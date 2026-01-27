from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from starlette import status
import uuid
import random
import json
from datetime import datetime
from typing import Optional

from app_common.database import get_db
from app_common.models.user import UserType, User
from app_common.models.device import Device, SettingsStatus
from app_common.schemas.default import LimitedResponse
from frontend_api.docs import Tags
from frontend_api.repos import device_repo
from app_common.schemas.device import DeviceConnectInit, DeviceConnectConfirm, DeviceProvision, DeviceCreate, \
    DeviceModel

from app_common.utils.certs.ca import CertificateAuthority

from cryptography import x509
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend

from frontend_api.utils.auth.auth import RequireUser
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/devices",
    tags=[Tags.Device],
    responses={}
)

"""
 * change device settings only it's owner
 * delete yourself from the device, require access
 Device Status:
    * private: only you and your family
    * protected: mangle the gps data
    * public: everybody has access to every data point
"""



@router.post(
    "/provision",
    dependencies=[],
    tags=[],
    responses=None,
    status_code=status.HTTP_200_OK,
    summary="Provision device",
    response_description="Successful Response",
)
async def provision_device(
    req: DeviceProvision,
    db: AsyncSession = Depends(get_db)
):
    device = await device_repo.create_device(db, device=DeviceCreate())

    ca = CertificateAuthority()
    device_cert = ca.issue_device_certificate(serial_number=str(device.id))
    return {
        'ca_cert': ca.get_ca_pem().decode("utf-8"),
        'device_cert': device_cert.cert_chain_pems[0].bytes().decode("utf-8"),
        'device_key': device_cert.private_key_pem.bytes().decode("utf-8")
    }




@router.get(
    "",
    dependencies=[],
    tags=[],
    response_model=LimitedResponse[DeviceModel],
    status_code=status.HTTP_200_OK,
    summary="Get my devices",
    response_description="Successful Response",
)
async def get_devices(
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    return await device_repo.get_devices(db, current_user, offset, limit)


@router.get(
    "/owned",
    dependencies=[],
    tags=[],
    response_model=LimitedResponse[DeviceModel],
    status_code=status.HTTP_200_OK,
    summary="Get devices directly owned by user",
    response_description="Devices where user_id matches current user",
)
async def get_owned_devices(
        offset: int = Query(default=0, ge=0),
        limit: int = Query(default=100, ge=0, le=500),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN]))
):
    """Get devices directly assigned to user (bound via BLE handshake)"""
    return await device_repo.get_owned_devices(db, current_user, offset, limit)


