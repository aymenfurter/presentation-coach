import { 
  CheckmarkCircle24Filled, 
  DismissCircle24Filled,
  Image24Regular 
} from '@fluentui/react-icons';
import { SlideAnalysis } from '../services/api';

interface SlideCardProps {
  slide: SlideAnalysis;
  onClick: () => void;
  selected: boolean;
}

export function SlideCard({ slide, onClick, selected }: SlideCardProps) {
  return (
    <div 
      className={`slide-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="slide-thumbnail">
        {slide.thumbnail_base64 ? (
          <img 
            src={`data:image/jpeg;base64,${slide.thumbnail_base64}`}
            alt={slide.slide_title}
          />
        ) : (
          <div className="slide-thumbnail-placeholder">
            <Image24Regular />
          </div>
        )}
      </div>
      
      <div className="slide-info">
        <div className="slide-rating">
          <span className="slide-title">{slide.slide_title}</span>
          <span className={`rating-badge ${slide.passed ? 'passed' : 'needs-work'}`}>
            {slide.passed ? (
              <>
                <CheckmarkCircle24Filled />
                Passed ({slide.quality_score}/5)
              </>
            ) : (
              <>
                <DismissCircle24Filled />
                Needs Work ({slide.quality_score}/5)
              </>
            )}
          </span>
        </div>
        
        {!slide.passed && slide.improvements.length > 0 && (
          <div className="slide-improvements">
            <p className="slide-improvements-title">Improvements:</p>
            {slide.improvements.map((improvement, i) => (
              <div key={i} className="slide-improvement">
                {improvement}
              </div>
            ))}
          </div>
        )}
        
        {slide.passed && (
          <div className="slide-passed-message">
            <CheckmarkCircle24Filled />
            <span>This slide meets quality standards</span>
          </div>
        )}
      </div>
    </div>
  );
}
