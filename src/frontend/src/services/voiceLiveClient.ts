// VoiceLive WebSocket Client for real-time voice conversations
// Based on the voicelive-api-salescoach sample

import type { TranscriptEntry } from '../types';

type EventCallback<T = unknown> = (data: T) => void;
type AnyEventCallback = EventCallback<unknown>;

// Audio processor worklet code for microphone input
const audioProcessorCode = `
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.recording = false
    this.buffer = []
    this.port.onmessage = e => {
      if (e.data.command === 'START') this.recording = true
      else if (e.data.command === 'STOP') {
        this.recording = false
        if (this.buffer.length) this.sendBuffer()
      }
    }
  }
  sendBuffer() {
    if (this.buffer.length) {
      this.port.postMessage({
        eventType: 'audio',
        audioData: new Float32Array(this.buffer)
      })
      this.buffer = []
    }
  }
  process(inputs) {
    if (inputs[0]?.length && this.recording) {
      this.buffer.push(...inputs[0][0])
      if (this.buffer.length >= 2400) this.sendBuffer()
    }
    return true
  }
}
registerProcessor('audio-recorder', AudioRecorderProcessor)
`;

export class VoiceLiveClient {
  private sessionId: string;
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private playbackAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private worklet: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isMuted = false;
  private isRecording = false;
  private nextPlayTime = 0;
  private isAvatarMuted = false; // When true, suppress all avatar audio and transcripts
  
  // WebRTC for avatar video/audio
  private peerConnection: RTCPeerConnection | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private audioElement: HTMLAudioElement | null = null;
  
