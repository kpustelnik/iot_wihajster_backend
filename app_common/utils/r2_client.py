"""
Klient do obsługi Cloudflare R2 (S3-compatible storage).
Zapewnia asynchroniczne operacje upload/download/delete dla firmware OTA.
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional, AsyncGenerator
import hashlib

import aioboto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app_common.config import settings

logger = logging.getLogger(__name__)


class R2Client:
    """
    Klient do obsługi Cloudflare R2.
    Używa aioboto3 dla asynchronicznych operacji S3-compatible.
    """

    def __init__(self):
        self._session: Optional[aioboto3.Session] = None
        self._bucket_name = settings.r2_bucket_name

    @property
    def session(self) -> aioboto3.Session:
        if self._session is None:
            self._session = aioboto3.Session()
        return self._session

    @property
    def endpoint_url(self) -> str:
        """Zwraca pełny URL endpointu R2."""
        endpoint = settings.r2_endpoint
        if not endpoint:
            raise ValueError("R2_ENDPOINT is not configured")
        if not endpoint.startswith("https://"):
            endpoint = f"https://{endpoint}"
        return endpoint

    @asynccontextmanager
    async def get_client(self) -> AsyncGenerator:
        """Context manager dla klienta S3."""
        config = Config(
            signature_version='s3v4',
            retries={'max_attempts': 3, 'mode': 'adaptive'}
        )

        async with self.session.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=config,
            region_name='auto'  # R2 uses 'auto' region
        ) as client:
            yield client

    async def ensure_bucket_exists(self) -> bool:
        """
        Sprawdza czy bucket istnieje, tworzy jeśli nie.
        Returns: True jeśli bucket istnieje/został utworzony.
        """
        try:
            async with self.get_client() as client:
                try:
                    await client.head_bucket(Bucket=self._bucket_name)
                    logger.info(f"Bucket '{self._bucket_name}' exists")
                    return True
                except ClientError as e:
                    error_code = e.response.get('Error', {}).get('Code', '')
                    if error_code == '404':
                        logger.info(f"Creating bucket '{self._bucket_name}'")
                        await client.create_bucket(Bucket=self._bucket_name)
                        return True
                    raise
        except Exception as e:
            logger.error(f"Error checking/creating bucket: {e}")
            return False

    async def upload_firmware(
        self,
        content: bytes,
        key: str,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None
    ) -> dict:
        """
        Upload firmware do R2.
        
        Args:
            content: Bajty pliku firmware
            key: Klucz (ścieżka) w bucket
            content_type: Typ MIME
            metadata: Dodatkowe metadane
            
        Returns:
            Dict z informacjami o uploadzie (etag, version_id)
        """
        try:
            async with self.get_client() as client:
                extra_args = {
                    'ContentType': content_type,
                }
                if metadata:
                    extra_args['Metadata'] = {k: str(v) for k, v in metadata.items()}

                response = await client.put_object(
                    Bucket=self._bucket_name,
                    Key=key,
                    Body=content,
                    **extra_args
                )

                logger.info(f"Uploaded firmware to R2: {key} ({len(content)} bytes)")
                return {
                    'etag': response.get('ETag', '').strip('"'),
                    'version_id': response.get('VersionId'),
                    'key': key,
                    'size': len(content)
                }
        except ClientError as e:
            logger.error(f"Failed to upload firmware to R2: {e}")
            raise

    async def download_firmware(self, key: str) -> bytes:
        """
        Pobiera firmware z R2.
        
        Args:
            key: Klucz pliku w bucket
            
        Returns:
            Bajty pliku firmware
        """
        try:
            async with self.get_client() as client:
                response = await client.get_object(
                    Bucket=self._bucket_name,
                    Key=key
                )
                content = await response['Body'].read()
                logger.info(f"Downloaded firmware from R2: {key} ({len(content)} bytes)")
                return content
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'NoSuchKey':
                logger.warning(f"Firmware not found in R2: {key}")
                raise FileNotFoundError(f"Firmware not found: {key}")
            logger.error(f"Failed to download firmware from R2: {e}")
            raise

    async def delete_firmware(self, key: str) -> bool:
        """
        Usuwa firmware z R2.
        
        Args:
            key: Klucz pliku do usunięcia
            
        Returns:
            True jeśli usunięto pomyślnie
        """
        try:
            async with self.get_client() as client:
                await client.delete_object(
                    Bucket=self._bucket_name,
                    Key=key
                )
                logger.info(f"Deleted firmware from R2: {key}")
                return True
        except ClientError as e:
            logger.error(f"Failed to delete firmware from R2: {e}")
            return False

    async def get_presigned_url(
        self,
        key: str,
        expires_in: int = 3600,
        http_method: str = 'GET'
    ) -> str:
        """
        Generuje presigned URL do pobierania firmware.
        
        Args:
            key: Klucz pliku w bucket
            expires_in: Czas ważności URL w sekundach (default 1h)
            http_method: Metoda HTTP (GET dla pobierania)
            
        Returns:
            Presigned URL
        """
        try:
            async with self.get_client() as client:
                url = await client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': self._bucket_name,
                        'Key': key
                    },
                    ExpiresIn=expires_in,
                    HttpMethod=http_method
                )
                return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise

    async def get_public_url(self, key: str) -> str:
        """
        Zwraca publiczny URL dla pliku (jeśli bucket jest publiczny lub używany jest public URL).
        
        Args:
            key: Klucz pliku w bucket
            
        Returns:
            Publiczny URL
        """
        if settings.r2_public_url:
            # Użyj skonfigurowanego publicznego URL (np. custom domain)
            public_base = settings.r2_public_url.rstrip('/')
            return f"{public_base}/{key}"
        else:
            # Fallback na presigned URL
            return await self.get_presigned_url(key, expires_in=86400)  # 24h

    async def firmware_exists(self, key: str) -> bool:
        """
        Sprawdza czy firmware istnieje w R2.
        
        Args:
            key: Klucz pliku
            
        Returns:
            True jeśli plik istnieje
        """
        try:
            async with self.get_client() as client:
                await client.head_object(
                    Bucket=self._bucket_name,
                    Key=key
                )
                return True
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == '404':
                return False
            raise

    async def get_firmware_info(self, key: str) -> Optional[dict]:
        """
        Pobiera informacje o firmware z R2 (bez pobierania treści).
        
        Args:
            key: Klucz pliku
            
        Returns:
            Dict z informacjami o pliku lub None
        """
        try:
            async with self.get_client() as client:
                response = await client.head_object(
                    Bucket=self._bucket_name,
                    Key=key
                )
                return {
                    'size': response.get('ContentLength', 0),
                    'etag': response.get('ETag', '').strip('"'),
                    'last_modified': response.get('LastModified'),
                    'content_type': response.get('ContentType'),
                    'metadata': response.get('Metadata', {})
                }
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == '404':
                return None
            raise


def compute_sha256(content: bytes) -> str:
    """Oblicza hash SHA256 dla zawartości."""
    return hashlib.sha256(content).hexdigest()


def generate_firmware_key(chip_type: str, version: str) -> str:
    """
    Generuje klucz R2 dla firmware.
    
    Args:
        chip_type: Typ chipa (esp32, esp32c6, etc.)
        version: Wersja firmware (np. 1.0.0)
        
    Returns:
        Klucz w formacie: firmware/{chip_type}/{version}/firmware.bin
    """
    safe_version = version.replace('.', '_')
    return f"firmware/{chip_type}/{safe_version}/firmware.bin"


# Singleton instance
r2_client = R2Client()
