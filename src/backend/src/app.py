"""Main Flask application for Presentation Coach."""

import asyncio
import base64
import json
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sock import Sock

from src.services.content_understanding import ContentUnderstandingService, ContentUnderstandingResult
from src.services.video_processing import VideoProcessingService
from src.services.presentation_analysis import PresentationAnalysisService
from src.services.voicelive_session import VoiceLiveSessionManager

# Valid presentation types and their corresponding scenario file basenames.
# These must stay in sync with /api/config.
SCENARIO_FILE_BASENAMES = {
    "investment_pitch": "investment-pitch",
    "product_demo": "product-demo",
    "team_update": "team-update",
}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def get_static_folder() -> str:
    """Get the static folder path, checking multiple locations."""
    # Check for Docker location first
    docker_path = Path("/app/src/static")
    if docker_path.exists():
        return str(docker_path)

    # Development location (relative to this file)
    dev_path = Path(__file__).parent.parent.parent / "frontend" / "dist"
    if dev_path.exists():
        return str(dev_path)

    # Fallback to current directory
    return str(Path(__file__).parent / "static")


# Initialize Flask app
app = Flask(__name__, static_folder=get_static_folder(), static_url_path="")
CORS(app)
sock = Sock(app)

# Check required dependencies before starting
VideoProcessingService.require_ffmpeg()

# Initialize services
content_understanding = ContentUnderstandingService()
video_processing = VideoProcessingService()
presentation_analysis = PresentationAnalysisService()
session_manager = VoiceLiveSessionManager()

# Store for active sessions and recordings
active_sessions: Dict[str, Dict[str, Any]] = {}
recordings_store: Dict[str, Dict[str, Any]] = {}


# ----- Static Routes -----

@app.route("/")
def serve_index():
    """Serve the React frontend."""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    """Serve static files."""
    # Sanitize path to prevent path traversal attacks
    # Normalize the path and ensure it doesn't escape the static folder
    safe_path = os.path.normpath(path).lstrip(os.sep)
    if safe_path.startswith('..') or os.path.isabs(path):
        return send_from_directory(app.static_folder, "index.html")

    full_path = os.path.realpath(os.path.join(app.static_folder, safe_path))
    static_folder_real = os.path.realpath(app.static_folder)

    # Ensure the resolved path is within the static folder
    if not full_path.startswith(static_folder_real + os.sep) and full_path != static_folder_real:
        return send_from_directory(app.static_folder, "index.html")

    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(app.static_folder, safe_path)
    return send_from_directory(app.static_folder, "index.html")


# ----- API Routes -----

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


@app.route("/api/config", methods=["GET"])
def get_config():
    """Get client-side configuration."""
    return jsonify({
        "presentation_types": [
            {
                "id": "investment_pitch",
                "name": "Investment Pitch",
                "description": "Practice pitching to VCs and investors",
                "icon": "Money"
            },
            {
                "id": "product_demo",
                "name": "Product Demo",
                "description": "Practice demonstrating your product to customers",
                "icon": "Laptop"
            },
            {
                "id": "team_update",
                "name": "Team Update",
                "description": "Practice all-hands and team presentations",
                "icon": "People"
            }
        ]
    })


@app.route("/api/scenarios/<presentation_type>", methods=["GET"])
def get_scenario(presentation_type: str):
    """Get scenario configuration for a presentation type."""
    # Validate and map the presentation type to a known-safe scenario basename.
    if presentation_type not in SCENARIO_FILE_BASENAMES:
        return jsonify({"error": f"Scenario not found: {presentation_type}"}), 404

    scenario_basename = SCENARIO_FILE_BASENAMES[presentation_type]
    scenarios_path = Path(__file__).parent.parent.parent.parent / "data" / "scenarios"

    role_play_file = scenarios_path / f"{scenario_basename}-role-play.prompt.yml"
    evaluation_file = scenarios_path / f"{scenario_basename}-evaluation.prompt.yml"

    if not role_play_file.exists():
        return jsonify({"error": f"Scenario not found: {presentation_type}"}), 404

    # Read scenario files
    with open(role_play_file, "r") as f:
        role_play = f.read()

    evaluation = ""
    if evaluation_file.exists():
        with open(evaluation_file, "r") as f:
            evaluation = f.read()

    return jsonify({
        "presentation_type": presentation_type,
        "role_play_prompt": role_play,
        "evaluation_prompt": evaluation
    })


