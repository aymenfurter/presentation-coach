"""Video processing service for combining audio and screen recordings."""

import asyncio
import base64
import io
import logging
import subprocess
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ProcessedVideo:
    """Result of video processing."""
    video_id: str
    video_data: bytes
    duration_ms: int
    format: str
    audio_track: bool
    video_track: bool
    output_path: Optional[str] = None


class VideoProcessingService:
    """Service for processing and combining video/audio recordings."""

    def __init__(self):
        pass

    @staticmethod
    def require_ffmpeg():
        """Check that ffmpeg is installed and raise an error if not."""
        try:
            result = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return
        except (subprocess.SubprocessError, FileNotFoundError):
            pass

        raise RuntimeError(
            "\nffmpeg is not installed!\n"
            "Install with: sudo apt install ffmpeg (Linux) | brew install ffmpeg (macOS)"
        )

    def combine_audio_and_screen_files(
        self,
        audio_path: str,
        screen_path: str,
        output_format: str = "webm"
    ) -> ProcessedVideo:
        """Combine audio and screen recording files into a single video."""
        video_id = str(uuid.uuid4())
        output_path = Path(audio_path).parent / f"combined.{output_format}"

        cmd = [
            "ffmpeg", "-y",
            "-i", screen_path,
            "-i", audio_path,
            "-r", "5",
            "-c:v", "libvpx-vp9",
            "-crf", "30",
            "-b:v", "0",
            "-c:a", "libopus" if output_format == "webm" else "aac",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            str(output_path)
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr}")

        return ProcessedVideo(
            video_id=video_id,
            video_data=output_path.read_bytes(),
            duration_ms=self._get_duration_ms(str(output_path)),
            format=output_format,
            audio_track=True,
            video_track=True,
            output_path=str(output_path),
        )

    def _get_duration_ms(self, video_path: str) -> int:
        """Get video duration in milliseconds using ffprobe."""
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                return int(float(result.stdout.strip()) * 1000)
        except Exception:
            pass
        return 0

    async def combine_audio_and_screen(
        self,
        audio_chunks: List[Dict[str, Any]],
        screen_recording: Optional[bytes],
        output_format: str = "webm"
    ) -> ProcessedVideo:
        """Combine audio chunks and screen recording into a single video."""
        video_id = str(uuid.uuid4())

        if screen_recording:
            combined = await self._combine_with_ffmpeg(audio_chunks, screen_recording, output_format)
            return ProcessedVideo(
                video_id=video_id,
                video_data=combined["data"],
                duration_ms=combined["duration_ms"],
                format=output_format,
                audio_track=True,
                video_track=True,
            )

        audio_data = await self._combine_audio_chunks(audio_chunks)
        return ProcessedVideo(
            video_id=video_id,
            video_data=audio_data["data"],
            duration_ms=audio_data["duration_ms"],
            format="wav",
            audio_track=True,
            video_track=False,
        )

    async def _combine_with_ffmpeg(
        self,
        audio_chunks: List[Dict[str, Any]],
        screen_recording: bytes,
        output_format: str
    ) -> Dict[str, Any]:
        """Use ffmpeg to combine audio and video."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            video_path = temp_path / "screen.webm"
            video_path.write_bytes(screen_recording)

            audio_path = temp_path / "audio.wav"
            audio_result = await self._combine_audio_chunks(audio_chunks)
            audio_path.write_bytes(audio_result["data"])

            output_path = temp_path / f"combined.{output_format}"

            cmd = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-c:v", "copy" if output_format == "webm" else "libx264",
                "-c:a", "opus" if output_format == "webm" else "aac",
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-shortest",
                str(output_path)
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            _, stderr = await process.communicate()

            if process.returncode != 0:
                raise RuntimeError(f"ffmpeg failed: {stderr.decode()}")

            return {
                "data": output_path.read_bytes(),
                "duration_ms": await self._get_duration_ms_async(str(output_path)),
            }

    async def _combine_audio_chunks(self, audio_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Combine audio chunks into a single WAV file."""
        sorted_chunks = sorted(audio_chunks, key=lambda x: x.get("timestamp", 0))

        combined_pcm = bytearray()
        for chunk in sorted_chunks:
            if chunk.get("type") == "user" and chunk.get("data"):
                combined_pcm.extend(base64.b64decode(chunk["data"]))

        wav_data = self._create_wav_from_pcm(bytes(combined_pcm))
        duration_ms = int(len(combined_pcm) / (24000 * 2) * 1000)

        return {"data": wav_data, "duration_ms": duration_ms}

    def _create_wav_from_pcm(
        self,
        pcm_data: bytes,
        sample_rate: int = 24000,
        channels: int = 1,
        bits_per_sample: int = 16
    ) -> bytes:
        """Create a WAV file from raw PCM data."""
        import wave
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(channels)
            wav.setsampwidth(bits_per_sample // 8)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm_data)
        return buffer.getvalue()

    async def _get_duration_ms_async(self, video_path: str) -> int:
        """Get video duration in milliseconds using ffprobe (async)."""
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        if process.returncode == 0:
            try:
                return int(float(stdout.decode().strip()) * 1000)
            except ValueError:
                pass
        return 0

    async def extract_frame(
        self,
        video_data: bytes,
        timestamp_ms: int,
        output_format: str = "jpg"
    ) -> Optional[bytes]:
        """Extract a single frame from video at specified timestamp."""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            video_path = temp_path / "input.webm"
            video_path.write_bytes(video_data)

            frame_path = temp_path / f"frame.{output_format}"

            cmd = [
                "ffmpeg", "-y",
                "-ss", str(timestamp_ms / 1000.0),
                "-i", str(video_path),
                "-vframes", "1",
                "-q:v", "2",
                str(frame_path)
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()

            if frame_path.exists():
                return frame_path.read_bytes()
            return None

    async def extract_multiple_frames(
        self,
        video_data: bytes,
        timestamps_ms: List[int],
        output_format: str = "jpg"
    ) -> Dict[int, bytes]:
        """Extract multiple frames from video."""
        frames = {}
        for ts in timestamps_ms:
            if frame := await self.extract_frame(video_data, ts, output_format):
                frames[ts] = frame
        return frames

    @staticmethod
    def encode_frame_base64(frame_data: bytes) -> str:
        """Encode frame data to base64 string."""
        return base64.b64encode(frame_data).decode("utf-8")
