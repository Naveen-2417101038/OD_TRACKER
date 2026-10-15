"""
Azure Blob Storage Service for OD Letters and Participation Certificates.
Manages file uploads, retrieval, streaming, and visual cloud storage in Azure Storage Account 'odtrackerstorage'.
Containers: 'odletters', 'certificates'
"""
import os
import mimetypes
import logging
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger('azure_blob_storage')

try:
    from azure.storage.blob import BlobServiceClient, ContentSettings
    from azure.identity import DefaultAzureCredential
    AZURE_BLOB_SDK_AVAILABLE = True
except ImportError:
    AZURE_BLOB_SDK_AVAILABLE = False


class AzureBlobStorageService:
    def __init__(self):
        self.account_name = os.environ.get('AZURE_STORAGE_ACCOUNT_NAME', 'odtrackerstorage')
        self.connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING', '').strip()
        self.account_key = os.environ.get('AZURE_STORAGE_KEY', '').strip()
        self.container_od_letters = os.environ.get('AZURE_BLOB_CONTAINER_OD_LETTERS', 'odletters')
        self.container_certificates = os.environ.get('AZURE_BLOB_CONTAINER_CERTIFICATES', 'certificates')

        self.account_url = f"https://{self.account_name}.blob.core.windows.net"
        self._client: Optional[Any] = None
        self._init_attempted = False

    def get_client(self) -> Optional[Any]:
        """Lazy-initialize BlobServiceClient using Connection String, Account Key, or Managed Identity."""
        if self._client:
            return self._client

        if not AZURE_BLOB_SDK_AVAILABLE:
            logger.warning("[!] azure-storage-blob package is not installed.")
            return None

        # 1. Connection String
        if self.connection_string:
            try:
                self._client = BlobServiceClient.from_connection_string(self.connection_string)
                logger.info(f"[+] Azure Blob Client initialized via Connection String for '{self.account_name}'")
                return self._client
            except Exception as e:
                logger.warning(f"[!] Failed to init Azure Blob Client with connection string: {e}")

        # 2. Account Name + Account Key
        if self.account_key:
            try:
                self._client = BlobServiceClient(account_url=self.account_url, credential=self.account_key)
                logger.info(f"[+] Azure Blob Client initialized via Account Key for '{self.account_name}'")
                return self._client
            except Exception as e:
                logger.warning(f"[!] Failed to init Azure Blob Client with account key: {e}")

        # 3. DefaultAzureCredential (for Azure App Service with Managed Identity)
        # Only attempt if running in Azure (WEBSITE_INSTANCE_ID or WEBSITE_SITE_NAME) or explicitly enabled
        is_in_azure = bool(os.environ.get('WEBSITE_INSTANCE_ID') or os.environ.get('WEBSITE_SITE_NAME'))
        use_mi = os.environ.get('AZURE_USE_MANAGED_IDENTITY', '').lower() in ['true', '1']

        if is_in_azure or use_mi:
            try:
                credential = DefaultAzureCredential()
                self._client = BlobServiceClient(account_url=self.account_url, credential=credential)
                logger.info(f"[+] Azure Blob Client initialized via DefaultAzureCredential for '{self.account_name}'")
                return self._client
            except Exception as e:
                if not self._init_attempted:
                    logger.info(f"[i] DefaultAzureCredential not available: {e}")
                    self._init_attempted = True
                return None

        return None

    def is_enabled(self) -> bool:
        """Check if Azure Blob client is configured and available."""
        if not AZURE_BLOB_SDK_AVAILABLE:
            return False
        if bool(self.connection_string or self.account_key):
            return self.get_client() is not None
        if bool(os.environ.get('WEBSITE_INSTANCE_ID') or os.environ.get('WEBSITE_SITE_NAME')):
            return self.get_client() is not None
        return False

    def _resolve_container(self, category: str) -> str:
        """Map 'od_letters'/'odletters' to 'odletters', 'certificates' to 'certificates'."""
        clean = (category or '').lower().replace('_', '').replace('-', '')
        if 'letter' in clean or 'od' in clean:
            return self.container_od_letters
        return self.container_certificates

    def _get_content_type(self, filename: str, fallback: str = "application/octet-stream") -> str:
        ext = os.path.splitext(filename)[1].lower()
        if ext == '.pdf':
            return 'application/pdf'
        elif ext in ['.png', '.jpg', '.jpeg', '.webp']:
            return f"image/{'jpeg' if ext in ['.jpg', '.jpeg'] else ext[1:]}"
        guess, _ = mimetypes.guess_type(filename)
        return guess or fallback

    def upload_file(
        self,
        category: str,
        filename: str,
        data: Any,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload file stream, bytes, or file-like object to Azure Blob Storage container.
        Returns metadata including direct blob URL.
        """
        client = self.get_client()
        container_name = self._resolve_container(category)

        if not client:
            return {'success': False, 'error': 'Azure Blob Storage client is not configured.'}

        try:
            container_client = client.get_container_client(container_name)
            if not container_client.exists():
                try:
                    container_client.create_container()
                except Exception as ce:
                    logger.debug(f"Container exists or cannot create: {ce}")

            blob_client = container_client.get_blob_client(filename)
            ctype = content_type or self._get_content_type(filename)
            content_settings = ContentSettings(
                content_type=ctype,
                cache_control="public, max-age=86400"
            )

            # Support file storage object (has .read), bytes, or path
            if hasattr(data, 'read'):
                if hasattr(data, 'seek'):
                    data.seek(0)
                blob_client.upload_blob(data, overwrite=True, content_settings=content_settings)
            elif isinstance(data, (bytes, bytearray)):
                blob_client.upload_blob(data, overwrite=True, content_settings=content_settings)
            elif isinstance(data, str) and os.path.isfile(data):
                with open(data, 'rb') as f:
                    blob_client.upload_blob(f, overwrite=True, content_settings=content_settings)
            else:
                return {'success': False, 'error': 'Unsupported file data format'}

            blob_url = f"https://{self.account_name}.blob.core.windows.net/{container_name}/{filename}"
            logger.info(f"[+] Successfully uploaded '{filename}' to Azure Blob container '{container_name}'")
            return {
                'success': True,
                'container': container_name,
                'filename': filename,
                'blob_url': blob_url,
                'content_type': ctype
            }
        except Exception as e:
            logger.error(f"[!] Azure Blob upload failed for '{filename}' in '{container_name}': {e}")
            return {'success': False, 'error': str(e)}

    def download_file(self, category: str, filename: str) -> Tuple[Optional[bytes], Optional[str]]:
        """
        Download blob content bytes and content type from Azure container.
        Returns (content_bytes, content_type) or (None, None) if not found/error.
        """
        client = self.get_client()
        container_name = self._resolve_container(category)

        if not client:
            return None, None

        try:
            blob_client = client.get_blob_client(container=container_name, blob=filename)
            if not blob_client.exists():
                return None, None

            props = blob_client.get_blob_properties()
            content_type = getattr(getattr(props, 'content_settings', None), 'content_type', None) or self._get_content_type(filename)
            download_stream = blob_client.download_blob()
            data = download_stream.readall()
            return data, content_type
        except Exception as e:
            logger.warning(f"[!] Azure Blob download error for '{filename}' in '{container_name}': {e}")
            return None, None

    def blob_exists(self, category: str, filename: str) -> bool:
        """Check if blob exists in container."""
        client = self.get_client()
        container_name = self._resolve_container(category)
        if not client:
            return False
        try:
            return client.get_blob_client(container=container_name, blob=filename).exists()
        except Exception:
            return False

    def list_blobs(self, category: str) -> list:
        """List all blob names in the container."""
        client = self.get_client()
        container_name = self._resolve_container(category)
        if not client:
            return []
        try:
            container_client = client.get_container_client(container_name)
            return [b.name for b in container_client.list_blobs()]
        except Exception as e:
            logger.warning(f"[!] Failed to list blobs in '{container_name}': {e}")
            return []


# Global singleton instance
blob_storage = AzureBlobStorageService()