@app.route("/api/sessions", methods=["POST"])
def create_session():
    """Create a new presentation session."""
    data = request.json or {}

    session_id = str(uuid.uuid4())
    presentation_type = data.get("presentation_type", "investment_pitch")

    active_sessions[session_id] = {
        "id": session_id,
        "presentation_type": presentation_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "created",
        "audio_chunks": [],
        "screen_frames": [],
        "transcripts": [],
        "muted": False
    }

    logger.info(f"Created session {session_id} for {presentation_type}")

    return jsonify({
        "session_id": session_id,
        "presentation_type": presentation_type,
        "status": "created"
    })


@app.route("/api/sessions/<session_id>", methods=["GET"])
def get_session(session_id: str):
    """Get session details."""
    if session_id not in active_sessions:
        return jsonify({"error": "Session not found"}), 404

    session = active_sessions[session_id]
    return jsonify({
        "id": session["id"],
        "presentation_type": session["presentation_type"],
        "status": session["status"],
        "created_at": session["created_at"],
        "muted": session["muted"],
        "transcript_count": len(session["transcripts"])
    })


@app.route("/api/sessions/<session_id>/mute", methods=["POST"])
def set_mute_status(session_id: str):
    """Set the AI mute status for a session."""
    if session_id not in active_sessions:
        return jsonify({"error": "Session not found"}), 404

    data = request.json or {}
    muted = data.get("muted", False)

    active_sessions[session_id]["muted"] = muted

    # Notify the voice session manager to update VAD
    session_manager.set_vad_enabled(session_id, not muted)

    logger.info(f"Session {session_id} mute status: {muted}")

    return jsonify({"muted": muted})


@app.route("/api/sessions/<session_id>/complete", methods=["POST"])
def complete_session(session_id: str):
    """Mark a session as completed and start analysis."""
    if session_id not in active_sessions:
        return jsonify({"error": "Session not found"}), 404

    session = active_sessions[session_id]
    session["status"] = "completed"
    session["completed_at"] = datetime.now(timezone.utc).isoformat()

    logger.info(f"Session {session_id} marked as completed")

    return jsonify({
        "session_id": session_id,
        "status": "completed",
        "analysis_available": True
    })


