// Base Recorder - Abstract class for media recording (DRY principle)

export interface IRecorder {
  start(): Promise<void>;
  stop(): void;
  getBlob(): Blob | null;
  isActive(): boolean;
}

export abstract class BaseRecorder implements IRecorder {
  protected mediaRecorder: MediaRecorder | null = null;
  protected chunks: Blob[] = [];
  protected isRecording = false;

  protected abstract getMimeType(): string;

  protected setupRecorder(stream: MediaStream): void {
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: this.getMimeType()
    });

    this.chunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
  }

  protected startRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.start(1000); // Capture in 1-second chunks
      this.isRecording = true;
    }
  }

  abstract start(): Promise<void>;

  stop(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    
    this.mediaRecorder.stop();
    this.isRecording = false;
    console.log(`${this.constructor.name} stopped`);
  }

  getBlob(): Blob | null {
    if (this.chunks.length === 0) return null;
    return new Blob(this.chunks, { type: this.getMimeType().split(';')[0] });
  }

  getChunks(): Blob[] {
    return this.chunks;
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
