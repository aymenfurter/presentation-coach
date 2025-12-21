// Analysis Types - Presentation Coach

export interface ChecklistItem {
  item: string;
  present: boolean;
  notes: string;
}

export interface Improvement {
  description: string;
  timecode_ms: number;
  severity: 'high' | 'medium' | 'low';
}

export interface PresentationLevelAnalysis {
  presentation_type: string;
  checklist_items: ChecklistItem[];
  missing_content: string[];
  improvements: Improvement[];
  overall_score: number;
  strengths: string[];
  summary: string;
}

export interface SegmentAnalysis {
  segment_id: string;
  start_time_ms: number;
  end_time_ms: number;
  segment_type: string;
  pace_status: string;
  pace_color: string;
  words_per_second: number;
  language_quality: string;
  language_issues: string[];
  suggestions: string[];
}

export interface SlideAnalysis {
  segment_id: string;
  slide_title: string;
  quality_score: number;
  passed: boolean;
  improvements: string[];
  thumbnail_base64?: string;
  start_time_ms?: number;
}

export interface TimelineSegment {
  segment_id: string;
  start_time_ms: number;
  end_time_ms: number;
  duration_ms: number;
  segment_type: string;
  description: string;
  transcript: string;
  pace_color: string;
  pace_status: string;
  words_per_second: number;
  thumbnail?: string;
  improvements?: Improvement[];
  has_issues: boolean;
  slide_analysis?: {
    title: string;
    quality_score: number;
    passed: boolean;
    improvements: string[];
  };
}

export interface AnalysisResult {
  presentation_level: PresentationLevelAnalysis;
  segment_analyses: SegmentAnalysis[];
  slide_analyses: SlideAnalysis[];
  timeline_data: TimelineSegment[];
  total_duration_ms: number;
  average_pace: number;
}
