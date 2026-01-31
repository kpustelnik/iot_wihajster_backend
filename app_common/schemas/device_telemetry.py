"""
Device Telemetry Schemas

Pydantic schemas for device telemetry data.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SystemInfo(BaseModel):
    """System information from device"""
    uptime: int = Field(0, description="Uptime in seconds")
    free_heap: int = Field(0, description="Free heap memory in bytes")
    min_heap: int = Field(0, description="Minimum free heap since boot")
    total_heap: int = Field(0, description="Total heap size")
    firmware: Optional[str] = Field(None, description="Firmware version")
    idf: Optional[str] = Field(None, description="ESP-IDF version")
    chip: Optional[str] = Field(None, description="Chip type (ESP32-C6, etc)")
    chip_rev: Optional[int] = Field(None, description="Chip revision")
    boot_count: int = Field(0, description="Number of boots")
    reset_reason: Optional[int] = Field(None, description="Last reset reason code")


class ConnectivityInfo(BaseModel):
    """Connectivity status from device"""
    wifi: bool = Field(False, description="WiFi connected")
    wifi_rssi: Optional[int] = Field(None, description="WiFi signal strength (dBm)")
    wifi_reconnects: int = Field(0, description="WiFi reconnection count")
    mqtt: bool = Field(False, description="MQTT connected")
    mqtt_reconnects: int = Field(0, description="MQTT reconnection count")
    mqtt_publishes: int = Field(0, description="MQTT messages published")
    lte: bool = Field(False, description="LTE connected")
    lte_rssi: Optional[int] = Field(None, description="LTE signal strength (dBm)")


class SensorInfo(BaseModel):
    """Sensor statistics from device"""
    cycles: int = Field(0, description="Number of sensor read cycles")
    success_rate: Optional[float] = Field(None, description="Success rate percentage")
    errors: int = Field(0, description="Number of sensor errors")


class PowerInfo(BaseModel):
    """Power status from device"""
    battery_v: Optional[int] = Field(None, description="Battery voltage in mV")
    battery_pct: Optional[int] = Field(None, description="Battery percentage")
    mode: int = Field(0, description="Power mode code")
    mode_name: Optional[str] = Field(None, description="Power mode name (NORMAL, LOW_POWER, etc)")
    sleep_time: int = Field(0, description="Total sleep time in seconds")


class ErrorInfo(BaseModel):
    """Error statistics from device"""
    total: int = Field(0, description="Total errors")
    crashes: int = Field(0, description="Number of crashes")


class DeviceTelemetryPayload(BaseModel):
    """
    Full telemetry payload from device.
    Received via MQTT on topic: telemetry/{device_id}
    """
    serial_number: str = Field(description="Device serial number (MAC address)")
    system: SystemInfo = Field(default_factory=SystemInfo)
    connectivity: ConnectivityInfo = Field(default_factory=ConnectivityInfo)
    sensors: SensorInfo = Field(default_factory=SensorInfo)
    power: PowerInfo = Field(default_factory=PowerInfo)
    errors: ErrorInfo = Field(default_factory=ErrorInfo)
    timestamp: int = Field(description="Device timestamp")


class DeviceTelemetryRead(BaseModel):
    """Device telemetry response schema"""
    id: int
    device_id: int
    serial_number: str
    received_at: datetime
    
    # System
    uptime_sec: int = 0
    free_heap: int = 0
    min_heap: int = 0
    total_heap: int = 0
    firmware_version: Optional[str] = None
    firmware_version_code: Optional[int] = None
    idf_version: Optional[str] = None
    chip_type: Optional[str] = None
    chip_revision: Optional[int] = None
    boot_count: int = 0
    reset_reason: Optional[int] = None
    
    # Connectivity
    wifi_connected: bool = False
    wifi_rssi: Optional[int] = None
    wifi_reconnects: int = 0
    mqtt_connected: bool = False
    mqtt_reconnects: int = 0
    mqtt_publishes: int = 0
    lte_connected: bool = False
    lte_rssi: Optional[int] = None
    
    # Sensors
    sensor_cycles: int = 0
    sensor_success_rate: Optional[float] = None
    sensor_errors: int = 0
    
    # Power
    battery_voltage_mv: Optional[int] = None
    battery_percent: Optional[int] = None
    power_mode: int = 0
    power_mode_name: Optional[str] = None
    sleep_time_sec: int = 0
    
    # Errors
    total_errors: int = 0
    crashes: int = 0
    
    device_timestamp: Optional[int] = None

    class Config:
        from_attributes = True


class DeviceTelemetrySummary(BaseModel):
    """Summary of latest telemetry for a device"""
    device_id: int
    serial_number: str
    last_seen: datetime
    is_online: bool = False
    
    # Quick status
    firmware_version: Optional[str] = None
    firmware_version_code: Optional[int] = None
    wifi_connected: bool = False
    wifi_rssi: Optional[int] = None
    mqtt_connected: bool = False
    lte_connected: bool = False
    battery_percent: Optional[int] = None
    uptime_sec: int = 0
    boot_count: int = 0
    total_errors: int = 0