@app.route("/api/sessions/<session_id>/recordings", methods=["POST"])
def upload_recording(session_id: str):
    """Upload recording data (audio + screen)."""
    if session_id not in active_sessions:
        return jsonify({"error": "Session not found"}), 404

    # Handle multipart form data
    audio_data = request.files.get("audio")
    screen_data = request.files.get("screen")

    logger.info(f"Receiving recordings for session {session_id}")
    logger.info(f"  - Audio file present: {audio_data is not None}")
    logger.info(f"  - Screen file present: {screen_data is not None}")

    recording_id = str(uuid.uuid4())

    # Save to temp files
    temp_dir = tempfile.mkdtemp()
    logger.info(f"  - Temp directory: {temp_dir}")

    if audio_data:
        audio_path = os.path.join(temp_dir, "audio.webm")
        audio_data.save(audio_path)
        audio_size = os.path.getsize(audio_path)
        logger.info(f"  - Saved audio: {audio_path} ({audio_size} bytes)")
    else:
        audio_path = None

    if screen_data:
        screen_path = os.path.join(temp_dir, "screen.webm")
        screen_data.save(screen_path)
        screen_size = os.path.getsize(screen_path)
        logger.info(f"  - Saved screen: {screen_path} ({screen_size} bytes)")
    else:
        screen_path = None

    recordings_store[recording_id] = {
        "session_id": session_id,
        "audio_path": audio_path,
        "screen_path": screen_path,
        "temp_dir": temp_dir,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    logger.info(f"Uploaded recording {recording_id} for session {session_id}")

    return jsonify({
        "recording_id": recording_id,
        "session_id": session_id
    })


@app.route("/api/sessions/<session_id>/analyze", methods=["POST"])
async def analyze_presentation(session_id: str):
    """Analyze a completed presentation session."""
    if session_id not in active_sessions:
        return jsonify({"error": "Session not found"}), 404

    session = active_sessions[session_id]
    data = request.json or {}
    recording_id = data.get("recording_id")

    logger.info(f"Starting analysis for session {session_id}")
    logger.info(f"  - Recording ID from request: {recording_id}")
    logger.info(f"  - All recordings in store: {list(recordings_store.keys())}")

    # If no recording_id provided, find the recording for this session
    if not recording_id:
        for rid, rec in recordings_store.items():
            if rec["session_id"] == session_id:
                recording_id = rid
                logger.info(f"  - Found recording {recording_id} for session")
                break

    try:
        # Get recording data
        recording = recordings_store.get(recording_id, {})
        logger.info(f"  - Recording data: audio_path={recording.get('audio_path')}, screen_path={recording.get('screen_path')}")

        # Step 1: Process video (combine audio + screen)
        if recording.get("audio_path") and recording.get("screen_path"):
            logger.info("  - Combining audio and screen...")
            logger.info(f"    - Audio exists: {os.path.exists(recording['audio_path'])}")
            logger.info(f"    - Screen exists: {os.path.exists(recording['screen_path'])}")

            processed_video = await asyncio.get_event_loop().run_in_executor(
                None,
                video_processing.combine_audio_and_screen_files,
                recording["audio_path"],
                recording["screen_path"]
            )
            video_path = processed_video.output_path
            logger.info(f"  - Combined video created: {video_path}")
            logger.info(f"    - Video exists: {os.path.exists(video_path) if video_path else False}")

            # Save the combined video path for playback
            recording["combined_video_path"] = video_path
            logger.info(f"  - Video URL: /api/sessions/{session_id}/video")
        else:
            # Use mock video for development
            video_path = None
            logger.info("  - No audio/screen files, using mock analysis")

        # Step 2: Analyze with Content Understanding
        if video_path:
            # Read video file as bytes for content understanding
            with open(video_path, 'rb') as f:
                video_data = f.read()
            logger.info(f"  - Video file size: {len(video_data)} bytes")
            cu_result = await content_understanding.analyze_video(video_data, session["presentation_type"])
        else:
            # Generate mock result
            cu_result = ContentUnderstandingResult(
                segments=[],
                full_transcript=" ".join([t["text"] for t in session.get("transcripts", [])]),
                duration_ms=180000,
                key_frames=[],
                raw_response={}
            )

        # Step 3: Extract frame thumbnails for ALL segments
        slide_images = {}
        if video_path and cu_result.segments:
            all_timestamps = [s.start_time_ms for s in cu_result.segments]
            if all_timestamps:
                # Read video file as bytes for frame extraction
                with open(video_path, 'rb') as f:
                    video_bytes = f.read()
                frames = await video_processing.extract_multiple_frames(
                    video_bytes,
                    all_timestamps
                )
                # Attach thumbnails to segment objects
                for segment in cu_result.segments:
                    if segment.start_time_ms in frames:
                        segment.thumbnail_base64 = video_processing.encode_frame_base64(
                            frames[segment.start_time_ms]
                        )

                # Build slide_images for slide-specific analysis
                slide_images = {
                    s.start_time_ms: s.thumbnail_base64
                    for s in cu_result.segments
                    if s.segment_type == "slide" and s.thumbnail_base64
                }

        # Step 4: Full presentation analysis
        analysis = await presentation_analysis.analyze_presentation(
            cu_result,
            session["presentation_type"],
            slide_images
        )

        # Store analysis result
        session["analysis"] = {
            "presentation_level": {
                "presentation_type": analysis.presentation_level.presentation_type,
                "checklist_items": analysis.presentation_level.checklist_items,
                "missing_content": analysis.presentation_level.missing_content,
                "improvements": analysis.presentation_level.improvements,
                "overall_score": analysis.presentation_level.overall_score,
                "strengths": analysis.presentation_level.strengths,
                "summary": analysis.presentation_level.summary
            },
            "segment_analyses": [
                {
                    "segment_id": sa.segment_id,
                    "start_time_ms": sa.start_time_ms,
                    "end_time_ms": sa.end_time_ms,
                    "segment_type": sa.segment_type,
                    "pace_status": sa.pace_status,
                    "pace_color": sa.pace_color,
                    "words_per_second": sa.words_per_second,
                    "language_quality": sa.language_quality,
                    "language_issues": sa.language_issues,
                    "suggestions": sa.suggestions
                }
                for sa in analysis.segment_analyses
            ],
            "slide_analyses": [
                {
                    "segment_id": sa.segment_id,
                    "slide_title": sa.slide_title,
                    "quality_score": sa.quality_score,
                    "passed": sa.passed,
                    "improvements": sa.improvements,
                    "thumbnail_base64": sa.thumbnail_base64,
                    "start_time_ms": sa.start_time_ms
                }
                for sa in analysis.slide_analyses
            ],
            "timeline_data": analysis.timeline_data,
            "total_duration_ms": analysis.total_duration_ms,
            "average_pace": analysis.average_pace
        }

        logger.info(f"Analysis completed for session {session_id}")

        return jsonify({
            "session_id": session_id,
            "analysis": session["analysis"]
        })

    except Exception as e:
        logger.error(f"Analysis failed for session {session_id}: {e}")
        return jsonify({"error": "An internal error occurred during analysis"}), 500


@app.route("/api/sessions/<session_id>/analysis", methods=["GET"])
def get_analysis(session_id: str):
    """Get the analysis result for a session."""
    if session_id not in active_sessions:
        return jsonify({"error": "Session not found"}), 404

    session = active_sessions[session_id]
    analysis = session.get("analysis")

    if not analysis:
        return jsonify({"error": "Analysis not available"}), 404

    return jsonify({
        "session_id": session_id,
        "analysis": analysis
    })


@app.route("/api/upload-video", methods=["POST"])
async def upload_and_analyze_video():
    """Upload a pre-recorded video and analyze it."""
    # Handle multipart form data
    video_file = request.files.get("video")
    presentation_type = request.form.get("presentation_type", "investment_pitch")

    if not video_file:
        return jsonify({"error": "No video file provided"}), 400

    logger.info(f"Received video upload: {video_file.filename}, type: {presentation_type}")

    # Create a session for this upload
    session_id = f"upload-{uuid.uuid4().hex[:8]}"
    active_sessions[session_id] = {
        "id": session_id,
        "presentation_type": presentation_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "analyzing",
        "audio_chunks": [],
        "screen_frames": [],
        "transcripts": [],
        "muted": False,
        "is_upload": True
    }

    try:
        # Save uploaded video to temp file
        temp_dir = tempfile.mkdtemp()
        video_path = os.path.join(temp_dir, "uploaded_video.webm")
        video_file.save(video_path)
        video_size = os.path.getsize(video_path)
        logger.info(f"Saved uploaded video: {video_path} ({video_size} bytes)")

        # Store recording info
        recording_id = str(uuid.uuid4())
        recordings_store[recording_id] = {
            "session_id": session_id,
            "audio_path": None,
            "screen_path": None,
            "combined_video_path": video_path,
            "temp_dir": temp_dir,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Read video data for analysis
        with open(video_path, 'rb') as f:
            video_data = f.read()

        logger.info(f"Video file size: {len(video_data)} bytes")

        # Analyze with Content Understanding
        cu_result = await content_understanding.analyze_video(video_data, presentation_type)

        logger.info(f"Content Understanding returned {len(cu_result.segments)} segments")

        # Extract frame thumbnails for ALL segments
        all_timestamps = [s.start_time_ms for s in cu_result.segments]
        if all_timestamps:
            frames = await video_processing.extract_multiple_frames(
                video_data,
                all_timestamps
            )
            for segment in cu_result.segments:
                if segment.start_time_ms in frames:
                    segment.thumbnail_base64 = video_processing.encode_frame_base64(
                        frames[segment.start_time_ms]
                    )

        # Build slide_images for slide-specific analysis
        slide_images = {
            s.start_time_ms: s.thumbnail_base64
            for s in cu_result.segments
            if s.segment_type == "slide" and s.thumbnail_base64
        }

        # Full presentation analysis
        analysis = await presentation_analysis.analyze_presentation(
            cu_result,
            presentation_type,
            slide_images
        )

        # Store analysis result
        session = active_sessions[session_id]
        session["status"] = "completed"
        session["analysis"] = {
            "presentation_level": {
                "presentation_type": analysis.presentation_level.presentation_type,
                "checklist_items": analysis.presentation_level.checklist_items,
                "missing_content": analysis.presentation_level.missing_content,
                "improvements": analysis.presentation_level.improvements,
                "overall_score": analysis.presentation_level.overall_score,
                "strengths": analysis.presentation_level.strengths,
                "summary": analysis.presentation_level.summary
            },
            "segment_analyses": [
                {
                    "segment_id": sa.segment_id,
                    "start_time_ms": sa.start_time_ms,
                    "end_time_ms": sa.end_time_ms,
                    "segment_type": sa.segment_type,
                    "pace_status": sa.pace_status,
                    "pace_color": sa.pace_color,
                    "words_per_second": sa.words_per_second,
                    "language_quality": sa.language_quality,
                    "language_issues": sa.language_issues,
                    "suggestions": sa.suggestions
                }
                for sa in analysis.segment_analyses
            ],
            "slide_analyses": [
                {
                    "segment_id": sa.segment_id,
                    "slide_title": sa.slide_title,
                    "quality_score": sa.quality_score,
                    "passed": sa.passed,
                    "improvements": sa.improvements,
                    "thumbnail_base64": sa.thumbnail_base64,
                    "start_time_ms": sa.start_time_ms
                }
                for sa in analysis.slide_analyses
            ],
            "timeline_data": analysis.timeline_data,
            "total_duration_ms": analysis.total_duration_ms,
            "average_pace": analysis.average_pace
        }

        logger.info(f"Upload analysis completed for session {session_id}")

        return jsonify({
            "session_id": session_id,
            "analysis": session["analysis"]
        })

    except Exception as e:
        logger.error(f"Upload analysis failed: {e}", exc_info=True)
        return jsonify({"error": "An internal error occurred during video analysis"}), 500


@app.route("/api/test/sample-analysis", methods=["POST"])
async def analyze_sample_video():
    """Analyze the sample.webm video for testing purposes."""
    data = request.json or {}
    presentation_type = data.get("presentation_type", "investment_pitch")

    # Path to sample video
    sample_path = Path(__file__).parent.parent.parent.parent / "data" / "sample.webm"

    if not sample_path.exists():
        return jsonify({"error": "Sample video not found at data/sample.webm"}), 404

    logger.info(f"Starting sample video analysis with type: {presentation_type}")

    # Create a test session
    session_id = f"sample-{uuid.uuid4().hex[:8]}"
    active_sessions[session_id] = {
        "id": session_id,
        "presentation_type": presentation_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "analyzing",
        "audio_chunks": [],
        "screen_frames": [],
        "transcripts": [],
        "muted": False,
        "is_sample": True
    }

    try:
        # Read the sample video
        with open(sample_path, 'rb') as f:
            video_data = f.read()

        logger.info(f"Sample video size: {len(video_data)} bytes")

        # Store the sample video path for playback
        recording_id = str(uuid.uuid4())
        recordings_store[recording_id] = {
            "session_id": session_id,
            "audio_path": None,
            "screen_path": None,
            "combined_video_path": str(sample_path),
            "temp_dir": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Analyze with Content Understanding
        cu_result = await content_understanding.analyze_video(video_data, presentation_type)

        logger.info(f"Content Understanding returned {len(cu_result.segments)} segments")
        for seg in cu_result.segments:
            logger.info(f"  - {seg.segment_id}: {seg.start_time_ms}ms - {seg.end_time_ms}ms ({seg.segment_type})")

        # Extract frame thumbnails for ALL segments
        all_timestamps = [s.start_time_ms for s in cu_result.segments]
        if all_timestamps:
            frames = await video_processing.extract_multiple_frames(
                video_data,
                all_timestamps
            )
            # Attach thumbnails to segment objects
            for segment in cu_result.segments:
                if segment.start_time_ms in frames:
                    segment.thumbnail_base64 = video_processing.encode_frame_base64(
                        frames[segment.start_time_ms]
                    )

        # Build slide_images for slide-specific analysis (slides only)
        slide_images = {
            s.start_time_ms: s.thumbnail_base64
            for s in cu_result.segments
            if s.segment_type == "slide" and s.thumbnail_base64
        }

        # Full presentation analysis
        analysis = await presentation_analysis.analyze_presentation(
            cu_result,
            presentation_type,
            slide_images
        )

        # Store analysis result
        session = active_sessions[session_id]
        session["status"] = "completed"
        session["analysis"] = {
            "presentation_level": {
                "presentation_type": analysis.presentation_level.presentation_type,
                "checklist_items": analysis.presentation_level.checklist_items,
                "missing_content": analysis.presentation_level.missing_content,
                "improvements": analysis.presentation_level.improvements,
                "overall_score": analysis.presentation_level.overall_score,
                "strengths": analysis.presentation_level.strengths,
                "summary": analysis.presentation_level.summary
            },
            "segment_analyses": [
                {
                    "segment_id": sa.segment_id,
                    "start_time_ms": sa.start_time_ms,
                    "end_time_ms": sa.end_time_ms,
                    "segment_type": sa.segment_type,
                    "pace_status": sa.pace_status,
                    "pace_color": sa.pace_color,
                    "words_per_second": sa.words_per_second,
                    "language_quality": sa.language_quality,
                    "language_issues": sa.language_issues,
                    "suggestions": sa.suggestions
                }
                for sa in analysis.segment_analyses
            ],
            "slide_analyses": [
                {
                    "segment_id": sa.segment_id,
                    "slide_title": sa.slide_title,
                    "quality_score": sa.quality_score,
                    "passed": sa.passed,
                    "improvements": sa.improvements,
                    "thumbnail_base64": sa.thumbnail_base64,
                    "start_time_ms": sa.start_time_ms
                }
                for sa in analysis.slide_analyses
            ],
            "timeline_data": analysis.timeline_data,
            "total_duration_ms": analysis.total_duration_ms,
            "average_pace": analysis.average_pace
        }

        logger.info(f"Sample analysis completed for session {session_id}")

        return jsonify({
            "session_id": session_id,
            "analysis": session["analysis"]
        })

    except Exception as e:
        logger.error(f"Sample analysis failed: {e}", exc_info=True)
        return jsonify({"error": "An internal error occurred during sample analysis"}), 500


@app.route("/api/sessions/<session_id>/video", methods=["GET"])
def get_recording_video(session_id: str):
    """Get the combined recording video for playback."""
    logger.info(f"Video requested for session {session_id}")

    if session_id not in active_sessions:
        logger.info("  - Session not found in active_sessions")
        return jsonify({"error": "Session not found"}), 404

    # Find recording for this session
    for recording_id, recording in recordings_store.items():
        if recording["session_id"] == session_id:
            logger.info(f"  - Found recording {recording_id}")
            logger.info(f"  - Recording data: {recording}")
            video_path = recording.get("combined_video_path")
            logger.info(f"  - Combined video path: {video_path}")
            if video_path and os.path.exists(video_path):
                logger.info(f"  - Serving video from {video_path}")
                return send_from_directory(
                    os.path.dirname(video_path),
                    os.path.basename(video_path),
                    mimetype="video/webm"
                )
            else:
                logger.info("  - Video file does not exist at path")

    logger.info("  - No recording found for session")
    return jsonify({"error": "Video not found"}), 404


# ----- WebSocket Routes -----

@sock.route("/ws/session/<session_id>")
def websocket_session(ws, session_id: str):
    """WebSocket endpoint for real-time session communication."""
    if session_id not in active_sessions:
        ws.send(json.dumps({"type": "error", "message": "Session not found"}))
        return

    session = active_sessions[session_id]
    logger.info(f"WebSocket connected for session {session_id}")

    try:
        while True:
            message = ws.receive()
            if message is None:
                break

            try:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "transcript":
                    # Store transcript entry
                    transcript_entry = {
                        "text": data.get("text", ""),
                        "speaker": data.get("speaker", "user"),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    session["transcripts"].append(transcript_entry)

                    # Echo back to client
                    ws.send(json.dumps({
                        "type": "transcript_ack",
                        "entry": transcript_entry
                    }))

                elif msg_type == "audio_chunk":
                    # Store audio chunk
                    audio_data = base64.b64decode(data.get("data", ""))
                    session["audio_chunks"].append(audio_data)

                elif msg_type == "screen_frame":
                    # Store screen frame
                    frame_data = base64.b64decode(data.get("data", ""))
                    session["screen_frames"].append({
                        "data": frame_data,
                        "timestamp": data.get("timestamp", 0)
                    })

                elif msg_type == "function_call":
                    # Handle function calls from VoiceLive (e.g., mute)
                    function_name = data.get("name")

                    if function_name == "mute_ai":
                        session["muted"] = True
                        session_manager.set_vad_enabled(session_id, False)
                        ws.send(json.dumps({
                            "type": "function_response",
                            "name": function_name,
                            "result": {"muted": True}
                        }))

                    elif function_name == "unmute_ai":
                        session["muted"] = False
                        session_manager.set_vad_enabled(session_id, True)
                        ws.send(json.dumps({
                            "type": "function_response",
                            "name": function_name,
                            "result": {"muted": False}
                        }))

                elif msg_type == "ping":
                    ws.send(json.dumps({"type": "pong"}))

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received: {message[:100]}")

    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
    finally:
        logger.info(f"WebSocket disconnected for session {session_id}")


@sock.route("/ws/voicelive/<session_id>")
def websocket_voicelive(ws, session_id: str):
    """WebSocket proxy for VoiceLive API."""
    if session_id not in active_sessions:
        ws.send(json.dumps({"type": "error", "message": "Session not found"}))
        return

    session = active_sessions[session_id]
    presentation_type = session['presentation_type']

    # Validate presentation type against whitelist
    system_prompt = ""
    if presentation_type in SCENARIO_FILE_BASENAMES:
        scenario_basename = SCENARIO_FILE_BASENAMES[presentation_type]
        scenarios_path = Path(__file__).parent.parent.parent.parent / "data" / "scenarios"
        role_play_file = scenarios_path / f"{scenario_basename}-role-play.prompt.yml"

        if role_play_file.exists():
            with open(role_play_file, "r") as f:
                system_prompt = f.read()

    logger.info(f"VoiceLive WebSocket connected for session {session_id}")

    try:
        # create_session handles the entire connection lifecycle including
        # bidirectional message forwarding - it blocks until the connection closes
        session_manager.create_session(
            session_id,
            system_prompt=system_prompt,
            websocket=ws
        )
    except Exception as e:
        logger.error(f"VoiceLive WebSocket error for session {session_id}: {e}")
    finally:
        session_manager.close_session(session_id)
        logger.info(f"VoiceLive WebSocket disconnected for session {session_id}")


# ----- Main Entry Point -----

def main():
    """Run the Flask application."""
    port = int(os.environ.get("PORT", 8015))
    debug = os.environ.get("DEBUG", "false").lower() == "true"

    logger.info(f"Starting Presentation Coach on port {port}")

    app.run(host="0.0.0.0", port=port, debug=debug)


if __name__ == "__main__":
    main()
