import { useEffect, useRef } from 'react';
import { Person24Regular } from '@fluentui/react-icons';

interface AvatarPanelProps {
  speaking: boolean;
  videoStream?: MediaStream;
}

export function AvatarPanel({ speaking, videoStream }: AvatarPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  return (
    <div className={`avatar-panel ${speaking ? 'speaking' : ''}`}>
      {videoStream ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
        />
      ) : (
        <div className="avatar-placeholder">
          <div className="avatar-circle">
            <Person24Regular />
          </div>
          <span className="avatar-name">Presentation Coach</span>
          {speaking && (
            <span className="badge badge-primary">Speaking...</span>
          )}
        </div>
      )}
    </div>
  );
}
