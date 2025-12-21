// Screen Recorder for capturing screen share during presentation

import { BaseRecorder } from './BaseRecorder';

export class ScreenRecorder extends BaseRecorder {
  private stream: MediaStream;

  constructor(stream: MediaStream) {
    super();
    this.stream = stream;
  }

  protected getMimeType(): string {
    return 'video/webm;codecs=vp9';
  }

  async start(): Promise<void> {
    if (this.isRecording) return;
    
    try {
      this.setupRecorder(this.stream);
      this.startRecording();
      console.log('Screen recording started');
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      throw error;
    }
  }
}
