
"""Tests for Presentation Analysis service."""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.services.content_understanding import ContentUnderstandingResult, VideoSegment
from src.services.presentation_analysis import (
    FullPresentationAnalysis,
    PACE_OPTIMAL_MAX,
    PACE_OPTIMAL_MIN,
    PACE_TOO_FAST,
    PACE_TOO_SLOW,
    PresentationAnalysisService,
    PresentationLevelAnalysis,
    SegmentAnalysis,
    SlideAnalysis,
    SLIDE_QUALITY_PASS,
)


class TestSegmentAnalysis:
    """Test cases for SegmentAnalysis dataclass."""

    def test_segment_analysis_creation(self):
        """Test creating a SegmentAnalysis instance."""
        analysis = SegmentAnalysis(
            segment_id="seg1",
            start_time_ms=0,
            end_time_ms=30000,
            segment_type="slide",
            pace_status="optimal",
            pace_color="green",
            words_per_second=2.5,
            language_quality="good",
            language_issues=[],
            suggestions=["Speak more clearly"],
        )

        assert analysis.segment_id == "seg1"
        assert analysis.pace_status == "optimal"
        assert analysis.pace_color == "green"


class TestSlideAnalysis:
    """Test cases for SlideAnalysis dataclass."""

    def test_slide_analysis_creation(self):
        """Test creating a SlideAnalysis instance."""
        analysis = SlideAnalysis(
            segment_id="slide1",
            slide_title="Introduction",
            quality_score=4,
            passed=True,
            improvements=["Add more visuals"],
            ocr_text="Welcome to...",
            transcript_during_slide="Hello everyone",
            start_time_ms=0,
        )

        assert analysis.slide_title == "Introduction"
        assert analysis.passed is True
        assert analysis.quality_score == 4


class TestPresentationLevelAnalysis:
    """Test cases for PresentationLevelAnalysis dataclass."""

    def test_presentation_level_analysis_creation(self):
        """Test creating a PresentationLevelAnalysis instance."""
        analysis = PresentationLevelAnalysis(
            presentation_type="investment_pitch",
            checklist_items=[{"item": "Problem Statement", "present": True, "notes": "Good"}],
            missing_content=["Financial Projections"],
            improvements=[{"description": "Add more data", "timecode_ms": 5000, "severity": "medium"}],
            overall_score=75,
            strengths=["Clear delivery"],
            summary="Good overall presentation",
        )

        assert analysis.presentation_type == "investment_pitch"
        assert analysis.overall_score == 75


