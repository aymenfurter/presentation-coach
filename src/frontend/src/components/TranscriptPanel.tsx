import { useEffect, useRef } from 'react';
import { Chat24Regular } from '@fluentui/react-icons';
import type { TranscriptEntry } from '../types';

interface TranscriptPanelProps {
  transcripts: TranscriptEntry[];
}

export function TranscriptPanel({ transcripts }: TranscriptPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div className="transcript-panel">
      <div className="transcript-header">
        <Chat24Regular />
        <span>Transcript</span>
      </div>
      
      <div className="transcript-content" ref={contentRef}>
        {transcripts.length === 0 ? (
          <p className="transcript-empty">
            Conversation will appear here...
          </p>
        ) : (
          transcripts.map((entry, index) => (
            <div 
              key={index} 
              className={`transcript-entry ${entry.speaker}`}
            >
              <div className="speaker">
                {entry.speaker === 'user' ? 'You' : 'Coach'}
              </div>
              <div className="text">{entry.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
