"""
Azure Blob Storage Service for OD Tracker.
Supports:
1. Uploading certificates and OD letters directly to Azure Blob Storage containers.
2. Automatic Local Filesystem Fallback when Azure Blob Storage is not configured.
3. Managed Identity (DefaultAzureCredential) or Connection String authentication.
4. Correct MIME Content-Type headers for in-browser PDF and image preview.
"""
import os
import io
import mimetypes
from typing import Optional, Tuple, Union, BinaryIO
from werkzeug.datastructures import FileStorage

try:
    from azure.storage.blob import BlobServiceClient, ContentSettings, ContainerClient
    from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
    HAS_AZURE_STORAGE = True
except ImportError:
    HAS_AZURE_STORAGE = False

try:
    from azure.identity import DefaultAzureCredential
    HAS_AZURE_IDENTITY = True
except ImportError:
    HAS_AZURE_IDENTITY = False

try:
    from backend.config import Config
except ImportError:
    from config import Config


# Map extensions to standard MIME content types
MIME_MAP = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
}


class BlobStorageService:
    _blob_service_client: Optional[Any] = None

    @classmethod
    def is_configured(cls) -> bool:
        """Check if Azure Blob Storage credentials or endpoint are provided."""
        if not HAS_AZURE_STORAGE:
            return False
        conn_str = getattr(Config, 'AZURE_STORAGE_CONNECTION_STRING', '').strip()
        account_url = getattr(Config, 'AZURE_STORAGE_ACCOUNT_URL', '').strip()
        account_name = getattr(Config, 'AZURE_STORAGE_ACCOUNT_NAME', '').strip()
        return bool(conn_str or account_url or account_name)

    @classmethod
    def get_client(cls) -> Optional[Any]:
        """Initialize or return the cached Azure BlobServiceClient."""
        if not cls.is_configured():
            return None

        if cls._blob_service_client is not None:
            return cls._blob_service_client

        conn_str = getattr(Config, 'AZURE_STORAGE_CONNECTION_STRING', '').strip()
        if conn_str:
            cls._blob_service_client = BlobServiceClient.from_connection_string(conn_str)
            return cls._blob_service_client

        account_url = getattr(Config, 'AZURE_STORAGE_ACCOUNT_URL', '').strip()
        account_name = getattr(Config, 'AZURE_STORAGE_ACCOUNT_NAME', '').strip()
        if not account_url and account_name:
            account_url = f"https://{account_name}.blob.core.windows.net"

        if account_url:
            use_mi = getattr(Config, 'AZURE_STORAGE_USE_MANAGED_IDENTITY', False)
            if use_mi and HAS_AZURE_IDENTITY:
                credential = DefaultAzureCredential()
                cls._blob_service_client = BlobServiceClient(account_url=account_url, credential=credential)
            else:
                cls._blob_service_client = BlobServiceClient(account_url=account_url)
            return cls._blob_service_client

        return None

    @classmethod
    def _get_content_type(cls, filename: str) -> str:
        """Determine content type for PDF or images."""
        ext = os.path.splitext(filename)[1].lower()
        if ext in MIME_MAP:
            return MIME_MAP[ext]
        guessed, _ = mimetypes.guess_type(filename)
        return guessed or 'application/octet-stream'

    @classmethod
    def _ensure_container(cls, client: Any, container_name: str) -> Any:
        """Create container if it does not already exist."""
        container_client = client.get_container_client(container_name)
        try:
            container_client.create_container(public_access='blob')
        except ResourceExistsError:
            pass
        except Exception:
            # Fall back to private if public access is restricted by policy
            try:
                container_client.create_container()
            except (ResourceExistsError, Exception):
                pass
        return container_client

    @classmethod
    def upload_file(
        cls,
        file_data: Union[FileStorage, BinaryIO, bytes],
        filename: str,
        container_type: str = 'certificates'
    ) -> str:
        """
        Uploads a certificate or OD letter.
        If Azure Blob Storage is configured, uploads directly to Azure and returns
        the Blob URL.
        Otherwise, falls back to storing on the local filesystem and returns
        the local API endpoint path.
        """
        content_type = cls._get_content_type(filename)

        # ── 1. Try Azure Blob Storage ─────────────────────────────────────────
        if cls.is_configured():
            try:
                client = cls.get_client()
                if client:
                    container_name = (
                        getattr(Config, 'AZURE_STORAGE_CONTAINER_CERTIFICATES', 'certificates')
                        if container_type == 'certificates'
                        else getattr(Config, 'AZURE_STORAGE_CONTAINER_OD_LETTERS', 'od-letters')
                    )

                    container_client = cls._ensure_container(client, container_name)
                    blob_client = container_client.get_blob_client(filename)

                    # Extract file bytes or stream
                    if isinstance(file_data, FileStorage):
                        file_data.stream.seek(0)
                        data_to_upload = file_data.stream.read()
                        file_data.stream.seek(0)
                    elif isinstance(file_data, (bytes, bytearray)):
                        data_to_upload = file_data
                    elif hasattr(file_data, 'read'):
                        data_to_upload = file_data.read()
                    else:
                        raise ValueError("Unsupported file_data type for blob upload")

                    blob_client.upload_blob(
                        data_to_upload,
                        overwrite=True,
                        content_settings=ContentSettings(content_type=content_type)
                    )

                    # Return the direct Blob URL
                    return blob_client.url
            except Exception as e:
                print(f"[!] Azure Blob upload failed ({e}). Falling back to local storage.")

        # ── 2. Local Filesystem Fallback ──────────────────────────────────────
        target_dir = (
            Config.CERTIFICATES_FOLDER
            if container_type == 'certificates'
            else Config.OD_LETTERS_FOLDER
        )
        os.makedirs(target_dir, exist_ok=True)
        local_path = os.path.join(target_dir, filename)

        if isinstance(file_data, FileStorage):
            file_data.stream.seek(0)
            file_data.save(local_path)
        elif isinstance(file_data, (bytes, bytearray)):
            with open(local_path, 'wb') as f:
                f.write(file_data)
        elif hasattr(file_data, 'read'):
            with open(local_path, 'wb') as f:
                f.write(file_data.read())

        url_prefix = (
            '/api/od-requests/uploads/certificates'
            if container_type == 'certificates'
            else '/api/od-requests/uploads/od_letters'
        )
        return f"{url_prefix}/{filename}"

    @classmethod
    def upload_certificate(cls, file_data: Union[FileStorage, BinaryIO, bytes], filename: str) -> str:
        """Helper to upload a student participation certificate."""
        return cls.upload_file(file_data, filename, container_type='certificates')

    @classmethod
    def upload_od_letter(cls, file_data: Union[FileStorage, BinaryIO, bytes], filename: str) -> str:
        """Helper to upload an OD application request document/letter."""
        return cls.upload_file(file_data, filename, container_type='od_letters')

    @classmethod
    def get_blob_stream(cls, filename: str, container_type: str = 'certificates') -> Optional[Tuple[io.BytesIO, str]]:
        """Download file stream and content type from Azure Blob Storage if available."""
        if not cls.is_configured():
            return None
        try:
            client = cls.get_client()
            if not client:
                return None
            container_name = (
                getattr(Config, 'AZURE_STORAGE_CONTAINER_CERTIFICATES', 'certificates')
                if container_type == 'certificates'
                else getattr(Config, 'AZURE_STORAGE_CONTAINER_OD_LETTERS', 'od-letters')
            )
            blob_client = client.get_container_client(container_name).get_blob_client(filename)
            downloader = blob_client.download_blob()
            stream = io.BytesIO(downloader.readall())
            content_type = cls._get_content_type(filename)
            return stream, content_type
        except Exception:
            return None
