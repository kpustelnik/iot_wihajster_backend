"""
Device Settings Model

Stores both current (live) and pending (to_set) values for device settings.
This enables synchronization between the backend and IoT devices.

Synchronization Protocol:
1. When device comes online, backend sends settings via MQTT topic `settings_sync/{DEVICE}`
2. Format includes current value and new_value (if pending update)
3. Device compares and syncs accordingly:
   - If current == server value and new_value exists -> device updates locally
   - If current != server value -> device sends its value to update the server
     AND backend clears any pending changes (device is authoritative)
"""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Enum, String, Boolean, Integer, BigInteger, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_common.database import Base


class DeviceMode(int, enum.Enum):
    """Device operating mode - matches C enum device_mode_t"""
    SETUP = 0
    WIFI = 1
    ZIGBEE = 2


class WifiAuthMode(int, enum.Enum):
    """WiFi authentication mode - matches ESP-IDF wifi_auth_mode_t"""
    OPEN = 0
    WEP = 1
    WPA_PSK = 2
    WPA2_PSK = 3
    WPA_WPA2_PSK = 4
    WPA2_ENTERPRISE = 5
    WPA3_PSK = 6
    WPA2_WPA3_PSK = 7


class SettingSyncStatus(str, enum.Enum):
    """Status of a setting's synchronization"""
    SYNCED = "synced"           # Device and server are in sync
    PENDING_TO_DEVICE = "pending_to_device"   # Server has new value to send to device
    PENDING_FROM_DEVICE = "pending_from_device"  # Awaiting device confirmation


