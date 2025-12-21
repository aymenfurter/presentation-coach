import { useEffect, RefObject } from 'react';

/**
 * Hook for attaching a MediaStream to a video element
 */
export function useVideoStream(
  videoRef: RefObject<HTMLVideoElement>,
  stream: MediaStream | undefined
): void {
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [videoRef, stream]);
}
