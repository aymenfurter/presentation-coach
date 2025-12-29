"""Configuration management for the presentation coach application."""

import os
from typing import Any, Dict

from dotenv import load_dotenv

load_dotenv()

# Default values as constants
DEFAULT_MODEL = "gpt-4o"
DEFAULT_ANALYSIS_MODEL = "gpt-4o-mini"
DEFAULT_API_VERSION = "2024-12-01-preview"


class Config:
    """Application configuration class."""

    def __init__(self):
        """Initialize configuration from environment variables."""
        self._config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from environment variables with defaults."""
        result: Dict[str, Any] = {
            # Azure OpenAI
            "azure_openai_endpoint": os.getenv("AZURE_OPENAI_ENDPOINT", ""),
            "model_deployment_name": os.getenv("MODEL_DEPLOYMENT_NAME", DEFAULT_MODEL),
            "analysis_model_deployment_name": os.getenv("ANALYSIS_MODEL_DEPLOYMENT_NAME", DEFAULT_ANALYSIS_MODEL),

            # API Version
            "api_version": DEFAULT_API_VERSION,

            # Content Understanding
            "content_understanding_endpoint": os.getenv(
                "CONTENT_UNDERSTANDING_ENDPOINT",
                os.getenv("AZURE_OPENAI_ENDPOINT", "")
            ),

            # Azure Client ID (for managed identity)
            "azure_client_id": os.getenv("AZURE_CLIENT_ID", ""),
        }
        return result


    def __getitem__(self, key: str) -> Any:
        """Get configuration value by key."""
        return self._config.get(key)

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value with optional default."""
        return self._config.get(key, default)

    @property
    def as_dict(self) -> Dict[str, Any]:
        """Return configuration as dictionary."""
        return self._config.copy()


config = Config()
