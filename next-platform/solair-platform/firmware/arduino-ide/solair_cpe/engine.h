#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <esp_timer.h>
#include <soc/gpio_struct.h>
#include <esp_task_wdt.h>
#include <time.h>
#if __has_include("solair_config.h")
#include "solair_config.h"
#else
#include "config.example.h"
#endif
#include "modules.h"
static_assert(ALARM_DURATION_MS>0&&ALARM_DURATION_MS<=10000,"Bound the output duration");
static_assert(ACS_SENSITIVITY_V_PER_A>0,"ACS sensitivity must be positive");
Modules modules;Contact lid,mountContact;
SemaphoreHandle_t moduleMutex,queueMutex;QueueHandle_t eventQueue;
Preferences spool;String boot;uint32_t seq=0,eventSeq=0;std::atomic<uint32_t> dropped{0};
String frames[7],persisted[6];int frameCount=0;
portMUX_TYPE securityMux=portMUX_INITIALIZER_UNLOCKED;
bool armed=false,triggered=false,motionNow=false;volatile bool alarmActive=false;
uint32_t alarmGeneration=0;uint8_t alarmCauses=0;
struct AlarmEvent {const char* reason;uint32_t generation,uptime;time_t epoch;uint8_t causes;bool active;};
#ifndef LOCAL_ARM_PIN
#define LOCAL_ARM_PIN -1
#endif
// Optional physical control remains unassigned until the hardware lead approves a free pin.
Contact localArm;
// IRAM timer ISR de-energizes the verified GPIO independently of task/mutex/I/O waits.
// It is not a substitute for an electrically verified reset-safe driver/physical cutoff.
static_assert(ALARM_PIN>=0&&ALARM_PIN<32&&LED_PIN>=0&&LED_PIN<32,"ISR register bank must match the established pins");
hw_timer_t* outputTimer=nullptr;
void IRAM_ATTR outputCutoffISR(){portENTER_CRITICAL_ISR(&securityMux);alarmActive=false;if(ALARM_ACTIVE_HIGH)GPIO.out_w1tc=uint32_t(1)<<ALARM_PIN;else GPIO.out_w1ts=uint32_t(1)<<ALARM_PIN;GPIO.out_w1tc=uint32_t(1)<<LED_PIN;portEXIT_CRITICAL_ISR(&securityMux);}
uint32_t alarmSince=0;const char* alarmReason=nullptr;esp_timer_handle_t cutoff;
// Main loop alone owns contacts/commands; short critical sections protect alarmActive timer state.
int lidStable=HIGH,mountStable=HIGH;
void forceOff(void*){portENTER_CRITICAL(&securityMux);alarmActive=false;digitalWrite(ALARM_PIN,ALARM_ACTIVE_HIGH?LOW:HIGH);digitalWrite(LED_PIN,LOW);portEXIT_CRITICAL(&securityMux);}
void disarm(){if(outputTimer)timerAlarmDisable(outputTimer);esp_timer_stop(cutoff);portENTER_CRITICAL(&securityMux);armed=false;triggered=false;alarmActive=false;alarmReason=nullptr;alarmCauses=0;digitalWrite(ALARM_PIN,ALARM_ACTIVE_HIGH?LOW:HIGH);digitalWrite(LED_PIN,LOW);portEXIT_CRITICAL(&securityMux);}
void trigger(const char* reason){
 uint8_t bit=!strcmp(reason,"lid")?1:!strcmp(reason,"mount")?2:4;
 AlarmEvent event{};bool start=false;
 portENTER_CRITICAL(&securityMux);
 if(alarmCauses&bit){portEXIT_CRITICAL(&securityMux);return;}
 alarmCauses|=bit;
 if(!triggered){start=true;triggered=true;alarmActive=true;alarmReason=reason;alarmSince=millis();alarmGeneration++;digitalWrite(LED_PIN,HIGH);if(ENABLE_ALARM&&ALARM_POLARITY_VERIFIED)digitalWrite(ALARM_PIN,ALARM_ACTIVE_HIGH?HIGH:LOW);}
 event.reason=reason;event.generation=alarmGeneration;event.uptime=millis();event.causes=alarmCauses;event.active=alarmActive;
 portEXIT_CRITICAL(&securityMux);
 if(start&&outputTimer){timerWrite(outputTimer,0);timerAlarmEnable(outputTimer);}
 event.epoch=time(nullptr);
 if(start){esp_timer_stop(cutoff);if(esp_timer_start_once(cutoff,uint64_t(ALARM_DURATION_MS)*1000)!=ESP_OK)forceOff(nullptr);}
 if(xQueueSend(eventQueue,&event,0)!=pdTRUE)dropped++;
}
String utc(time_t t=time(nullptr)){if(t<1700000000)return "";tm v;gmtime_r(&t,&v);char s[24];strftime(s,sizeof(s),"%Y-%m-%dT%H:%M:%SZ",&v);return s;}
void persist(){int slot=0;for(int i=0;i<frameCount&&slot<6;i++){if(frames[i].indexOf("\"event_id\"")<0)continue;String key=String("e")+slot;if(persisted[slot]!=frames[i]){if(spool.putString(key.c_str(),frames[i])!=frames[i].length())dropped++;else persisted[slot]=frames[i];}slot++;}for(;slot<6;slot++)if(persisted[slot].length()){String key=String("e")+slot;if(spool.remove(key.c_str()))persisted[slot]="";else dropped++;}}
void enqueue(const String& frame,bool event){
 xSemaphoreTake(queueMutex,portMAX_DELAY);
 int eventCount=0;for(int i=0;i<frameCount;i++)if(frames[i].indexOf("\"event_id\"")>=0)eventCount++;
 if(event&&eventCount>=6){dropped++;xSemaphoreGive(queueMutex);return;}
 if(!event){for(int i=frameCount-1;i>=0;i--)if(frames[i].indexOf("\"event_id\"")<0){for(int j=i+1;j<frameCount;j++)frames[j-1]=frames[j];frameCount--;}}
 frames[frameCount++]=frame;if(event)persist();xSemaphoreGive(queueMutex);
}
void emitFrame(const AlarmEvent* event){
 JsonDocument d;d["schema_version"]=2;d["device_id"]=DEVICE_ID;d["firmware_version"]="solair-cpe-2.1.0";d["boot_id"]=boot;d["sequence"]=seq++;d["device_uptime_ms"]=millis();String ts=utc();if(ts.length())d["device_timestamp"]=ts;else d["device_timestamp"]=nullptr;
 d["source_type"]="hardware";d["transport"]="usb";auto h=d["sensor_health"].to<JsonObject>();
 xSemaphoreTake(moduleMutex,portMAX_DELAY);
 if(ENABLE_MPU&&modules.imuIdentity==0x70)d["firmware_version"]="solair-cpe-2.1.0/imu6500-compatible";
 h["mpu6050"]=!ENABLE_MPU||modules.imuIdentity==0x70?"absent":modules.mpuOK?"ok":"fault";
 h["mpu6500_compatible"]=!ENABLE_MPU||modules.imuIdentity!=0x70?"absent":modules.mpuOK?"ok":"fault";
 h["switches"]=ENABLE_SWITCHES?"ok":"absent";h["ads1115"]=!ENABLE_ADS?"absent":modules.adsOK?"ok":"fault";h["acs758"]=!ENABLE_ACS?"absent":!modules.acsOK?"fault":ACS_CALIBRATED?"ok":"uncalibrated";h["gps"]=!ENABLE_GPS?"absent":modules.fix()?"ok":"fault";h["pzem017"]=!ENABLE_PZEM?"absent":modules.pzemOK?"ok":"fault";h["lte"]=!ENABLE_LTE?"absent":modules.atDetected?"ok":"fault";h["wind"]="absent";h["event_buffer"]=dropped?"fault":"ok";
 if(modules.mpuOK){auto a=d["accelerometer"].to<JsonArray>();a.add(modules.accel.acceleration.x);a.add(modules.accel.acceleration.y);a.add(modules.accel.acceleration.z);auto g=d["gyroscope"].to<JsonArray>();g.add(modules.gyro.gyro.x*RAD_TO_DEG);g.add(modules.gyro.gyro.y*RAD_TO_DEG);g.add(modules.gyro.gyro.z*RAD_TO_DEG);}
 if(modules.adsOK){auto a=d["ads_raw"].to<JsonArray>();auto v=d["ads_voltage"].to<JsonArray>();for(int i=0;i<4;i++){a.add(modules.adsRaw[i]);v.add(modules.adsV[i]);}d["ads_gain"]="GAIN_ONE +/-4.096 V";}
 d["gps_fix"]=modules.fix();if(modules.fix()){d["latitude"]=modules.gps.location.lat();d["longitude"]=modules.gps.location.lng();d["gps_fix_age_ms"]=modules.gps.location.age();if(modules.gps.satellites.isValid())d["satellites"]=modules.gps.satellites.value();}
 auto c=d["cpe"].to<JsonObject>();c["load_mode"]=LOAD_MODE;c["historical"]=event!=nullptr;c["queue_dropped"]=dropped.load();
 c["meter_source"]=PZEM_SOURCE;
 c["mpu_raw"]=nullptr;if(modules.mpuOK){auto r=c["mpu_raw"].to<JsonArray>();for(int i=0;i<7;i++)r.add(modules.mpuRaw[i]);}
 auto p=c["pzem"].to<JsonObject>();p["quality"]=!ENABLE_PZEM?"unavailable":modules.pzemOK?"ok":"fault";
 for(const char* key:{"voltage_v","current_a","power_w","energy_wh","alarm_high","alarm_low"})p[key]=nullptr;
 if(modules.pzemOK){p["voltage_v"]=modules.meter.voltage;p["current_a"]=modules.meter.current;p["power_w"]=modules.meter.power;p["energy_wh"]=modules.meter.wh;p["alarm_high"]=modules.meter.high;p["alarm_low"]=modules.meter.low;}
 auto ac=c["acs"].to<JsonObject>();ac["quality"]=!ENABLE_ACS?"unavailable":!modules.acsOK?"fault":ACS_CALIBRATED?"ok":"uncalibrated";ac["current_a"]=nullptr;ac["adc_mv"]=nullptr;ac["zero_v"]=nullptr;ac["sensitivity_v_per_a"]=nullptr;if(ENABLE_ACS){ac["adc_mv"]=modules.acsMV;ac["zero_v"]=ACS_ZERO_V;ac["sensitivity_v_per_a"]=ACS_SENSITIVITY_V_PER_A;if(modules.acsOK&&ACS_CALIBRATED)ac["current_a"]=modules.acsCurrent;}
 if(ENABLE_ACS&&modules.acsOK){d["acs_output_v"]=modules.acsMV/1000*ACS_FRONTEND_SCALE;if(ACS_CALIBRATED)d["acs_zero_v"]=ACS_ZERO_V;}
 auto g=c["gps"].to<JsonObject>();g["quality"]=!ENABLE_GPS?"unavailable":modules.fix()?"ok":"fault";g["hdop"]=nullptr;if(modules.fix()&&modules.gps.hdop.isValid())g["hdop"]=modules.gps.hdop.hdop();g["checksum_failures"]=modules.gps.failedChecksum();g["software_uart_overflows"]=modules.gpsOverflows;
 auto l=c["lte"].to<JsonObject>();l["quality"]=!ENABLE_LTE?"unavailable":modules.atDetected?"ok":"fault";l["at_detected"]=modules.atDetected;l["registered"]=modules.atDetected&&modules.registered;l["attached"]=modules.atDetected&&modules.registered&&modules.attached;l["rssi"]=nullptr;if(modules.rssi>=0)l["rssi"]=modules.rssi;l["uplink_commissioned"]=LTE_HTTP_BENCH_COMMISSIONED;d["lte_registration"]=modules.registered?"registered":"not registered";if(modules.rssi>=0)d["lte_signal_quality"]=modules.rssi;
 auto ages=d["sensor_age_ms"].to<JsonObject>();uint32_t captured=millis();
 if(modules.mpuOK)ages["imu"]=uint32_t(captured-modules.imuSampleAt);
 if(modules.adsOK){uint32_t oldest=0;for(int i=0;i<4;i++)oldest=max(oldest,uint32_t(captured-modules.adsSampleAt[i]));ages["ads1115"]=oldest;}
 if(modules.acsOK)ages["acs758"]=uint32_t(captured-modules.acsSampleAt);
 if(modules.pzemOK)ages["pzem017"]=uint32_t(captured-modules.pzemSampleAt);
 if(modules.fix())ages["gps"]=modules.gps.location.age();
 xSemaphoreGive(moduleMutex);
 bool armedCopy,alarmCopy,motionCopy;int lidCopy,mountCopy;const char* reasonCopy;
 portENTER_CRITICAL(&securityMux);armedCopy=armed;alarmCopy=alarmActive;motionCopy=motionNow;lidCopy=lidStable;mountCopy=mountStable;reasonCopy=alarmReason;portEXIT_CRITICAL(&securityMux);
 d["armed"]=armedCopy;d["alarm_active"]=event?event->active:alarmCopy;d["motion_detected"]=motionCopy;if(ENABLE_SWITCHES){d["lid_raw"]=lidCopy;d["mount_raw"]=mountCopy;d["lid_state"]=lidCopy==LOW?"secure":"tampered";d["mount_state"]=mountCopy==LOW?"secure":"tampered";}auto a=c["alarm"].to<JsonObject>();a["commanded"]=alarmCopy&&ENABLE_ALARM&&ALARM_POLARITY_VERIFIED;a["output_level"]=nullptr;if(ALARM_POLARITY_VERIFIED)a["output_level"]=(alarmCopy&&ENABLE_ALARM)==ALARM_ACTIVE_HIGH?1:0;a["feedback"]=nullptr;if(reasonCopy)a["reason"]=reasonCopy;else a["reason"]=nullptr;a["duration_ms"]=ALARM_DURATION_MS;
 d["siren_verified"]=ALARM_POLARITY_VERIFIED;d["calibration_status"]="unverified";
 uint32_t generation;uint8_t causes;
 portENTER_CRITICAL(&securityMux);generation=alarmGeneration;causes=alarmCauses;portEXIT_CRITICAL(&securityMux);
 if(event){String occurred=utc(event->epoch);if(occurred.length())d["event_timestamp"]=occurred;else d["event_timestamp"]=nullptr;d["event_uptime_ms"]=event->uptime;generation=event->generation;causes=event->causes;d["event_id"]=String(eventSeq++);d["event_type"]=event->reason;}
 if(generation){d["alarm_id"]=String(generation);auto list=d["alarm_causes"].to<JsonArray>();if(causes&1)list.add("lid");if(causes&2)list.add("mount");if(causes&4)list.add("motion");}
 String s;serializeJson(d,s);Serial.println(s);d["transport"]="wifi";s="";serializeJson(d,s);enqueue(s,event!=nullptr);
}
bool privateBenchURL(){String u=INGEST_URL;if(!ALLOW_PRIVATE_BENCH_HTTP||!u.startsWith("http://"))return false;int end=u.indexOf('/',7);String host=u.substring(7,end<0?u.length():end);int colon=host.indexOf(':');if(colon>=0)host=host.substring(0,colon);IPAddress ip;if(!ip.fromString(host))return false;return ip[0]==10||(ip[0]==192&&ip[1]==168)||(ip[0]==172&&ip[1]>=16&&ip[1]<=31);}
bool acknowledged(const String& frame,const String& response){JsonDocument sent,receipt;if(deserializeJson(sent,frame)||deserializeJson(receipt,response))return false;return receipt["ack"]["persisted"]==true&&receipt["ack"]["device_id"].as<String>()==sent["device_id"].as<String>()&&receipt["ack"]["boot_id"].as<String>()==sent["boot_id"].as<String>()&&receipt["ack"]["sequence"].as<uint32_t>()==sent["sequence"].as<uint32_t>();}
int wifiPost(const String& frame){HTTPClient http;http.setConnectTimeout(1500);http.setTimeout(2500);WiFiClient plain;WiFiClientSecure tls;String url=INGEST_URL;bool opened=false;if(url.startsWith("https://")&&strlen(ROOT_CA)){tls.setCACert(ROOT_CA);opened=http.begin(tls,url);}else if(privateBenchURL())opened=http.begin(plain,url);if(!opened)return -1;http.addHeader("Content-Type","application/json");http.addHeader("Authorization",String("Bearer ")+DEVICE_TOKEN);int status=http.POST(frame);if(status>=200&&status<300){if(http.getSize()>2048)status=-2;else if(!acknowledged(frame,http.getString()))status=-2;}http.end();return status;}
// Modem command waits occur in transport task, never the security loop. Do not log tokens/HTTP frames.
bool waitAT(const char* expected,uint32_t timeout){String response;uint32_t start=millis();while(uint32_t(millis()-start)<timeout){while(modules.modem.available()){char c=modules.modem.read();if(response.length()>1000)response.remove(0,500);response+=c;if(response.indexOf(expected)>=0)return true;if(response.indexOf("ERROR")>=0)return false;}vTaskDelay(pdMS_TO_TICKS(10));}return false;}
bool atCommand(const String& s,const char* expected="OK",uint32_t timeout=2000){while(modules.modem.available())modules.modem.read();modules.modem.println(s);return waitAT(expected,timeout);}
int httpAction(){modules.modem.println("AT+HTTPACTION=1");String line;uint32_t start=millis();while(uint32_t(millis()-start)<15000){while(modules.modem.available()){char ch=modules.modem.read();if(ch=='\n'){line.trim();if(line.startsWith("+HTTPACTION:")){int a=line.indexOf(','),b=line.indexOf(',',a+1);return a>0&&b>a?line.substring(a+1,b).toInt():-1;}if(line=="ERROR")return -1;line="";}else if(line.length()<200)line+=ch;}vTaskDelay(pdMS_TO_TICKS(10));}return -1;}
int ltePost(String frame){
 if(!ENABLE_LTE||!LTE_HTTP_BENCH_COMMISSIONED||!privateBenchURL())return -1;
 JsonDocument d;if(deserializeJson(d,frame))return -1;d["transport"]="lte";frame="";serializeJson(d,frame);
 // Carrier-specific HTTPS CA setup is intentionally not bypassed. This path is isolated HTTP bench only.
 atCommand("AT+HTTPTERM");if(!atCommand("AT+HTTPINIT"))return -1;
 bool ok=atCommand(String("AT+HTTPPARA=\"URL\",\"")+INGEST_URL+"\"")&&atCommand("AT+HTTPPARA=\"CONTENT\",\"application/json\"")&&atCommand(String("AT+HTTPPARA=\"USERDATA\",\"Authorization: Bearer ")+DEVICE_TOKEN+"\"")&&atCommand(String("AT+HTTPDATA=")+frame.length()+",10000","DOWNLOAD");
 int status=-1;if(ok){modules.modem.print(frame);if(waitAT("OK",11000))status=httpAction();}
 if(status>=200&&status<300){modules.modem.println("AT+HTTPREAD");String body;uint32_t began=millis();while(uint32_t(millis()-began)<3000){while(modules.modem.available()){char ch=modules.modem.read();if(body.length()<2048)body+=ch;}if(body.indexOf("\nOK")>=0)break;vTaskDelay(pdMS_TO_TICKS(10));}int first=body.indexOf('{'),last=body.lastIndexOf('}');if(first<0||last<first||!acknowledged(frame,body.substring(first,last+1)))status=-2;}
 atCommand("AT+HTTPTERM");return status;
}
void transportTask(void*){
 uint32_t lastWiFi=0,nextTry=0;uint32_t backoff=500;
 for(;;){uint32_t now=millis();xSemaphoreTake(moduleMutex,portMAX_DELAY);modules.pollLTE(now);bool cellularReady=modules.atDetected&&modules.registered&&modules.attached;xSemaphoreGive(moduleMutex);
  if(strlen(WIFI_SSID)&&WiFi.status()!=WL_CONNECTED&&uint32_t(now-lastWiFi)>=15000){lastWiFi=now;WiFi.begin(WIFI_SSID,WIFI_PASSWORD);}
  if(int32_t(now-nextTry)>=0&&strlen(DEVICE_TOKEN)){
   xSemaphoreTake(queueMutex,portMAX_DELAY);String frame=frameCount?frames[0]:"";xSemaphoreGive(queueMutex);
   if(frame.length()){int status=WiFi.status()==WL_CONNECTED?wifiPost(frame):cellularReady?ltePost(frame):-1;
    if(status>=200&&status<300){xSemaphoreTake(queueMutex,portMAX_DELAY);if(frameCount&&frames[0]==frame){bool event=frame.indexOf("\"event_id\"")>=0;for(int i=1;i<frameCount;i++)frames[i-1]=frames[i];frameCount--;if(event)persist();}xSemaphoreGive(queueMutex);backoff=500;}
    else {backoff=min(uint32_t(30000),backoff*2);Serial.printf("# INGEST status=%d queued=%d; no acknowledgement on conflict/error\n",status,frameCount);}nextTry=millis()+backoff;
   }
  }vTaskDelay(pdMS_TO_TICKS(20));
 }
}
void acquisitionTask(void*){uint32_t reportAt=0;for(;;){uint32_t now=millis();xSemaphoreTake(moduleMutex,portMAX_DELAY);modules.pollSensors(now);bool motion=modules.mpuOK&&(fabsf(sqrtf(sq(modules.accel.acceleration.x)+sq(modules.accel.acceleration.y)+sq(modules.accel.acceleration.z))-9.80665f)>MOTION_DELTA_MPS2||sqrtf(sq(modules.gyro.gyro.x)+sq(modules.gyro.gyro.y)+sq(modules.gyro.gyro.z))>MOTION_GYRO_RAD_S);xSemaphoreGive(moduleMutex);portENTER_CRITICAL(&securityMux);motionNow=motion;portEXIT_CRITICAL(&securityMux);AlarmEvent event{};if(xQueueReceive(eventQueue,&event,0)==pdTRUE)emitFrame(&event);else if(uint32_t(now-reportAt)>=2000){reportAt=now;emitFrame(nullptr);}vTaskDelay(pdMS_TO_TICKS(5));}}
void setup(){
 Serial.begin(115200);digitalWrite(ALARM_PIN,ALARM_ACTIVE_HIGH?LOW:HIGH);pinMode(ALARM_PIN,OUTPUT);digitalWrite(LED_PIN,LOW);pinMode(LED_PIN,OUTPUT);
 moduleMutex=xSemaphoreCreateMutex();queueMutex=xSemaphoreCreateMutex();eventQueue=xQueueCreate(16,sizeof(AlarmEvent));esp_timer_create_args_t args={};args.callback=forceOff;args.name="alarmActive-cutoff";
 outputTimer=timerBegin(0,80,true);if(outputTimer){timerAttachInterrupt(outputTimer,&outputCutoffISR,true);timerAlarmWrite(outputTimer,uint64_t(ALARM_DURATION_MS)*1000,false);timerAlarmDisable(outputTimer);}
 if(!outputTimer||!moduleMutex||!queueMutex||!eventQueue||esp_timer_create(&args,&cutoff)!=ESP_OK){forceOff(nullptr);Serial.println("# FATAL resources; outputs OFF");while(true)delay(1000);}
 if(ENABLE_SWITCHES){lid.begin(LID_PIN);mountContact.begin(MOUNT_PIN);}
 if(LOCAL_ARM_PIN>=0)localArm.begin(LOCAL_ARM_PIN);
 boot=String(esp_random(),HEX)+String(esp_random(),HEX)+String(esp_random(),HEX);spool.begin("solair-cpe-v2",false);for(int i=0;i<6;i++){String key=String("e")+i;String f=spool.getString(key.c_str(),"");JsonDocument stored;if(f.length()&&!deserializeJson(stored,f)&&stored["schema_version"]==2&&!stored["event_id"].isNull()&&stored["device_id"]==DEVICE_ID){frames[frameCount++]=f;persisted[i]=f;}}
 modules.begin();WiFi.mode(WIFI_STA);if(strlen(WIFI_SSID)){WiFi.begin(WIFI_SSID,WIFI_PASSWORD);configTime(0,0,"pool.ntp.org","time.cloudflare.com");}
 if(xTaskCreatePinnedToCore(acquisitionTask,"acquisition",12288,nullptr,1,nullptr,0)!=pdPASS||xTaskCreatePinnedToCore(transportTask,"transport",12288,nullptr,1,nullptr,0)!=pdPASS){forceOff(nullptr);Serial.println("# FATAL task startup");while(true)delay(1000);}
 esp_task_wdt_init(5,true);esp_task_wdt_add(nullptr);Serial.println("# SOLAIR CPE v2 DISARMED; ARM/DISARM newline 115200; module flags are commissioning gates");
}
void loop(){
 static String cmd;static uint32_t motionStart=0,ledUntil=0;
 esp_task_wdt_reset();uint32_t now=millis();
 if(ENABLE_SWITCHES){lid.poll(now);mountContact.poll(now);portENTER_CRITICAL(&securityMux);lidStable=lid.stable;mountStable=mountContact.stable;portEXIT_CRITICAL(&securityMux);}
 unsigned count=0;while(Serial.available()&&count++<128){char ch=Serial.read();if(ch=='\n'){cmd.trim();if(cmd.startsWith("{")){JsonDocument d;if(!deserializeJson(d,cmd)){String c=d["command"]|"";if(c=="arm")cmd="ARM";else if(c=="disarm"||c=="alarm_off")cmd="DISARM";else if(c=="led_test")cmd="LED";}}
   if(cmd=="DISARM"){disarm();Serial.println("# DISARMED output OFF");}
   else if(cmd=="SENSORS OFF"){modules.running=false;Serial.println("# acquisition paused; contacts/security remain active");}
   else if(cmd=="SENSORS ON"){modules.running=true;Serial.println("# acquisition resumed for compile-time commissioned modules only");}
   else if(cmd=="ARM"){if(!ENABLE_SWITCHES||now<10000||lid.stable!=LOW||mountContact.stable!=LOW||triggered)Serial.println("# ARM_REJECTED: wait 10 seconds, secure contacts, DISARM latch");else {armed=true;Serial.println("# ARMED locally");}}
   else if(cmd=="LED"&&!alarmActive){digitalWrite(LED_PIN,HIGH);ledUntil=now+300;}
   else Serial.println("# Unknown command; motion calibration uses measured configuration, not auto-approval");cmd="";
  }else if(cmd.length()<512)cmd+=ch;else cmd="";
 }
 if(ledUntil&&int32_t(now-ledUntil)>=0){if(!alarmActive)digitalWrite(LED_PIN,LOW);ledUntil=0;}
 if(LOCAL_ARM_PIN>=0){localArm.poll(now);if(localArm.transition&&localArm.stable==HIGH)disarm();else if(localArm.transition&&localArm.stable==LOW&&now>=10000&&ENABLE_SWITCHES&&lid.stable==LOW&&mountContact.stable==LOW&&!triggered)armed=true;}
 if(armed){if(ENABLE_SWITCHES&&lid.stable==HIGH)trigger("lid");if(ENABLE_SWITCHES&&mountContact.stable==HIGH)trigger("mount");if(ENABLE_MOTION&&MOTION_CALIBRATED&&motionNow){if(!motionStart)motionStart=now;if(uint32_t(now-motionStart)>=200)trigger("motion");}else motionStart=0;}
 // Backup cutoff independent of networking/sensor work. Physical reset-safe OFF still requires the interface circuit.
 if(alarmActive&&uint32_t(now-alarmSince)>=ALARM_DURATION_MS)forceOff(nullptr);
 vTaskDelay(pdMS_TO_TICKS(2));
}

