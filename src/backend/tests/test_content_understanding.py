
"""Tests for Content Understanding service."""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from src.services.content_understanding import (
    AzureContentUnderstandingClient,
    ContentUnderstandingResult,
    ContentUnderstandingService,
    VideoSegment,
)

TEST_VIDEO_PATH = Path(__file__).parent.parent.parent.parent / "combined_fixed.webm"


class TestVideoSegment:
    """Test cases for VideoSegment dataclass."""

    def test_video_segment_creation(self):
        """Test creating a VideoSegment instance."""
        segment = VideoSegment(
            segment_id="seg1",
            start_time_ms=0,
            end_time_ms=30000,
            segment_type="slide",
            description="Intro slide",
            transcript="Hello world",
            words_per_second=2.5,
            word_count=2,
        )

        assert segment.segment_id == "seg1"
        assert segment.start_time_ms == 0
        assert segment.end_time_ms == 30000
        assert segment.segment_type == "slide"
        assert segment.transcript == "Hello world"

    def test_video_segment_optional_thumbnail(self):
        """Test VideoSegment with optional thumbnail."""
        segment = VideoSegment(
            segment_id="seg1",
            start_time_ms=0,
            end_time_ms=30000,
            segment_type="person",
            description="Speaker",
            transcript="Test",
            thumbnail_base64="base64data",
        )

        assert segment.thumbnail_base64 == "base64data"


class TestContentUnderstandingResult:
    """Test cases for ContentUnderstandingResult dataclass."""

    def test_result_creation(self):
        """Test creating a ContentUnderstandingResult."""
        segments = [
            VideoSegment(
                segment_id="s1",
                start_time_ms=0,
                end_time_ms=10000,
                segment_type="slide",
                description="Test",
                transcript="Test transcript",
            )
        ]

        result = ContentUnderstandingResult(
            segments=segments,
            full_transcript="Test transcript",
            duration_ms=10000,
            key_frames=[{"time": 0}],
            raw_response={"status": "ok"},
        )

        assert len(result.segments) == 1
        assert result.duration_ms == 10000
        assert result.full_transcript == "Test transcript"


