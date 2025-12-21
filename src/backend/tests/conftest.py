
"""Pytest configuration and shared fixtures for backend tests."""

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add the src directory to the path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set environment variables before importing modules that use config
os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com")
os.environ.setdefault("AZURE_OPENAI_API_KEY", "test-key")
os.environ.setdefault("CONTENT_UNDERSTANDING_ENDPOINT", "https://test.openai.azure.com")
os.environ.setdefault("CONTENT_UNDERSTANDING_KEY", "test-key")
os.environ.setdefault("AZURE_AI_RESOURCE_NAME", "test-resource")


@pytest.fixture
def mock_config():
    """Provide a mock configuration dictionary."""
    return {
        "azure_ai_resource_name": "test-resource",
        "azure_ai_region": "eastus",
        "azure_ai_project_name": "test-project",
        "project_endpoint": "https://test.endpoint.com",
        "use_azure_ai_agents": False,
        "agent_id": "",
        "port": 8000,
        "host": "0.0.0.0",
        "azure_openai_endpoint": "https://test.openai.azure.com",
        "azure_openai_api_key": "test-api-key",
        "model_deployment_name": "gpt-4o",
        "analysis_model_deployment_name": "gpt-4o-mini",
        "subscription_id": "test-subscription",
        "resource_group_name": "test-rg",
        "api_version": "2024-12-01-preview",
        "azure_input_transcription_model": "azure-speech",
        "azure_input_transcription_language": "en-US",
        "azure_input_noise_reduction_type": "azure_deep_noise_suppression",
        "azure_voice_name": "en-US-Ava:DragonHDLatestNeural",
        "azure_voice_type": "azure-standard",
        "azure_avatar_character": "isabella",
        "azure_avatar_style": "casual-sitting",
        "content_understanding_endpoint": "https://test.openai.azure.com",
        "content_understanding_key": "test-key",
    }


@pytest.fixture
def sample_video_segment():
    """Provide a sample VideoSegment for testing."""
    from src.services.content_understanding import VideoSegment

    return VideoSegment(
        segment_id="segment_0",
        start_time_ms=0,
        end_time_ms=30000,
        segment_type="slide",
        description="Introduction slide",
        transcript="Hello everyone, welcome to this presentation.",
        words_per_second=2.5,
        word_count=7,
        thumbnail_base64=None,
    )


@pytest.fixture
def sample_content_understanding_result(sample_video_segment):
    """Provide a sample ContentUnderstandingResult for testing."""
    from src.services.content_understanding import ContentUnderstandingResult, VideoSegment

    segments = [
        sample_video_segment,
        VideoSegment(
            segment_id="segment_1",
            start_time_ms=30000,
            end_time_ms=60000,
            segment_type="person",
            description="Speaker talking",
            transcript="Let me explain the key features of our product.",
            words_per_second=2.8,
            word_count=9,
        ),
        VideoSegment(
            segment_id="segment_2",
            start_time_ms=60000,
            end_time_ms=90000,
            segment_type="slide",
            description="Features slide",
            transcript="Here are the main features we offer.",
            words_per_second=2.2,
            word_count=7,
        ),
    ]

    return ContentUnderstandingResult(
        segments=segments,
        full_transcript=" ".join(s.transcript for s in segments),
        duration_ms=90000,
        key_frames=[],
        raw_response={"mock": True},
    )


@pytest.fixture
def mock_openai_client():
    """Provide a mock AsyncAzureOpenAI client."""
    mock_client = MagicMock()
    mock_client.chat = MagicMock()
    mock_client.chat.completions = MagicMock()
    mock_client.chat.completions.create = AsyncMock()
    return mock_client


@pytest.fixture
def temp_video_file(tmp_path):
    """Create a temporary video file for testing."""
    video_path = tmp_path / "test_video.webm"
    # Create a minimal valid file (not a real video, but for path testing)
    video_path.write_bytes(b"fake video content")
    return video_path


@pytest.fixture
def temp_audio_file(tmp_path):
    """Create a temporary audio file for testing."""
    audio_path = tmp_path / "test_audio.webm"
    audio_path.write_bytes(b"fake audio content")
    return audio_path
