"""Presentation analysis service using Azure OpenAI with structured outputs."""

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from openai import AsyncAzureOpenAI

from src.config import config
from src.services.content_understanding import ContentUnderstandingResult, VideoSegment

logger = logging.getLogger(__name__)


# Speaking pace thresholds (words per second)
PACE_TOO_SLOW = 1.5
PACE_OPTIMAL_MIN = 2.0
PACE_OPTIMAL_MAX = 3.0
PACE_TOO_FAST = 3.5

# Slide quality thresholds
SLIDE_QUALITY_PASS = 4


@dataclass
class SegmentAnalysis:
    """Analysis for a single segment."""
    segment_id: str
    start_time_ms: int
    end_time_ms: int
    segment_type: str
    pace_status: str
    pace_color: str
    words_per_second: float
    language_quality: str
    language_issues: List[str]
    suggestions: List[str]
    thumbnail_base64: Optional[str] = None


@dataclass
class SlideAnalysis:
    """Analysis for a single slide."""
    segment_id: str
    slide_title: str
    quality_score: int
    passed: bool
    improvements: List[str]
    ocr_text: str
    transcript_during_slide: str
    start_time_ms: int = 0
    thumbnail_base64: Optional[str] = None


@dataclass
class PresentationLevelAnalysis:
    """Overall presentation analysis."""
    presentation_type: str
    checklist_items: List[Dict[str, Any]]
    missing_content: List[str]
    improvements: List[Dict[str, Any]]
    overall_score: int
    strengths: List[str]
    summary: str


@dataclass
class FullPresentationAnalysis:
    """Complete analysis result."""
    presentation_level: PresentationLevelAnalysis
    segment_analyses: List[SegmentAnalysis]
    slide_analyses: List[SlideAnalysis]
    timeline_data: List[Dict[str, Any]]
    total_duration_ms: int
    average_pace: float


