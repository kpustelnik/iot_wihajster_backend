"""
Device Telemetry Model

Stores telemetry data sent by devices including system info, connectivity status,
sensor stats, power info, and error counts.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Integer, BigInteger, DateTime, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app_common.database import Base


class DeviceTelemetry(Base):
    """
    Stores device telemetry data.
    
    Each record represents a telemetry snapshot from a device.
    The latest record for each device represents its current status.
    """
    __tablename__ = "device_telemetry"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    serial_number: Mapped[str] = mapped_column(String(32), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # ===== System Info =====
    uptime_sec: Mapped[int] = mapped_column(Integer, default=0)
    free_heap: Mapped[int] = mapped_column(Integer, default=0)
    min_heap: Mapped[int] = mapped_column(Integer, default=0)
    total_heap: Mapped[int] = mapped_column(Integer, default=0)
    firmware_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    idf_version: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    chip_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    chip_revision: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    boot_count: Mapped[int] = mapped_column(Integer, default=0)
    reset_reason: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Connectivity =====
    wifi_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    wifi_rssi: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    wifi_reconnects: Mapped[int] = mapped_column(Integer, default=0)
    
    mqtt_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    mqtt_reconnects: Mapped[int] = mapped_column(Integer, default=0)
    mqtt_publishes: Mapped[int] = mapped_column(Integer, default=0)
    
    lte_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    lte_rssi: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # ===== Sensors =====
    sensor_cycles: Mapped[int] = mapped_column(Integer, default=0)
    sensor_success_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sensor_errors: Mapped[int] = mapped_column(Integer, default=0)
    
    # ===== Power =====
    battery_voltage_mv: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    battery_percent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    power_mode: Mapped[int] = mapped_column(Integer, default=0)
    power_mode_name: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sleep_time_sec: Mapped[int] = mapped_column(Integer, default=0)
    
    # ===== Errors =====
    total_errors: Mapped[int] = mapped_column(Integer, default=0)
    crashes: Mapped[int] = mapped_column(Integer, default=0)
    
    # ===== Device timestamp (from device RTC) =====
    device_timestamp: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    
    # Relationship back to device
    device = relationship("Device", back_populates="telemetry")

    @classmethod
    def from_mqtt_payload(cls, device_id: int, payload: dict) -> "DeviceTelemetry":
        """
        Create a DeviceTelemetry instance from MQTT payload.
        
        Expected payload format:
        {
            "serial_number": "58:8C:81:3B:BE:D4",
            "system": {
                "uptime": 241,
                "free_heap": 119788,
                "min_heap": 98832,
                "total_heap": 326700,
                "firmware": "2",
                "idf": "v5.5.1",
                "chip": "ESP32-C6",
                "chip_rev": 2,
                "boot_count": 327,
                "reset_reason": 11
            },
            "connectivity": {
                "wifi": true,
                "wifi_rssi": -53,
                "wifi_reconnects": 0,
                "mqtt": true,
                "mqtt_reconnects": 0,
                "mqtt_publishes": 6,
                "lte": false,
                "lte_rssi": -63
            },
            "sensors": {
                "cycles": 5,
                "success_rate": 100,
                "errors": 0
            },
            "power": {
                "battery_v": 0,
                "battery_pct": 0,
                "mode": 0,
                "mode_name": "NORMAL",
                "sleep_time": 0
            },
            "errors": {
                "total": 0,
                "crashes": 0
            },
            "timestamp": 241905
        }
        """
        system = payload.get("system", {})
        connectivity = payload.get("connectivity", {})
        sensors = payload.get("sensors", {})
        power = payload.get("power", {})
        errors = payload.get("errors", {})
        
        return cls(
            device_id=device_id,
            serial_number=payload.get("serial_number", ""),
            received_at=datetime.utcnow(),
            
            # System
            uptime_sec=system.get("uptime", 0),
            free_heap=system.get("free_heap", 0),
            min_heap=system.get("min_heap", 0),
            total_heap=system.get("total_heap", 0),
            firmware_version=str(system.get("firmware")) if system.get("firmware") else None,
            idf_version=system.get("idf"),
            chip_type=system.get("chip"),
            chip_revision=system.get("chip_rev"),
            boot_count=system.get("boot_count", 0),
            reset_reason=system.get("reset_reason"),
            
            # Connectivity
            wifi_connected=connectivity.get("wifi", False),
            wifi_rssi=connectivity.get("wifi_rssi"),
            wifi_reconnects=connectivity.get("wifi_reconnects", 0),
            mqtt_connected=connectivity.get("mqtt", False),
            mqtt_reconnects=connectivity.get("mqtt_reconnects", 0),
            mqtt_publishes=connectivity.get("mqtt_publishes", 0),
            lte_connected=connectivity.get("lte", False),
            lte_rssi=connectivity.get("lte_rssi"),
            
            # Sensors
            sensor_cycles=sensors.get("cycles", 0),
            sensor_success_rate=sensors.get("success_rate"),
            sensor_errors=sensors.get("errors", 0),
            
            # Power
            battery_voltage_mv=power.get("battery_v"),
            battery_percent=power.get("battery_pct"),
            power_mode=power.get("mode", 0),
            power_mode_name=power.get("mode_name"),
            sleep_time_sec=power.get("sleep_time", 0),
            
            # Errors
            total_errors=errors.get("total", 0),
            crashes=errors.get("crashes", 0),
            
            # Device timestamp
            device_timestamp=payload.get("timestamp"),
        )