challenges = {}
@router.post(
    "/connect",
    dependencies=[],
    tags=[],
    responses=None,
    status_code=status.HTTP_201_CREATED,
    summary="Start device connection",
    response_description="Successful Response",
)
async def init_device_connection(
        req: DeviceConnectInit,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db),
):
    """
    Initialize device connection.
    
    The user_id is included in the signed payload sent to the device.
    The device will:
    - Accept connection if device has no owner (and bind to this user)
    - Accept connection if device owner matches this user
    - Reject connection if device is bound to a different user
    
    This ensures the device is the source of truth for ownership.
    """
    ca = CertificateAuthority()

    cert = x509.load_pem_x509_certificate(req.cert.encode("utf-8"), default_backend())

    try:
        cert.verify_directly_issued_by(ca.get_ca_cert())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect certificate"
        )
    
    device_serial_number = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)[0].value
    print("Device serial number is", device_serial_number)
    
    # Get device from database to check current ownership
    device_id = int(device_serial_number)
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found in database"
        )

    challenge_uuid = uuid.uuid4()
    challenge = {
        'serial_number': device_serial_number,
        'user_id': current_user.id,
        'timestamp': int(uuid.uuid1().time),  # For replay protection
        'pin': random.randint(100000, 999999)
    }
    challenges[str(challenge_uuid)] = challenge

    # Include user_id in the payload sent to device
    # Device will use this to verify/bind ownership
    payload = json.dumps({
        'pin': challenge['pin'],
        'challenge': str(challenge_uuid),
        'user_id': current_user.id  # Device uses this to check/set owner
    })
    with open("/certs/ca_key.key", "rb") as f:
        ca_private_key = serialization.load_pem_private_key(
            f.read(),
            password=None,  # or b"your_password" if encrypted
            backend=default_backend()
        )
    signature = ca_private_key.sign(
        payload.encode("utf-8"),
        asym_padding.PKCS1v15(),
        hashes.SHA256()
    )
    print(signature)

    data = json.dumps({
        "data": payload,
        "signature": signature.hex()
    }).encode("utf-8")

    import os
    aes_key = os.urandom(32)  # 256-bit AES key
    iv = os.urandom(16)

    # Encrypt the data using AES
    cipher = Cipher(algorithms.AES(aes_key), modes.CFB(iv))
    encryptor = cipher.encryptor()
    encrypted_data = encryptor.update(data) + encryptor.finalize()

    # Encrypt AES key using RSA public key
    encrypted_key = cert.public_key().encrypt(
        aes_key,
        asym_padding.OAEP(
            mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    return {
        'key': encrypted_key.hex(),
        'iv': iv.hex(),
        'data': encrypted_data.hex()
    }


@router.post(
    "/confirm",
    dependencies=[],
    tags=[],
    responses=None,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm device connection",
    response_description="Successful Response",
)
async def confirm_device_connection(
        req: DeviceConnectConfirm,
        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
        db: AsyncSession = Depends(get_db),
):
    ca = CertificateAuthority()

    cert = x509.load_pem_x509_certificate(req.cert.encode("utf-8"), default_backend())

    try:
        cert.verify_directly_issued_by(ca.get_ca_cert())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect certificate"
        )
    
    device_serial_number = cert.subject.get_attributes_for_oid(x509.NameOID.COMMON_NAME)[0].value
    print("Device serial number is", device_serial_number)

    # Decrypt the AES key
    with open("/certs/ca_key.key", "rb") as f:
        ca_private_key = serialization.load_pem_private_key(
            f.read(),
            password=None,  # or b"your_password" if encrypted
            backend=default_backend()
        )
    aes_key = ca_private_key.decrypt(
        bytes.fromhex(req.key),
        asym_padding.OAEP(
            mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    # Decrypt data
    cipher = Cipher(algorithms.AES(aes_key), modes.CFB(bytes.fromhex(req.iv)))
    decryptor = cipher.decryptor()
    pt = decryptor.update(bytes.fromhex(req.data)) + decryptor.finalize()

    print("Decrypted:", pt)
    import json
    data = json.loads(pt.decode("utf-8"))
    message = data['data'].encode("utf-8")
    signature = bytes.fromhex(data['signature'])

    cert.public_key().verify(
        signature,
        message,
        asym_padding.PSS(
            mgf=asym_padding.MGF1(hashes.SHA256()),
            salt_length=asym_padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    
    decoded_message = message.decode("utf-8") # {"data":"{\\"data\\":\\"944583:bdb8f788-2f28-4365-a8c3-e99d16ccd167\\",\\"msg\\":1}
    print("Retrieved message:", decoded_message)

    data_msg = json.loads(decoded_message)
    
    pin = int(data_msg['pin'])
    challenge_uuid = data_msg['challenge']
    msg = data_msg.get('msg', 0)
    print("Received msg from the device:", msg)

    if challenge_uuid not in challenges:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown challenge"
        )
    
    challenge = challenges[challenge_uuid]
    if challenge['pin'] != pin or challenge['serial_number'] != device_serial_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect response"
        )
    
    # Verify user matches the one who initiated the connection
    if challenge.get('user_id') != current_user.id:
        del challenges[challenge_uuid]
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User mismatch - connection initiated by different user"
        )
    
    # Check challenge_echo for replay protection
    challenge_echo = data_msg.get('challenge_echo')
    if challenge_echo != challenge_uuid:
        del challenges[challenge_uuid]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge mismatch - possible replay attack"
        )
    
    # Get binding status from device response
    binding_status = data_msg.get('binding_status', 0)
    owner_user_id = data_msg.get('owner_user_id', 0)
    
    # Handle binding status
    # 0 = connection ok, no binding change
    # 1 = device bound/confirmed to this user
    # 2 = device bound to different user (error response - shouldn't reach here)
    
    del challenges[challenge_uuid]
    
    if binding_status == 2:
        # Device rejected - bound to different user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Device is bound to another user (user_id: {owner_user_id}). They must release it and perform factory reset on device."
        )
    
    # Update database with device ownership
    device_id = int(device_serial_number)
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    
    # Import ownership repo for creating ownership
    from frontend_api.repos.ownership_repo import create_ownership
    
    if binding_status == 1 or owner_user_id == current_user.id:
        if device is not None:
            # Device exists - update ownership
            stmt = update(Device).where(Device.id == device_id).values(
                user_id=current_user.id,
                status=SettingsStatus.ACCEPTED
            )
            await db.execute(stmt)
            await db.commit()
            print(f"Device {device_id} bound to user {current_user.id} in database (updated)")
        else:
            # Device doesn't exist in database - create it with correct ID
            # This can happen if device was provisioned but DB was reset
            from sqlalchemy import text
            stmt = text("""
                INSERT INTO devices (id, user_id, status, day_collection_interval, night_collection_interval, day_start, day_end, privacy, battery)
                VALUES (:id, :user_id, :status, 60, 120, '06:00:00', '22:00:00', 0, 0)
                ON CONFLICT (id) DO UPDATE SET user_id = :user_id, status = :status
            """)
            await db.execute(stmt, {
                'id': device_id,
                'user_id': current_user.id,
                'status': SettingsStatus.ACCEPTED.value
            })
            # Also update the sequence to avoid future conflicts
            await db.execute(text("SELECT setval('devices_id_seq', GREATEST((SELECT MAX(id) FROM devices), :id))"), {'id': device_id})
            await db.commit()
            print(f"Device {device_id} created and bound to user {current_user.id} in database (new)")
        
        # Create ownership record for the device (required for measurements to be saved)
        try:
            await create_ownership(db, current_user, device_id)
            print(f"Ownership created for device {device_id} and user {current_user.id}")
        except ValueError as e:
            # Ownership might already exist (e.g., device reconnection)
            print(f"Ownership already exists or error: {e}")
    
    return {
        'pin': pin,
        'binding_status': binding_status,
        'owner_user_id': owner_user_id
    }


