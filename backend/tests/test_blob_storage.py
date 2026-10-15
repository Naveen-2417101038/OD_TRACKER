"""
Unit tests for BlobStorageService and Certificate Storage.
"""
import io
import unittest
from unittest.mock import MagicMock, patch

from backend.services.blob_storage_service import BlobStorageService, MIME_MAP
from backend.config import Config


class TestBlobStorageService(unittest.TestCase):

    def test_mime_type_resolution(self):
        self.assertEqual(BlobStorageService._get_content_type("sample_cert.pdf"), "application/pdf")
        self.assertEqual(BlobStorageService._get_content_type("photo.png"), "image/png")
        self.assertEqual(BlobStorageService._get_content_type("picture.jpg"), "image/jpeg")
        self.assertEqual(BlobStorageService._get_content_type("scan.jpeg"), "image/jpeg")

    def test_local_fallback_upload_and_read(self):
        test_content = b"%PDF-1.4 test certificate binary content"
        test_filename = "test_unit_cert.pdf"

        # When Blob is not configured, should return local url
        with patch.object(BlobStorageService, 'is_configured', return_value=False):
            url = BlobStorageService.upload_certificate(test_content, test_filename)
            self.assertEqual(url, f"/api/od-requests/uploads/certificates/{test_filename}")

            # Verify file exists on local disk
            local_path = f"{Config.CERTIFICATES_FOLDER}/{test_filename}"
            import os
            self.assertTrue(os.path.exists(local_path))
            with open(local_path, 'rb') as f:
                self.assertEqual(f.read(), test_content)

            # Cleanup
            try:
                os.remove(local_path)
            except OSError:
                pass

    def test_mocked_azure_blob_upload(self):
        fake_blob_url = "https://mockstorage.blob.core.windows.net/certificates/cert_123.pdf"
        test_content = b"%PDF-1.4 mock azure certificate bytes"

        mock_client = MagicMock()
        mock_container = MagicMock()
        mock_blob = MagicMock()
        mock_blob.url = fake_blob_url
        mock_container.get_blob_client.return_value = mock_blob
        mock_client.get_container_client.return_value = mock_container

        with patch.object(BlobStorageService, 'is_configured', return_value=True), \
             patch.object(BlobStorageService, 'get_client', return_value=mock_client):

            result_url = BlobStorageService.upload_certificate(test_content, "cert_123.pdf")

            self.assertEqual(result_url, fake_blob_url)
            mock_blob.upload_blob.assert_called_once()
            call_args, call_kwargs = mock_blob.upload_blob.call_args
            self.assertEqual(call_args[0], test_content)
            self.assertTrue(call_kwargs.get('overwrite'))
            self.assertEqual(call_kwargs.get('content_settings').content_type, 'application/pdf')


if __name__ == '__main__':
    unittest.main()
