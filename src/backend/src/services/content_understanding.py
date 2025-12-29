"""Azure Content Understanding service for video analysis."""

import json
import logging
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from azure.core.credentials import TokenCredential
from azure.identity import DefaultAzureCredential

from src.config import config

logger = logging.getLogger(__name__)


@dataclass
class VideoSegment:
    """Represents a segment of the analyzed video."""
    segment_id: str
    start_time_ms: int
    end_time_ms: int
    segment_type: str
    description: str
    transcript: str
    words_per_second: float = 0.0
    word_count: int = 0
    thumbnail_base64: Optional[str] = None


@dataclass
class ContentUnderstandingResult:
    """Result from Content Understanding analysis."""
    segments: List[VideoSegment]
    full_transcript: str
    duration_ms: int
    key_frames: List[Dict[str, Any]]
    raw_response: Dict[str, Any]


class AzureContentUnderstandingClient:
    """Client for Azure Content Understanding API."""

    def __init__(
        self,
        endpoint: str,
        api_version: str,
        credential: TokenCredential,
        x_ms_useragent: str = "presentation-coach",
    ):
        self._endpoint = endpoint.rstrip("/")
        self._api_version = api_version
        self._credential = credential
        self._headers = {
            "x-ms-useragent": x_ms_useragent,
        }

    def _get_token(self) -> str:
        token = self._credential.get_token("https://cognitiveservices.azure.com/.default")
        return token.token

    def _get_headers(self) -> Dict[str, str]:
        headers = self._headers.copy()
        headers["Authorization"] = f"Bearer {self._get_token()}"
        return headers

    def _get_analyzer_url(self, analyzer_id: str) -> str:
        return f"{self._endpoint}/contentunderstanding/analyzers/{analyzer_id}?api-version={self._api_version}"

    def _get_analyze_url(self, analyzer_id: str) -> str:
        return f"{self._endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze?api-version={self._api_version}"

    def begin_create_analyzer(
        self,
        analyzer_id: str,
        analyzer_template_path: str,
    ) -> requests.Response:
        """Create an analyzer with the given ID and template."""
        with open(analyzer_template_path) as f:
            template = json.load(f)

        response = requests.put(
            url=self._get_analyzer_url(analyzer_id),
            headers={"Content-Type": "application/json", **self._get_headers()},
            json=template,
        )
        response.raise_for_status()
        logger.info(f"Analyzer {analyzer_id} created")
        return response

    def delete_analyzer(self, analyzer_id: str) -> None:
        """Delete an analyzer."""
        response = requests.delete(self._get_analyzer_url(analyzer_id), headers=self._get_headers())
        response.raise_for_status()
        logger.info(f"Analyzer {analyzer_id} deleted")

    def begin_analyze(self, analyzer_id: str, file_data: bytes) -> requests.Response:
        """Begin analysis of video data."""
        response = requests.post(
            url=self._get_analyze_url(analyzer_id),
            headers={"Content-Type": "application/octet-stream", **self._get_headers()},
            data=file_data,
        )
        response.raise_for_status()
        logger.info(f"Analysis started for analyzer: {analyzer_id}")
        return response

    def poll_result(
        self,
        response: requests.Response,
        timeout_seconds: int = 3600,
        polling_interval_seconds: int = 5,
    ) -> dict:
        """Poll for analysis results until complete."""
        operation_location = response.headers["operation-location"]
        start_time = time.time()

        while (elapsed := time.time() - start_time) < timeout_seconds:
            result = requests.get(operation_location, headers=self._get_headers()).json()
            status = result.get("status", "").lower()

            if status == "succeeded":
                logger.info(f"Analysis completed in {elapsed:.1f}s")
                return result
            if status == "failed":
                raise RuntimeError(f"Analysis failed: {result}")

            logger.info(f"Polling... {elapsed:.1f}s elapsed")
            time.sleep(polling_interval_seconds)

        raise TimeoutError(f"Operation timed out after {timeout_seconds}s")


class ContentUnderstandingService:
    """Service for analyzing videos using Azure Content Understanding."""

    API_VERSION = "2024-12-01-preview"
    TEMPLATE_PATH = Path(__file__).parent.parent / "analyzer_templates" / "video_content_understanding.json"

    def __init__(self):
        self.endpoint = config["content_understanding_endpoint"]
        self._client: Optional[AzureContentUnderstandingClient] = None

    @property
    def client(self) -> AzureContentUnderstandingClient:
        """Lazily create the Content Understanding client."""
        if self._client is None:
            self._client = AzureContentUnderstandingClient(
                endpoint=self.endpoint,
                api_version=self.API_VERSION,
                credential=DefaultAzureCredential(),
            )
        return self._client

    async def analyze_video(
        self,
        video_data: bytes,
        presentation_type: str,
    ) -> ContentUnderstandingResult:
        """Analyze a video using Azure Content Understanding."""
        analyzer_id = f"presentation-analyzer-{uuid.uuid4().hex[:8]}"

        # Create analyzer
        response = self.client.begin_create_analyzer(analyzer_id, str(self.TEMPLATE_PATH))
        self.client.poll_result(response, timeout_seconds=60, polling_interval_seconds=1)

        # Run analysis
        response = self.client.begin_analyze(analyzer_id, video_data)
        raw_result = self.client.poll_result(response, timeout_seconds=3600)

        # Cleanup
        try:
            self.client.delete_analyzer(analyzer_id)
        except Exception:
            pass

        return self._parse_results(raw_result)

    def _parse_results(self, raw_result: Dict[str, Any]) -> ContentUnderstandingResult:
        """Parse raw API response into structured result."""
        contents = raw_result.get("result", {}).get("contents", [])
        segments = []
        transcripts = []

        for idx, content in enumerate(contents):
            start_ms = content.get("startTimeMs", 0)
            end_ms = content.get("endTimeMs", 0)
            fields = content.get("fields", {})

            transcript = " ".join(p.get("text", "") for p in content.get("transcriptPhrases", []))
            word_count = len(transcript.split())
            duration_sec = max((end_ms - start_ms) / 1000.0, 0.1)

            segments.append(VideoSegment(
                segment_id=f"segment_{idx}",
                start_time_ms=start_ms,
                end_time_ms=end_ms,
                segment_type=self._get_field(fields, "segmentType", "other").lower(),
                description=self._get_field(fields, "description", ""),
                transcript=transcript,
                words_per_second=word_count / duration_sec,
                word_count=word_count,
            ))
            if transcript:
                transcripts.append(transcript)

        segments.sort(key=lambda s: s.start_time_ms)
        duration_ms = max((s.end_time_ms for s in segments), default=0)

        return ContentUnderstandingResult(
            segments=segments,
            full_transcript=" ".join(transcripts),
            duration_ms=duration_ms,
            key_frames=[],
            raw_response=raw_result,
        )

    def _get_field(self, fields: Dict, name: str, default: str = "") -> str:
        """Extract string value from fields dict."""
        field = fields.get(name) or fields.get(name[0].upper() + name[1:]) or {}
        return field.get("valueString", default)
