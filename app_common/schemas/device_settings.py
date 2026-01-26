"""
Device Settings Schemas

Pydantic schemas for device settings management and synchronization.
Field names match device's cJSON keys exactly.
"""
from datetime import datetime
from typing import Optional
from enum import IntEnum

from pydantic import BaseModel, Field

from app_common.models.device_settings import DeviceMode, WifiAuthMode, SettingSyncStatus


# ===== Enums =====

class DeviceModeEnum(IntEnum):
    """Device operating mode"""
    SETUP = 0
    WIFI = 1
    ZIGBEE = 2


class WifiAuthModeEnum(IntEnum):
    """WiFi authentication mode"""
    OPEN = 0
    WEP = 1
    WPA_PSK = 2
    WPA2_PSK = 3
    WPA_WPA2_PSK = 4
    WPA2_ENTERPRISE = 5
    WPA3_PSK = 6
    WPA2_WPA3_PSK = 7


# ===== Base Settings Schema =====

class DeviceSettingsBase(BaseModel):
    """Base device settings schema - matches device cJSON fields exactly"""
    
    # WiFi
    wifi_ssid: Optional[str] = Field(None, max_length=64, description="WiFi SSID")
    wifi_pass: Optional[str] = Field(None, max_length=128, description="WiFi password")
    wifi_auth: int = Field(WifiAuthModeEnum.WPA2_PSK, description="WiFi auth mode")
    
    # Device mode
    device_mode: int = Field(DeviceModeEnum.SETUP, description="Device operating mode")
    
    # Flags
    allow_unencrypted_ble: bool = Field(False, description="Allow unencrypted BLE")
    lte_enabled: bool = Field(False, description="Enable LTE modem")
    ble_enabled: bool = Field(True, description="Enable Bluetooth")
    power_management_enabled: bool = Field(False, description="Enable power management")
    
    # Sensor flags
    pms5003_indoor: bool = Field(False, description="PMS5003 indoor mode")
    pms5003_enabled: bool = Field(True, description="PMS5003 sensor enabled")
    bmp280_enabled: bool = Field(True, description="BMP280 sensor enabled")
    dht22_enabled: bool = Field(True, description="DHT22 sensor enabled")
    
    # Sensor measurement intervals (seconds)
    pms5003_measurement_interval: int = Field(300, ge=10, le=86400, description="PMS5003 interval")
    bmp280_measurement_interval: int = Field(300, ge=10, le=86400, description="BMP280 interval")
    dht22_measurement_interval: int = Field(300, ge=10, le=86400, description="DHT22 interval")
    
    # LED
    led_brightness: int = Field(100, ge=0, le=255, description="LED brightness")
    
    # SIM
    sim_pin: Optional[int] = Field(None, ge=0, le=9999, description="SIM PIN")
    
    # Sensor settings
    bmp280_settings: int = Field(0, description="BMP280 sensor settings")
    
    # Global measurement intervals (seconds)
    measurement_interval_day_sec: int = Field(300, ge=10, le=86400, description="Day measurement interval")
    measurement_interval_night_sec: int = Field(900, ge=10, le=86400, description="Night measurement interval")
    
    # Daytime boundaries (seconds from midnight)
    daytime_start_sec: int = Field(21600, ge=0, le=86400, description="Daytime start (6:00 AM = 21600)")
    daytime_end_sec: int = Field(79200, ge=0, le=86400, description="Daytime end (22:00 = 79200)")
    
    # Owner
    owner_user_id: Optional[int] = Field(None, description="Owner user ID")

    class Config:
        from_attributes = True


class DeviceSettingsRead(DeviceSettingsBase):
    """Device settings response schema with metadata"""
    id: int
    device_id: int
    last_sync_at: Optional[datetime] = None
    sync_status: SettingSyncStatus = SettingSyncStatus.SYNCED
    
    # Pending values (for admin/debug view)
    wifi_ssid_pending: Optional[str] = None
    wifi_pass_pending: Optional[str] = None
    wifi_auth_pending: Optional[int] = None
    device_mode_pending: Optional[int] = None
    allow_unencrypted_ble_pending: Optional[bool] = None
    lte_enabled_pending: Optional[bool] = None
    ble_enabled_pending: Optional[bool] = None
    power_management_enabled_pending: Optional[bool] = None
    pms5003_indoor_pending: Optional[bool] = None
    pms5003_enabled_pending: Optional[bool] = None
    bmp280_enabled_pending: Optional[bool] = None
    dht22_enabled_pending: Optional[bool] = None
    pms5003_measurement_interval_pending: Optional[int] = None
    bmp280_measurement_interval_pending: Optional[int] = None
    dht22_measurement_interval_pending: Optional[int] = None
    led_brightness_pending: Optional[int] = None
    sim_pin_pending: Optional[int] = None
    bmp280_settings_pending: Optional[int] = None
    measurement_interval_day_sec_pending: Optional[int] = None
    measurement_interval_night_sec_pending: Optional[int] = None
    daytime_start_sec_pending: Optional[int] = None
    daytime_end_sec_pending: Optional[int] = None
    owner_user_id_pending: Optional[int] = None
    
    has_pending_changes: bool = False


