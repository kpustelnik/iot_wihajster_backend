import ssl
import asyncio
import logging
import json
import os
import urllib.request
from datetime import datetime
from typing import Optional
from aiomqtt import Client, MqttError
from decimal import Decimal

from sqlalchemy import select, and_

from app_common.database import sessionmanager
from app_common.models.measurement import Measurement
from app_common.models.device import Device
from app_common.models.ownership import Ownership
from app_common.models.device_settings import DeviceSettings, SettingSyncStatus
from app_common.models.device_telemetry import DeviceTelemetry

# AWS IoT configuration
USE_AWS_MQTT = os.getenv("USE_AWS_MQTT", "true").lower() == "true"
AWS_ROOT_CA_URL = "https://www.amazontrust.com/repository/AmazonRootCA1.pem"
AWS_ROOT_CA_PATH = "/certs/AmazonRootCA.pem"
AWS_IOT_ENDPOINT = os.getenv("AWS_IOT_ENDPOINT", "a19l9pjpkjjlvv-ats.iot.us-east-1.amazonaws.com")


def download_aws_root_ca():
    """Download Amazon Root CA if it doesn't exist."""
    if os.path.exists(AWS_ROOT_CA_PATH):
        return
    
    print(f"[MQTT] Downloading Amazon Root CA from {AWS_ROOT_CA_URL}...")
    try:
        with urllib.request.urlopen(AWS_ROOT_CA_URL, timeout=15) as response:
            cert_data = response.read().decode('utf-8')
        
        with open(AWS_ROOT_CA_PATH, 'w') as f:
            f.write(cert_data)
        print(f"[MQTT] Amazon Root CA saved to {AWS_ROOT_CA_PATH}")
    except Exception as e:
        print(f"[MQTT] Failed to download Amazon Root CA: {e}")
        raise

def create_tls_context():
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    if USE_AWS_MQTT:
        # Download Amazon Root CA if not present
        download_aws_root_ca()
        
        # AWS IoT Core - use Amazon Root CA and mqtt_server certificate
        context.load_verify_locations(AWS_ROOT_CA_PATH)
        context.load_cert_chain(
            certfile="/certs/mqtt_server.crt",
            keyfile="/certs/mqtt_server.key"
        )
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
    else:
        # Local MQTT broker
        context.load_verify_locations("/certs/ca_cert.crt")
        context.load_cert_chain(
            certfile="/certs/mqtt_server.crt",
            keyfile="/certs/mqtt_server.key"
        )
        context.check_hostname = False
        context.verify_mode = ssl.CERT_REQUIRED

    return context


TLS_CONTEXT = create_tls_context()

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

# MQTT Configuration
if USE_AWS_MQTT:
    MQTT_HOST = AWS_IOT_ENDPOINT
    MQTT_PORT = 8883
else:
    MQTT_HOST = "mqtt_ext"
    MQTT_PORT = 2883

MQTT_TOPIC_SENSORS = "sensors/#"
MQTT_TOPIC_STATUS = "status/#"
MQTT_TOPIC_PRESENCE = "presence/#"
MQTT_TOPIC_TELEMETRY = "telemetry/#"
MQTT_TOPIC_SETTINGS_REPORT = "settings_report/#"
MQTT_TOPIC_SETTINGS_ACK = "settings_ack/#"

# Global MQTT client reference for publishing
_mqtt_client: Optional[Client] = None


