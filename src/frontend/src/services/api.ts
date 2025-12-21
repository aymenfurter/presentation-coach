// API Service for Presentation Coach
// Types are now in src/types/

import type { AppConfig, Session, AnalysisResult } from '../types';

// Re-export types for backwards compatibility
export type { 
  PresentationType, 
  AppConfig, 
  Session, 
  TranscriptEntry,
  ChecklistItem,
  Improvement,
  PresentationLevelAnalysis,
  SegmentAnalysis,
  SlideAnalysis,
  TimelineSegment,
  AnalysisResult,
} from '../types';

class ApiService {
  private baseUrl = '';

  /**
   * Generic request helper to reduce duplication
   */
  private async request<T>(
    url: string, 
    options?: RequestInit,
    errorMessage = 'Request failed'
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || errorMessage);
    }
    return response.json();
  }

  private post<T>(url: string, body?: object, errorMessage?: string): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }, errorMessage);
  }

  private postForm<T>(url: string, formData: FormData, errorMessage?: string): Promise<T> {
    return this.request<T>(url, { method: 'POST', body: formData }, errorMessage);
  }

  // Config & Sessions
  getConfig = (): Promise<AppConfig> => 
    this.request('/api/config', undefined, 'Failed to fetch config');

  createSession = (presentationType: string): Promise<Session> => 
    this.post('/api/sessions', { presentation_type: presentationType }, 'Failed to create session');

  getSession = (sessionId: string): Promise<Session> => 
    this.request(`/api/sessions/${sessionId}`, undefined, 'Failed to fetch session');

  setMuteStatus = (sessionId: string, muted: boolean): Promise<{ muted: boolean }> => 
    this.post(`/api/sessions/${sessionId}/mute`, { muted }, 'Failed to set mute status');

  completeSession = async (sessionId: string): Promise<void> => {
    await this.post(`/api/sessions/${sessionId}/complete`, undefined, 'Failed to complete session');
  };

  // Recordings
  uploadRecording = (sessionId: string, audioBlob?: Blob, screenBlob?: Blob): Promise<{ recording_id: string }> => {
    const formData = new FormData();
    if (audioBlob) formData.append('audio', audioBlob, 'audio.webm');
    if (screenBlob) formData.append('screen', screenBlob, 'screen.webm');
    return this.postForm(`/api/sessions/${sessionId}/recordings`, formData, 'Failed to upload recording');
  };

  // Analysis
  analyzeSession = (sessionId: string, recordingId?: string): Promise<{ session_id: string; analysis: AnalysisResult }> => 
    this.post(`/api/sessions/${sessionId}/analyze`, { recording_id: recordingId }, 'Failed to analyze session');

  getAnalysis = (sessionId: string): Promise<{ session_id: string; analysis: AnalysisResult }> => 
    this.request(`/api/sessions/${sessionId}/analysis`, undefined, 'Analysis not available');

  // Speech
  getSpeechToken = (): Promise<{ token: string; region: string }> => 
    this.request('/api/speech/token', undefined, 'Failed to get speech token');

  // Video upload & analysis
  analyzeSampleVideo = (presentationType: string): Promise<{ session_id: string; analysis: AnalysisResult }> => 
    this.post('/api/test/sample-analysis', { presentation_type: presentationType }, 'Failed to analyze sample video');

  uploadAndAnalyzeVideo = (videoFile: File, presentationType: string): Promise<{ session_id: string; analysis: AnalysisResult }> => {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('presentation_type', presentationType);
    return this.postForm('/api/upload-video', formData, 'Failed to analyze uploaded video');
  };
}

export const api = new ApiService();
