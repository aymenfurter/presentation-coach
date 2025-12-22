import { useRef, useState, useEffect } from 'react';
import { formatTime } from '../utils/formatters';
import type { TimelineSegment } from '../types';

interface TimelineProps {
  data: TimelineSegment[];
  totalDuration: number;
  selectedSegment: string | null;
  onSegmentClick: (segmentId: string) => void;
}

export function Timeline({ data, totalDuration, selectedSegment, onSegmentClick }: TimelineProps) {
  const [hoveredSegment, setHoveredSegment] = useState<TimelineSegment | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  function getSegmentWidth(segment: TimelineSegment): number {
    const duration = segment.end_time_ms - segment.start_time_ms;
    return (duration / totalDuration) * 100;
  }

  function getPaceColorClass(color: string): string {
    return `pace-${color}`;
  }

  function handleMouseEnter(e: React.MouseEvent, segment: TimelineSegment) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setHoverPosition({ 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top - 10 
      });
    }
    setHoveredSegment(segment);
  }

  function handleMouseMove(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && hoveredSegment) {
      setHoverPosition({ 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top - 10 
      });
    }
  }

  return (
    <div className="timeline-container" ref={containerRef}>
      {/* Legend */}
      <div className="timeline-legend">
        <div className="timeline-legend-item">
          <div className="timeline-legend-color optimal" />
          <span>Optimal</span>
        </div>
        <div className="timeline-legend-item">
          <div className="timeline-legend-color slightly-fast" />
          <span>Slightly fast</span>
        </div>
        <div className="timeline-legend-item">
          <div className="timeline-legend-color too-fast" />
          <span>Too fast</span>
        </div>
        <div className="timeline-legend-item">
          <div className="timeline-legend-color slow" />
          <span>Slow</span>
        </div>
      </div>

      {/* Timeline bar */}
      <div className="timeline-bar" onMouseMove={handleMouseMove}>
        {data.map((segment) => {
          const width = getSegmentWidth(segment);
          const isSelected = selectedSegment === segment.segment_id;
          const isHovered = hoveredSegment?.segment_id === segment.segment_id;
          
          return (
            <div
              key={segment.segment_id}
              className={`timeline-segment ${getPaceColorClass(segment.pace_color)} ${isSelected ? 'selected' : ''}`}
              style={{
                width: `${width}%`,
                opacity: isSelected || isHovered ? 1 : 0.85,
              }}
              onClick={() => onSegmentClick(segment.segment_id)}
              onMouseEnter={(e) => handleMouseEnter(e, segment)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {/* Improvement markers */}
              {segment.improvements?.map((imp: { timecode_ms: number }, i: number) => {
                const position = ((imp.timecode_ms - segment.start_time_ms) / 
                  (segment.end_time_ms - segment.start_time_ms)) * 100;
                return (
                  <div 
                    key={i}
                    className="timeline-improvement-marker"
                    style={{ left: `${position}%` }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Hover Preview Tooltip */}
      {hoveredSegment && (
        <div 
          className="timeline-hover-preview"
          style={{ 
            left: `${Math.min(Math.max(hoverPosition.x, 80), containerWidth - 80)}px`,
            bottom: '70px'
          }}
        >
          {hoveredSegment.thumbnail && (
            <div className="timeline-preview-thumb">
              <img src={`data:image/jpeg;base64,${hoveredSegment.thumbnail}`} alt="Preview" />
            </div>
          )}
          <div className="timeline-preview-info">
            <span className="timeline-preview-time">
              {formatTime(hoveredSegment.start_time_ms)} - {formatTime(hoveredSegment.end_time_ms)}
            </span>
            <span className="timeline-preview-type">{hoveredSegment.segment_type}</span>
            <span className={`timeline-preview-pace ${hoveredSegment.pace_color}`}>
              {hoveredSegment.words_per_second.toFixed(1)} wps
            </span>
          </div>
        </div>
      )}

      {/* Time markers */}
      <div className="timeline-markers">
        <span className="timeline-marker">0:00</span>
        <span className="timeline-marker">{formatTime(totalDuration / 4)}</span>
        <span className="timeline-marker">{formatTime(totalDuration / 2)}</span>
        <span className="timeline-marker">{formatTime((totalDuration * 3) / 4)}</span>
        <span className="timeline-marker">{formatTime(totalDuration)}</span>
      </div>
    </div>
  );
}