async def get_active_ownership(session, device_id: int) -> Ownership | None:
    """Pobiera aktywny ownership dla urządzenia"""
    query = select(Ownership).where(
        and_(
            Ownership.device_id == device_id,
            Ownership.is_active == True
        )
    )
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def save_sensor_data_to_db(device_id: int, data: dict):
    """
    Zapisuje dane z sensorów do bazy danych.
    
    Format danych (jednolity dla WiFi i LTE):
    {
        "timestamp": 1735900000,
        "dht22": {"temperature": 23.5, "humidity": 45.2, "valid": true},
        "bmp280": {"pressure": 101325, "temperature": 23.1, "valid": true},
        "pms5003": {"pm1_0": 10, "pm2_5": 25, "pm10": 35, "valid": true},
        "battery": {"voltage_mv": 4200, "percent": 100, "valid": true},
        "source": "WIFI" | "LTE",
        "device_id": "1"
    }
    """
    session = None
    try:
        session = sessionmanager.session()
        
        # Get active ownership for device
        ownership = await get_active_ownership(session, device_id)
        if ownership is None:
            logger.warning(f"[MQTT] No active ownership found for device {device_id}, skipping measurement")
            return
        
        # Parse timestamp
        timestamp = data.get("timestamp")
        if timestamp:
            measurement_time = datetime.fromtimestamp(timestamp)
        else:
            measurement_time = datetime.utcnow()
        
        # Extract sensor values from nested objects
        dht22 = data.get("dht22", {})
        bmp280 = data.get("bmp280", {})
        pms5003 = data.get("pms5003", {})
        battery = data.get("battery", {})
        gps = data.get("gps", {})
        
        temperature = Decimal(str(dht22.get("temperature", 0))) if dht22.get("valid") else None
        humidity = int(dht22.get("humidity", 0)) if dht22.get("valid") else None
        pressure = int(bmp280.get("pressure", 0)) if bmp280.get("valid") else None
        pm25 = int(pms5003.get("pm2_5", 0)) if pms5003.get("valid") else None
        pm10 = int(pms5003.get("pm10", 0)) if pms5003.get("valid") else None
        battery_percent = battery.get("percent") if battery.get("valid") else None
        latitude = float(gps.get("latitude", 0)) if gps.get("valid") else None
        longitude = float(gps.get("longitude", 0)) if gps.get("valid") else None
        
        # Create measurement record
        measurement = Measurement(
            ownership_id=ownership.id,
            time=measurement_time,
            temperature=temperature,
            humidity=humidity,
            pressure=pressure,
            PM25=pm25,
            PM10=pm10,
            latitude=latitude,
            longitude=longitude,
        )
        
        session.add(measurement)
        
        # Update device battery status if available
        if battery_percent is not None:
            from sqlalchemy import update
            stmt = update(Device).where(Device.id == device_id).values(
                battery=battery_percent
            )
            await session.execute(stmt)
        
        await session.commit()
        source = data.get("source", "UNKNOWN")
        logger.info(f"[MQTT] Saved measurement for device {device_id} at {measurement_time} (source: {source})")
        
    except Exception as e:
        logger.error(f"[MQTT] Error saving sensor data: {e!r}")
        if session:
            await session.rollback()
    finally:
        if session:
            await session.close()


async def process_sensor_message(topic: str, payload: str):
    """
    Przetwarza wiadomość z topic 'sensors/<device_id>'
    """
    try:
        # Parse topic to get device_id
        parts = topic.split("/")
        if len(parts) < 2:
            logger.warning(f"[MQTT] Invalid sensor topic format: {topic}")
            return
        
        device_id_str = parts[1]
        
        # Parse JSON payload
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            logger.error(f"[MQTT] Invalid JSON in sensor message: {e}")
            return
        
        # Try to get device_id from payload or topic
        try:
            device_id = int(data.get("device_id", device_id_str))
        except (ValueError, TypeError):
            logger.error(f"[MQTT] Invalid device_id: {device_id_str}")
            return
        
        # Save to database
        await save_sensor_data_to_db(device_id, data)
        
    except Exception as e:
        logger.error(f"[MQTT] Error processing sensor message: {e!r}")


