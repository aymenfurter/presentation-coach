import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAnalysis } from '../hooks/useAnalysis'
import { api } from '../services/api'
import type { AnalysisResult } from '../types'

// Mock the api module
vi.mock('../services/api', () => ({
  api: {
    getAnalysis: vi.fn(),
    analyzeSession: vi.fn(),
  },
}))

const mockAnalysisResult: AnalysisResult = {
  presentation_level: {
    presentation_type: 'investment_pitch',
    checklist_items: [],
    missing_content: [],
    improvements: [],
    overall_score: 85,
    strengths: ['Clear speaking', 'Good structure'],
    summary: 'Good presentation',
  },
  segment_analyses: [],
  slide_analyses: [],
  timeline_data: [],
  total_duration_ms: 60000,
  average_pace: 2.5,
}

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns loading state initially', () => {
    vi.mocked(api.getAnalysis).mockImplementation(() => new Promise(() => {}))
    
    const { result } = renderHook(() => useAnalysis('session-123'))
    
    expect(result.current.loading).toBe(true)
    expect(result.current.analysis).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('does not make API call when sessionId is undefined', () => {
    renderHook(() => useAnalysis(undefined))
    
    // Should not call API when sessionId is undefined
    expect(api.getAnalysis).not.toHaveBeenCalled()
  })

  it('loads existing analysis successfully', async () => {
    vi.mocked(api.getAnalysis).mockResolvedValue({
      session_id: 'session-123',
      analysis: mockAnalysisResult,
    })
    
    const { result } = renderHook(() => useAnalysis('session-123'))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.analysis).toEqual(mockAnalysisResult)
    expect(result.current.error).toBeNull()
    expect(api.getAnalysis).toHaveBeenCalledWith('session-123')
  })

  it('starts new analysis when no existing analysis found', async () => {
    vi.mocked(api.getAnalysis).mockRejectedValue(new Error('Not found'))
    vi.mocked(api.analyzeSession).mockResolvedValue({
      session_id: 'session-123',
      analysis: mockAnalysisResult,
    })
    
    const { result } = renderHook(() => useAnalysis('session-123'))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.analysis).toEqual(mockAnalysisResult)
    expect(result.current.analyzing).toBe(false)
    expect(api.analyzeSession).toHaveBeenCalledWith('session-123')
  })

  it('handles analysis failure', async () => {
    vi.mocked(api.getAnalysis).mockRejectedValue(new Error('Not found'))
    vi.mocked(api.analyzeSession).mockRejectedValue(new Error('Analysis failed'))
    
    const { result } = renderHook(() => useAnalysis('session-123'))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.error).toBe('Failed to analyze presentation')
    expect(result.current.analysis).toBeNull()
  })

  it('provides refetch function', async () => {
    vi.mocked(api.getAnalysis).mockResolvedValue({
      session_id: 'session-123',
      analysis: mockAnalysisResult,
    })
    
    const { result } = renderHook(() => useAnalysis('session-123'))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(typeof result.current.refetch).toBe('function')
  })
})