class PresentationAnalysisService:
    """Service for analyzing presentations using Azure OpenAI."""

    CHECKLISTS = {
        "investment_pitch": [
            "Problem Statement", "Solution Overview", "Market Size (TAM/SAM/SOM)",
            "Business Model", "Traction & Metrics", "Competition Analysis",
            "Team Introduction", "Financial Projections", "Funding Ask & Use of Funds",
            "Call to Action"
        ],
        "product_demo": [
            "Customer Pain Point Hook", "Product Overview", "Key Feature Demonstration",
            "User Workflow Walkthrough", "Integration Capabilities", "Pricing Overview",
            "Customer Success Stories", "Next Steps & CTA"
        ],
        "team_update": [
            "Opening & Context Setting", "Key Achievements Review", "Challenges & Lessons Learned",
            "Strategic Priorities", "Team Recognition", "Upcoming Milestones",
            "Q&A Preparation", "Closing & Motivation"
        ]
    }

    def __init__(self):
        self.client = AsyncAzureOpenAI(
            api_key=config["azure_openai_api_key"],
            api_version=config["api_version"],
            azure_endpoint=config["azure_openai_endpoint"]
        )
        self.model = config.get("analysis_model_deployment_name", "gpt-4o-mini")

    async def analyze_presentation(
        self,
        content_result: ContentUnderstandingResult,
        presentation_type: str,
        segment_images: Optional[Dict[int, str]] = None
    ) -> FullPresentationAnalysis:
        """Perform complete presentation analysis."""
        segment_images = segment_images or {}

        # Classify segments and build slide analyses
        classifications = await self._classify_and_analyze_segments(content_result.segments, segment_images)
        slide_analyses = []

        for segment in content_result.segments:
            classification = classifications.get(segment.segment_id, {})
            if classification.get("is_slide"):
                segment.segment_type = "slide"
                thumbnail = self._find_closest_image(segment.start_time_ms, segment_images)
                slide_analyses.append(SlideAnalysis(
                    segment_id=segment.segment_id,
                    slide_title=classification.get("slide_title", "Untitled"),
                    quality_score=classification.get("quality_score", 3),
                    passed=classification.get("quality_score", 3) >= SLIDE_QUALITY_PASS,
                    improvements=classification.get("improvements", []),
                    ocr_text=classification.get("ocr_text", ""),
                    transcript_during_slide=segment.transcript,
                    thumbnail_base64=thumbnail,
                    start_time_ms=segment.start_time_ms,
                ))
            else:
                segment.segment_type = classification.get("segment_type", "person")

        slide_analyses = self._deduplicate_slides(slide_analyses, content_result.duration_ms)

        # Run remaining analyses in parallel
        segment_analyses, presentation_analysis = await asyncio.gather(
            self._analyze_segments(content_result.segments),
            self._analyze_presentation_level(
                content_result.full_transcript, content_result.segments,
                presentation_type, segment_images
            ),
        )

        timeline_data = self._build_timeline_data(
            content_result.segments, segment_analyses,
            slide_analyses, presentation_analysis.improvements
        )

        total_words = sum(s.word_count for s in content_result.segments)
        duration_s = content_result.duration_ms / 1000.0

        return FullPresentationAnalysis(
            presentation_level=presentation_analysis,
            segment_analyses=segment_analyses,
            slide_analyses=slide_analyses,
            timeline_data=timeline_data,
            total_duration_ms=content_result.duration_ms,
            average_pace=total_words / duration_s if duration_s else 0,
        )

    async def _classify_and_analyze_segments(
        self,
        segments: List[VideoSegment],
        segment_images: Dict[int, str]
    ) -> Dict[str, Dict[str, Any]]:
        """Use GPT vision to classify each segment and analyze slides."""
        if not segment_images:
            return {}

        tasks = []
        segment_ids = []
        for segment in segments:
            if image := self._find_closest_image(segment.start_time_ms, segment_images):
                tasks.append(self._classify_single_segment(segment, image))
                segment_ids.append(segment.segment_id)

        if not tasks:
            return {}

        results = await asyncio.gather(*tasks)
        return dict(zip(segment_ids, results))

    def _find_closest_image(self, timestamp_ms: int, images: Dict[int, str]) -> Optional[str]:
        """Find the closest image to a given timestamp."""
        if not images:
            return None
        if timestamp_ms in images:
            return images[timestamp_ms]
        closest = min(images.keys(), key=lambda t: abs(t - timestamp_ms))
        return images[closest]

    async def _classify_single_segment(
        self,
        segment: VideoSegment,
        image_base64: str
    ) -> Dict[str, Any]:
        """Use GPT vision to classify a single segment."""
        system_prompt = """Analyze this frame from a presentation video.

Determine if this frame primarily shows a presentation slide or something else.

A frame IS a slide if: It shows PowerPoint/Keynote/Google Slides content, text, charts, diagrams.
A frame is NOT a slide if: It primarily shows a person, live demo, or code/terminal."""

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Transcript: \"{segment.transcript[:500]}\""},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                    ]
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "segment_classification",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "is_slide": {"type": "boolean"},
                            "segment_type": {"type": "string", "enum": ["slide", "person", "demo", "other"]},
                            "slide_title": {"type": "string"},
                            "quality_score": {"type": "integer"},
                            "improvements": {"type": "array", "items": {"type": "string"}},
                            "ocr_text": {"type": "string"},
                            "description": {"type": "string"}
                        },
                        "required": ["is_slide", "segment_type", "slide_title", "quality_score", "improvements", "ocr_text", "description"],
                        "additionalProperties": False
                    }
                }
            }
        )
        return json.loads(response.choices[0].message.content)

    async def _analyze_segments(self, segments: List[VideoSegment]) -> List[SegmentAnalysis]:
        """Analyze individual segments for pace and language quality."""
        analyses = []
        for segment in segments:
            pace_status, pace_color = self._classify_pace(segment.words_per_second)
            language = await self._analyze_language_quality(segment.transcript)

            analyses.append(SegmentAnalysis(
                segment_id=segment.segment_id,
                start_time_ms=segment.start_time_ms,
                end_time_ms=segment.end_time_ms,
                segment_type=segment.segment_type,
                pace_status=pace_status,
                pace_color=pace_color,
                words_per_second=segment.words_per_second,
                language_quality=language["quality"],
                language_issues=language["issues"],
                suggestions=language["suggestions"],
                thumbnail_base64=segment.thumbnail_base64,
            ))
        return analyses

    def _classify_pace(self, wps: float) -> tuple[str, str]:
        """Classify speaking pace and return (status, color)."""
        if wps < PACE_TOO_SLOW:
            return "too_slow", "blue"
        if wps < PACE_OPTIMAL_MIN:
            return "slightly_slow", "lightblue"
        if wps <= PACE_OPTIMAL_MAX:
            return "optimal", "green"
        if wps <= PACE_TOO_FAST:
            return "slightly_fast", "yellow"
        return "too_fast", "red"

    async def _analyze_language_quality(self, transcript: str) -> Dict[str, Any]:
        """Analyze language quality of a transcript segment."""
        if not transcript.strip():
            return {"quality": "N/A", "issues": [], "suggestions": []}

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Analyze language quality. Focus on clarity, grammar, filler words, professionalism."},
                {"role": "user", "content": transcript}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "language_analysis",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "quality": {"type": "string", "enum": ["excellent", "good", "fair", "needs_improvement"]},
                            "issues": {"type": "array", "items": {"type": "string"}},
                            "suggestions": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["quality", "issues", "suggestions"],
                        "additionalProperties": False
                    }
                }
            }
        )
        return json.loads(response.choices[0].message.content)

    async def _analyze_presentation_level(
        self,
        full_transcript: str,
        segments: List[VideoSegment],
        presentation_type: str,
        slide_images: Optional[Dict[int, str]] = None
    ) -> PresentationLevelAnalysis:
        """Analyze the presentation at the overall level."""
        checklist = self.CHECKLISTS.get(presentation_type, self.CHECKLISTS["investment_pitch"])

        segment_info = "\n".join(
            f"[{s.start_time_ms}ms] ({s.segment_type}): {s.transcript[:200]}..."
            for s in segments
        )

        messages = [
            {
                "role": "system",
                "content": f"""Expert presentation coach analyzing a {presentation_type.replace('_', ' ')}.

Checklist: {json.dumps(checklist)}

Evaluate: checklist coverage, specific improvements with timecodes, strengths, summary."""
            },
            {"role": "user", "content": f"Transcript:\n{full_transcript}\n\nSegments:\n{segment_info}"}
        ]

        if slide_images:
            images = [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}}
                for _, img in list(slide_images.items())[:10]
            ]
            if images:
                messages.append({"role": "user", "content": [{"type": "text", "text": "Slides:"}, *images]})

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "presentation_analysis",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "checklist_items": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "item": {"type": "string"},
                                        "present": {"type": "boolean"},
                                        "notes": {"type": "string"}
                                    },
                                    "required": ["item", "present", "notes"],
                                    "additionalProperties": False
                                }
                            },
                            "missing_content": {"type": "array", "items": {"type": "string"}},
                            "improvements": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "description": {"type": "string"},
                                        "timecode_ms": {"type": "integer"},
                                        "severity": {"type": "string", "enum": ["high", "medium", "low"]}
                                    },
                                    "required": ["description", "timecode_ms", "severity"],
                                    "additionalProperties": False
                                }
                            },
                            "overall_score": {"type": "integer"},
                            "strengths": {"type": "array", "items": {"type": "string"}},
                            "summary": {"type": "string"}
                        },
                        "required": ["checklist_items", "missing_content", "improvements", "overall_score", "strengths", "summary"],
                        "additionalProperties": False
                    }
                }
            }
        )

        result = json.loads(response.choices[0].message.content)
        return PresentationLevelAnalysis(
            presentation_type=presentation_type,
            checklist_items=result["checklist_items"],
            missing_content=result["missing_content"],
            improvements=result["improvements"][:3],
            overall_score=result["overall_score"],
            strengths=result["strengths"][:3],
            summary=result["summary"],
        )

    def _deduplicate_slides(self, slides: List[SlideAnalysis], total_duration_ms: int) -> List[SlideAnalysis]:
        """Remove duplicate slides that are too close together."""
        if not slides:
            return slides

        # Minimum gap based on video duration
        if total_duration_ms < 120000:
            min_gap_ms = 10000
        elif total_duration_ms < 300000:
            min_gap_ms = 20000
        else:
            min_gap_ms = 30000

        sorted_slides = sorted(slides, key=lambda s: s.start_time_ms)
        deduplicated = []

        for slide in sorted_slides:
            duplicate_of = None
            for existing in deduplicated:
                if self._titles_similar(existing.slide_title, slide.slide_title):
                    if abs(slide.start_time_ms - existing.start_time_ms) < min_gap_ms:
                        duplicate_of = existing
                        break

            if duplicate_of:
                if slide.quality_score > duplicate_of.quality_score:
                    deduplicated.remove(duplicate_of)
                    deduplicated.append(slide)
            else:
                deduplicated.append(slide)

        return deduplicated

    def _titles_similar(self, title1: str, title2: str) -> bool:
        """Check if two slide titles are similar."""
        t1, t2 = title1.lower().strip(), title2.lower().strip()
        if t1 == t2 or t1 in t2 or t2 in t1:
            return True
        words1, words2 = set(t1.split()), set(t2.split())
        if not words1 or not words2:
            return False
        return len(words1 & words2) / min(len(words1), len(words2)) >= 0.7

    def _build_timeline_data(
        self,
        segments: List[VideoSegment],
        segment_analyses: List[SegmentAnalysis],
        slide_analyses: List[SlideAnalysis],
        improvements: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Build timeline data for the UI."""
        segment_map = {sa.segment_id: sa for sa in segment_analyses}
        slide_map = {sa.segment_id: sa for sa in slide_analyses}

        timeline = []
        for segment in segments:
            seg = segment_map.get(segment.segment_id)
            slide = slide_map.get(segment.segment_id)

            segment_improvements = [
                imp for imp in improvements
                if segment.start_time_ms <= imp["timecode_ms"] < segment.end_time_ms
            ]

            entry = {
                "segment_id": segment.segment_id,
                "start_time_ms": segment.start_time_ms,
                "end_time_ms": segment.end_time_ms,
                "duration_ms": segment.end_time_ms - segment.start_time_ms,
                "segment_type": segment.segment_type,
                "description": segment.description,
                "transcript": segment.transcript,
                "pace_color": seg.pace_color if seg else "gray",
                "pace_status": seg.pace_status if seg else "unknown",
                "words_per_second": segment.words_per_second,
                "thumbnail": segment.thumbnail_base64,
                "improvements": segment_improvements,
                "has_issues": bool(segment_improvements) or (seg and seg.pace_color in ["yellow", "red"]),
            }

            if slide:
                entry["slide_analysis"] = {
                    "title": slide.slide_title,
                    "quality_score": slide.quality_score,
                    "passed": slide.passed,
                    "improvements": slide.improvements,
                }

            timeline.append(entry)

        return timeline