async def process_status_message(topic: str, payload: str):
    """
    Przetwarza wiadomość z topic 'status/<device_id>'
    To są odpowiedzi urządzeń na komendy.
    """
    try:
        parts = topic.split("/")
        if len(parts) < 2:
            return
        
        device_id = parts[1]
        logger.info(f"[MQTT] Device {device_id} status: {payload[:200]}")
        
        # Tu można dodać logikę obsługi statusów OTA itp.
        try:
            data = json.loads(payload)
            if data.get("command") == "ota_update":
                accepted = data.get("accepted", False)
                logger.info(f"[MQTT] OTA update {'accepted' if accepted else 'rejected'} by device {device_id}")
        except json.JSONDecodeError:
            pass
            
    except Exception as e:
        logger.error(f"[MQTT] Error processing status message: {e!r}")


async def process_presence_message(topic: str, payload: str):
    """
    Przetwarza wiadomość z topic 'presence/<device_id>'
    To są wiadomości LWT (Last Will and Testament) informujące o statusie urządzenia.
    
    When device comes online, trigger settings sync.
    """
    try:
        parts = topic.split("/")
        if len(parts) < 2:
            return
        
        device_id = parts[1]
        
        try:
            data = json.loads(payload)
            status = data.get("status", "unknown")
            reason = data.get("reason", "")
            
            if status == "online":
                logger.info(f"[MQTT] Device {device_id} is ONLINE")
                # Trigger settings sync when device comes online
                await send_settings_sync(device_id)
            elif status == "offline":
                logger.warning(f"[MQTT] Device {device_id} is OFFLINE (reason: {reason})")
            else:
                logger.info(f"[MQTT] Device {device_id} presence: {status}")
                
        except json.JSONDecodeError:
            logger.info(f"[MQTT] Device {device_id} presence: {payload}")
            
    except Exception as e:
        logger.error(f"[MQTT] Error processing presence message: {e!r}")


async def process_telemetry_message(topic: str, payload: str):
    """
    Przetwarza wiadomość z topic 'telemetry/<device_id>'
    Zapisuje telemetrię urządzenia do bazy danych.
    """
    try:
        parts = topic.split("/")
        if len(parts) < 2:
            logger.warning(f"[MQTT] Invalid telemetry topic format: {topic}")
            return
        
        device_id_str = parts[1]
        
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            logger.error(f"[MQTT] Invalid JSON in telemetry message: {e}")
            return
        
        try:
            device_id = int(device_id_str)
        except (ValueError, TypeError):
            logger.error(f"[MQTT] Invalid device_id in telemetry: {device_id_str}")
            return
        
        await save_telemetry_to_db(device_id, data)
        
    except Exception as e:
        logger.error(f"[MQTT] Error processing telemetry message: {e!r}")


async def save_telemetry_to_db(device_id: int, data: dict):
    """
    Zapisuje telemetrię urządzenia do bazy danych.
    """
    session = None
    try:
        session = sessionmanager.session()
        
        telemetry = DeviceTelemetry.from_mqtt_payload(device_id, data)
        session.add(telemetry)
        await session.commit()
        
        logger.info(f"[MQTT] Saved telemetry for device {device_id}")
        
    except Exception as e:
        logger.error(f"[MQTT] Error saving telemetry: {e!r}")
        if session:
            await session.rollback()
    finally:
        if session:
            await session.close()


async def process_settings_report_message(topic: str, payload: str):
    """
    Przetwarza wiadomość z topic 'settings_report/<device_id>'
    Urządzenie zgłasza swoje aktualne ustawienia gdy różnią się od oczekiwanych.
    """
    try:
        parts = topic.split("/")
        if len(parts) < 2:
            return
        
        device_id_str = parts[1]
        
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            logger.error(f"[MQTT] Invalid JSON in settings report: {e}")
            return
        
        try:
            device_id = int(device_id_str)
        except (ValueError, TypeError):
            logger.error(f"[MQTT] Invalid device_id in settings report: {device_id_str}")
            return
        
        await update_settings_from_device(device_id, data)
        
    except Exception as e:
        logger.error(f"[MQTT] Error processing settings report: {e!r}")