  private eventListeners: Map<string, Set<AnyEventCallback>> = new Map();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Get the microphone MediaStream used by VoiceLive
   * Can be shared with AudioRecorder for recording
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as AnyEventCallback);
  }

  off<T>(event: string, callback: EventCallback<T>): void {
    this.eventListeners.get(event)?.delete(callback as AnyEventCallback);
  }

  private emit<T>(event: string, data: T): void {
    this.eventListeners.get(event)?.forEach(cb => (cb as EventCallback<T>)(data));
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/voicelive/${this.sessionId}`;
        
        console.log('Connecting to VoiceLive WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = async () => {
          console.log('VoiceLive WebSocket connected');
          this.emit('connected', undefined);
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        this.ws.onerror = (error) => {
          console.error('VoiceLive WebSocket error:', error);
          this.emit('error', new Error('WebSocket error'));
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('VoiceLive WebSocket closed');
          this.emit('disconnected', undefined);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopRecording();
    this.cleanupAudio();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private async initializeRecording(): Promise<void> {
    try {
      // Request microphone access with 24kHz sample rate
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
        }
      });
      
      // Create audio context at 24kHz for recording
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Create and load the audio worklet
      const blob = new Blob([audioProcessorCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      
      // Create source from microphone
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create worklet node
      this.worklet = new AudioWorkletNode(this.audioContext, 'audio-recorder');
      
      // Handle audio data from worklet
      this.worklet.port.onmessage = (event) => {
        if (event.data.eventType === 'audio' && !this.isMuted) {
          const float32 = event.data.audioData;
          // Convert float32 to int16
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32767));
          }
          // Send as base64 using VoiceLive protocol
          const base64 = this.arrayBufferToBase64(int16.buffer);
          this.send({ type: 'input_audio_buffer.append', audio: base64 });
        }
      };
      
      // Connect nodes
      this.source.connect(this.worklet);
      this.worklet.connect(this.audioContext.destination);
      
      console.log('Audio recording initialized');
      
    } catch (error) {
      console.error('Failed to initialize audio recording:', error);
      throw error;
    }
  }

  private initializePlayback(): void {
    // Create playback context at 24kHz
    this.playbackAudioContext = new AudioContext({ sampleRate: 24000 });
    this.nextPlayTime = 0;
    console.log('Audio playback initialized');
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;
    
    await this.initializeRecording();
    this.initializePlayback();
    
    if (this.worklet) {
      this.worklet.port.postMessage({ command: 'START' });
    }
    
    this.isRecording = true;
    this.emit('recording_started', undefined);
    console.log('Recording started');
  }

  stopRecording(): void {
    if (!this.isRecording) return;
    
    if (this.worklet) {
      this.worklet.port.postMessage({ command: 'STOP' });
    }
    
    this.isRecording = false;
    this.emit('recording_stopped', undefined);
    console.log('Recording stopped');
  }

  private cleanupAudio(): void {
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.playbackAudioContext) {
      this.playbackAudioContext.close();
      this.playbackAudioContext = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Cleanup WebRTC
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }
    
    this.videoElement = null;
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Log all messages for debugging
      if (message.type !== 'response.audio.delta' && message.type !== 'response.audio_transcript.delta') {
        console.log('VoiceLive message:', message.type, message);
      }
      
      switch (message.type) {
        case 'proxy.connected':
          console.log('Proxy connected to Azure Voice API');
          this.emit('session_ready', message);
          break;
          
        case 'session.created':
          console.log('Session created:', message.session?.id);
          this.emit('session_created', message);
          break;
          
        case 'session.updated':
          console.log('Session updated');
          this.emit('session_updated', message);
          // Check for ICE servers to set up WebRTC for avatar
          this.handleSessionUpdated(message);
          break;
          
        case 'conversation.item.input_audio_transcription.completed':
          // User's speech transcribed
          if (message.transcript) {
            const entry: TranscriptEntry = {
              text: message.transcript,
              speaker: 'user',
              timestamp: new Date().toISOString()
            };
            this.emit('transcript', entry);
            console.log('User transcript:', message.transcript);
          }
          break;
          
        case 'response.audio_transcript.delta':
          // Assistant's incremental transcript - suppress if muted
          if (!this.isAvatarMuted) {
            this.emit('transcript_delta', {
              speaker: 'assistant',
              delta: message.delta
            });
          }
          break;
          
        case 'response.audio_transcript.done':
          // Assistant's complete transcript - suppress if muted
          if (message.transcript && !this.isAvatarMuted) {
            const entry: TranscriptEntry = {
              text: message.transcript,
              speaker: 'assistant',
              timestamp: new Date().toISOString()
            };
            this.emit('transcript', entry);
            console.log('Assistant transcript:', message.transcript);
          } else if (this.isAvatarMuted) {
            console.log('Suppressing assistant transcript (avatar muted):', message.transcript);
          }
          break;
          
        case 'response.audio.delta':
          // Audio chunk from assistant - suppress if muted
          if (message.delta && !this.isAvatarMuted) {
            this.playAudio(message.delta);
          }
          break;
          
        case 'response.audio.done':
          this.emit('audio_done', undefined);
          break;
          
        case 'input_audio_buffer.speech_started':
          this.emit('speech_started', undefined);
          break;
          
        case 'input_audio_buffer.speech_stopped':
          this.emit('speech_stopped', undefined);
          break;
          
        case 'error':
          console.error('VoiceLive error:', message.error);
          this.emit('error', new Error(message.error?.message || 'Unknown error'));
          break;
        
        case 'function_call.executed':
          // Backend executed a function call (mute_ai/unmute_ai)
          console.log('Function call executed:', message.name, message.result);
          this.emit('function_call', {
            name: message.name,
            result: message.result
          });
          break;
          
        default:
          // Check for WebRTC answer (server_sdp, sdp, or answer)
          if ((message.server_sdp || message.sdp || message.answer) && message.type !== 'session.update') {
            this.handleWebRTCAnswer(message);
          } else if (!message.type?.startsWith('response.') && !message.type?.startsWith('input_')) {
            // Log unhandled message types for debugging
            console.log('Unhandled message type:', message.type);
          }
      }
      
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  // ----- WebRTC for Avatar Video/Audio -----

  private handleSessionUpdated(message: any): void {
    const session = message.session;
    // Look for ICE servers in various locations (API may vary)
    const servers =
      session?.avatar?.ice_servers ||
      session?.rtc?.ice_servers ||
      session?.ice_servers;
    const username =
      session?.avatar?.username ||
      session?.avatar?.ice_username ||
      session?.rtc?.ice_username ||
      session?.ice_username;
    const credential =
      session?.avatar?.credential ||
      session?.avatar?.ice_credential ||
      session?.rtc?.ice_credential ||
      session?.ice_credential;

    if (servers) {
      console.log('ICE servers received, setting up WebRTC for avatar');
      this.setupWebRTC(servers, username, credential);
    }
  }

  private async setupWebRTC(
    iceServers: any,
    username?: string,
    password?: string
  ): Promise<void> {
    try {
      // Parse ICE servers
      let servers = Array.isArray(iceServers) ? iceServers : [{ urls: iceServers }];
      if (username && password) {
        servers = servers.map((s: any) => ({
          urls: typeof s === 'string' ? s : s.urls,
          username,
          credential: password,
          credentialType: 'password' as const,
        }));
      }

      console.log('Creating RTCPeerConnection with servers:', servers);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: servers,
        bundlePolicy: 'max-bundle',
      });

      // When ICE gathering is complete, send the offer
      pc.onicecandidate = (e) => {
        if (!e.candidate && pc.localDescription) {
          const sdp = btoa(
            JSON.stringify({
              type: 'offer',
              sdp: pc.localDescription.sdp,
            })
          );
          console.log('Sending avatar connect offer');
          this.send({ type: 'session.avatar.connect', client_sdp: sdp });
        }
      };

      // Handle incoming tracks (video and audio from avatar)
      pc.ontrack = (e) => {
        console.log('Received track:', e.track.kind);
        if (e.track.kind === 'video') {
          // Emit video stream for AvatarPanel to use
          this.emit('avatar_video_stream', e.streams[0]);
          
          // Also set on video element if available
          if (this.videoElement) {
            this.videoElement.srcObject = e.streams[0];
            this.videoElement.play().catch(err => console.error('Video play error:', err));
          }
        } else if (e.track.kind === 'audio') {
          // Create audio element for avatar audio
          if (!this.audioElement) {
            this.audioElement = document.createElement('audio');
            this.audioElement.autoplay = true;
            this.audioElement.style.display = 'none';
            document.body.appendChild(this.audioElement);
          }
          this.audioElement.srcObject = e.streams[0];
        }
      };

      // Add transceivers for receiving video and audio
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.peerConnection = pc;
      console.log('WebRTC setup complete, waiting for ICE candidates');

    } catch (error) {
      console.error('Failed to setup WebRTC:', error);
    }
  }

  private async handleWebRTCAnswer(message: any): Promise<void> {
    if (!this.peerConnection || this.peerConnection.signalingState !== 'have-local-offer') {
      console.log('Ignoring WebRTC answer - not in correct state');
      return;
    }

    try {
      // Parse SDP from various possible formats
      let sdp: string | undefined;
      if (message.server_sdp) {
        const parsed = JSON.parse(atob(message.server_sdp));
        sdp = parsed.sdp;
      } else {
        sdp = message.sdp || message.answer;
      }

      if (sdp) {
        console.log('Setting remote description from server');
        await this.peerConnection.setRemoteDescription({ type: 'answer', sdp });
        console.log('WebRTC connection established');
        this.emit('avatar_connected', undefined);
      }
    } catch (error) {
      console.error('Failed to handle WebRTC answer:', error);
    }
  }

  /**
   * Set the video element for avatar display.
   * Call this before connecting to ensure avatar video is displayed.
   */
  setVideoElement(element: HTMLVideoElement | null): void {
    this.videoElement = element;
    // If we already have a stream, set it
    if (this.peerConnection && element) {
      const receivers = this.peerConnection.getReceivers();
      for (const receiver of receivers) {
        if (receiver.track?.kind === 'video') {
          const stream = new MediaStream([receiver.track]);
          element.srcObject = stream;
          element.play().catch(err => console.error('Video play error:', err));
          break;
        }
      }
    }
  }

  private playAudio(base64: string): void {
    if (!this.playbackAudioContext) {
      this.initializePlayback();
    }
    
    const audioCtx = this.playbackAudioContext!;
    audioCtx.resume?.();
    
    try {
      // Decode base64 to bytes
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      
      // Convert int16 to float32
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }
      
      // Create audio buffer
      const buffer = audioCtx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      
      // Create source and play
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(audioCtx.destination);
      
      // Schedule playback
      this.nextPlayTime = Math.max(this.nextPlayTime, audioCtx.currentTime);
      src.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;
      
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  async mute(): Promise<void> {
    this.isMuted = true;
    this.emit('muted', undefined);
  }

  async unmute(): Promise<void> {
    this.isMuted = false;
    this.emit('unmuted', undefined);
  }

  /**
   * Mute the avatar - suppresses audio and transcripts but keeps WebRTC connected.
   * The avatar will be hidden in the UI.
   */
  disconnectAvatar(): void {
    console.log('Muting avatar');
    this.isAvatarMuted = true; // Suppress all audio and transcripts
    
    // Mute the WebRTC audio element (but keep connection alive)
    if (this.audioElement) {
      this.audioElement.muted = true;
    }
    
    // Suspend playback audio context
    if (this.playbackAudioContext) {
      this.playbackAudioContext.suspend();
    }
    
    this.emit('avatar_muted', undefined);
    console.log('Avatar muted');
  }

  /**
   * Unmute the avatar - resumes audio and transcripts.
   * The avatar will be shown again in the UI.
   */
  reconnectAvatar(): void {
    console.log('Unmuting avatar');
    this.isAvatarMuted = false; // Allow audio and transcripts again
    
    // Unmute the WebRTC audio element
    if (this.audioElement) {
      this.audioElement.muted = false;
    }
    
    // Resume playback audio context
    if (this.playbackAudioContext) {
      this.playbackAudioContext.resume();
    }
    
    // Re-emit the video stream if we have an active WebRTC connection
    if (this.peerConnection) {
      const receivers = this.peerConnection.getReceivers();
      for (const receiver of receivers) {
        if (receiver.track?.kind === 'video') {
          const stream = new MediaStream([receiver.track]);
          this.emit('avatar_video_stream', stream);
          console.log('Re-emitted avatar video stream');
          break;
        }
      }
    }
    
    this.emit('avatar_unmuted', undefined);
    console.log('Avatar unmuted');
  }

  sendText(text: string): void {
    // Send text input using VoiceLive protocol
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    });
    // Request response
    this.send({ type: 'response.create' });
  }

  private send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
