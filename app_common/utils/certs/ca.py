import trustme
import os
from app_common.utils.singleton import Singleton
from cryptography import x509
from cryptography.hazmat.backends import default_backend

class CertificateAuthority(metaclass=Singleton):
    def __init__(self, canCreate: bool = False):
        self.ca_cert = '/certs/ca_cert.crt'
        self.ca_key = '/certs/ca_key.key'

        if not os.path.exists(self.ca_cert) or not os.path.exists(self.ca_key):
            if canCreate:
                self.create_ca()
            else:
                raise FileNotFoundError("CA certificates not found and canCreate is False")
        else:
            self.load_ca()

    def create_ca(self):
        self.ca = trustme.CA(
            organization_name="WIHAJSTER",
            organization_unit_name="Root CA",
            key_type=trustme.KeyType.RSA,
        )
        # Export CA certificate and key to files
        self.ca.cert_pem.write_to_path(self.ca_cert)
        self.ca.private_key_pem.write_to_path(self.ca_key)

    def load_ca(self):
        with open(self.ca_cert, 'rb') as cert_file:
            cert_bytes = cert_file.read()
        with open(self.ca_key, 'rb') as key_file:
            key_bytes = key_file.read()
        self.ca = trustme.CA.from_pem(
            cert_bytes=cert_bytes,
            private_key_bytes=key_bytes,
        )

    def issue_server_certificate(self, common_name: str):
        server_cert = self.ca.issue_cert(
            common_name=common_name,
            organization_name="WIHAJSTER",
            organization_unit_name="Server Certificate",
            key_type=trustme.KeyType.RSA,
        )
        return server_cert

    def issue_device_certificate(self, serial_number: str):
        device_cert = self.ca.issue_cert(
            common_name=serial_number,
            organization_name="WIHAJSTER",
            organization_unit_name="Device Certificate",
            key_type=trustme.KeyType.RSA,
        )
        return device_cert

    def get_ca_pem(self) -> bytes:
        return self.ca.cert_pem.bytes()
    
    def get_ca_cert(self) -> x509.Certificate:
        return x509.load_pem_x509_certificate(self.get_ca_pem(), default_backend())
    

ca = CertificateAuthority(True) # Initialize the CA
awsRegistrationCode = os.getenv("AWS_CA_REGISTRATION_CODE", None)
if awsRegistrationCode is not None and len(awsRegistrationCode) > 0 and not os.path.exists(f"/certs/servers/AWS_{awsRegistrationCode}_cert.crt") :
    aws_cert = ca.issue_server_certificate(awsRegistrationCode)
    dir = '/certs/servers'
    os.makedirs(dir, exist_ok=True)
    aws_cert.cert_chain_pems[0].write_to_path(f"{dir}/AWS_{awsRegistrationCode}_cert.crt")
    aws_cert.private_key_pem.write_to_path(f"{dir}/AWS_{awsRegistrationCode}_key.key")
if not os.path.exists("/certs/mqtt_server.crt"):
    mqtt_cert = ca.issue_server_certificate("MQTT_Server")
    dir = '/certs'
    os.makedirs(dir, exist_ok=True)
    mqtt_cert.cert_chain_pems[0].write_to_path(f"{dir}/mqtt_server.crt")
    mqtt_cert.private_key_pem.write_to_path(f"{dir}/mqtt_server.key")
