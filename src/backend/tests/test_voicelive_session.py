
"""Tests for VoiceLive Session Manager."""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.voicelive_session import (
    AZURE_COGNITIVE_SERVICES_DOMAIN,
    AZURE_VOICE_API_VERSION,
    DEFAULT_AVATAR_CHARACTER,
    DEFAULT_ECHO_CANCELLATION_TYPE,
    DEFAULT_NOISE_REDUCTION_TYPE,
    DEFAULT_TURN_DETECTION_TYPE,
    DEFAULT_VOICE_NAME,
    DEFAULT_VOICE_TYPE,
    LOG_MESSAGE_MAX_LENGTH,
    VoiceLiveSessionManager,
)


class TestVoiceLiveSessionManagerConstants:
    """Test constants are correctly defined."""

    def test_api_version(self):
        """Test API version constant."""
        assert AZURE_VOICE_API_VERSION == "2025-05-01-preview"

    def test_cognitive_services_domain(self):
        """Test cognitive services domain constant."""
        assert AZURE_COGNITIVE_SERVICES_DOMAIN == "cognitiveservices.azure.com"

    def test_default_constants(self):
        """Test default constant values."""
        assert DEFAULT_TURN_DETECTION_TYPE == "azure_semantic_vad"
        assert DEFAULT_NOISE_REDUCTION_TYPE == "azure_deep_noise_suppression"
        assert DEFAULT_ECHO_CANCELLATION_TYPE == "server_echo_cancellation"
        assert DEFAULT_AVATAR_CHARACTER == "simone"
        assert "en-US" in DEFAULT_VOICE_NAME
        assert DEFAULT_VOICE_TYPE == "azure-standard"
        assert LOG_MESSAGE_MAX_LENGTH == 100


