import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { AnalysisResult } from '../types';

interface UseAnalysisReturn {
  analysis: AnalysisResult | null;
  loading: boolean;
  analyzing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for loading and managing analysis data
 */
export function useAnalysis(sessionId: string | undefined): UseAnalysisReturn {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrStartAnalysis = useCallback(async () => {
    if (!sessionId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Try to get existing analysis
      const result = await api.getAnalysis(sessionId);
      setAnalysis(result.analysis);
    } catch {
      // No existing analysis, start new one
      setAnalyzing(true);
      try {
        const result = await api.analyzeSession(sessionId);
        setAnalysis(result.analysis);
      } catch (err) {
        console.error('Analysis failed:', err);
        setError('Failed to analyze presentation');
      }
      setAnalyzing(false);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadOrStartAnalysis();
  }, [loadOrStartAnalysis]);

  return { analysis, loading, analyzing, error, refetch: loadOrStartAnalysis };
}
