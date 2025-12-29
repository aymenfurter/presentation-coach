import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Mic24Regular,
  MicOff24Regular,
  Presenter24Regular,
  DataTrending24Regular,
  CallEnd24Regular,
  Record24Regular,
  Play24Regular,
} from '@fluentui/react-icons';
import { ScreenSharePanel } from '../components/ScreenSharePanel';
import { DartLogoStatic } from '../components/DartLogo';
import { api } from '../services/api';
import { AudioRecorder } from '../services/audioRecorder';
import { ScreenRecorder } from '../services/screenRecorder';
import { formatTimeSeconds, formatPresentationType } from '../utils/formatters';

// Session phases
type SessionPhase = 'welcome' | 'presenting' | 'review';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [userMuted, setUserMuted] = useState(false);
  const [presentationType, setPresentationType] = useState<string>('');
  const [phase, setPhase] = useState<SessionPhase>('welcome');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [welcomeVideoEnded, setWelcomeVideoEnded] = useState(false);
  const [reviewVideoEnded, setReviewVideoEnded] = useState(false);
  
  // Refs
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const screenRecorderRef = useRef<ScreenRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const welcomeVideoRef = useRef<HTMLVideoElement>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize session
  useEffect(() => {
    if (!sessionId) return;
    
    let mounted = true;
    
    async function initializeSession() {
      try {
        const session = await api.getSession(sessionId!);
        if (!mounted) return;
        setPresentationType(session.presentation_type);
        
        // Initialize audio recorder
        audioRecorderRef.current = new AudioRecorder();
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize session:', error);
        if (mounted) setLoading(false);
      }
    }
    
    initializeSession();
    
    return () => {
      mounted = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      audioRecorderRef.current?.stop();
      screenRecorderRef.current?.stop();
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [sessionId]);

  // Handle welcome video ending
  function handleWelcomeVideoEnded() {
    setWelcomeVideoEnded(true);
  }

  // Handle review video ending
  function handleReviewVideoEnded() {
    setReviewVideoEnded(true);
  }

  // Toggle user microphone
  async function toggleMicrophone() {
    if (audioRecorderRef.current) {
      if (userMuted) {
        // Unmute - but don't start recording yet
      } else {
        // Mute
      }
    }
    setUserMuted(!userMuted);
  }

  // Start Presentation - start screen share and recording
  async function startPresentation() {
    try {
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
      setScreenStream(stream);
      
      // Handle user stopping share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        screenStreamRef.current = null;
        setScreenStream(null);
      };
      
      // Initialize and start recorders
      screenRecorderRef.current = new ScreenRecorder(stream);
      await audioRecorderRef.current?.start();
      await screenRecorderRef.current.start();
      
      // Start timer
      timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
      
      setPhase('presenting');
    } catch (error) {
      console.error('Failed to start presentation:', error);
    }
  }

  // Go to Review phase - stop recording, show review video
  async function goToReview() {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop recording
    audioRecorderRef.current?.stop();
    screenRecorderRef.current?.stop();
    
    // Stop screen share
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    
    setPhase('review');
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    audioRecorderRef.current?.stop();
    screenRecorderRef.current?.stop();
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    navigate('/');
  }

  if (loading) {
    return (
      <div className="session-loading">
        <div className="loader-ring" />
        <div className="session-loading-content">
          <p className="session-loading-text">
            Setting up your session...
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
          {phase === 'review' && (
            <span className="call-status-badge qa">Review</span>
          )}
          {phase === 'presenting' && (
            <div className="call-timer">
              <span className="live-dot" />
              {formatTimeSeconds(elapsedTime)}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="call-main">
        <div className={`video-grid ${phase === 'presenting' && screenStream ? 'with-screenshare' : ''}`}>
          
          {/* Welcome Phase - Show welcome video */}
          {phase === 'welcome' && (
            <div className="avatar-panel video-panel">
              <video
                ref={welcomeVideoRef}
                src="/api/media/welcome"
                autoPlay
                playsInline
                onEnded={handleWelcomeVideoEnded}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {welcomeVideoEnded && (
                <div className="video-overlay">
                  <div className="video-overlay-content">
                    <Play24Regular />
                    <span>Ready to present</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Presenting Phase - Show screen share */}
          {phase === 'presenting' && (
            <>
              <div className="avatar-panel avatar-offline">
                <div className="avatar-offline-content">
                  <Presenter24Regular />
                  <span className="avatar-offline-title">Presenting</span>
                  <span className="avatar-offline-subtitle">Recording your presentation</span>
                </div>
              </div>
              {screenStream && (
                <ScreenSharePanel stream={screenStream} />
              )}
            </>
          )}
          
          {/* Review Phase - Show review video */}
          {phase === 'review' && (
            <div className="avatar-panel video-panel">
              <video
                ref={reviewVideoRef}
                src="/api/media/review"
                autoPlay
                playsInline
                onEnded={handleReviewVideoEnded}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {reviewVideoEnded && (
                <div className="video-overlay">
                  <div className="video-overlay-content">
                    <DataTrending24Regular />
                    <span>Ready to analyze</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="call-controls">
        {/* Microphone - only show during presenting */}
        {phase === 'presenting' && (
          <button 
            className={`control-button ${userMuted ? 'active' : 'secondary'}`}
            onClick={toggleMicrophone}
          >
            <span className="icon">
              {userMuted ? <MicOff24Regular /> : <Mic24Regular />}
            </span>
            <span className="label">{userMuted ? 'Unmute' : 'Mute'}</span>
          </button>
        )}
        
        {/* Phase-specific buttons */}
        {phase === 'welcome' && welcomeVideoEnded && (
          <button 
            className="control-button primary"
            onClick={startPresentation}
          >
            <span className="icon"><Presenter24Regular /></span>
            <span className="label">Start Presentation</span>
          </button>
        )}
        
        {phase === 'presenting' && (
          <button 
            className="control-button success"
            onClick={goToReview}
          >
            <span className="icon"><DataTrending24Regular /></span>
            <span className="label">Finish</span>
          </button>
        )}
        
        {phase === 'review' && reviewVideoEnded && (
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
