#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_ADS1X15.h>
#include <TinyGPSPlus.h>
#include <SoftwareSerial.h>
#include <atomic>
#include "pins.h"
#include "protocol.h"
#include "imu6500.h"
#ifndef ALLOW_MPU6500_COMPAT
#define ALLOW_MPU6500_COMPAT false
#endif
#if (defined(TEST_STAGE) && TEST_STAGE == 1) || defined(SOLAIR_COMPILE_ALL)
#undef ALLOW_MPU6500_COMPAT
#define ALLOW_MPU6500_COMPAT true
#endif
struct ImuWireIo {
 bool read(uint8_t reg,uint8_t* out,size_t size){
  Wire.beginTransmission(MPU_ADDRESS);Wire.write(reg);if(Wire.endTransmission(false)!=0)return false;
  if(Wire.requestFrom(int(MPU_ADDRESS),int(size))!=int(size)){while(Wire.available())Wire.read();return false;}
  for(size_t i=0;i<size;i++){if(!Wire.available())return false;out[i]=Wire.read();}return true;
 }
 bool write(uint8_t reg,uint8_t value){Wire.beginTransmission(MPU_ADDRESS);Wire.write(reg);Wire.write(value);return Wire.endTransmission()==0;}
};
#if defined(SOLAIR_COMPILE_ALL)
#undef ENABLE_MPU
#undef ENABLE_SWITCHES
#undef ENABLE_ADS
#undef ENABLE_ACS
#undef ENABLE_GPS
#undef ENABLE_PZEM
#undef ENABLE_LTE
#undef ENABLE_MOTION
#define ENABLE_MPU true
#define ENABLE_SWITCHES true
#define ENABLE_ADS true
#define ENABLE_ACS true
#define ENABLE_GPS true
#define ENABLE_PZEM true
#define ENABLE_LTE true
#define ENABLE_MOTION true
#endif
struct Contact {
 int pin,raw=HIGH,stable=HIGH;uint32_t changed=0;bool transition=false;
 void begin(int p){pin=p;pinMode(p,INPUT_PULLUP);raw=stable=digitalRead(p);}
 void poll(uint32_t now){transition=false;int v=digitalRead(pin);if(v!=raw){raw=v;changed=now;}if(v!=stable&&uint32_t(now-changed)>=50){stable=v;transition=true;}}
};
struct Modules {
 std::atomic<bool> running{true};
 Adafruit_MPU6050 mpu;Adafruit_ADS1115 ads;TinyGPSPlus gps;
 ImuWireIo imuIo;Imu6500<ImuWireIo> imu6500{imuIo};int imuIdentity=-1;uint32_t identityAt=0;
 EspSoftwareSerial::UART gpsUart;HardwareSerial rs{1},modem{2};
 bool mpuOK=false,adsOK=false,pzemOK=false;bool mpuSeen=false,adsSeen=false;
 sensors_event_t accel{},gyro{},temp{};int16_t adsRaw[4]={};float adsV[4]={};
 int16_t mpuRaw[7]={};float acsMV=0,acsCurrent=0;bool acsOK=false;
 uint32_t imuAt=0,adsAt=0,acsAt=0,pzemAt=0,rsSent=0,gpsByteAt=0;int adsChannel=0;
 uint32_t adsStarted=0,adsSamples=0;uint8_t adsMask=0;
 uint32_t imuSampleAt=0,acsSampleAt=0,pzemSampleAt=0,adsSampleAt[4]={};
 uint8_t rsBytes[64];size_t rsCount=0;bool rsPending=false,rsRangeQuery=false,shunt50OK=false;uint32_t shuntAt=0;PzemReading meter{};
 uint32_t gpsOverflows=0;bool atDetected=false,registered=false,attached=false;
 int rssi=-1;uint32_t lteAt=0,lteResponseAt=0;int lteStep=0;String lteLine;
 void begin(){
  Wire.begin(SDA_PIN,SCL_PIN,100000);Wire.setTimeOut(20);
  if(ENABLE_MPU){uint8_t id=0;if(imuIo.read(0x75,&id,1))imuIdentity=id;if(imuIdentity==0x68){mpuOK=mpu.begin(MPU_ADDRESS);mpuSeen=mpuOK;if(mpuOK){mpu.setAccelerometerRange(MPU6050_RANGE_4_G);mpu.setGyroRange(MPU6050_RANGE_500_DEG);}}}
  if(ENABLE_ADS){adsSeen=ads.begin(0x48);adsOK=false;if(adsSeen){ads.setGain(GAIN_ONE);adsChannel=0;adsMask=0;ads.startADCReading(ADS1X15_REG_CONFIG_MUX_SINGLE_0,false);adsStarted=millis();}}
  if(ENABLE_ACS){analogReadResolution(12);analogSetPinAttenuation(ACS_PIN,ADC_11db);}
  if(ENABLE_GPS)gpsUart.begin(9600,SWSERIAL_8N1,GPS_RX,-1,false,512,512);
  if(ENABLE_PZEM){pinMode(RS_DIR,OUTPUT);digitalWrite(RS_DIR,LOW);rs.begin(9600,SERIAL_8N2,RS_RX,RS_TX);}
  if(ENABLE_LTE)modem.begin(LTE_BAUD,SERIAL_8N1,LTE_RX,LTE_TX);
 }
 bool present(uint8_t addr){Wire.beginTransmission(addr);return Wire.endTransmission()==0;}
 const char* imuProfile(){return imuIdentity==0x68?"mpu6050":imuIdentity==0x70?"mpu6500_compatible":"unknown";}
 void pollSensors(uint32_t now){
  if(!running){mpuOK=adsOK=pzemOK=acsOK=false;return;}
  if(ENABLE_MPU&&uint32_t(now-imuAt)>=50){imuAt=now;
   if(imuIdentity<0||uint32_t(now-identityAt)>=1000){identityAt=now;uint8_t id=0;int previous=imuIdentity;imuIdentity=imuIo.read(0x75,&id,1)?id:-1;if(previous!=imuIdentity)mpuSeen=false;}
   mpuOK=false;
   if(imuIdentity==0x70&&ALLOW_MPU6500_COMPAT){
    Imu6500Sample sample{};mpuOK=imu6500.poll(now,sample);mpuSeen=imu6500.initialized();
    if(mpuOK){for(int i=0;i<7;i++)mpuRaw[i]=sample.raw[i];accel.acceleration.x=sample.accel[0];accel.acceleration.y=sample.accel[1];accel.acceleration.z=sample.accel[2];gyro.gyro.x=sample.gyro[0];gyro.gyro.y=sample.gyro[1];gyro.gyro.z=sample.gyro[2];}
   }else if(imuIdentity==0x68){
    mpuOK=present(MPU_ADDRESS);if(mpuOK&&!mpuSeen){mpuOK=mpu.begin(MPU_ADDRESS);mpuSeen=mpuOK;if(mpuOK){mpu.setAccelerometerRange(MPU6050_RANGE_4_G);mpu.setGyroRange(MPU6050_RANGE_500_DEG);}}
    if(mpuOK){mpu.getEvent(&accel,&gyro,&temp);uint8_t bytes[14];mpuOK=imuIo.read(0x3b,bytes,sizeof(bytes));if(mpuOK)for(int i=0;i<7;i++)mpuRaw[i]=int16_t((uint16_t(bytes[i*2])<<8)|bytes[i*2+1]);}
   }
   if(mpuOK)imuSampleAt=millis();
  }
  if(ENABLE_ADS&&uint32_t(now-adsAt)>=20){adsAt=now;
   if(!present(0x48)){adsOK=false;adsSeen=false;adsMask=0;}
   else{
    if(!adsSeen){adsSeen=ads.begin(0x48);adsOK=false;adsMask=0;adsChannel=0;if(adsSeen){ads.setGain(GAIN_ONE);ads.startADCReading(ADS1X15_REG_CONFIG_MUX_SINGLE_0,false);adsStarted=now;}}
    // OS completion polling is for single-shot mode; continuous mode stays busy.
    if(adsSeen&&ads.conversionComplete()){
     adsRaw[adsChannel]=ads.getLastConversionResults();adsV[adsChannel]=ads.computeVolts(adsRaw[adsChannel]);adsSampleAt[adsChannel]=millis();adsSamples++;adsMask|=uint8_t(1u<<adsChannel);adsOK=adsMask==15;
     adsChannel=(adsChannel+1)%4;ads.startADCReading(ADS1X15_REG_CONFIG_MUX_SINGLE_0+(adsChannel<<12),false);adsStarted=now;
    }else if(adsSeen&&uint32_t(now-adsStarted)>200){adsOK=false;adsSeen=false;adsMask=0;}
   }
  }
  if(ENABLE_ACS&&uint32_t(now-acsAt)>=50){acsAt=now;acsMV=analogReadMilliVolts(ACS_PIN);acsOK=acsMV>20&&acsMV<3250;acsCurrent=((acsMV/1000.0f)*ACS_FRONTEND_SCALE-ACS_ZERO_V)/ACS_SENSITIVITY_V_PER_A;if(!isfinite(acsCurrent)||fabsf(acsCurrent)>50)acsOK=false;if(acsOK)acsSampleAt=millis();}
  if(ENABLE_GPS){unsigned count=0;while(gpsUart.available()&&count++<256){gpsByteAt=now;char b=gpsUart.read();gps.encode(b);
#if defined(TEST_STAGE) && TEST_STAGE == 7
    Serial.write(b);
#endif
   }if(gpsUart.overflow())gpsOverflows++;}
  if(ENABLE_PZEM)pollRS(now);
 }
 bool fix(){return running&&ENABLE_GPS&&gps.location.isValid()&&gps.location.age()<=30000&&uint32_t(millis()-gpsByteAt)<5000;}
 void pollRS(uint32_t now){
  while(rs.available()){int c=rs.read();if(rsCount<sizeof(rsBytes))rsBytes[rsCount++]=c;}
  if(rsPending&&rsCount>=(rsRangeQuery?7u:21u)){
   if(rsRangeQuery){shunt50OK=decodePzem50A(rsBytes,rsCount,PZEM_ADDRESS);shuntAt=now;if(!shunt50OK)pzemOK=false;}
   else {pzemOK=shunt50OK&&decodePzem(rsBytes,rsCount,PZEM_ADDRESS,meter);if(pzemOK)pzemSampleAt=millis();}
   rsPending=false;
  }
  if(rsPending&&uint32_t(now-rsSent)>350){rsPending=false;pzemOK=false;if(rsRangeQuery)shunt50OK=false;}
  if(!rsPending&&uint32_t(now-pzemAt)>=2000){
   pzemAt=now;rsCount=0;while(rs.available())rs.read();
   rsRangeQuery=!shunt50OK||uint32_t(now-shuntAt)>=30000;
   uint8_t q[8]={PZEM_ADDRESS,uint8_t(rsRangeQuery?3:4),0,uint8_t(rsRangeQuery?3:0),0,uint8_t(rsRangeQuery?1:8),0,0};
   uint16_t crc=modbusCRC(q,6);q[6]=crc&255;q[7]=crc>>8;digitalWrite(RS_DIR,HIGH);rs.write(q,8);rs.flush();digitalWrite(RS_DIR,LOW);rsSent=millis();rsPending=true;
  }
 }
 // Called ONLY by transport task; modem UART has one owner.
 void pollLTE(uint32_t now){
  if(!ENABLE_LTE)return;unsigned count=0;
  while(modem.available()&&count++<512){char c=modem.read();if(c=='\n'){
    lteLine.trim();if(lteLine=="OK"){atDetected=true;lteResponseAt=now;}
    if(lteLine.startsWith("+CEREG:")){int comma=lteLine.indexOf(',');int status=lteLine.substring(comma>=0?comma+1:7).toInt();registered=status==1||status==5;}
    if(lteLine.startsWith("+CGATT:"))attached=lteLine.substring(7).toInt()==1;
    if(lteLine.startsWith("+CSQ:")){int v=lteLine.substring(5).toInt();rssi=v>=0&&v<=31?v:-1;} // 99 means unknown, never a strong signal.
    lteLine="";
   }else if(lteLine.length()<180)lteLine+=c;
  }
  if(uint32_t(now-lteResponseAt)>30000){atDetected=false;registered=false;attached=false;rssi=-1;}
  if(uint32_t(now-lteAt)>=3000){lteAt=now;const char* cmds[]={"AT","AT+CPIN?","AT+CSQ","AT+CEREG?","AT+CGATT?"};modem.println(cmds[lteStep++%5]);}
 }
};
