import { formatTime } from '../../utils/formatters';
import type { TimelineSegment, Improvement } from '../../types';

interface SegmentDetailsProps {
  segment: TimelineSegment | null;
}

export function SegmentDetails({ segment }: SegmentDetailsProps) {
  if (!segment) {
    return <p className="empty-text">Click a segment on the timeline to see details</p>;
  }

  return (
    <div className="detail-content">
      {segment.thumbnail && (
        <div className="detail-thumbnail">
          <img src={`data:image/jpeg;base64,${segment.thumbnail}`} alt="Frame" />
        </div>
      )}
      
      <div className="detail-row">
        <span className="detail-label">Time</span>
        <span className="detail-value">
          {formatTime(segment.start_time_ms)} — {formatTime(segment.end_time_ms)}
        </span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">Type</span>
        <span className="badge badge-info">{segment.segment_type}</span>
      </div>
      
      <div className="detail-row">
        <span className="detail-label">Pace</span>
        <span className="detail-pace" style={{ backgroundColor: segment.pace_color }}>
          {segment.words_per_second.toFixed(1)} wps • {segment.pace_status}
        </span>
      </div>
      
      {segment.transcript && (
        <div className="detail-transcript">
          <span className="detail-label">Transcript</span>
          <p>{segment.transcript}</p>
        </div>
      )}
      
      {segment.improvements && segment.improvements.length > 0 && (
        <div className="detail-improvements">
          <span className="detail-label">Suggestions</span>
          {segment.improvements.map((imp: Improvement, i: number) => (
            <p key={i} className="detail-suggestion">{imp.description}</p>
          ))}
        </div>
      )}
    </div>
  );
}
