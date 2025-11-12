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