class TestVoiceLiveSessionManager:
    """Test cases for VoiceLiveSessionManager."""

    @pytest.fixture
    def manager(self):
        """Create a VoiceLiveSessionManager instance."""
        return VoiceLiveSessionManager()

    def test_initialization(self, manager):
        """Test manager initializes with empty sessions."""
        assert manager.sessions == {}

    def test_build_endpoint(self, manager):
        """Test endpoint building."""
        with patch("src.services.voicelive_session.config", {"azure_ai_resource_name": "test-resource"}):
            endpoint = manager._build_endpoint()

        assert "test-resource" in endpoint
        assert AZURE_COGNITIVE_SERVICES_DOMAIN in endpoint

    def test_get_credential(self, manager):
        """Test credential retrieval."""
        with patch("src.services.voicelive_session.config", {"azure_openai_api_key": "test-key"}):
            credential = manager._get_credential()

        assert credential is not None

    def test_get_model_default(self, manager):
        """Test model retrieval with default."""
        with patch("src.services.voicelive_session.config") as mock_config:
            mock_config.get.return_value = "gpt-4o-realtime-preview"
            model = manager._get_model()

        assert model == "gpt-4o-realtime-preview"

    def test_get_model_configured(self, manager):
        """Test model retrieval with configured value."""
        with patch("src.services.voicelive_session.config") as mock_config:
            mock_config.get.return_value = "custom-model"
            model = manager._get_model()

        assert model == "custom-model"

    def test_get_function_tools(self, manager):
        """Test function tools definition."""
        tools = manager._get_function_tools()

        assert len(tools) > 0

        # Check mute_ai tool exists
        tool_names = [t.name for t in tools]
        assert "mute_ai" in tool_names

    def test_build_session_config_basic(self, manager):
        """Test session config building without system prompt."""
        with patch("src.services.voicelive_session.config") as mock_config:
            mock_config.get.side_effect = lambda k, d=None: d

            session_config = manager._build_session_config()

        assert session_config is not None
        # Should have modalities, turn_detection, etc.

    def test_build_session_config_with_prompt(self, manager):
        """Test session config building with system prompt."""
        with patch("src.services.voicelive_session.config") as mock_config:
            mock_config.get.side_effect = lambda k, d=None: d

            session_config = manager._build_session_config("You are a helpful assistant.")

        assert session_config is not None
        # Should include instructions when system prompt provided

    def test_create_session(self, manager):
        """Test session creation stores session data during processing."""
        mock_ws = MagicMock()

        # Store session_id that was added
        def mock_run_until_complete(coro):
            # Verify session was added during processing
            assert "test-session" in manager.sessions

        with patch.object(manager, "handle_connection_async", new_callable=AsyncMock):
            import asyncio
            real_loop = asyncio.new_event_loop()
            with patch("asyncio.new_event_loop", return_value=real_loop):
                with patch("asyncio.set_event_loop"):
                    with patch.object(real_loop, "run_until_complete", side_effect=mock_run_until_complete):
                        with patch.object(real_loop, "close"):
                            manager.create_session(
                                session_id="test-session",
                                system_prompt="Test prompt",
                                websocket=mock_ws,
                            )

        # Session should be cleaned up after create_session completes
        assert "test-session" not in manager.sessions

    def test_close_session(self, manager):
        """Test session closing removes session."""
        manager.sessions["test-session"] = {"data": "test"}

        manager.close_session("test-session")

        assert "test-session" not in manager.sessions

    def test_close_session_nonexistent(self, manager):
        """Test closing nonexistent session doesn't raise."""
        # Should not raise
        manager.close_session("nonexistent-session")

    def test_set_vad_enabled_existing_session(self, manager):
        """Test setting VAD for existing session."""
        manager.sessions["test-session"] = {"vad_enabled": True}

        manager.set_vad_enabled("test-session", False)

        assert manager.sessions["test-session"]["vad_enabled"] is False

    def test_set_vad_enabled_nonexistent_session(self, manager):
        """Test setting VAD for nonexistent session doesn't raise."""
        # Should not raise
        manager.set_vad_enabled("nonexistent", True)

    def test_handle_message_noop(self, manager):
        """Test handle_message is a no-op."""
        # Should not raise and do nothing
        manager.handle_message("test-session", "test message")

    @pytest.mark.asyncio
    async def test_send_message(self, manager):
        """Test sending message to websocket."""
        mock_ws = MagicMock()

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock()

            await manager._send_message(mock_ws, {"type": "test"})

    @pytest.mark.asyncio
    async def test_send_message_error(self, manager):
        """Test sending message handles errors gracefully."""
        mock_ws = MagicMock()

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock(side_effect=Exception("Error"))

            # Should not raise
            await manager._send_message(mock_ws, {"type": "test"})

    @pytest.mark.asyncio
    async def test_send_error(self, manager):
        """Test sending error message."""
        mock_ws = MagicMock()

        with patch.object(manager, "_send_message", new_callable=AsyncMock) as mock_send:
            await manager._send_error(mock_ws, "Test error")

            mock_send.assert_called_once()
            call_args = mock_send.call_args[0]
            assert call_args[1]["type"] == "error"
            assert "Test error" in call_args[1]["error"]["message"]

    @pytest.mark.asyncio
    async def test_execute_function_call_mute_ai(self, manager):
        """Test executing mute_ai function call."""
        mock_azure_conn = AsyncMock()
        mock_azure_conn.conversation = AsyncMock()
        mock_azure_conn.conversation.item = AsyncMock()
        mock_azure_conn.conversation.item.create = AsyncMock()
        mock_azure_conn.response = AsyncMock()
        mock_azure_conn.response.create = AsyncMock()

        mock_client_ws = MagicMock()

        fn_info = {
            "name": "mute_ai",
            "call_id": "call-123",
            "arguments": json.dumps({"reason": "User presenting"}),
            "previous_item_id": "prev-item",
        }

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock()

            await manager._execute_function_call(mock_azure_conn, mock_client_ws, fn_info)

        # Verify the function was called
        mock_azure_conn.conversation.item.create.assert_called_once()
        mock_azure_conn.response.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_function_call_unknown(self, manager):
        """Test executing unknown function call."""
        mock_azure_conn = AsyncMock()
        mock_azure_conn.conversation = AsyncMock()
        mock_azure_conn.conversation.item = AsyncMock()
        mock_azure_conn.conversation.item.create = AsyncMock()
        mock_azure_conn.response = AsyncMock()
        mock_azure_conn.response.create = AsyncMock()

        mock_client_ws = MagicMock()

        fn_info = {
            "name": "unknown_function",
            "call_id": "call-123",
            "arguments": "{}",
            "previous_item_id": "prev-item",
        }

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock()

            await manager._execute_function_call(mock_azure_conn, mock_client_ws, fn_info)

        # Should still complete without error

    @pytest.mark.asyncio
    async def test_execute_function_call_empty_arguments(self, manager):
        """Test executing function call with empty arguments."""
        mock_azure_conn = AsyncMock()
        mock_azure_conn.conversation = AsyncMock()
        mock_azure_conn.conversation.item = AsyncMock()
        mock_azure_conn.conversation.item.create = AsyncMock()
        mock_azure_conn.response = AsyncMock()
        mock_azure_conn.response.create = AsyncMock()

        mock_client_ws = MagicMock()

        fn_info = {
            "name": "mute_ai",
            "call_id": "call-123",
            "arguments": None,  # Empty arguments
            "previous_item_id": "prev-item",
        }

        with patch("asyncio.get_event_loop") as mock_loop:
            mock_loop.return_value.run_in_executor = AsyncMock()

            # Should not raise
            await manager._execute_function_call(mock_azure_conn, mock_client_ws, fn_info)