class TestAzureContentUnderstandingClient:
    """Test cases for AzureContentUnderstandingClient."""

    @pytest.fixture
    def client(self):
        """Create a client instance."""
        return AzureContentUnderstandingClient(
            endpoint="https://test.endpoint.com/",
            api_version="2024-12-01-preview",
            credential=MagicMock(),
        )

    def test_client_initialization(self, client):
        """Test client initializes correctly."""
        assert client._endpoint == "https://test.endpoint.com"
        assert client._api_version == "2024-12-01-preview"
        assert client._credential is not None

    def test_get_analyzer_url(self, client):
        """Test analyzer URL construction."""
        url = client._get_analyzer_url("my-analyzer")

        assert "my-analyzer" in url
        assert "api-version" in url

    def test_get_analyze_url(self, client):
        """Test analyze URL construction."""
        url = client._get_analyze_url("my-analyzer")

        assert "my-analyzer" in url
        assert ":analyze" in url

    @patch("requests.put")
    def test_begin_create_analyzer(self, mock_put, client, tmp_path):
        """Test creating an analyzer."""
        # Create a template file
        template_file = tmp_path / "template.json"
        template_file.write_text('{"type": "video"}')

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_put.return_value = mock_response

        result = client.begin_create_analyzer("test-analyzer", str(template_file))

        mock_put.assert_called_once()
        assert result == mock_response

    @patch("requests.delete")
    def test_delete_analyzer(self, mock_delete, client):
        """Test deleting an analyzer."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_delete.return_value = mock_response

        client.delete_analyzer("test-analyzer")

        mock_delete.assert_called_once()

    @patch("requests.post")
    def test_begin_analyze(self, mock_post, client):
        """Test starting analysis."""
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        result = client.begin_analyze("test-analyzer", b"video data")

        mock_post.assert_called_once()
        assert result == mock_response

    @patch("requests.get")
    @patch("time.sleep")
    def test_poll_result_success(self, mock_sleep, mock_get, client):
        """Test polling for results - success."""
        mock_response = MagicMock()
        mock_response.headers = {"operation-location": "https://test.endpoint.com/operation/123"}

        mock_get.return_value.json.return_value = {"status": "Succeeded"}

        result = client.poll_result(mock_response, timeout_seconds=10)

        assert result["status"] == "Succeeded"

    @patch("requests.get")
    @patch("time.sleep")
    def test_poll_result_failed(self, mock_sleep, mock_get, client):
        """Test polling for results - failure."""
        mock_response = MagicMock()
        mock_response.headers = {"operation-location": "https://test.endpoint.com/operation/123"}

        mock_get.return_value.json.return_value = {"status": "Failed", "error": "Something went wrong"}

        with pytest.raises(RuntimeError, match="Analysis failed"):
            client.poll_result(mock_response, timeout_seconds=10)

    @patch("requests.get")
    @patch("time.sleep")
    def test_poll_result_timeout(self, mock_sleep, mock_get, client):
        """Test polling for results - timeout."""
        mock_response = MagicMock()
        mock_response.headers = {"operation-location": "https://test.endpoint.com/operation/123"}

        mock_get.return_value.json.return_value = {"status": "Running"}

        with pytest.raises(TimeoutError, match="timed out"):
            client.poll_result(mock_response, timeout_seconds=1, polling_interval_seconds=0.1)


class TestContentUnderstandingService:
    """Test cases for ContentUnderstandingService."""

    @pytest.fixture
    def service(self):
        """Create a ContentUnderstandingService instance."""
        return ContentUnderstandingService()

    def test_service_initialization(self, service):
        """Test service initializes correctly."""
        assert service.endpoint is not None
        assert service.API_VERSION == "2024-12-01-preview"

    def test_client_property_lazy_init(self, service):
        """Test client is lazily initialized."""
        assert service._client is None

        # Access client property
        _ = service.client

        assert service._client is not None

    def test_get_field_with_value(self, service):
        """Test _get_field extracts value correctly."""
        fields = {"segmentType": {"valueString": "slide"}}

        result = service._get_field(fields, "segmentType")

        assert result == "slide"

    def test_get_field_default(self, service):
        """Test _get_field returns default when not found."""
        fields = {}

        result = service._get_field(fields, "segmentType", "other")

        assert result == "other"

    def test_get_field_case_variation(self, service):
        """Test _get_field handles case variations."""
        fields = {"SegmentType": {"valueString": "slide"}}

        result = service._get_field(fields, "segmentType")

        assert result == "slide"

    def test_parse_results_empty(self, service):
        """Test parsing empty results."""
        raw_result = {"result": {"contents": []}}

        result = service._parse_results(raw_result)

        assert result.segments == []
        assert result.full_transcript == ""
        assert result.duration_ms == 0

    def test_parse_results_with_segments(self, service):
        """Test parsing results with segments."""
        raw_result = {
            "result": {
                "contents": [
                    {
                        "startTimeMs": 0,
                        "endTimeMs": 30000,
                        "fields": {"segmentType": {"valueString": "slide"}},
                        "transcriptPhrases": [
                            {"text": "Hello"},
                            {"text": "world"}
                        ]
                    },
                    {
                        "startTimeMs": 30000,
                        "endTimeMs": 60000,
                        "fields": {"segmentType": {"valueString": "person"}},
                        "transcriptPhrases": [{"text": "Thank you"}]
                    }
                ]
            }
        }

        result = service._parse_results(raw_result)

        assert len(result.segments) == 2
        assert result.segments[0].segment_type == "slide"
        assert "Hello world" in result.segments[0].transcript
        assert result.duration_ms == 60000

    @pytest.mark.asyncio
    async def test_analyze_video_calls_client(self, service):
        """Test analyze_video method calls client methods."""
        from unittest.mock import MagicMock, patch

        mock_client = MagicMock()
        mock_client.begin_create_analyzer.return_value = MagicMock()
        mock_client.poll_result.return_value = {"result": {"contents": []}}
        mock_client.begin_analyze.return_value = MagicMock()
        mock_client.delete_analyzer.return_value = None

        # Set the private _client directly to bypass the property
        service._client = mock_client

        result = await service.analyze_video(b"video data", "investment_pitch")

        assert mock_client.begin_create_analyzer.called
        assert mock_client.begin_analyze.called
        assert result.segments == []


def truncate(text: str, max_length: int = 100) -> str:
    """Truncate text with ellipsis if exceeding max length."""
    return f"{text[:max_length]}..." if len(text) > max_length else text


@pytest.mark.asyncio
async def test_analyze_video_with_combined_webm():
    """Test analyzing the combined.webm file requires real credentials."""
    if not TEST_VIDEO_PATH.exists():
        pytest.skip(f"Test video not found at {TEST_VIDEO_PATH}")

    # This test requires real Azure credentials, so we skip in CI
    import os
    if os.getenv("CI") or "test.openai.azure.com" in os.getenv("AZURE_OPENAI_ENDPOINT", ""):
        pytest.skip("Skipping integration test in CI environment")

    service = ContentUnderstandingService()
    video_data = TEST_VIDEO_PATH.read_bytes()

    result = await service.analyze_video(
        video_data=video_data,
        presentation_type="investment_pitch"
    )

    assert result.segments, "Expected at least one segment"

    for segment in result.segments:
        assert segment.segment_type
        assert segment.start_time_ms >= 0
        assert segment.end_time_ms >= segment.start_time_ms


@pytest.mark.asyncio
async def test_parse_results_integration():
    """Test that _parse_results correctly processes API-like responses."""
    service = ContentUnderstandingService()

    # Simulated API response
    raw_result = {
        "result": {
            "contents": [
                {
                    "startTimeMs": 0,
                    "endTimeMs": 30000,
                    "fields": {"segmentType": {"valueString": "slide"}},
                    "transcriptPhrases": [{"text": "Hello world"}],
                }
            ]
        }
    }

    result = service._parse_results(raw_result)

    assert result.duration_ms == 30000
    assert len(result.segments) == 1
    assert result.segments[0].segment_type == "slide"