async def update_settings_from_device(device_id: int, data: dict):
    """
    Aktualizuje ustawienia w bazie na podstawie raportu urządzenia.
    Urządzenie wysyła swoje aktualne wartości, gdy różnią się od oczekiwanych.
    """
    session = None
    try:
        from sqlalchemy import select
        session = sessionmanager.session()
        
        query = select(DeviceSettings).where(DeviceSettings.device_id == device_id)
        settings = await session.scalar(query)
        
        if not settings:
            logger.warning(f"[MQTT] No settings found for device {device_id}")
            return
        
        # Update current values from device report
        field_mapping = {
            "wifi_ssid": "wifi_ssid",
            "wifi_auth_mode": "wifi_auth_mode",
            "device_mode": "device_mode",
            "allow_unencrypted_bluetooth": "allow_unencrypted_bluetooth",
            "enable_lte": "enable_lte",
            "sim_pin_accepted": "sim_pin_accepted",
            "enable_power_management": "enable_power_management",
            "sim_pin": "sim_pin",
            "sim_iccid": "sim_iccid",
            "bmp280_settings": "bmp280_settings",
            "measurement_interval_day_sec": "measurement_interval_day_sec",
            "measurement_interval_night_sec": "measurement_interval_night_sec",
            "daytime_start_sec": "daytime_start_sec",
            "daytime_end_sec": "daytime_end_sec",
            "owner_user_id": "owner_user_id",
        }
        
        updated_fields = []
        for json_field, model_field in field_mapping.items():
            if json_field in data:
                setattr(settings, model_field, data[json_field])
                updated_fields.append(model_field)
        
        if updated_fields:
            settings.last_sync_at = datetime.utcnow()
            settings.sync_status = SettingSyncStatus.SYNCED
            await session.commit()
            logger.info(f"[MQTT] Updated settings for device {device_id}: {updated_fields}")
        
    except Exception as e:
        logger.error(f"[MQTT] Error updating settings from device: {e!r}")
        if session:
            await session.rollback()
    finally:
        if session:
            await session.close()


async def process_settings_ack_message(topic: str, payload: str):
    """
    Przetwarza wiadomość z topic 'settings_ack/<device_id>'
    Urządzenie potwierdza zastosowanie ustawień.
    """
    try:
        parts = topic.split("/")
        if len(parts) < 2:
            return
        
        device_id_str = parts[1]
        
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            logger.error(f"[MQTT] Invalid JSON in settings ack: {e}")
            return
        
        try:
            device_id = int(device_id_str)
        except (ValueError, TypeError):
            logger.error(f"[MQTT] Invalid device_id in settings ack: {device_id_str}")
            return
        
        await apply_acknowledged_settings(device_id, data)
        
    except Exception as e:
        logger.error(f"[MQTT] Error processing settings ack: {e!r}")


