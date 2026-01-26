"""
Device Settings Schemas

Pydantic schemas for device settings management and synchronization.
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
    """Base device settings schema"""
    
    # WiFi
    wifi_ssid: Optional[str] = Field(None, max_length=64, description="WiFi SSID")
    wifi_pass: Optional[str] = Field(None, max_length=128, description="WiFi password")
    wifi_auth_mode: int = Field(WifiAuthModeEnum.WPA2_PSK, description="WiFi auth mode")
    
    # Device mode
    device_mode: int = Field(DeviceModeEnum.SETUP, description="Device operating mode")
    
    # Flags
    allow_unencrypted_bluetooth: bool = Field(False, description="Allow unencrypted BLE")
    enable_lte: bool = Field(False, description="Enable LTE modem")
    sim_pin_accepted: bool = Field(False, description="SIM PIN was accepted")
    enable_power_management: bool = Field(False, description="Enable power management")
    
    # SIM
    sim_pin: Optional[int] = Field(None, ge=0, le=9999, description="SIM PIN")
    sim_iccid: Optional[str] = Field(None, max_length=32, description="SIM ICCID")
    
    # Sensor settings
    bmp280_settings: int = Field(0, description="BMP280 sensor settings")
    
    # Measurement intervals (seconds)
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
    wifi_auth_mode_pending: Optional[int] = None
    device_mode_pending: Optional[int] = None
    allow_unencrypted_bluetooth_pending: Optional[bool] = None
    enable_lte_pending: Optional[bool] = None
    enable_power_management_pending: Optional[bool] = None
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
    wifi_auth_mode: Optional[int] = None
    device_mode: Optional[int] = None
    allow_unencrypted_bluetooth: Optional[bool] = None
    enable_lte: Optional[bool] = None
    enable_power_management: Optional[bool] = None
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
    wifi_auth_mode: int = WifiAuthModeEnum.WPA2_PSK
    new_wifi_auth_mode: Optional[int] = None
    
    # Device mode
    device_mode: int = DeviceModeEnum.SETUP
    new_device_mode: Optional[int] = None
    
    # Flags
    allow_unencrypted_bluetooth: bool = False
    new_allow_unencrypted_bluetooth: Optional[bool] = None
    enable_lte: bool = False
    new_enable_lte: Optional[bool] = None
    sim_pin_accepted: bool = False
    enable_power_management: bool = False
    new_enable_power_management: Optional[bool] = None
    
    # SIM
    sim_pin: Optional[int] = None
    new_sim_pin: Optional[int] = None
    sim_iccid: Optional[str] = None
    
    # Sensor settings
    bmp280_settings: int = 0
    new_bmp280_settings: Optional[int] = None
    
    # Measurement intervals
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
    """
    wifi_ssid: Optional[str] = None
    wifi_auth_mode: Optional[int] = None
    device_mode: Optional[int] = None
    allow_unencrypted_bluetooth: Optional[bool] = None
    enable_lte: Optional[bool] = None
    sim_pin_accepted: Optional[bool] = None
    enable_power_management: Optional[bool] = None
    sim_pin: Optional[int] = None
    sim_iccid: Optional[str] = None
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
