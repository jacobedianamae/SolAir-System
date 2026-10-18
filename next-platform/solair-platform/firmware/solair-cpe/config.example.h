#pragma once
// Copy to ignored solair_config.h AFTER the corresponding electrical gate passes.
#define DEVICE_ID "SOL-ET-01"
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define DEVICE_TOKEN ""
#define INGEST_URL "https://YOUR-DOMAIN/api/ingest"
#define ROOT_CA ""
// Private RFC1918 HTTP only for isolated local bench. Production uses verified HTTPS.
#define ALLOW_PRIVATE_BENCH_HTTP false
#define ENABLE_MPU false
#define MPU_ADDRESS 0x68
// Test01 can exercise reported ID0x70. Enable in combined/final ONLY after real
// changing accel/gyro and stationary gravity checks pass; no authenticity claim.
#define ALLOW_MPU6500_COMPAT false
#define ENABLE_SWITCHES false
#define ENABLE_ADS false
#define ENABLE_ACS false
#define ENABLE_GPS false
#define ENABLE_PZEM false
#define ENABLE_LTE false
#define ENABLE_MOTION false
#define MOTION_CALIBRATED false
#define MOTION_DELTA_MPS2 4.0f
#define MOTION_GYRO_RAD_S 1.5f
#define ENABLE_ALARM false
#define ALARM_POLARITY_VERIFIED false
#define ALARM_ACTIVE_HIGH true
// Team measured GPIO27 OFF ~0 V, ON ~3.0–3.3 V on 11 Oct 2026.
// Keep active-HIGH. Reset/power-up safe-OFF is still unrecorded; gate stays false.
#define ALARM_DURATION_MS 5000
#define ACS_CALIBRATED false
#define ACS_ZERO_V 2.5f
#define ACS_SENSITIVITY_V_PER_A 0.04f
// Actual sensor Vout / conditioned voltage at GPIO34; measure your divider/buffer.
#define ACS_FRONTEND_SCALE 1.0f
#define PZEM_ADDRESS 1
#define LTE_BAUD 115200
#define LOAD_MODE "unknown"
#define PZEM_SOURCE "unknown" // bench_supply for adapter tests; mppt_output only at actual controller output.
// Packet fallback uses carrier A76XX HTTP commands, isolated private HTTP only.
// Set true ONLY after USB AT, UART/registration and actual POST acceptance tests.
// HTTPS modem uplink remains disabled until carrier-specific CA provisioning is verified.
#define LTE_HTTP_BENCH_COMMISSIONED false

// No physical arming pin is assigned. Verify wiring and free-pin use before setting.
#define LOCAL_ARM_PIN -1
