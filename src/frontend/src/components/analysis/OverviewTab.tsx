import { formatTime } from '../../utils/formatters';
import type { PresentationLevelAnalysis, Improvement } from '../../types';

interface OverviewTabProps {
  presentationLevel: PresentationLevelAnalysis;
  onImprovementClick: (improvement: Improvement) => void;
}

export function OverviewTab({ presentationLevel, onImprovementClick }: OverviewTabProps) {
  return (
    <div className="tab-panel">
      <h4 className="panel-title">Summary</h4>
      <p className="summary-text">{presentationLevel.summary}</p>
      
      {presentationLevel.improvements.length > 0 && (
        <>
          <h4 className="panel-title" style={{ marginTop: '16px' }}>Improvements</h4>
          {presentationLevel.improvements.map((imp, i) => (
            <div 
              key={i} 
              className={`improvement-row ${imp.severity}`}
              onClick={() => onImprovementClick(imp)}
            >
              <span className="improvement-time">{formatTime(imp.timecode_ms)}</span>
              <span className="improvement-desc">{imp.description}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
