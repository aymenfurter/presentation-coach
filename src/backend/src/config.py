"""Configuration management for the presentation coach application."""

import os
from typing import Any, Dict

from dotenv import load_dotenv

load_dotenv()

# Default values as constants
DEFAULT_MODEL = "gpt-4o"
DEFAULT_ANALYSIS_MODEL = "gpt-4o-mini"
DEFAULT_API_VERSION = "2024-12-01-preview"
DEFAULT_VOICE_NAME = "en-US-Ava:DragonHDLatestNeural"
DEFAULT_VOICE_TYPE = "azure-standard"
DEFAULT_AVATAR_CHARACTER = "isabella"


class Config:
    """Application configuration class."""

    def __init__(self):
        """Initialize configuration from environment variables."""
        self._config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from environment variables with defaults."""
        result: Dict[str, Any] = {
            # Azure AI Foundry (used by VoiceLive)
            "azure_ai_resource_name": os.getenv("AZURE_AI_RESOURCE_NAME", ""),

            # Azure OpenAI
            "azure_openai_endpoint": os.getenv("AZURE_OPENAI_ENDPOINT", ""),
            "azure_openai_api_key": os.getenv("AZURE_OPENAI_API_KEY", ""),
            "model_deployment_name": os.getenv("MODEL_DEPLOYMENT_NAME", DEFAULT_MODEL),
            "analysis_model_deployment_name": os.getenv("ANALYSIS_MODEL_DEPLOYMENT_NAME", DEFAULT_ANALYSIS_MODEL),

            # API Version
            "api_version": DEFAULT_API_VERSION,

            # Voice Live API Settings
            "azure_voice_name": os.getenv("AZURE_VOICE_NAME", DEFAULT_VOICE_NAME),
            "azure_voice_type": os.getenv("AZURE_VOICE_TYPE", DEFAULT_VOICE_TYPE),
            "azure_avatar_character": os.getenv("AZURE_AVATAR_CHARACTER", DEFAULT_AVATAR_CHARACTER),

            # Content Understanding
            "content_understanding_endpoint": os.getenv(
                "CONTENT_UNDERSTANDING_ENDPOINT",
                os.getenv("AZURE_OPENAI_ENDPOINT", "")
            ),
            "content_understanding_key": os.getenv(
                "CONTENT_UNDERSTANDING_KEY",
                os.getenv("AZURE_OPENAI_API_KEY", "")
            ),
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
