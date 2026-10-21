"""
Sync local uploaded OD letters and certificates to Azure Blob Storage containers:
- backend/uploads/od_letters -> Azure Blob Container 'odletters'
- backend/uploads/certificates -> Azure Blob Container 'certificates'
Storage Account: 'odtrackerstorage'
"""
import os
import sys

# Ensure backend root is on path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PARENT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))
for d in [BASE_DIR, PARENT_DIR]:
    if d not in sys.path:
        sys.path.insert(0, d)

try:
    from backend.config import Config
    from backend.services.blob_storage_service import blob_storage
except ImportError:
    from config import Config
    from services.blob_storage_service import blob_storage

def sync_all_uploads():
    print("[*] Starting Azure Blob Storage Sync for 'odtrackerstorage'...")
    if not blob_storage.is_enabled():
        print("[!] Azure Blob Storage is not configured or accessible. Skipping sync.")
        return False

    synced_letters = 0
    synced_certs = 0

    # 1. Sync OD letters
    if os.path.exists(Config.OD_LETTERS_FOLDER):
        for f in os.listdir(Config.OD_LETTERS_FOLDER):
            if f.startswith('.'):
                continue
            fp = os.path.join(Config.OD_LETTERS_FOLDER, f)
            if os.path.isfile(fp):
                res = blob_storage.upload_file('odletters', f, fp)
                if res.get('success'):
                    synced_letters += 1

    # 2. Sync Certificates
    if os.path.exists(Config.CERTIFICATES_FOLDER):
        for f in os.listdir(Config.CERTIFICATES_FOLDER):
            if f.startswith('.'):
                continue
            fp = os.path.join(Config.CERTIFICATES_FOLDER, f)
            if os.path.isfile(fp):
                res = blob_storage.upload_file('certificates', f, fp)
                if res.get('success'):
                    synced_certs += 1

    print(f"[✓] Azure Blob Storage Sync completed: {synced_letters} OD letters -> 'odletters', {synced_certs} certificates -> 'certificates'")
    return True

sync_uploads_to_blob = sync_all_uploads

if __name__ == '__main__':
    sync_all_uploads()
