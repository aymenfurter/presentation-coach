import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Mic24Regular,
  MicOff24Regular,
  Presenter24Regular,
  PeopleAudience24Regular,
  DataTrending24Regular,
  CallEnd24Regular,
  Record24Regular,
} from '@fluentui/react-icons';
import { AvatarPanel } from '../components/AvatarPanel';
import { ScreenSharePanel } from '../components/ScreenSharePanel';
import { TranscriptPanel } from '../components/TranscriptPanel';
import { DartLogoStatic } from '../components/DartLogo';
import { api } from '../services/api';
import { VoiceLiveClient } from '../services/voiceLiveClient';
import { AudioRecorder } from '../services/audioRecorder';
import { ScreenRecorder } from '../services/screenRecorder';
import { formatTimeSeconds, formatPresentationType } from '../utils/formatters';
import type { TranscriptEntry } from '../types';

// Session phases
type SessionPhase = 'conversation' | 'presenting' | 'qa';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [_connected, setConnected] = useState(false);
  const [userMuted, setUserMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [presentationType, setPresentationType] = useState<string>('');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [avatarVideoStream, setAvatarVideoStream] = useState<MediaStream | undefined>(undefined);
  const [phase, setPhase] = useState<SessionPhase>('conversation');
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Refs
  const voiceLiveRef = useRef<VoiceLiveClient | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const screenRecorderRef = useRef<ScreenRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const aiMutedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize session
  useEffect(() => {
    if (!sessionId) return;
    
    initializeSession();
    
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => {
      cleanup();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [sessionId]);

  async function initializeSession() {
    try {
      // Get session details
      const session = await api.getSession(sessionId!);
      setPresentationType(session.presentation_type);
      
      // Initialize voice client
      voiceLiveRef.current = new VoiceLiveClient(sessionId!);
      
      voiceLiveRef.current.on('connected', () => {
        setConnected(true);
        setLoading(false);
      });
      
      voiceLiveRef.current.on('transcript', (entry: TranscriptEntry) => {
        if (entry.speaker === 'assistant' && aiMutedRef.current) {
          return;
        }
        setTranscripts(prev => [...prev, entry]);
      });
      
      voiceLiveRef.current.on('function_call', (data: { name: string; result: { muted: boolean } }) => {
        if (data.name === 'mute_ai') {
          // AI requested to mute itself - user said they're ready
          startPresentation();
        }
      });
      
      voiceLiveRef.current.on('audio_started', () => {
        setAiSpeaking(true);
      });
      
      voiceLiveRef.current.on('audio_done', () => {
        setAiSpeaking(false);
      });
      
      voiceLiveRef.current.on('avatar_video_stream', (stream: MediaStream) => {
        if (aiMutedRef.current) return;
        setAvatarVideoStream(stream);
      });
      
      voiceLiveRef.current.on('error', (error: Error) => {
        console.error('VoiceLive error:', error);
      });
      
      await voiceLiveRef.current.connect();
      await voiceLiveRef.current.startRecording();
      
      // Initialize audio recorder
      audioRecorderRef.current = new AudioRecorder();
      
    } catch (error) {
      console.error('Failed to initialize session:', error);
      setLoading(false);
    }
  }

  function cleanup() {
    voiceLiveRef.current?.disconnect();
    audioRecorderRef.current?.stop();
    screenRecorderRef.current?.stop();
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
  }

  // Toggle user microphone
  async function toggleMicrophone() {
    if (userMuted) {
      await voiceLiveRef.current?.unmute();
    } else {
      await voiceLiveRef.current?.mute();
    }
    setUserMuted(!userMuted);
  }

  // Start Presentation - mute AI, start screen share and recording
  async function startPresentation() {
    try {
      // Mute the AI
      aiMutedRef.current = true;
      voiceLiveRef.current?.disconnectAvatar();
      setAvatarVideoStream(undefined);
      
      // Start screen sharing
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      screenStreamRef.current = stream;
      
      // Handle user stopping share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        screenStreamRef.current = null;
      };
      
      // Initialize and start recorders
      screenRecorderRef.current = new ScreenRecorder(stream);
      await audioRecorderRef.current?.start();
      await screenRecorderRef.current.start();
      
      setPhase('presenting');
    } catch (error) {
      console.error('Failed to start presentation:', error);
      // Reset if screen share was cancelled
      aiMutedRef.current = false;
      voiceLiveRef.current?.reconnectAvatar();
    }
  }

  // Go to Q&A - stop recording, unmute AI
  async function goToQA() {
    // Stop recording
    audioRecorderRef.current?.stop();
    screenRecorderRef.current?.stop();
    
    // Stop screen share
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    
    // Unmute AI
    aiMutedRef.current = false;
    voiceLiveRef.current?.reconnectAvatar();
    voiceLiveRef.current?.sendText("The presentation is complete. Please ask me questions about my presentation or provide feedback.");
    
    setPhase('qa');
  }

  // Analyze - upload recordings and navigate to analysis
  async function analyzePresentation() {
    try {
      // Get recordings
      const audioBlob = audioRecorderRef.current?.getBlob();
      const screenBlob = screenRecorderRef.current?.getBlob();
      
      // Upload recordings
      if (audioBlob || screenBlob) {
        const formData = new FormData();
        if (audioBlob) {
          formData.append('audio', audioBlob, 'audio.webm');
        }
        if (screenBlob) {
          formData.append('screen', screenBlob, 'screen.webm');
        }
        
        await fetch(`/api/sessions/${sessionId}/recordings`, {
          method: 'POST',
          body: formData
        });
      }
      
      // Complete session
      await api.completeSession(sessionId!);
      
      // Navigate to analysis
      navigate(`/analysis/${sessionId}`);
      
    } catch (error) {
      console.error('Failed to analyze presentation:', error);
    }
  }

  // End call
  function endCall() {
    cleanup();
    navigate('/');
  }

  if (loading) {
    return (
      <div className="session-loading">
        <div className="loader-ring" />
        <div className="session-loading-content">
          <p className="session-loading-text">
            Connecting to your coach...
          </p>
          <p className="session-loading-subtext">
            Please allow microphone access when prompted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="call-container">
      {/* Header */}
      <div className="call-header">
        <div className="call-header-left">
          <Link to="/" className="call-back-btn" title="Back to Home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div className="call-header-brand">
            <div className="call-logo">
              <DartLogoStatic size={28} />
            </div>
            <span className="call-title">
              {formatPresentationType(presentationType)}
            </span>
          </div>
        </div>
        
        <div className="call-header-right">
          {phase === 'presenting' && (
            <span className="call-status-badge recording">
              <Record24Regular />
              Recording
            </span>
          )}
          {phase === 'qa' && (
            <span className="call-status-badge qa">Q&A</span>
          )}
          <div className="call-timer">
            <span className="live-dot" />
            {formatTimeSeconds(elapsedTime)}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="call-main">
        <div className={`video-grid ${phase === 'presenting' && screenStreamRef.current ? 'with-screenshare' : ''}`}>
          {/* AI Avatar - show placeholder when presenting */}
          {phase === 'presenting' ? (
            <div className="avatar-panel avatar-offline">
              <div className="avatar-offline-content">
                <Presenter24Regular />
                <span className="avatar-offline-title">Presenting</span>
                <span className="avatar-offline-subtitle">Your coach is listening</span>
              </div>
            </div>
          ) : (
            <AvatarPanel 
              speaking={aiSpeaking}
              videoStream={avatarVideoStream}
            />
          )}
          
          {/* Screen share */}
          {phase === 'presenting' && screenStreamRef.current && (
            <ScreenSharePanel stream={screenStreamRef.current} />
          )}
        </div>
        
        {/* Transcript panel */}
        <TranscriptPanel transcripts={transcripts} />
      </div>

      {/* Controls */}
      <div className="call-controls">
        {/* Microphone */}
        <button 
          className={`control-button ${userMuted ? 'active' : 'secondary'}`}
          onClick={toggleMicrophone}
        >
          <span className="icon">
            {userMuted ? <MicOff24Regular /> : <Mic24Regular />}
          </span>
          <span className="label">{userMuted ? 'Unmute' : 'Mute'}</span>
        </button>
        
        {/* Phase-specific buttons */}
        {phase === 'conversation' && (
          <button 
            className="control-button primary"
            onClick={startPresentation}
          >
            <span className="icon"><Presenter24Regular /></span>
            <span className="label">Present</span>
          </button>
        )}
        
        {phase === 'presenting' && (
          <button 
            className="control-button success"
            onClick={goToQA}
          >
            <span className="icon"><PeopleAudience24Regular /></span>
            <span className="label">Q&A</span>
          </button>
        )}
        
        {phase === 'qa' && (
          <button 
            className="control-button primary"
            onClick={analyzePresentation}
          >
            <span className="icon"><DataTrending24Regular /></span>
            <span className="label">Analyze</span>
          </button>
        )}
        
        {/* End call */}
        <button 
          className="control-button danger"
          onClick={endCall}
        >
          <span className="icon"><CallEnd24Regular /></span>
          <span className="label">End</span>
        </button>
      </div>
    </div>
  );
}