async def apply_acknowledged_settings(device_id: int, data: dict):
    """
    Stosuje potwierdzone ustawienia - przesuwa pending do current.
    """
    session = None
    try:
        from sqlalchemy import select
        session = sessionmanager.session()
        
        query = select(DeviceSettings).where(DeviceSettings.device_id == device_id)
        settings = await session.scalar(query)
        
        if not settings:
            logger.warning(f"[MQTT] No settings found for device {device_id}")
            return
        
        applied_settings = data.get("applied_settings", [])
        
        # Map applied setting names to pending field names
        pending_field_mapping = {
            "wifi_ssid": ("wifi_ssid", "wifi_ssid_pending"),
            "wifi_pass": ("wifi_pass", "wifi_pass_pending"),
            "wifi_auth_mode": ("wifi_auth_mode", "wifi_auth_mode_pending"),
            "device_mode": ("device_mode", "device_mode_pending"),
            "allow_unencrypted_bluetooth": ("allow_unencrypted_bluetooth", "allow_unencrypted_bluetooth_pending"),
            "enable_lte": ("enable_lte", "enable_lte_pending"),
            "enable_power_management": ("enable_power_management", "enable_power_management_pending"),
            "sim_pin": ("sim_pin", "sim_pin_pending"),
            "bmp280_settings": ("bmp280_settings", "bmp280_settings_pending"),
            "measurement_interval_day_sec": ("measurement_interval_day_sec", "measurement_interval_day_sec_pending"),
            "measurement_interval_night_sec": ("measurement_interval_night_sec", "measurement_interval_night_sec_pending"),
            "daytime_start_sec": ("daytime_start_sec", "daytime_start_sec_pending"),
            "daytime_end_sec": ("daytime_end_sec", "daytime_end_sec_pending"),
            "owner_user_id": ("owner_user_id", "owner_user_id_pending"),
        }
        
        updated_fields = []
        for setting_name in applied_settings:
            if setting_name in pending_field_mapping:
                current_field, pending_field = pending_field_mapping[setting_name]
                pending_value = getattr(settings, pending_field)
                if pending_value is not None:
                    setattr(settings, current_field, pending_value)
                    setattr(settings, pending_field, None)
                    updated_fields.append(current_field)
        
        if updated_fields:
            settings.last_sync_at = datetime.utcnow()
            if not settings.has_pending_changes():
                settings.sync_status = SettingSyncStatus.SYNCED
            await session.commit()
            logger.info(f"[MQTT] Applied settings for device {device_id}: {updated_fields}")
        
    except Exception as e:
        logger.error(f"[MQTT] Error applying acknowledged settings: {e!r}")
        if session:
            await session.rollback()
    finally:
        if session:
            await session.close()


async def send_settings_sync(device_id: str):
    """
    Wysyła ustawienia synchronizacji do urządzenia.
    Wywoływane gdy urządzenie przychodzi online.
    """
    session = None
    try:
        from sqlalchemy import select
        session = sessionmanager.session()
        
        try:
            device_id_int = int(device_id)
        except (ValueError, TypeError):
            logger.error(f"[MQTT] Invalid device_id for settings sync: {device_id}")
            return
        
        query = select(DeviceSettings).where(DeviceSettings.device_id == device_id_int)
        settings = await session.scalar(query)
        
        if not settings:
            logger.info(f"[MQTT] No settings found for device {device_id}, creating default")
            # Create default settings
            settings = DeviceSettings(device_id=device_id_int)
            session.add(settings)
            await session.commit()
        
        # Get sync payload
        sync_payload = settings.get_sync_payload()
        
        # Publish to settings_sync topic
        await publish_settings_sync(device_id, sync_payload)
        
        # Update sync status
        if settings.has_pending_changes():
            settings.sync_status = SettingSyncStatus.PENDING_TO_DEVICE
            await session.commit()
        
    except Exception as e:
        logger.error(f"[MQTT] Error sending settings sync: {e!r}")
        if session:
            await session.rollback()
    finally:
        if session:
            await session.close()


async def publish_settings_sync(device_id: str, payload: dict):
    """
    Publikuje ustawienia synchronizacji na topic settings_sync/{device_id}
    """
    if _mqtt_client is None:
        logger.error("[MQTT] Client not connected, cannot publish settings sync")
        return False
    
    try:
        topic = f"settings_sync/{device_id}"
        await _mqtt_client.publish(topic, payload=json.dumps(payload))
        logger.info(f"[MQTT] Sent settings sync to {topic}")
        return True
    except Exception as e:
        logger.error(f"[MQTT] Error publishing settings sync: {e!r}")
        return False


