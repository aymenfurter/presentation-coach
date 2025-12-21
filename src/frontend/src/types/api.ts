// API Types - Presentation Coach

export interface PresentationType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface AppConfig {
  presentation_types: PresentationType[];
}

export interface Session {
  session_id: string;
  presentation_type: string;
  status: string;
  created_at?: string;
  muted?: boolean;
}

export interface TranscriptEntry {
  text: string;
  speaker: 'user' | 'assistant';
  timestamp?: string;
}
