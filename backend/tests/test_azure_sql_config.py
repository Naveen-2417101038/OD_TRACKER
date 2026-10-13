"""
Unit tests for Azure SQL Database environment configuration, production guards,
authentication options, and credential masking.
"""
import os
import unittest
import urllib.parse
from unittest.mock import patch

from backend.database.sql_server import (
    build_sql_server_url,
    mask_credentials,
    is_production_environment,
    SQLServerDB,
)


class AzureSQLConfigTestCase(unittest.TestCase):

    def test_mask_credentials(self):
        """Verify passwords, tokens, and secrets are masked in strings."""
        sample_odbc = "DRIVER={ODBC Driver 18};SERVER=tcp:srv.database.windows.net,1433;UID=admin;PWD=SuperSecretPassword123!;Encrypt=yes"
        masked = mask_credentials(sample_odbc)
        self.assertNotIn("SuperSecretPassword123!", masked)
        self.assertIn("PWD=***", masked)

        url_str = "mssql+pyodbc://admin:SecretPass%21@srv.database.windows.net/db"
        masked_url = mask_credentials(url_str)
        self.assertNotIn("SecretPass%21", masked_url)
        self.assertIn("://admin:***@", masked_url)

    @patch.dict(os.environ, {"WEBSITE_SITE_NAME": "Rajalakshmi-ODTracker"}, clear=False)
    def test_production_detection_azure_app_service(self):
        """Verify Azure App Service WEBSITE_SITE_NAME is detected as production."""
        self.assertTrue(is_production_environment())

    @patch.dict(os.environ, {
        "WEBSITE_SITE_NAME": "Rajalakshmi-ODTracker",
        "AZURE_SQL_SERVER": "",
        "SQL_SERVER": "",
        "DATABASE_URL": "",
        "AZURE_SQL_CONNECTIONSTRING": ""
    }, clear=False)
    def test_production_missing_config_fails_safely(self):
        """Verify production fails with clear error if Azure database configuration is missing."""
        with self.assertRaises(ValueError) as ctx:
            build_sql_server_url()
        self.assertIn("Production / Azure App Service environment detected", str(ctx.exception))

    @patch.dict(os.environ, {
        "WEBSITE_SITE_NAME": "Rajalakshmi-ODTracker",
        "AZURE_SQL_SERVER": "DESKTOP-OTLUI9C\\MSSQLSERVER02",
        "AZURE_SQL_DATABASE": "ODTRACKINGDB"
    }, clear=False)
    def test_production_local_fallback_blocked(self):
        """Verify production rejects local SQL server instance names and prevents fallback."""
        with self.assertRaises(ValueError) as ctx:
            build_sql_server_url()
        self.assertIn("Silent fallback to local databases in production is forbidden", str(ctx.exception))

    @patch.dict(os.environ, {
        "WEBSITE_SITE_NAME": "Rajalakshmi-ODTracker",
        "AZURE_SQL_SERVER": "localhost",
        "AZURE_SQL_DATABASE": "ODTRACKINGDB"
    }, clear=False)
    def test_production_localhost_blocked(self):
        """Verify production rejects localhost as database server."""
        with self.assertRaises(ValueError) as ctx:
            build_sql_server_url()
        self.assertIn("Silent fallback to local databases in production is forbidden", str(ctx.exception))

    @patch.dict(os.environ, {
        "WEBSITE_SITE_NAME": "Rajalakshmi-ODTracker",
        "AZURE_SQL_SERVER": "my-azuresql.database.windows.net",
        "AZURE_SQL_DATABASE": "ODTRACKINGDB",
        "AZURE_SQL_AUTH_TYPE": "managed_identity",
        "AZURE_SQL_USER": "",
        "AZURE_SQL_PASSWORD": "",
        "SQL_USER": "",
        "SQL_PASSWORD": ""
    }, clear=False)
    def test_azure_managed_identity_url_generation(self):
        """Verify System-Assigned Managed Identity URL generation for Azure SQL."""
        url = build_sql_server_url()
        decoded = urllib.parse.unquote_plus(url)
        self.assertIn("SERVER=tcp:my-azuresql.database.windows.net,1433", decoded)
        self.assertIn("Authentication=ActiveDirectoryMsi", decoded)
        self.assertIn("Encrypt=yes", decoded)
        self.assertIn("TrustServerCertificate=no", decoded)
        # Ensure no UID or PWD
        self.assertNotIn("PWD=", decoded)

    @patch.dict(os.environ, {
        "WEBSITE_SITE_NAME": "Rajalakshmi-ODTracker",
        "AZURE_SQL_SERVER": "my-azuresql.database.windows.net",
        "AZURE_SQL_DATABASE": "ODTRACKINGDB",
        "AZURE_SQL_AUTH_TYPE": "sql",
        "AZURE_SQL_USER": "rec_admin",
        "AZURE_SQL_PASSWORD": "AzureSecurePassword123!"
    }, clear=False)
    def test_azure_sql_authentication_url_generation(self):
        """Verify Azure SQL authentication fallback URL generation with encryption and cert validation."""
        url = build_sql_server_url()
        decoded = urllib.parse.unquote_plus(url)
        self.assertIn("SERVER=tcp:my-azuresql.database.windows.net,1433", decoded)
        self.assertIn("UID=rec_admin", decoded)
        self.assertIn("PWD=AzureSecurePassword123!", decoded)
        self.assertIn("Encrypt=yes", decoded)
        self.assertIn("TrustServerCertificate=no", decoded)

    @patch.dict(os.environ, {
        "WEBSITE_SITE_NAME": "",
        "FLASK_ENV": "development",
        "ENVIRONMENT": "development",
        "AZURE_SQL_SERVER": "",
        "SQL_SERVER": "localhost\\MSSQLSERVER02",
        "SQL_DATABASE": "ODTRACKINGDB",
        "SQL_TRUSTED_CONNECTION": "yes",
        "SQL_USER": "",
        "SQL_PASSWORD": ""
    }, clear=False)
    def test_local_development_windows_auth(self):
        """Verify local development continues to use Windows Authentication with local settings."""
        url = build_sql_server_url()
        decoded = urllib.parse.unquote_plus(url)
        self.assertIn("SERVER=localhost\\MSSQLSERVER02", decoded)
        self.assertIn("Trusted_Connection=yes", decoded)
        self.assertIn("TrustServerCertificate=yes", decoded)
        self.assertIn("Encrypt=no", decoded)


if __name__ == '__main__':
    unittest.main()
