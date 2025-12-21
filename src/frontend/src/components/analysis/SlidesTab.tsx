import { CheckmarkCircle24Filled, DismissCircle24Filled, ArrowLeft20Regular } from '@fluentui/react-icons';
import { formatTime } from '../../utils/formatters';
import type { SlideAnalysis, TimelineSegment } from '../../types';

interface SlidesTabProps {
  slides: SlideAnalysis[];
  timelineData: TimelineSegment[];
  selectedSlide: string | null;
  selectedSegment: string | null;
  onSlideClick: (slideId: string) => void;
  onSlideBack: () => void;
  onPlayFromTime: (timeMs: number) => void;
}

export function SlidesTab({ 
  slides, 
  timelineData,
  selectedSlide, 
  selectedSegment,
  onSlideClick, 
  onSlideBack,
  onPlayFromTime 
}: SlidesTabProps) {
  if (slides.length === 0) {
    return <div className="tab-panel"><p className="empty-text">No slides detected</p></div>;
  }

  // Show slide detail view
  if (selectedSlide) {
    const slide = slides.find(s => s.segment_id === selectedSlide);
    const segment = timelineData.find(s => s.segment_id === selectedSlide);
    
    if (!slide) return null;

    return (
      <div className="tab-panel">
        <div className="slide-detail-view">
          <button className="slide-back-btn" onClick={onSlideBack}>
            <ArrowLeft20Regular /> Back to slides
          </button>
          
          {slide.thumbnail_base64 && (
            <div className="slide-detail-thumbnail">
              <img src={`data:image/jpeg;base64,${slide.thumbnail_base64}`} alt={slide.slide_title} />
            </div>
          )}
          
          <div className="slide-detail-header">
            <span className={`slide-status-large ${slide.passed ? 'passed' : 'failed'}`}>
              {slide.passed ? <CheckmarkCircle24Filled /> : <DismissCircle24Filled />}
            </span>
            <div className="slide-detail-title-info">
              <h4 className="slide-detail-title">{slide.slide_title}</h4>
              <span className="slide-detail-score">Quality: {slide.quality_score}/5</span>
            </div>
          </div>
          
          {segment?.start_time_ms !== undefined && (
            <div className="slide-detail-meta">
              <span 
                className="slide-time-badge" 
                onClick={() => onPlayFromTime(segment.start_time_ms)}
              >
                ▶ {formatTime(segment.start_time_ms)}
              </span>
            </div>
          )}
          
          {slide.improvements?.length > 0 && (
            <div className="slide-findings">
              <h5 className="slide-findings-title">Findings & Improvements</h5>
              {slide.improvements.map((imp, i) => (
                <div key={i} className="slide-finding-item">
                  <span className="finding-bullet">•</span>
                  <span className="finding-text">{imp}</span>
                </div>
              ))}
            </div>
          )}
          
          {(!slide.improvements || slide.improvements.length === 0) && slide.passed && (
            <div className="slide-success-msg">
              <CheckmarkCircle24Filled />
              <span>This slide meets all quality criteria</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show slide list
  return (
    <div className="tab-panel">
      {slides.map((slide) => (
        <div 
          key={slide.segment_id}
          className={`slide-row ${selectedSegment === slide.segment_id ? 'selected' : ''}`}
          onClick={() => onSlideClick(slide.segment_id)}
        >
          <span className={`slide-status ${slide.passed ? 'passed' : 'failed'}`}>
            {slide.passed ? <CheckmarkCircle24Filled /> : <DismissCircle24Filled />}
          </span>
          <span className="slide-name">{slide.slide_title}</span>
          <span className="slide-score">{slide.quality_score}/5</span>
        </div>
      ))}
    </div>
  );
}
