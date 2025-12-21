// Audio Recorder for capturing user's microphone during presentation

import { BaseRecorder } from './BaseRecorder';

export class AudioRecorder extends BaseRecorder {
  private mediaStream: MediaStream | null = null;
  private ownsStream = false;

  protected getMimeType(): string {
    return 'audio/webm;codecs=opus';
  }

  /**
   * Start recording audio
   * @param existingStream Optional existing MediaStream to use instead of creating a new one
   */
  async start(existingStream?: MediaStream): Promise<void> {
    if (this.isRecording) return;
    
    try {
      if (existingStream) {
        this.mediaStream = existingStream;
        this.ownsStream = false;
        console.log('Audio recording using existing stream');
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 44100,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          }
        });
        this.ownsStream = true;
        console.log('Audio recording created new stream');
      }
      
      this.setupRecorder(this.mediaStream);
      this.startRecording();
      console.log('Audio recording started');
      
    } catch (error) {
      console.error('Failed to start audio recording:', error);
      throw error;
    }
  }

  stop(): void {
    super.stop();
    
    // Only stop tracks if we own the stream
    if (this.ownsStream && this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
  }
}
