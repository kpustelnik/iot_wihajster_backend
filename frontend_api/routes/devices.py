from fastapi import APIRouter, HTTPException
from starlette import status

from frontend_api.docs import Tags
from app_common.schemas.device import DeviceConnectInit, DeviceConnectConfirm

from cryptography import x509
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.backends import default_backend


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

challenges = {}
@router.post(
    "/connect",
    dependencies=[],
    tags=[],
    #response_model=FamilyModel,
    responses=None,
    status_code=status.HTTP_201_CREATED,
    summary="Start device connection",
    response_description="Successful Response",
)
async def init_device_connection(
        req: DeviceConnectInit,
#        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
#        db: AsyncSession = Depends(get_db),
):
    with open('/certs/ca.crt', "rb") as f:
        ca_cert = x509.load_pem_x509_certificate(f.read(), default_backend())
    ca_public_key = ca_cert.public_key()

    print(req.cert)
    cert = x509.load_pem_x509_certificate(req.cert.encode("utf-8"), default_backend())

    try:
        ca_public_key.verify(
            cert.signature,
            cert.tbs_certificate_bytes,
            padding.PKCS1v15(),
            cert.signature_hash_algorithm
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect certificate"
        )
    
    print("Device serial number is", cert.serial_number)
    print(cert.extensions)
    print(cert.subject)

    import uuid
    import random
    challenge_uuid = uuid.uuid4()
    challenge = {
        # TODO: Store the actual device serial number
        # TODO: store the connection init timestamp (to prefer the most recent inits over older ones)
        'pin': random.randint(100000, 999999)
    }
    challenges[str(challenge_uuid)] = challenge

    # TODO: Also insert information about the user id?
    # The device could then refuse to accept connection (requiring it to perform a hardware settings reset before authenticating)
    # This is to make it to disallow anonymous connections
    import json
    payload = json.dumps({
        'pin': challenge['pin'],
        'challenge': str(challenge_uuid)
    })
    with open("/certs/ca.key", "rb") as f:
        ca_private_key = serialization.load_pem_private_key(
            f.read(),
            password=None,  # or b"your_password" if encrypted
            backend=default_backend()
        )
    signature = ca_private_key.sign(
        payload.encode("utf-8"),
        padding.PKCS1v15(),
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
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    return {
        'key': encrypted_key.hex(),
        'iv': iv.hex(),
        'data': encrypted_data.hex()
    }

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography import x509
from cryptography.hazmat.primitives import padding as sym_padding


@router.post(
    "/confirm",
    dependencies=[],
    tags=[],
    #response_model=FamilyModel,
    responses=None,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm device connection",
    response_description="Successful Response",
)
async def confirm_device_connection(
        req: DeviceConnectConfirm,
#        current_user: User = Depends(RequireUser([UserType.ADMIN, UserType.CLIENT])),
#        db: AsyncSession = Depends(get_db),
):
    with open('/certs/ca.crt', "rb") as f:
        ca_cert = x509.load_pem_x509_certificate(f.read(), default_backend())
    ca_public_key = ca_cert.public_key()

    cert = x509.load_pem_x509_certificate(req.cert.encode("utf-8"), default_backend())

    try:
        ca_public_key.verify(
            cert.signature,
            cert.tbs_certificate_bytes,
            padding.PKCS1v15(),
            cert.signature_hash_algorithm
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect certificate"
        )
    
    print("Device serial number is", cert.serial_number)
    print(cert.extensions)
    print(cert.subject)

    # Decrypt the AES key
    with open("/certs/ca.key", "rb") as f:
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
    # TODO: Confirm that the certificate is matching challenged device
    # TODO: Create device credential (?)
    challenge = challenges[challenge_uuid]
    if challenge['pin'] != pin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect response"
        )
    del challenges[challenge_uuid]
    return {
        'pin': pin
    }