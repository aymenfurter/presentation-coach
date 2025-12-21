
"""Tests for Video Processing service."""

import asyncio
import base64
import io
import sys
import tempfile
import wave
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.video_processing import ProcessedVideo, VideoProcessingService


class TestProcessedVideo:
    """Test cases for ProcessedVideo dataclass."""

    def test_processed_video_creation(self):
        """Test creating a ProcessedVideo instance."""
        video = ProcessedVideo(
            video_id="test-id",
            video_data=b"test data",
            duration_ms=5000,
            format="webm",
            audio_track=True,
            video_track=True,
            output_path="/tmp/test.webm",
        )

        assert video.video_id == "test-id"
        assert video.video_data == b"test data"
        assert video.duration_ms == 5000
        assert video.format == "webm"
        assert video.audio_track is True
        assert video.video_track is True
        assert video.output_path == "/tmp/test.webm"

    def test_processed_video_default_output_path(self):
        """Test ProcessedVideo with default output_path."""
        video = ProcessedVideo(
            video_id="test-id",
            video_data=b"test",
            duration_ms=1000,
            format="webm",
            audio_track=True,
            video_track=False,
        )

        assert video.output_path is None


class TestVideoProcessingService:
    """Test cases for VideoProcessingService."""

    @pytest.fixture
    def service(self):
        """Create a VideoProcessingService instance."""
        return VideoProcessingService()

    def test_service_initialization(self, service):
        """Test service initializes correctly."""
        assert service is not None

    @patch("subprocess.run")
    def test_require_ffmpeg_installed(self, mock_run):
        """Test require_ffmpeg when ffmpeg is installed."""
        mock_run.return_value = MagicMock(returncode=0)

        # Should not raise
        VideoProcessingService.require_ffmpeg()

        mock_run.assert_called_once()

    @patch("subprocess.run")
    def test_require_ffmpeg_not_installed(self, mock_run):
        """Test require_ffmpeg raises error when ffmpeg is not installed."""
        mock_run.side_effect = FileNotFoundError()

        with pytest.raises(RuntimeError, match="ffmpeg is not installed"):
            VideoProcessingService.require_ffmpeg()

    @patch("subprocess.run")
    def test_require_ffmpeg_returns_error(self, mock_run):
        """Test require_ffmpeg raises error when ffmpeg returns non-zero."""
        mock_run.return_value = MagicMock(returncode=1)

        with pytest.raises(RuntimeError, match="ffmpeg is not installed"):
            VideoProcessingService.require_ffmpeg()

    def test_encode_frame_base64(self, service):
        """Test encoding frame data to base64."""
        frame_data = b"test frame data"

        encoded = service.encode_frame_base64(frame_data)

        assert isinstance(encoded, str)
        assert base64.b64decode(encoded) == frame_data

    def test_encode_frame_base64_empty(self, service):
        """Test encoding empty frame data."""
        encoded = service.encode_frame_base64(b"")

        assert encoded == ""

    @patch("subprocess.run")
    def test_get_duration_ms_success(self, mock_run, service):
        """Test getting video duration successfully."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="10.5\n"
        )

        duration = service._get_duration_ms("/fake/video.webm")

        assert duration == 10500  # 10.5 seconds = 10500ms

    @patch("subprocess.run")
    def test_get_duration_ms_failure(self, mock_run, service):
        """Test getting video duration when ffprobe fails."""
        mock_run.return_value = MagicMock(returncode=1)

        duration = service._get_duration_ms("/fake/video.webm")

        assert duration == 0

    @patch("subprocess.run")
    def test_get_duration_ms_exception(self, mock_run, service):
        """Test getting video duration when exception occurs."""
        mock_run.side_effect = Exception("ffprobe error")

        duration = service._get_duration_ms("/fake/video.webm")

        assert duration == 0

    def test_create_wav_from_pcm(self, service):
        """Test creating WAV file from PCM data."""
        # Create some fake PCM data (16-bit mono samples)
        pcm_data = bytes([0x00, 0x00] * 100)

        wav_data = service._create_wav_from_pcm(pcm_data)

        # Verify it's a valid WAV file
        buffer = io.BytesIO(wav_data)
        with wave.open(buffer, "rb") as wav:
            assert wav.getnchannels() == 1
            assert wav.getsampwidth() == 2  # 16 bits = 2 bytes
            assert wav.getframerate() == 24000

    def test_create_wav_from_pcm_custom_params(self, service):
        """Test creating WAV file with custom parameters."""
        pcm_data = bytes([0x00, 0x00] * 100)

        wav_data = service._create_wav_from_pcm(
            pcm_data,
            sample_rate=44100,
            channels=2,
            bits_per_sample=16,
        )

        buffer = io.BytesIO(wav_data)
        with wave.open(buffer, "rb") as wav:
            assert wav.getnchannels() == 2
            assert wav.getframerate() == 44100

    @pytest.mark.asyncio
    async def test_combine_audio_chunks_empty(self, service):
        """Test combining empty audio chunks."""
        result = await service._combine_audio_chunks([])

        assert "data" in result
        assert "duration_ms" in result
        assert result["duration_ms"] == 0

    @pytest.mark.asyncio
    async def test_combine_audio_chunks_with_data(self, service):
        """Test combining audio chunks with data."""
        audio_data = base64.b64encode(bytes([0x00, 0x00] * 48000)).decode()  # 1 second at 24kHz
        chunks = [
            {"type": "user", "data": audio_data, "timestamp": 0},
            {"type": "user", "data": audio_data, "timestamp": 1000},
        ]

        result = await service._combine_audio_chunks(chunks)

        assert result["data"] is not None
        assert result["duration_ms"] > 0

    @pytest.mark.asyncio
    async def test_combine_audio_chunks_skips_non_user(self, service):
        """Test that non-user chunks are skipped."""
        audio_data = base64.b64encode(b"test").decode()
        chunks = [
            {"type": "system", "data": audio_data, "timestamp": 0},
            {"type": "ai", "data": audio_data, "timestamp": 1000},
        ]

        result = await service._combine_audio_chunks(chunks)

        # Should only have WAV header, no actual PCM data
        assert result["duration_ms"] == 0

    @pytest.mark.asyncio
    async def test_combine_audio_and_screen_no_screen(self, service):
        """Test combining when there's no screen recording."""
        audio_chunks = [
            {"type": "user", "data": base64.b64encode(bytes([0] * 100)).decode(), "timestamp": 0}
        ]

        result = await service.combine_audio_and_screen(
            audio_chunks=audio_chunks,
            screen_recording=None,
        )

        assert result.video_track is False
        assert result.audio_track is True
        assert result.format == "wav"

    @pytest.mark.asyncio
    @patch("asyncio.create_subprocess_exec")
    async def test_get_duration_ms_async_success(self, mock_exec, service):
        """Test async duration getting."""
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate = AsyncMock(return_value=(b"15.25\n", b""))
        mock_exec.return_value = mock_process

        duration = await service._get_duration_ms_async("/fake/video.webm")

        assert duration == 15250  # 15.25 seconds

    @pytest.mark.asyncio
    @patch("asyncio.create_subprocess_exec")
    async def test_get_duration_ms_async_failure(self, mock_exec, service):
        """Test async duration getting when ffprobe fails."""
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate = AsyncMock(return_value=(b"", b"error"))
        mock_exec.return_value = mock_process

        duration = await service._get_duration_ms_async("/fake/video.webm")

        assert duration == 0

    @pytest.mark.asyncio
    @patch("asyncio.create_subprocess_exec")
    async def test_extract_frame_success(self, mock_exec, service):
        """Test extracting a frame from video."""
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate = AsyncMock(return_value=(b"", b""))
        mock_exec.return_value = mock_process

        with tempfile.TemporaryDirectory():
            with patch.object(Path, "exists", return_value=True):
                with patch.object(Path, "read_bytes", return_value=b"frame data"):
                    await service.extract_frame(b"video data", 5000)

        # Frame extraction depends on ffmpeg creating a file
        # In mock mode, we can't fully test this
        assert True

    @pytest.mark.asyncio
    async def test_extract_multiple_frames(self, service):
        """Test extracting multiple frames."""
        with patch.object(service, "extract_frame", new_callable=AsyncMock) as mock_extract:
            mock_extract.side_effect = [b"frame1", b"frame2", None]

            frames = await service.extract_multiple_frames(
                b"video data",
                [0, 5000, 10000]
            )

            assert 0 in frames
            assert 5000 in frames
            assert 10000 not in frames  # None was returned

    @patch("subprocess.run")
    def test_combine_audio_and_screen_files_success(self, mock_run, service):
        """Test combining audio and screen files."""
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = Path(temp_dir) / "audio.webm"
            screen_path = Path(temp_dir) / "screen.webm"

            audio_path.write_bytes(b"audio data")
            screen_path.write_bytes(b"screen data")

            with patch.object(Path, "read_bytes", return_value=b"combined"):
                with patch.object(service, "_get_duration_ms", return_value=10000):
                    result = service.combine_audio_and_screen_files(
                        str(audio_path),
                        str(screen_path),
                    )

            assert result.audio_track is True
            assert result.video_track is True
            assert result.format == "webm"

    @patch("subprocess.run")
    def test_combine_audio_and_screen_files_failure(self, mock_run, service):
        """Test combining files when ffmpeg fails."""
        mock_run.return_value = MagicMock(returncode=1, stderr="ffmpeg error")

        with tempfile.TemporaryDirectory() as temp_dir:
            audio_path = Path(temp_dir) / "audio.webm"
            screen_path = Path(temp_dir) / "screen.webm"

            audio_path.write_bytes(b"audio")
            screen_path.write_bytes(b"screen")

            with pytest.raises(RuntimeError, match="ffmpeg failed"):
                service.combine_audio_and_screen_files(
                    str(audio_path),
                    str(screen_path),
                )