# ==================== Device Ownership Management ====================

class DeviceReleaseRequest(BaseModel):
    """Request to release device ownership"""
    device_id: int = Field(..., description="ID urządzenia do zwolnienia")


# NOTE: Direct /claim endpoint is REMOVED
# Device claiming now happens through the encrypted BLE handshake:
# 1. User calls /connect with device certificate
# 2. Backend returns signed payload with user_id
# 3. Frontend sends payload to device via BLE proxied_communication
# 4. Device validates, binds user if unbound, returns signed response
# 5. Frontend calls /confirm with device response
# 6. Backend verifies and updates database based on device confirmation
#
# This ensures the DEVICE is the source of truth for ownership.
# The device can be reset via factory reset (hold BOOT button 10s).


@router.post(
    "/release",
    status_code=status.HTTP_200_OK,
    summary="Release device ownership",
)
async def release_device(
    req: DeviceReleaseRequest,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Zwolnij urządzenie - usuń przypisanie w bazie danych.
    
    UWAGA: To tylko zwalnia przypisanie w bazie danych backendu.
    Urządzenie nadal ma zapisane owner_user_id lokalnie.
    
    Aby nowy użytkownik mógł przejąć urządzenie:
    1. Poprzedni właściciel wywołuje /release
    2. Wykonaj factory reset na urządzeniu (przytrzymaj BOOT przez 10s)
    3. Nowy użytkownik łączy się przez BLE i jest automatycznie przypisany
    """
    result = await db.execute(select(Device).where(Device.id == req.device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if device.user_id != current_user.id and current_user.type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't own this device"
        )
    
    stmt = update(Device).where(Device.id == req.device_id).values(
        user_id=None,
        status=SettingsStatus.PENDING
    )
    await db.execute(stmt)
    await db.commit()
    
    return {"message": "Device released in database. Perform factory reset on device (hold BOOT 10s) to complete transfer.", "device_id": req.device_id}


@router.get(
    "/{device_id}",
    response_model=DeviceModel,
    status_code=status.HTTP_200_OK,
    summary="Get device details",
)
async def get_device(
    device_id: int,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Pobierz szczegóły urządzenia.
    """
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # Check permissions
    if device.user_id != current_user.id and current_user.type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this device"
        )
    
    return device


