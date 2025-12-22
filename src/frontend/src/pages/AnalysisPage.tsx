import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAnalysis } from '../hooks/useAnalysis';
import { formatTime, formatPresentationType } from '../utils/formatters';
import { DartLogoStatic } from '../components/DartLogo';
import { Timeline } from '../components/Timeline';
import {
  AnalysisLoading,
  ScoreCard,
  AnalysisTabs,
  OverviewTab,
  ChecklistTab,
  SegmentsTab,
  SlidesTab,
  VideoPlayer,
  SegmentDetails,
} from '../components/analysis';
import type { Improvement } from '../types';

export function AnalysisPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const { analysis, loading, analyzing } = useAnalysis(sessionId);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedSlide, setSelectedSlide] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Update currentTime from video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, []);

  const handleSegmentClick = (segmentId: string) => {
    setSelectedSegment(segmentId);
    const segment = analysis?.timeline_data.find(s => s.segment_id === segmentId);
    if (segment && videoRef.current) {
      videoRef.current.currentTime = segment.start_time_ms / 1000;
    }
  };

  const handleImprovementClick = (imp: Improvement) => {
    if (videoRef.current) {
      videoRef.current.currentTime = imp.timecode_ms / 1000;
      videoRef.current.play();
      setVideoPlaying(true);
    }
    const seg = analysis?.timeline_data.find(
      s => s.start_time_ms <= imp.timecode_ms && s.end_time_ms > imp.timecode_ms
    );
    if (seg) setSelectedSegment(seg.segment_id);
  };

  const handlePlayFromTime = (timeMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeMs / 1000;
      videoRef.current.play();
      setVideoPlaying(true);
    }
  };

  const toggleVideo = () => {
    if (videoRef.current) {
      if (videoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setVideoPlaying(!videoPlaying);
    }
  };

  if (loading || analyzing) {
    return <AnalysisLoading analyzing={analyzing} />;
  }

  if (!analysis) {
    return (
      <div className="analysis-loading">
        <h2 style={{ marginBottom: '16px' }}>Analysis not available</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Return Home
        </button>
      </div>
    );
  }

  const { presentation_level } = analysis;
  const selectedSegmentData = selectedSegment 
    ? analysis.timeline_data.find(s => s.segment_id === selectedSegment) ?? null
    : null;

  return (
    <div className="analysis-page">
      {/* Header */}
      <header className="analysis-header">
        <Link to="/" className="analysis-header-back" title="Back to Home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div className="analysis-header-brand">
          <div className="analysis-header-logo">
            <DartLogoStatic size={28} />
          </div>
          <h1 className="analysis-header-title">
            {formatPresentationType(presentation_level.presentation_type)}
          </h1>
        </div>
        <div className="analysis-header-meta">
          <span className="analysis-meta-badge">{formatTime(analysis.total_duration_ms)}</span>
          <span className="analysis-meta-badge primary">{analysis.average_pace.toFixed(1)} wps</span>
        </div>
      </header>

      {/* Dashboard Layout */}
      <div className="analysis-dashboard">
        {/* Left Panel - Score & Tabs */}
        <div className="analysis-panel analysis-panel-left">
          <ScoreCard presentationLevel={presentation_level} />
          <AnalysisTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="tab-content-scroll">
            {activeTab === 'overview' && (
              <OverviewTab 
                presentationLevel={presentation_level}
                onImprovementClick={handleImprovementClick}
              />
            )}
            {activeTab === 'checklist' && (
              <ChecklistTab items={presentation_level.checklist_items} />
            )}
            {activeTab === 'segments' && (
              <SegmentsTab 
                segments={analysis.timeline_data}
                selectedSegment={selectedSegment}
                onSegmentClick={handleSegmentClick}
              />
            )}
            {activeTab === 'slides' && (
              <SlidesTab 
                slides={analysis.slide_analyses}
                timelineData={analysis.timeline_data}
                selectedSlide={selectedSlide}
                selectedSegment={selectedSegment}
                onSlideClick={(slideId) => {
                  setSelectedSlide(slideId);
                  handleSegmentClick(slideId);
                }}
                onSlideBack={() => setSelectedSlide(null)}
                onPlayFromTime={handlePlayFromTime}
              />
            )}
          </div>
        </div>

        {/* Center Panel - Video & Timeline */}
        <div className="analysis-panel analysis-panel-center">
          <VideoPlayer 
            videoRef={videoRef}
            sessionId={sessionId!}
            isPlaying={videoPlaying}
            currentTime={currentTime}
            totalDuration={analysis.total_duration_ms}
            onToggle={toggleVideo}
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
          />
          
          <div className="timeline-section">
            <Timeline 
              data={analysis.timeline_data}
              totalDuration={analysis.total_duration_ms}
              selectedSegment={selectedSegment}
              onSegmentClick={handleSegmentClick}
            />
          </div>
        </div>

        {/* Right Panel - Segment Details */}
        <div className="analysis-panel analysis-panel-right">
          <h4 className="panel-title">Segment Details</h4>
          <SegmentDetails segment={selectedSegmentData} />
        </div>
      </div>
    </div>
  );
}
