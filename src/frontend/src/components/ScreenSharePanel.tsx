import { useEffect, useRef } from 'react';
import { ShareScreenStart24Regular } from '@fluentui/react-icons';

interface ScreenSharePanelProps {
  stream?: MediaStream;
}

export function ScreenSharePanel({ stream }: ScreenSharePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className="screen-share-panel">
        <div className="screen-share-placeholder">
          <ShareScreenStart24Regular />
          <p>Click "Share Screen" to show your presentation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-share-panel">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
      />
    </div>
  );
}
