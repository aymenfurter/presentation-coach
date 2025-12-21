"""WebSocket handling for voice proxy connections using Azure AI VoiceLive SDK."""

import asyncio
import json
import logging
from typing import Any, Dict, Optional

from azure.ai.voicelive.aio import (
    ConnectionClosed,
    ConnectionError as VoiceLiveConnectionError,
    VoiceLiveConnection,
    connect,
)
from azure.ai.voicelive.models import (
    AudioEchoCancellation,
    AudioNoiseReduction,
    AzureSemanticVad,
    AzureStandardVoice,
    FunctionCallOutputItem,
    FunctionTool,
    ItemType,
    Modality,
    RequestSession,
    ServerEventType,
    Tool,
    ToolChoiceLiteral,
)
from azure.core.credentials import AzureKeyCredential

from src.config import config

logger = logging.getLogger(__name__)

# Constants
AZURE_VOICE_API_VERSION = "2025-05-01-preview"
AZURE_COGNITIVE_SERVICES_DOMAIN = "cognitiveservices.azure.com"
DEFAULT_TURN_DETECTION_TYPE = "azure_semantic_vad"
DEFAULT_NOISE_REDUCTION_TYPE = "azure_deep_noise_suppression"
DEFAULT_ECHO_CANCELLATION_TYPE = "server_echo_cancellation"
DEFAULT_AVATAR_CHARACTER = "simone"
DEFAULT_VOICE_NAME = "en-US-Ava:DragonHDLatestNeural"
DEFAULT_VOICE_TYPE = "azure-standard"
LOG_MESSAGE_MAX_LENGTH = 100


