import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play24Filled,
  ArrowUpload24Regular,
  ChevronDown24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { api } from '../services/api';
import { useDropdown } from '../hooks/useDropdown';
import { getPresentationIcon } from '../utils/iconMap';
import { DartLogo } from '../components/DartLogo';
import { EmberParticles } from '../components/EmberParticles';
import type { PresentationType, AppConfig } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  
  // Main dropdown using hook
  const mainDropdown = useDropdown<PresentationType>();
  
  // Upload state
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const uploadDropdown = useDropdown<PresentationType>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Heat state for logo animation
  const [logoHeat, setLogoHeat] = useState(0);

  useEffect(() => {
    let cancelled = false;
    
    async function loadConfig() {
      try {
        const configData = await api.getConfig();
        if (cancelled) return;
        setConfig(configData);
        if (configData.presentation_types.length > 0) {
          mainDropdown.setSelected(configData.presentation_types[0]);
          uploadDropdown.setSelected(configData.presentation_types[0]);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    loadConfig();
    
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStartPractice() {
    if (!mainDropdown.selected) return;
    setCreating(mainDropdown.selected.id);
    try {
      const session = await api.createSession(mainDropdown.selected.id);
      navigate(`/session/${session.session_id}`);
    } catch (error) {
      console.error('Failed to create session:', error);
      setCreating(null);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file (MP4, WebM, etc.)');
        return;
      }
      setSelectedFile(file);
    }
  }

  async function handleUploadVideo() {
    if (!selectedFile || !uploadDropdown.selected) return;
    
    setUploadingVideo(true);
    setLogoHeat(1);
    try {
      const result = await api.uploadAndAnalyzeVideo(selectedFile, uploadDropdown.selected.id);
      navigate(`/analysis/${result.session_id}`);
    } catch (error) {
      console.error('Failed to analyze video:', error);
      alert('Failed to analyze video. Check console for details.');
      setLogoHeat(0);
    } finally {
      setUploadingVideo(false);
    }
  }

  if (loading) {
    return (
      <div className="home-loading">
        <div className="loader-ring" />
      </div>
    );
  }

  return (
    <main className={`home-hero ${logoHeat > 0.5 ? 'heating' : ''}`} style={{
      '--heat-intensity': logoHeat,
    } as React.CSSProperties}>
      <EmberParticles active={logoHeat > 0.5} intensity={logoHeat} />
      
      <div className="home-hero-inner">
        <div className="home-hero-content">
          <div className="home-logo-mark">
            <DartLogo size={120} heat={logoHeat} animated={true} />
          </div>
          <h1 className="home-title" data-text="Presentation Coach">Presentation Coach</h1>
          <p className="home-tagline">AI-powered feedback to perfect your delivery</p>
        </div>

        <div className="home-actions">
          {/* Primary Action - Start Practice with Dropdown */}
          <div className="home-primary-action" ref={mainDropdown.ref as React.RefObject<HTMLDivElement>}>
            <div className="home-action-row">
              <button
                className="home-start-btn"
                onClick={handleStartPractice}
                disabled={!!creating || !mainDropdown.selected}
              >
                {creating ? (
                  <>
                    <span className="spinner spinner-sm" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Play24Filled />
                    <span>Start Practice</span>
                  </>
                )}
              </button>
              <button
                className="home-dropdown-trigger"
                onClick={mainDropdown.toggle}
                aria-expanded={mainDropdown.isOpen}
                aria-haspopup="listbox"
              >
                <span className="home-selected-type">
                  {mainDropdown.selected && getPresentationIcon(mainDropdown.selected.icon)}
                  {mainDropdown.selected?.name || 'Select type'}
                </span>
                <ChevronDown24Regular className={`home-chevron ${mainDropdown.isOpen ? 'open' : ''}`} />
              </button>
            </div>

            {mainDropdown.isOpen && (
              <div className="home-dropdown" role="listbox">
                {config?.presentation_types.map((type) => (
                  <button
                    key={type.id}
                    className={`home-dropdown-item ${mainDropdown.selected?.id === type.id ? 'selected' : ''}`}
                    onClick={() => mainDropdown.select(type)}
                    role="option"
                    aria-selected={mainDropdown.selected?.id === type.id}
                  >
                    <span className="home-dropdown-icon">
                      {getPresentationIcon(type.icon)}
                    </span>
                    <div className="home-dropdown-text">
                      <span className="home-dropdown-name">{type.name}</span>
                      <span className="home-dropdown-desc">{type.description}</span>
                    </div>
                    {mainDropdown.selected?.id === type.id && (
                      <Checkmark24Regular className="home-dropdown-check" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Secondary Action - Upload */}
          {!uploadMode ? (
            <button
              className="home-upload-link"
              onClick={() => setUploadMode(true)}
            >
              <ArrowUpload24Regular />
              Or analyze a recording
            </button>
          ) : (
            <div className="home-upload-panel">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="video/*"
                onChange={handleFileSelect}
              />
              
              {!selectedFile ? (
                <button
                  className="home-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ArrowUpload24Regular />
                  <span>Select video file</span>
                </button>
              ) : (
                <div className="home-upload-ready">
                  <div className="home-upload-file">
                    <span className="home-upload-filename">{selectedFile.name}</span>
                    <button 
                      className="home-upload-remove"
                      onClick={() => setSelectedFile(null)}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="home-upload-type-select" ref={uploadDropdown.ref as React.RefObject<HTMLDivElement>}>
                    <button
                      className="home-upload-type-trigger"
                      onClick={uploadDropdown.toggle}
                    >
                      {uploadDropdown.selected && getPresentationIcon(uploadDropdown.selected.icon)}
                      <span>{uploadDropdown.selected?.name}</span>
                      <ChevronDown24Regular className={uploadDropdown.isOpen ? 'open' : ''} />
                    </button>
                    
                    {uploadDropdown.isOpen && (
                      <div className="home-upload-type-dropdown">
                        {config?.presentation_types.map((type) => (
                          <button
                            key={type.id}
                            className={`home-upload-type-option ${uploadDropdown.selected?.id === type.id ? 'selected' : ''}`}
                            onClick={() => uploadDropdown.select(type)}
                          >
                            {getPresentationIcon(type.icon)}
                            <span>{type.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button
                    className="home-analyze-btn"
                    onClick={handleUploadVideo}
                    disabled={uploadingVideo}
                  >
                    {uploadingVideo ? (
                      <>
                        <span className="spinner spinner-sm" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <span>Analyze Video</span>
                    )}
                  </button>
                </div>
              )}
              
              <button
                className="home-upload-cancel"
                onClick={() => {
                  setUploadMode(false);
                  setSelectedFile(null);
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
