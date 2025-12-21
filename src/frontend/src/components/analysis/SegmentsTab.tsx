import { formatTime } from '../../utils/formatters';
import type { TimelineSegment } from '../../types';

interface SegmentsTabProps {
  segments: TimelineSegment[];
  selectedSegment: string | null;
  onSegmentClick: (segmentId: string) => void;
}

export function SegmentsTab({ segments, selectedSegment, onSegmentClick }: SegmentsTabProps) {
  return (
    <div className="tab-panel">
      {segments.map((segment) => (
        <div 
          key={segment.segment_id}
          className={`segment-row ${selectedSegment === segment.segment_id ? 'selected' : ''}`}
          onClick={() => onSegmentClick(segment.segment_id)}
        >
          <span className="segment-time-badge">{formatTime(segment.start_time_ms)}</span>
          <span className="segment-type">{segment.segment_type}</span>
          <span className={`segment-pace ${segment.pace_status.replace(' ', '-')}`}>
            {segment.words_per_second.toFixed(1)} wps
          </span>
        </div>
      ))}
    </div>
  );
}
