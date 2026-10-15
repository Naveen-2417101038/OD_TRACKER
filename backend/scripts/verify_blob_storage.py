"""
Verification script for Azure Blob Storage integration.
Tests connecting to Azure Blob Storage, ensuring containers exist, and uploading a test document.
"""
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.config import Config
from backend.services.blob_storage_service import BlobStorageService


def verify_blob_storage():
    print("=" * 60)
    print("Azure Blob Storage Verification")
    print("=" * 60)

    is_cfg = BlobStorageService.is_configured()
    print(f"[*] Blob Storage configured in .env: {is_cfg}")

    if not is_cfg:
        print("\n[!] AZURE_STORAGE_CONNECTION_STRING is not set in your .env file.")
        print("    Please add it to .env and run this script again.")
        return False

    client = BlobStorageService.get_client()
    if not client:
        print("[-] Failed to initialize Azure BlobServiceClient. Please check your credentials.")
        return False

    print(f"[+] Successfully connected to Azure Storage Account: {client.account_name}")

    # Test containers
    containers = [
        Config.AZURE_STORAGE_CONTAINER_CERTIFICATES,
        Config.AZURE_STORAGE_CONTAINER_OD_LETTERS
    ]

    for cname in containers:
        try:
            container_client = BlobStorageService._ensure_container(client, cname)
            print(f"[+] Container '{cname}' is ready.")
        except Exception as e:
            print(f"[-] Could not verify container '{cname}': {e}")
            return False

    # Test upload
    test_blob_name = "test_connectivity_check.txt"
    test_payload = b"OD Tracking System - Azure Blob Storage Connectivity OK"
    try:
        url = BlobStorageService.upload_certificate(test_payload, test_blob_name)
        print(f"[+] Test file uploaded successfully!")
        print(f"    Public Blob URL: {url}")
    except Exception as e:
        print(f"[-] Failed uploading test file to Azure Blob: {e}")
        return False

    # Clean up test file
    try:
        container = client.get_container_client(Config.AZURE_STORAGE_CONTAINER_CERTIFICATES)
        container.get_blob_client(test_blob_name).delete_blob()
        print(f"[+] Cleaned up temporary test file.")
    except Exception:
        pass

    print("\n[SUCCESS] Azure Blob Storage is fully configured and ready for production use!")
    return True


if __name__ == '__main__':
    verify_blob_storage()