class TestPresentationAnalysisService:
    """Test cases for PresentationAnalysisService."""

    @pytest.fixture
    def mock_openai_response(self):
        """Create a mock OpenAI response."""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message = MagicMock()
        mock_response.choices[0].message.content = json.dumps({
            "quality": "good",
            "issues": [],
            "suggestions": []
        })
        return mock_response

    @pytest.fixture
    def service(self):
        """Create a PresentationAnalysisService with mocked client."""
        with patch("src.services.presentation_analysis.AsyncAzureOpenAI"):
            service = PresentationAnalysisService()
            return service

    def test_service_initialization(self, service):
        """Test service initializes correctly."""
        assert service is not None

    def test_checklists_defined(self, service):
        """Test that checklists are defined for all presentation types."""
        assert "investment_pitch" in service.CHECKLISTS
        assert "product_demo" in service.CHECKLISTS
        assert "team_update" in service.CHECKLISTS

        # Verify checklists have items
        for ptype, checklist in service.CHECKLISTS.items():
            assert len(checklist) > 0, f"{ptype} checklist is empty"

    def test_classify_pace_too_slow(self, service):
        """Test pace classification for too slow."""
        status, color = service._classify_pace(1.0)
        assert status == "too_slow"
        assert color == "blue"

    def test_classify_pace_slightly_slow(self, service):
        """Test pace classification for slightly slow."""
        status, color = service._classify_pace(1.8)
        assert status == "slightly_slow"
        assert color == "lightblue"

    def test_classify_pace_optimal(self, service):
        """Test pace classification for optimal pace."""
        status, color = service._classify_pace(2.5)
        assert status == "optimal"
        assert color == "green"

    def test_classify_pace_slightly_fast(self, service):
        """Test pace classification for slightly fast."""
        status, color = service._classify_pace(3.3)
        assert status == "slightly_fast"
        assert color == "yellow"

    def test_classify_pace_too_fast(self, service):
        """Test pace classification for too fast."""
        status, color = service._classify_pace(4.0)
        assert status == "too_fast"
        assert color == "red"

    def test_pace_thresholds(self):
        """Test that pace threshold constants are correctly defined."""
        assert PACE_TOO_SLOW == 1.5
        assert PACE_OPTIMAL_MIN == 2.0
        assert PACE_OPTIMAL_MAX == 3.0
        assert PACE_TOO_FAST == 3.5
        assert SLIDE_QUALITY_PASS == 4

    def test_titles_similar_exact_match(self, service):
        """Test title similarity for exact matches."""
        assert service._titles_similar("Introduction", "Introduction") is True
        assert service._titles_similar("Intro", "Intro") is True

    def test_titles_similar_case_insensitive(self, service):
        """Test title similarity is case insensitive."""
        assert service._titles_similar("INTRODUCTION", "introduction") is True
        assert service._titles_similar("Problem Statement", "problem statement") is True

    def test_titles_similar_substring(self, service):
        """Test title similarity for substrings."""
        assert service._titles_similar("Intro", "Introduction") is True
        assert service._titles_similar("Introduction Slide", "Introduction") is True

    def test_titles_similar_high_overlap(self, service):
        """Test title similarity based on high word overlap."""
        # These should be similar (>= 70% word overlap)
        assert service._titles_similar("Problem Statement Overview", "Problem Statement") is True
        assert service._titles_similar("Market Size Analysis", "Market Size") is True

    def test_titles_not_similar(self, service):
        """Test title dissimilarity detection."""
        assert service._titles_similar("Introduction", "Conclusion") is False
        assert service._titles_similar("Problem", "Solution") is False

    def test_titles_similar_empty(self, service):
        """Test title similarity with empty strings."""
        assert service._titles_similar("", "") is True  # Both empty = substring match
        assert service._titles_similar("Intro", "") is True  # Empty is substring

    def test_find_closest_image_exact_match(self, service):
        """Test finding closest image with exact timestamp match."""
        images = {0: "img0", 5000: "img5", 10000: "img10"}

        result = service._find_closest_image(5000, images)

        assert result == "img5"

    def test_find_closest_image_nearest(self, service):
        """Test finding closest image to timestamp."""
        images = {0: "img0", 10000: "img10"}

        result = service._find_closest_image(4000, images)

        assert result == "img0"  # Closer to 0 than 10000

    def test_find_closest_image_empty(self, service):
        """Test finding closest image with no images."""
        result = service._find_closest_image(5000, {})

        assert result is None

    def test_deduplicate_slides_empty(self, service):
        """Test deduplication with empty list."""
        result = service._deduplicate_slides([], 100000)

        assert result == []

    def test_deduplicate_slides_no_duplicates(self, service):
        """Test deduplication with no duplicate slides."""
        slides = [
            SlideAnalysis(
                segment_id="s1",
                slide_title="Intro",
                quality_score=4,
                passed=True,
                improvements=[],
                ocr_text="",
                transcript_during_slide="",
                start_time_ms=0,
            ),
            SlideAnalysis(
                segment_id="s2",
                slide_title="Problem",
                quality_score=5,
                passed=True,
                improvements=[],
                ocr_text="",
                transcript_during_slide="",
                start_time_ms=60000,
            ),
        ]

        result = service._deduplicate_slides(slides, 120000)

        assert len(result) == 2

    def test_deduplicate_slides_with_duplicates(self, service):
        """Test deduplication removes duplicate slides."""
        slides = [
            SlideAnalysis(
                segment_id="s1",
                slide_title="Introduction",
                quality_score=3,
                passed=False,
                improvements=[],
                ocr_text="",
                transcript_during_slide="",
                start_time_ms=0,
            ),
            SlideAnalysis(
                segment_id="s2",
                slide_title="Introduction",  # Same title
                quality_score=5,  # Higher quality
                passed=True,
                improvements=[],
                ocr_text="",
                transcript_during_slide="",
                start_time_ms=5000,  # Close to first
            ),
        ]

        result = service._deduplicate_slides(slides, 60000)  # Short video = 10s min gap

        assert len(result) == 1
        assert result[0].quality_score == 5  # Kept higher quality

    def test_build_timeline_data(self, service):
        """Test building timeline data from segments."""
        segments = [
            VideoSegment(
                segment_id="seg1",
                start_time_ms=0,
                end_time_ms=30000,
                segment_type="slide",
                description="Intro slide",
                transcript="Hello",
                words_per_second=2.5,
                word_count=1,
            ),
        ]

        segment_analyses = [
            SegmentAnalysis(
                segment_id="seg1",
                start_time_ms=0,
                end_time_ms=30000,
                segment_type="slide",
                pace_status="optimal",
                pace_color="green",
                words_per_second=2.5,
                language_quality="good",
                language_issues=[],
                suggestions=[],
            ),
        ]

        timeline = service._build_timeline_data(segments, segment_analyses, [], [])

        assert len(timeline) == 1
        assert timeline[0]["segment_id"] == "seg1"
        assert timeline[0]["pace_color"] == "green"
        assert timeline[0]["has_issues"] is False

    def test_build_timeline_data_with_improvements(self, service):
        """Test timeline data includes improvements."""
        segments = [
            VideoSegment(
                segment_id="seg1",
                start_time_ms=0,
                end_time_ms=30000,
                segment_type="person",
                description="Speaker",
                transcript="Hello",
                words_per_second=2.5,
                word_count=1,
            ),
        ]

        segment_analyses = [
            SegmentAnalysis(
                segment_id="seg1",
                start_time_ms=0,
                end_time_ms=30000,
                segment_type="person",
                pace_status="optimal",
                pace_color="green",
                words_per_second=2.5,
                language_quality="good",
                language_issues=[],
                suggestions=[],
            ),
        ]

        improvements = [
            {"description": "Speak louder", "timecode_ms": 5000, "severity": "medium"}
        ]

        timeline = service._build_timeline_data(segments, segment_analyses, [], improvements)

        assert len(timeline[0]["improvements"]) == 1
        assert timeline[0]["has_issues"] is True

    @pytest.mark.asyncio
    async def test_analyze_language_quality_empty(self, service):
        """Test language quality analysis with empty transcript."""
        result = await service._analyze_language_quality("")

        assert result["quality"] == "N/A"
        assert result["issues"] == []
        assert result["suggestions"] == []

    @pytest.mark.asyncio
    async def test_analyze_language_quality_whitespace(self, service):
        """Test language quality analysis with whitespace-only transcript."""
        result = await service._analyze_language_quality("   \n\t  ")

        assert result["quality"] == "N/A"
