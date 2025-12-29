
"""Tests for Config module."""

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


class TestConfig:
    """Test cases for the Config class."""

    def test_config_loads_with_env_values(self):
        """Test that config loads values from environment."""
        from src.config import Config

        cfg = Config()

        # Test that essential keys exist and have expected types
        assert cfg["api_version"] == "2024-12-01-preview"
        assert "azure_openai_endpoint" in cfg.as_dict

    def test_config_reads_environment_variables(self):
        """Test that config reads values from environment variables."""
        env_vars = {
            "AZURE_OPENAI_ENDPOINT": "https://custom.endpoint.com",
            "MODEL_DEPLOYMENT_NAME": "custom-model",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            from importlib import reload
            from src import config as config_module
            reload(config_module)

            cfg = config_module.Config()

            assert cfg["azure_openai_endpoint"] == "https://custom.endpoint.com"
            assert cfg["model_deployment_name"] == "custom-model"

    def test_config_getitem(self):
        """Test __getitem__ method returns correct values."""
        from src.config import Config

        cfg = Config()
        assert cfg["api_version"] == "2024-12-01-preview"
        assert cfg["nonexistent_key"] is None

    def test_config_get_with_default(self):
        """Test get method with default value."""
        from src.config import Config

        cfg = Config()
        assert cfg.get("nonexistent", "default_value") == "default_value"
        assert cfg.get("api_version") is not None

    def test_config_as_dict(self):
        """Test as_dict property returns a copy of config."""
        from src.config import Config

        cfg = Config()
        config_dict = cfg.as_dict

        assert isinstance(config_dict, dict)
        assert "azure_openai_endpoint" in config_dict

        # Verify it's a copy by modifying it
        original_endpoint = cfg["azure_openai_endpoint"]
        config_dict["azure_openai_endpoint"] = "modified"
        assert cfg["azure_openai_endpoint"] == original_endpoint

    def test_content_understanding_exists(self):
        """Test content understanding settings are present."""
        from src.config import Config

        cfg = Config()

        # Just verify these keys exist and are strings
        assert "content_understanding_endpoint" in cfg.as_dict

    def test_content_understanding_explicit(self):
        """Test explicit content understanding settings override fallback."""
        env_vars = {
            "AZURE_OPENAI_ENDPOINT": "https://openai.endpoint.com",
            "CONTENT_UNDERSTANDING_ENDPOINT": "https://cu.endpoint.com",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            from importlib import reload
            from src import config as config_module
            reload(config_module)

            cfg = config_module.Config()

            assert cfg["content_understanding_endpoint"] == "https://cu.endpoint.com"

    def test_default_constants(self):
        """Test that default constants are correctly defined."""
        from src.config import (
            DEFAULT_MODEL,
            DEFAULT_ANALYSIS_MODEL,
            DEFAULT_API_VERSION,
        )

        assert DEFAULT_MODEL == "gpt-4o"
        assert DEFAULT_ANALYSIS_MODEL == "gpt-4o-mini"
        assert DEFAULT_API_VERSION == "2024-12-01-preview"