class DeviceSettings(Base):
    """
    Device settings with current (live) and pending (to set) values.
    
    Field names match the device's cJSON keys exactly for easy serialization.
    
    Each setting has:
    - current value: What the device currently has
    - pending value (nullable): What we want to set on the device
    - sync_status: Whether the setting is synced
    """
    __tablename__ = "device_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Last sync timestamp
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    sync_status: Mapped[SettingSyncStatus] = mapped_column(
        Enum(SettingSyncStatus),
        default=SettingSyncStatus.SYNCED
    )
    
    # ===== WiFi Settings =====
    wifi_ssid: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    wifi_ssid_pending: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    wifi_pass: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    wifi_pass_pending: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    wifi_auth: Mapped[int] = mapped_column(Integer, default=WifiAuthMode.WPA2_PSK.value)
    wifi_auth_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Device Mode =====
    device_mode: Mapped[int] = mapped_column(Integer, default=DeviceMode.SETUP.value)
    device_mode_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Flags =====
    allow_unencrypted_ble: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_unencrypted_ble_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    lte_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    lte_enabled_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    ble_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    ble_enabled_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    power_management_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    power_management_enabled_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # ===== Sensor Enable Flags =====
    pms5003_indoor: Mapped[bool] = mapped_column(Boolean, default=False)
    pms5003_indoor_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    pms5003_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    pms5003_enabled_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    bmp280_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    bmp280_enabled_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    dht22_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    dht22_enabled_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # ===== Sensor Measurement Intervals (seconds) =====
    pms5003_measurement_interval: Mapped[int] = mapped_column(Integer, default=300)
    pms5003_measurement_interval_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    bmp280_measurement_interval: Mapped[int] = mapped_column(Integer, default=300)
    bmp280_measurement_interval_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    dht22_measurement_interval: Mapped[int] = mapped_column(Integer, default=300)
    dht22_measurement_interval_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== LED Settings =====
    led_brightness: Mapped[int] = mapped_column(Integer, default=100)
    led_brightness_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== SIM Settings =====
    sim_pin: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sim_pin_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Sensor Settings =====
    bmp280_settings: Mapped[int] = mapped_column(Integer, default=0)
    bmp280_settings_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Global Measurement Intervals (in seconds) =====
    measurement_interval_day_sec: Mapped[int] = mapped_column(Integer, default=300)  # 5 minutes
    measurement_interval_day_sec_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    measurement_interval_night_sec: Mapped[int] = mapped_column(Integer, default=900)  # 15 minutes
    measurement_interval_night_sec_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Daytime Boundaries (seconds from midnight) =====
    # e.g., 6:30 AM = 6*3600 + 30*60 = 23400
    daytime_start_sec: Mapped[int] = mapped_column(Integer, default=21600)  # 6:00 AM
    daytime_start_sec_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    daytime_end_sec: Mapped[int] = mapped_column(Integer, default=79200)  # 22:00 (10 PM)
    daytime_end_sec_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Owner User ID =====
    owner_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    owner_user_id_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Relationship back to device
    device = relationship("Device", back_populates="settings")

    # List of all setting fields (current_field, pending_field, json_key)
    SETTING_FIELDS = [
        ("wifi_ssid", "wifi_ssid_pending", "wifi_ssid"),
        ("wifi_pass", "wifi_pass_pending", "wifi_pass"),
        ("wifi_auth", "wifi_auth_pending", "wifi_auth"),
        ("device_mode", "device_mode_pending", "device_mode"),
        ("allow_unencrypted_ble", "allow_unencrypted_ble_pending", "allow_unencrypted_ble"),
        ("lte_enabled", "lte_enabled_pending", "lte_enabled"),
        ("ble_enabled", "ble_enabled_pending", "ble_enabled"),
        ("power_management_enabled", "power_management_enabled_pending", "power_management_enabled"),
        ("pms5003_indoor", "pms5003_indoor_pending", "pms5003_indoor"),
        ("pms5003_enabled", "pms5003_enabled_pending", "pms5003_enabled"),
        ("bmp280_enabled", "bmp280_enabled_pending", "bmp280_enabled"),
        ("dht22_enabled", "dht22_enabled_pending", "dht22_enabled"),
        ("pms5003_measurement_interval", "pms5003_measurement_interval_pending", "pms5003_measurement_interval"),
        ("bmp280_measurement_interval", "bmp280_measurement_interval_pending", "bmp280_measurement_interval"),
        ("dht22_measurement_interval", "dht22_measurement_interval_pending", "dht22_measurement_interval"),
        ("led_brightness", "led_brightness_pending", "led_brightness"),
        ("sim_pin", "sim_pin_pending", "sim_pin"),
        ("bmp280_settings", "bmp280_settings_pending", "bmp280_settings"),
        ("measurement_interval_day_sec", "measurement_interval_day_sec_pending", "measurement_interval_day_sec"),
        ("measurement_interval_night_sec", "measurement_interval_night_sec_pending", "measurement_interval_night_sec"),
        ("daytime_start_sec", "daytime_start_sec_pending", "daytime_start_sec"),
        ("daytime_end_sec", "daytime_end_sec_pending", "daytime_end_sec"),
        ("owner_user_id", "owner_user_id_pending", "owner_user_id"),
    ]

    def get_sync_payload(self) -> dict:
        """
        Generate the settings sync payload for MQTT.
        
        Format:
        {
            "setting_name": current_value,
            "new_setting_name": pending_value or null
        }
        """
        payload = {}
        for current_field, pending_field, json_key in self.SETTING_FIELDS:
            payload[json_key] = getattr(self, current_field)
            payload[f"new_{json_key}"] = getattr(self, pending_field)
        return payload
    
    def apply_pending_settings(self) -> list[str]:
        """
        Apply all pending settings to current values.
        Returns list of setting names that were updated.
        """
        updated = []
        for current_field, pending_field, json_key in self.SETTING_FIELDS:
            pending_value = getattr(self, pending_field)
            if pending_value is not None:
                setattr(self, current_field, pending_value)
                setattr(self, pending_field, None)
                updated.append(json_key)
        return updated

    def clear_all_pending(self) -> list[str]:
        """
        Clear all pending settings without applying them.
        Returns list of setting names that had pending values.
        """
        cleared = []
        for current_field, pending_field, json_key in self.SETTING_FIELDS:
            if getattr(self, pending_field) is not None:
                setattr(self, pending_field, None)
                cleared.append(json_key)
        return cleared

    def has_pending_changes(self) -> bool:
        """Check if there are any pending settings to sync."""
        for _, pending_field, _ in self.SETTING_FIELDS:
            if getattr(self, pending_field) is not None:
                return True
        return False
    
    def update_from_device_report(self, data: dict) -> tuple[list[str], list[str]]:
        """
        Update settings from device report.
        
        If device reports a value different from our current value:
        1. Update current value to match device
        2. Clear any pending value for that setting
        
        Returns:
            Tuple of (updated_fields, cleared_pending_fields)
        """
        updated = []
        cleared_pending = []
        
        for current_field, pending_field, json_key in self.SETTING_FIELDS:
            if json_key in data:
                device_value = data[json_key]
                current_value = getattr(self, current_field)
                
                # If device value differs from our current, update and clear pending
                if device_value != current_value:
                    setattr(self, current_field, device_value)
                    updated.append(json_key)
                    
                    # Clear pending if exists - device is authoritative
                    if getattr(self, pending_field) is not None:
                        setattr(self, pending_field, None)
                        cleared_pending.append(json_key)
        
        return updated, cleared_pending
