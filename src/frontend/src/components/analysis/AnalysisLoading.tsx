import { DartLogo } from '../DartLogo';
import { EmberParticles } from '../EmberParticles';

interface AnalysisLoadingProps {
  analyzing: boolean;
}

export function AnalysisLoading({ analyzing }: AnalysisLoadingProps) {
  return (
    <div className="analysis-loading">
      <EmberParticles intensity={analyzing ? 0.6 : 0.3} active={true} />
      <div className="analysis-loading-logo">
        <DartLogo size={80} heat={analyzing ? 0.7 : 0.3} />
      </div>
      <div className="analysis-loading-text">
        <h3 className="analysis-loading-title">
          {analyzing ? 'Analyzing your presentation' : 'Loading analysis'}
        </h3>
        <p className="analysis-loading-subtitle">
          {analyzing ? 'AI is reviewing your content and delivery...' : 'Please wait a moment'}
        </p>
      </div>
    </div>
  );
}
