import os
import sys

# Ensure root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.config import Config
from backend.database.mongodb import MongoDB, get_db, init_db
from backend.app import create_app

def main():
    print("=== TESTING FLASK + MONGODB INITIALIZATION ===")
    print(f"Config MONGO_URI: {Config.MONGO_URI}")
    print(f"Config MONGO_DB_NAME: {Config.MONGO_DB_NAME}")
    print(f"Config SECRET_KEY: {'[SET]' if Config.SECRET_KEY else '[NOT SET]'}")
    
    app = create_app()
    print("[+] Flask app created successfully!")
    
    status = MongoDB.get_status()
    print(f"MongoDB Status: {status}")
    
    with app.test_client() as client:
        # Test /api/health
        res = client.get('/api/health')
        print(f"[*] GET /api/health -> HTTP {res.status_code}, data: {res.get_json()}")
        
        # Test /api/auth/users
        res = client.get('/api/auth/users')
        print(f"[*] GET /api/auth/users -> HTTP {res.status_code}, count: {len(res.get_json().get('users', []))}")
        
    print("=== TEST COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    main()
