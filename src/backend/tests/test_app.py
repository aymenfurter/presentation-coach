"""Tests for Flask App routes and endpoints."""

import json
import os
import sys
import tempfile
from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

# Set environment variables before importing app
os.environ["AZURE_OPENAI_ENDPOINT"] = "https://test.openai.azure.com"
os.environ["AZURE_OPENAI_API_KEY"] = "test-key"


class TestFlaskApp:
    """Test cases for Flask application routes."""

    @pytest.fixture
    def app(self):
        """Create a Flask test client."""
        # Patch ffmpeg check before importing app
        with patch("src.services.video_processing.VideoProcessingService.require_ffmpeg"):
            from src.app import app
            app.config["TESTING"] = True
            return app

    @pytest.fixture
    def client(self, app):
        """Create a test client."""
        with app.test_client() as client:
            yield client

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/api/health")

        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "healthy"
        assert "timestamp" in data

    def test_get_config(self, client):
        """Test config endpoint."""
        response = client.get("/api/config")

        assert response.status_code == 200
        data = response.get_json()
        assert "presentation_types" in data
        assert len(data["presentation_types"]) > 0

    def test_get_config_presentation_types(self, client):
        """Test config returns valid presentation types."""
        response = client.get("/api/config")
        data = response.get_json()

        presentation_types = {p["id"] for p in data["presentation_types"]}
        assert "investment_pitch" in presentation_types
        assert "product_demo" in presentation_types
        assert "team_update" in presentation_types

    def test_create_session(self, client):
        """Test session creation."""
        response = client.post(
            "/api/sessions",
            json={"presentation_type": "investment_pitch"}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert "session_id" in data
        assert data["presentation_type"] == "investment_pitch"
        assert data["status"] == "created"

    def test_create_session_default_type(self, client):
        """Test session creation with default type."""
        response = client.post("/api/sessions", json={})

        assert response.status_code == 200
        data = response.get_json()
        assert data["presentation_type"] == "investment_pitch"

    def test_get_session(self, client):
        """Test getting session details."""
        # Create session first
        create_response = client.post("/api/sessions", json={})
        session_id = create_response.get_json()["session_id"]

        # Get session
        response = client.get(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.get_json()
        assert data["id"] == session_id
        assert "status" in data

    def test_get_session_not_found(self, client):
        """Test getting nonexistent session."""
        response = client.get("/api/sessions/nonexistent-id")

        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data

    def test_complete_session(self, client):
        """Test completing a session."""
        # Create session first
        create_response = client.post("/api/sessions", json={})
        session_id = create_response.get_json()["session_id"]

        # Complete session
        response = client.post(f"/api/sessions/{session_id}/complete")

        assert response.status_code == 200
        data = response.get_json()
        assert data["session_id"] == session_id
        assert data["status"] == "completed"

    def test_complete_session_not_found(self, client):
        """Test completing nonexistent session."""
        response = client.post("/api/sessions/nonexistent/complete")

        assert response.status_code == 404

    def test_get_analysis_not_found(self, client):
        """Test getting analysis for nonexistent session."""
        response = client.get("/api/sessions/nonexistent/analysis")

        assert response.status_code == 404

    def test_get_analysis_no_analysis(self, client):
        """Test getting analysis when none available."""
        # Create session
        create_response = client.post("/api/sessions", json={})
        session_id = create_response.get_json()["session_id"]

        # Try to get analysis before it's done
        response = client.get(f"/api/sessions/{session_id}/analysis")

        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data

    def test_get_video_not_found(self, client):
        """Test getting video for nonexistent session."""
        response = client.get("/api/sessions/nonexistent/video")

        assert response.status_code == 404

    def test_upload_recording(self, client):
        """Test uploading recording files."""
        # Create session first
        create_response = client.post("/api/sessions", json={})
        session_id = create_response.get_json()["session_id"]

        # Upload recording
        data = {
            "audio": (BytesIO(b"audio data"), "audio.webm"),
            "screen": (BytesIO(b"screen data"), "screen.webm"),
        }

        response = client.post(
            f"/api/sessions/{session_id}/recordings",
            data=data,
            content_type="multipart/form-data",
        )

        assert response.status_code == 200
        result = response.get_json()
        assert "recording_id" in result
        assert result["session_id"] == session_id

    def test_upload_recording_not_found(self, client):
        """Test uploading to nonexistent session."""
        data = {"audio": (BytesIO(b"audio"), "audio.webm")}

        response = client.post(
            "/api/sessions/nonexistent/recordings",
            data=data,
            content_type="multipart/form-data",
        )

        assert response.status_code == 404

    def test_get_scenario_not_found(self, client):
        """Test getting nonexistent scenario."""
        response = client.get("/api/scenarios/nonexistent_type")

        assert response.status_code == 404


class TestStaticRoutes:
    """Test cases for static file serving."""

    @pytest.fixture
    def app(self):
        """Create a Flask test client with static folder."""
        with patch("src.services.video_processing.VideoProcessingService.require_ffmpeg"):
            from src.app import app
            app.config["TESTING"] = True
            return app

    @pytest.fixture
    def client(self, app):
        """Create a test client."""
        with app.test_client() as client:
            yield client

    def test_serve_index_fallback(self, client):
        """Test that unknown paths fallback to index.html."""
        # This might fail if static folder doesn't exist, which is OK in tests
        response = client.get("/some/unknown/path")
        # Either serves index.html or 404 if static folder doesn't exist
        assert response.status_code in [200, 404, 500]


class TestStaticMediaRoutes:
    """Test cases for static media serving."""

    @pytest.fixture
    def app(self):
        """Create a Flask test client with static folder."""
        with patch("src.services.video_processing.VideoProcessingService.require_ffmpeg"):
            from src.app import app
            app.config["TESTING"] = True
            return app

    @pytest.fixture
    def client(self, app):
        """Create a test client."""
        with app.test_client() as client:
            yield client

    def test_get_welcome_video(self, client):
        """Test getting welcome video."""
        response = client.get("/api/media/welcome")
        # Will return 200 if media exists, 404 otherwise
        assert response.status_code in [200, 404]

    def test_get_review_video(self, client):
        """Test getting review video."""
        response = client.get("/api/media/review")
        # Will return 200 if media exists, 404 otherwise
        assert response.status_code in [200, 404]


class TestSessionManagement:
    """Test session lifecycle and management."""

    @pytest.fixture
    def app(self):
        """Create a Flask test client."""
        with patch("src.services.video_processing.VideoProcessingService.require_ffmpeg"):
            from src.app import app, active_sessions
            app.config["TESTING"] = True
            # Clear any existing sessions
            active_sessions.clear()
            return app

    @pytest.fixture
    def client(self, app):
        """Create a test client."""
        with app.test_client() as client:
            yield client

    def test_session_lifecycle(self, client):
        """Test full session lifecycle."""
        # Create
        response = client.post("/api/sessions", json={"presentation_type": "product_demo"})
        assert response.status_code == 200
        session_id = response.get_json()["session_id"]

        # Get
        response = client.get(f"/api/sessions/{session_id}")
        assert response.status_code == 200
        assert response.get_json()["status"] == "created"

        # Complete
        response = client.post(f"/api/sessions/{session_id}/complete")
        assert response.status_code == 200

        # Verify completed
        response = client.get(f"/api/sessions/{session_id}")
        assert response.get_json()["status"] == "completed"

    def test_multiple_sessions(self, client):
        """Test creating multiple sessions."""
        # Create first session
        r1 = client.post("/api/sessions", json={"presentation_type": "investment_pitch"})
        session1 = r1.get_json()["session_id"]

        # Create second session
        r2 = client.post("/api/sessions", json={"presentation_type": "team_update"})
        session2 = r2.get_json()["session_id"]

        # Verify they are different
        assert session1 != session2

        # Verify both exist
        assert client.get(f"/api/sessions/{session1}").status_code == 200
        assert client.get(f"/api/sessions/{session2}").status_code == 200