class DeviceSettingsUpdate(BaseModel):
    """Schema for updating device settings (sets pending values)"""
    
    wifi_ssid: Optional[str] = Field(None, max_length=64)
    wifi_pass: Optional[str] = Field(None, max_length=128)
    wifi_auth: Optional[int] = None
    device_mode: Optional[int] = None
    allow_unencrypted_ble: Optional[bool] = None
    lte_enabled: Optional[bool] = None
    ble_enabled: Optional[bool] = None
    power_management_enabled: Optional[bool] = None
    pms5003_indoor: Optional[bool] = None
    pms5003_enabled: Optional[bool] = None
    bmp280_enabled: Optional[bool] = None
    dht22_enabled: Optional[bool] = None
    pms5003_measurement_interval: Optional[int] = Field(None, ge=10, le=86400)
    bmp280_measurement_interval: Optional[int] = Field(None, ge=10, le=86400)
    dht22_measurement_interval: Optional[int] = Field(None, ge=10, le=86400)
    led_brightness: Optional[int] = Field(None, ge=0, le=255)
    sim_pin: Optional[int] = Field(None, ge=0, le=9999)
    bmp280_settings: Optional[int] = None
    measurement_interval_day_sec: Optional[int] = Field(None, ge=10, le=86400)
    measurement_interval_night_sec: Optional[int] = Field(None, ge=10, le=86400)
    daytime_start_sec: Optional[int] = Field(None, ge=0, le=86400)
    daytime_end_sec: Optional[int] = Field(None, ge=0, le=86400)
    owner_user_id: Optional[int] = None


# ===== MQTT Sync Schemas =====

class SettingsSyncPayload(BaseModel):
    """
    Payload for settings synchronization via MQTT.
    
    Sent to device on topic: settings_sync/{device_id}
    
    Format:
    {
        "setting_name": current_value,
        "new_setting_name": pending_value or null
    }
    """
    # WiFi
    wifi_ssid: Optional[str] = None
    new_wifi_ssid: Optional[str] = None
    wifi_pass: Optional[str] = None
    new_wifi_pass: Optional[str] = None
    wifi_auth: int = WifiAuthModeEnum.WPA2_PSK
    new_wifi_auth: Optional[int] = None
    
    # Device mode
    device_mode: int = DeviceModeEnum.SETUP
    new_device_mode: Optional[int] = None
    
    # Flags
    allow_unencrypted_ble: bool = False
    new_allow_unencrypted_ble: Optional[bool] = None
    lte_enabled: bool = False
    new_lte_enabled: Optional[bool] = None
    ble_enabled: bool = True
    new_ble_enabled: Optional[bool] = None
    power_management_enabled: bool = False
    new_power_management_enabled: Optional[bool] = None
    
    # Sensor flags
    pms5003_indoor: bool = False
    new_pms5003_indoor: Optional[bool] = None
    pms5003_enabled: bool = True
    new_pms5003_enabled: Optional[bool] = None
    bmp280_enabled: bool = True
    new_bmp280_enabled: Optional[bool] = None
    dht22_enabled: bool = True
    new_dht22_enabled: Optional[bool] = None
    
    # Sensor intervals
    pms5003_measurement_interval: int = 300
    new_pms5003_measurement_interval: Optional[int] = None
    bmp280_measurement_interval: int = 300
    new_bmp280_measurement_interval: Optional[int] = None
    dht22_measurement_interval: int = 300
    new_dht22_measurement_interval: Optional[int] = None
    
    # LED
    led_brightness: int = 100
    new_led_brightness: Optional[int] = None
    
    # SIM
    sim_pin: Optional[int] = None
    new_sim_pin: Optional[int] = None
    
    # Sensor settings
    bmp280_settings: int = 0
    new_bmp280_settings: Optional[int] = None
    
    # Global measurement intervals
    measurement_interval_day_sec: int = 300
    new_measurement_interval_day_sec: Optional[int] = None
    measurement_interval_night_sec: int = 900
    new_measurement_interval_night_sec: Optional[int] = None
    
    # Daytime boundaries
    daytime_start_sec: int = 21600
    new_daytime_start_sec: Optional[int] = None
    daytime_end_sec: int = 79200
    new_daytime_end_sec: Optional[int] = None
    
    # Owner
    owner_user_id: Optional[int] = None
    new_owner_user_id: Optional[int] = None


class DeviceSettingsReport(BaseModel):
    """
    Report from device with its current settings.
    Received via MQTT on topic: settings_report/{device_id}
    
    Device sends this when its settings differ from server's expected values.
    When received, server updates current values and clears pending.
    """
    wifi_ssid: Optional[str] = None
    wifi_pass: Optional[str] = None
    wifi_auth: Optional[int] = None
    device_mode: Optional[int] = None
    allow_unencrypted_ble: Optional[bool] = None
    lte_enabled: Optional[bool] = None
    ble_enabled: Optional[bool] = None
    power_management_enabled: Optional[bool] = None
    pms5003_indoor: Optional[bool] = None
    pms5003_enabled: Optional[bool] = None
    bmp280_enabled: Optional[bool] = None
    dht22_enabled: Optional[bool] = None
    pms5003_measurement_interval: Optional[int] = None
    bmp280_measurement_interval: Optional[int] = None
    dht22_measurement_interval: Optional[int] = None
    led_brightness: Optional[int] = None
    sim_pin: Optional[int] = None
    bmp280_settings: Optional[int] = None
    measurement_interval_day_sec: Optional[int] = None
    measurement_interval_night_sec: Optional[int] = None
    daytime_start_sec: Optional[int] = None
    daytime_end_sec: Optional[int] = None
    owner_user_id: Optional[int] = None


class SettingsAcknowledgement(BaseModel):
    """
    Acknowledgement from device that settings were applied.
    Received via MQTT on topic: settings_ack/{device_id}
    """
    applied_settings: list[str] = Field(default_factory=list, description="List of setting names that were applied")
    timestamp: int = Field(description="Device timestamp")