async def process_message(topic: str, payload: str):
    """
    Główny router wiadomości MQTT.
    """
    logger.debug(f"[MQTT] Received: topic={topic}, payload={payload[:100]}...")
    
    if topic.startswith("sensors/"):
        await process_sensor_message(topic, payload)
    elif topic.startswith("status/"):
        await process_status_message(topic, payload)
    elif topic.startswith("presence/"):
        await process_presence_message(topic, payload)
    elif topic.startswith("telemetry/"):
        await process_telemetry_message(topic, payload)
    elif topic.startswith("settings_report/"):
        await process_settings_report_message(topic, payload)
    elif topic.startswith("settings_ack/"):
        await process_settings_ack_message(topic, payload)
    else:
        logger.warning(f"[MQTT] Unknown topic: {topic}")


async def publish_command(device_id: str, command: str, params: dict = None):
    """
    Wysyła komendę do urządzenia przez MQTT.
    
    Args:
        device_id: ID urządzenia (serial number z certyfikatu)
        command: Nazwa komendy (np. 'led_color', 'reboot', 'ota_update')
        params: Parametry komendy (opcjonalne)
    """
    if _mqtt_client is None:
        logger.error("[MQTT] Client not connected, cannot publish command")
        return False
    
    try:
        message = {
            "command": command,
            "params": params or {}
        }
        topic = f"data_update/{device_id}"
        await _mqtt_client.publish(topic, payload=json.dumps(message))
        logger.info(f"[MQTT] Sent command to {topic}: {command}")
        return True
    except Exception as e:
        logger.error(f"[MQTT] Error publishing command: {e!r}")
        return False

    
async def _mqtt_loop():
    """
    Jedna sesja MQTT:
    - łączy się z brokerem
    - subskrybuje tematy
    - czyta wiadomości w pętli
    Zostaje przerwana, gdy połączenie padnie -> wyjątek MqttError.
    """
    global _mqtt_client
    
    async with Client(MQTT_HOST, MQTT_PORT, tls_context=TLS_CONTEXT) as client:
        _mqtt_client = client
        
        # Subscribe to all relevant topics
        await client.subscribe(MQTT_TOPIC_SENSORS)
        await client.subscribe(MQTT_TOPIC_STATUS)
        await client.subscribe(MQTT_TOPIC_PRESENCE)
        await client.subscribe(MQTT_TOPIC_TELEMETRY)
        await client.subscribe(MQTT_TOPIC_SETTINGS_REPORT)
        await client.subscribe(MQTT_TOPIC_SETTINGS_ACK)
        logger.info(f"[MQTT] Connected to {MQTT_HOST}:{MQTT_PORT}")
        logger.info(f"[MQTT] Subscribed to: sensors, status, presence, telemetry, settings_report, settings_ack")

        try:
            async for message in client.messages:
                try:
                    payload = message.payload.decode(errors="ignore")
                    topic_str = str(message.topic)
                    await process_message(topic_str, payload)
                except Exception as e:
                    logger.error(f"[MQTT] Error processing message: {e!r}")
                    continue
        except asyncio.CancelledError:
            logger.info("[MQTT] Message loop cancelled.")
            raise
        finally:
            _mqtt_client = None


async def mqtt_runner():
    """
    Pętla "wieczna":
    - odpala _mqtt_loop()
    - jeśli połączenie padnie -> log, sleep, reconnect
    Ta funkcja powinna działać w tle od startu FastAPI.
    """
    reconnect_delay = 3
    try:
        while True:
            try:
                logger.info("[MQTT] Connecting to broker...")
                await _mqtt_loop()
            except MqttError as e:
                logger.error(f"[MQTT] Connection lost: {e!r}. Reconnecting in {reconnect_delay}s...")
                await asyncio.sleep(reconnect_delay)
            except Exception as e:
                logger.exception(f"[MQTT] Unexpected error: {e!r}. Reconnecting in {reconnect_delay}s...")
                await asyncio.sleep(reconnect_delay)
    except asyncio.CancelledError:
        logger.info("[MQTT] MQTT task cancelled, shutting down gracefully.")
        raise