@router.get(
    "/{device_id}/sensors/latest",
    status_code=status.HTTP_200_OK,
    summary="Get latest sensor readings",
)
async def get_device_sensors_latest(
    device_id: int,
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Pobierz ostatnie odczyty sensorów urządzenia.
    """
    from app_common.models.measurement import Measurement
    
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    
    if device.user_id != current_user.id and current_user.type != UserType.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this device")
    
    # Pobierz ostatni pomiar (przez aktywny ownership)
    from app_common.models.ownership import Ownership
    result = await db.execute(
        select(Measurement)
        .join(Ownership, Measurement.ownership_id == Ownership.id)
        .where(Ownership.device_id == device_id)
        .where(Ownership.is_active == True)
        .order_by(Measurement.time.desc())
        .limit(1)
    )
    measurement = result.scalar_one_or_none()
    
    if measurement is None:
        return {}
    
    return {
        "timestamp": measurement.time.isoformat() if measurement.time else None,
        "temperature": float(measurement.temperature) if measurement.temperature else None,
        "humidity": measurement.humidity,
        "pressure": measurement.pressure,
        "pm2_5": measurement.PM25,
        "pm10_0": measurement.PM10,
        "latitude": measurement.latitude,
        "longitude": measurement.longitude,
    }


@router.get(
    "/{device_id}/sensors/history",
    status_code=status.HTTP_200_OK,
    summary="Get sensor history",
)
async def get_device_sensors_history(
    device_id: int,
    range: str = Query(default="24h", description="Zakres czasu: 1h, 6h, 24h, 7d, 30d"),
    current_user: User = Depends(RequireUser([UserType.CLIENT, UserType.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Pobierz historię odczytów sensorów urządzenia.
    """
    from app_common.models.measurement import Measurement
    from datetime import timedelta
    
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    
    if device.user_id != current_user.id and current_user.type != UserType.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this device")
    
    # Parse time range
    time_ranges = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    delta = time_ranges.get(range, timedelta(hours=24))
    since = datetime.utcnow() - delta
    
    # Pobierz pomiary (przez aktywny ownership)
    from app_common.models.ownership import Ownership
    result = await db.execute(
        select(Measurement)
        .join(Ownership, Measurement.ownership_id == Ownership.id)
        .where(Ownership.device_id == device_id)
        .where(Ownership.is_active == True)
        .where(Measurement.time >= since)
        .order_by(Measurement.time.asc())
        .limit(1000)
    )
    measurements = result.scalars().all()
    
    return [
        {
            "timestamp": m.time.isoformat() if m.time else None,
            "temperature": float(m.temperature) if m.temperature else None,
            "humidity": m.humidity,
            "pressure": m.pressure,
            "pm2_5": m.PM25,
            "pm10_0": m.PM10,
            "latitude": m.latitude,
            "longitude": m.longitude,
        }
        for m in measurements
    ]
