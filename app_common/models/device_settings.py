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
    
    wifi_auth_mode: Mapped[int] = mapped_column(Integer, default=WifiAuthMode.WPA2_PSK.value)
    wifi_auth_mode_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Device Mode =====
    device_mode: Mapped[int] = mapped_column(Integer, default=DeviceMode.SETUP.value)
    device_mode_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Flags (stored as bitmask) =====
    # FLAG_ALLOW_UNENCRYPTED_BLUETOOTH = 1 << 0
    # FLAG_ENABLE_LTE = 1 << 1
    # FLAG_SIM_PIN_ACCEPTED = 1 << 2
    # FLAG_ENABLE_POWER_MANAGEMENT = 1 << 3
    allow_unencrypted_bluetooth: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_unencrypted_bluetooth_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    enable_lte: Mapped[bool] = mapped_column(Boolean, default=False)
    enable_lte_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    sim_pin_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    # Note: sim_pin_accepted is device-set only, no pending
    
    enable_power_management: Mapped[bool] = mapped_column(Boolean, default=False)
    enable_power_management_pending: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # ===== SIM Settings =====
    sim_pin: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sim_pin_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    sim_iccid: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # sim_iccid is device-set only, no pending
    
    # ===== Sensor Settings =====
    bmp280_settings: Mapped[int] = mapped_column(Integer, default=0)
    bmp280_settings_pending: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Measurement Intervals (in seconds) =====
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

    def get_sync_payload(self) -> dict:
        """
        Generate the settings sync payload for MQTT.
        
        Format:
        {
            "setting_name": current_value,
            "new_setting_name": pending_value or null
        }
        """
        return {
            # WiFi
            "wifi_ssid": self.wifi_ssid,
            "new_wifi_ssid": self.wifi_ssid_pending,
            "wifi_pass": self.wifi_pass,
            "new_wifi_pass": self.wifi_pass_pending,
            "wifi_auth_mode": self.wifi_auth_mode,
            "new_wifi_auth_mode": self.wifi_auth_mode_pending,
            
            # Device mode
            "device_mode": self.device_mode,
            "new_device_mode": self.device_mode_pending,
            
            # Flags
            "allow_unencrypted_bluetooth": self.allow_unencrypted_bluetooth,
            "new_allow_unencrypted_bluetooth": self.allow_unencrypted_bluetooth_pending,
            "enable_lte": self.enable_lte,
            "new_enable_lte": self.enable_lte_pending,
            "sim_pin_accepted": self.sim_pin_accepted,  # Device-set only
            "enable_power_management": self.enable_power_management,
            "new_enable_power_management": self.enable_power_management_pending,
            
            # SIM
            "sim_pin": self.sim_pin,
            "new_sim_pin": self.sim_pin_pending,
            "sim_iccid": self.sim_iccid,  # Device-set only
            
            # Sensor settings
            "bmp280_settings": self.bmp280_settings,
            "new_bmp280_settings": self.bmp280_settings_pending,
            
            # Measurement intervals
            "measurement_interval_day_sec": self.measurement_interval_day_sec,
            "new_measurement_interval_day_sec": self.measurement_interval_day_sec_pending,
            "measurement_interval_night_sec": self.measurement_interval_night_sec,
            "new_measurement_interval_night_sec": self.measurement_interval_night_sec_pending,
            
            # Daytime boundaries
            "daytime_start_sec": self.daytime_start_sec,
            "new_daytime_start_sec": self.daytime_start_sec_pending,
            "daytime_end_sec": self.daytime_end_sec,
            "new_daytime_end_sec": self.daytime_end_sec_pending,
            
            # Owner
            "owner_user_id": self.owner_user_id,
            "new_owner_user_id": self.owner_user_id_pending,
        }
    
    def apply_pending_settings(self) -> list[str]:
        """
        Apply all pending settings to current values.
        Returns list of setting names that were updated.
        """
        updated = []
        pending_fields = [
            ("wifi_ssid", "wifi_ssid_pending"),
            ("wifi_pass", "wifi_pass_pending"),
            ("wifi_auth_mode", "wifi_auth_mode_pending"),
            ("device_mode", "device_mode_pending"),
            ("allow_unencrypted_bluetooth", "allow_unencrypted_bluetooth_pending"),
            ("enable_lte", "enable_lte_pending"),
            ("enable_power_management", "enable_power_management_pending"),
            ("sim_pin", "sim_pin_pending"),
            ("bmp280_settings", "bmp280_settings_pending"),
            ("measurement_interval_day_sec", "measurement_interval_day_sec_pending"),
            ("measurement_interval_night_sec", "measurement_interval_night_sec_pending"),
            ("daytime_start_sec", "daytime_start_sec_pending"),
            ("daytime_end_sec", "daytime_end_sec_pending"),
            ("owner_user_id", "owner_user_id_pending"),
        ]
        
        for current_field, pending_field in pending_fields:
            pending_value = getattr(self, pending_field)
            if pending_value is not None:
                setattr(self, current_field, pending_value)
                setattr(self, pending_field, None)
                updated.append(current_field)
        
        return updated

    def has_pending_changes(self) -> bool:
        """Check if there are any pending settings to sync."""
        pending_fields = [
            self.wifi_ssid_pending,
            self.wifi_pass_pending,
            self.wifi_auth_mode_pending,
            self.device_mode_pending,
            self.allow_unencrypted_bluetooth_pending,
            self.enable_lte_pending,
            self.enable_power_management_pending,
            self.sim_pin_pending,
            self.bmp280_settings_pending,
            self.measurement_interval_day_sec_pending,
            self.measurement_interval_night_sec_pending,
            self.daytime_start_sec_pending,
            self.daytime_end_sec_pending,
            self.owner_user_id_pending,
        ]
        return any(v is not None for v in pending_fields)
