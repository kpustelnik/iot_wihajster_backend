import ssl
import asyncio
import logging
from asyncio_mqtt import Client, MqttError


def create_tls_context():
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    context.load_verify_locations("/certs/ca_cert.crt")  # Root CA
    # TODO: Replace with AWS cert in case of AWS
    context.load_cert_chain(
        certfile="/certs/mqtt_server.crt",
        keyfile="/certs/mqtt_server.key"
    )

    context.check_hostname = False  # AWS IoT Core ma unikalny endpoint, ale i tak jest OK
    context.verify_mode = ssl.CERT_REQUIRED

    return context



TLS_CONTEXT = create_tls_context()

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

MQTT_HOST = "mqtt_ext"
MQTT_PORT = 2883
MQTT_TOPIC = "sensors/#"


async def process_message(topic: str, payload: str):
    """
    Tutaj robisz, co chcesz z wiadomością:
    - zapis do bazy
    - logika biznesowa
    - push do kolejki, itd.
    """
    logger.info(f"[MQTT] topic={topic}, payload={payload}")
    print(f"[MQTT] topic={topic}, payload={payload}")
    # TODO: np. zapis do DB

    
async def _mqtt_loop():
    """
    Jedna sesja MQTT:
    - łączy się z brokerem
    - subskrybuje tematy
    - czyta wiadomości w pętli
    Zostaje przerwana, gdy połączenie padnie -> wyjątek MqttError.
    """
    async with Client(MQTT_HOST, MQTT_PORT, tls_context=TLS_CONTEXT) as client:
        await client.subscribe(MQTT_TOPIC)

        async with client.messages() as messages:
            async for message in messages:
                payload = message.payload.decode(errors="ignore")
                topic_str = str(message.topic)
                await process_message(topic_str, payload)
                [_, user_id] = topic_str.split("/")
                client.publish("Some data update!", f"data_update/{user_id}")


async def mqtt_runner():
    """
    Pętla "wieczna":
    - odpala _mqtt_loop()
    - jeśli połączenie padnie -> log, sleep, reconnect
    Ta funkcja powinna działać w tle od startu FastAPI.
    """
    reconnect_delay = 3
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