class VoiceLiveSessionManager:
    """Handles WebSocket proxy connections between client and Azure Voice API."""

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

    def _build_endpoint(self) -> str:
        return f"https://{config['azure_ai_resource_name']}.{AZURE_COGNITIVE_SERVICES_DOMAIN}"

    def _get_credential(self) -> AzureKeyCredential:
        return AzureKeyCredential(config["azure_openai_api_key"])

    def _get_model(self) -> str:
        return config.get("model_deployment_name", "gpt-4o-realtime-preview")

    def _get_function_tools(self) -> list[Tool]:
        return [
            FunctionTool(
                name="mute_ai",
                description="Mute yourself so the user can present. You cannot unmute yourself.",
                parameters={
                    "type": "object",
                    "properties": {"reason": {"type": "string"}},
                    "required": [],
                },
            ),
        ]

    def _build_session_config(self, system_prompt: Optional[str] = None) -> RequestSession:
        """Build the session configuration."""
        session = RequestSession(
            modalities=[Modality.TEXT, Modality.AUDIO, Modality.AVATAR],
            turn_detection=AzureSemanticVad(type=DEFAULT_TURN_DETECTION_TYPE),
            input_audio_noise_reduction=AudioNoiseReduction(type=DEFAULT_NOISE_REDUCTION_TYPE),
            input_audio_echo_cancellation=AudioEchoCancellation(type=DEFAULT_ECHO_CANCELLATION_TYPE),
            voice=AzureStandardVoice(
                name=config.get("azure_voice_name", DEFAULT_VOICE_NAME),
                type=config.get("azure_voice_type", DEFAULT_VOICE_TYPE),
            ),
            avatar={
                "type": "photo-avatar",
                "model": "vasa-1",
                "character": config.get("azure_avatar_character", DEFAULT_AVATAR_CHARACTER),
                "customized": False,
            },
            input_audio_transcription={"model": "whisper-1"},
            tools=self._get_function_tools(),
            tool_choice=ToolChoiceLiteral.AUTO,
        )
        if system_prompt:
            session["instructions"] = system_prompt
            session["temperature"] = 0.7
            session["max_response_output_tokens"] = 2000
        return session

    async def handle_connection_async(self, client_ws: Any, system_prompt: Optional[str] = None) -> None:
        """Handle a WebSocket connection from a client."""
        try:
            async with connect(
                endpoint=self._build_endpoint(),
                credential=self._get_credential(),
                model=self._get_model(),
                api_version=AZURE_VOICE_API_VERSION,
            ) as azure_conn:
                await self._send_message(client_ws, {"type": "proxy.connected"})
                await azure_conn.session.update(session=self._build_session_config(system_prompt))
                await self._handle_message_forwarding(client_ws, azure_conn)

        except ConnectionClosed:
            pass
        except VoiceLiveConnectionError as e:
            await self._send_error(client_ws, str(e))
        except Exception as e:
            await self._send_error(client_ws, str(e))

    async def _handle_message_forwarding(
        self, client_ws: Any, azure_conn: VoiceLiveConnection
    ) -> None:
        """Handle bidirectional message forwarding."""
        pending_calls: Dict[str, Dict[str, Any]] = {}
        tasks = [
            asyncio.create_task(self._forward_client_to_azure(client_ws, azure_conn)),
            asyncio.create_task(self._forward_azure_to_client(azure_conn, client_ws, pending_calls)),
        ]
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()

    async def _forward_client_to_azure(
        self, client_ws: Any, azure_conn: VoiceLiveConnection
    ) -> None:
        """Forward messages from client to Azure."""
        try:
            while True:
                message = await asyncio.get_event_loop().run_in_executor(None, client_ws.receive)
                if message is None:
                    break
                parsed = json.loads(message) if isinstance(message, str) else message
                await azure_conn.send(parsed)
        except (ConnectionClosed, Exception):
            pass

    async def _forward_azure_to_client(
        self,
        azure_conn: VoiceLiveConnection,
        client_ws: Any,
        pending_calls: Dict[str, Dict[str, Any]],
    ) -> None:
        """Forward messages from Azure to client, handling function calls."""
        try:
            async for event in azure_conn:
                event_dict = event.as_dict() if hasattr(event, "as_dict") else dict(event)
                await asyncio.get_event_loop().run_in_executor(
                    None, client_ws.send, json.dumps(event_dict)
                )

                if event.type == ServerEventType.CONVERSATION_ITEM_CREATED:
                    item = event.item
                    if hasattr(item, "type") and item.type == ItemType.FUNCTION_CALL:
                        call_id = getattr(item, "call_id", None)
                        if call_id:
                            pending_calls[call_id] = {
                                "name": getattr(item, "name", ""),
                                "call_id": call_id,
                                "previous_item_id": getattr(item, "id", None),
                            }

                elif event.type == ServerEventType.RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
                    call_id = getattr(event, "call_id", None)
                    if call_id and call_id in pending_calls:
                        fn_info = pending_calls.pop(call_id)
                        fn_info["arguments"] = getattr(event, "arguments", "{}")
                        await self._execute_function_call(azure_conn, client_ws, fn_info)

        except (ConnectionClosed, Exception):
            pass

    async def _execute_function_call(
        self,
        azure_conn: VoiceLiveConnection,
        client_ws: Any,
        fn_info: Dict[str, Any],
    ) -> None:
        """Execute a function call and send the result back."""
        name = fn_info["name"]
        call_id = fn_info["call_id"]
        args = json.loads(fn_info.get("arguments", "{}") or "{}")

        if name == "mute_ai":
            result = {"success": True, "muted": True, "reason": args.get("reason", "User presenting")}
        else:
            result = {"error": f"Unknown function: {name}"}

        await azure_conn.conversation.item.create(
            previous_item_id=fn_info.get("previous_item_id"),
            item=FunctionCallOutputItem(call_id=call_id, output=json.dumps(result)),
        )

        await asyncio.get_event_loop().run_in_executor(
            None, client_ws.send, json.dumps({"type": "function_call.executed", "name": name, "result": result})
        )
        await azure_conn.response.create()

    async def _send_message(self, ws: Any, message: Dict[str, Any]) -> None:
        try:
            await asyncio.get_event_loop().run_in_executor(None, ws.send, json.dumps(message))
        except Exception:
            pass

    async def _send_error(self, ws: Any, error_message: str) -> None:
        await self._send_message(ws, {"type": "error", "error": {"message": error_message}})

    # Synchronous wrapper methods for Flask

    def create_session(
        self,
        session_id: str,
        system_prompt: str,
        websocket: Any,
        avatar_config: Optional[Dict[str, Any]] = None
    ) -> None:
        """Create and run a VoiceLive session synchronously."""
        self.sessions[session_id] = {
            "system_prompt": system_prompt,
            "avatar_config": avatar_config,
            "vad_enabled": True,
        }
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self.handle_connection_async(websocket, system_prompt))
        finally:
            loop.close()
            self.sessions.pop(session_id, None)

    def handle_message(self, session_id: str, message: str) -> None:
        """No-op for API compatibility."""
        pass

    def close_session(self, session_id: str) -> None:
        self.sessions.pop(session_id, None)

    def set_vad_enabled(self, session_id: str, enabled: bool) -> None:
        if session_id in self.sessions:
            self.sessions[session_id]["vad_enabled"] = enabled
