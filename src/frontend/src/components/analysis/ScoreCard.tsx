import { getScoreClass } from '../../utils/formatters';
import type { PresentationLevelAnalysis } from '../../types';

interface ScoreCardProps {
  presentationLevel: PresentationLevelAnalysis;
}

export function ScoreCard({ presentationLevel }: ScoreCardProps) {
  const scoreClass = getScoreClass(presentationLevel.overall_score);

  return (
    <div className="score-card">
      <div className={`score-ring ${scoreClass}`}>
        <span className="score-value">{presentationLevel.overall_score}</span>
      </div>
      <div className="score-info">
        <span className="score-label">Overall Score</span>
        <div className="score-strengths-inline">
          {presentationLevel.strengths.slice(0, 2).map((s, i) => (
            <span key={i} className="strength-tag">✓ {s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
