import { Play24Filled, Pause24Filled } from '@fluentui/react-icons';
import { formatTime } from '../../utils/formatters';

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sessionId: string;
  isPlaying: boolean;
  totalDuration: number;
  onToggle: () => void;
  onPlay: () => void;
  onPause: () => void;
}

export function VideoPlayer({ 
  videoRef, 
  sessionId, 
  isPlaying, 
  totalDuration,
  onToggle,
  onPlay,
  onPause 
}: VideoPlayerProps) {
  const currentTime = videoRef.current?.currentTime ?? 0;
  const progress = totalDuration > 0 ? (currentTime * 1000 / totalDuration) * 100 : 0;

  return (
    <div className="video-section">
      <video 
        ref={videoRef}
        src={`/api/sessions/${sessionId}/video`}
        onPlay={onPlay}
        onPause={onPause}
      />
      <div className="video-controls">
        <button className="video-play-btn" onClick={onToggle}>
          {isPlaying ? <Pause24Filled /> : <Play24Filled />}
        </button>
        <span className="video-time">{formatTime(currentTime * 1000)}</span>
        <div className="video-progress">
          <div className="video-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="video-time">{formatTime(totalDuration)}</span>
      </div>
    </div>
  );
}
