import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from '../services/api'

describe('ApiService', () => {
  const mockFetch = vi.fn()
  
  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getConfig', () => {
    it('fetches config from /api/config', async () => {
      const mockConfig = {
        presentation_types: [],
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      })

      const result = await api.getConfig()

      expect(mockFetch).toHaveBeenCalledWith('/api/config', undefined)
      expect(result).toEqual(mockConfig)
    })

    it('throws error when request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })

      await expect(api.getConfig()).rejects.toThrow('Server error')
    })
  })

  describe('createSession', () => {
    it('posts to /api/sessions with presentation type', async () => {
      const mockSession = {
        session_id: 'session-123',
        presentation_type: 'investment_pitch',
        status: 'active',
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSession),
      })

      const result = await api.createSession('investment_pitch')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation_type: 'investment_pitch' }),
      })
      expect(result).toEqual(mockSession)
    })
  })

  describe('getSession', () => {
    it('fetches session by ID', async () => {
      const mockSession = {
        session_id: 'session-123',
        presentation_type: 'demo',
        status: 'completed',
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSession),
      })

      const result = await api.getSession('session-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-123', undefined)
      expect(result).toEqual(mockSession)
    })
  })

  describe('setMuteStatus', () => {
    it('posts mute status to session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ muted: true }),
      })

      const result = await api.setMuteStatus('session-123', true)

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-123/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: true }),
      })
      expect(result).toEqual({ muted: true })
    })
  })

  describe('completeSession', () => {
    it('posts to complete endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await api.completeSession('session-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-123/complete', {
        method: 'POST',
        headers: undefined,
        body: undefined,
      })
    })
  })

  describe('uploadRecording', () => {
    it('uploads audio blob', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ recording_id: 'rec-123' }),
      })

      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' })
      const result = await api.uploadRecording('session-123', audioBlob, undefined)

      expect(mockFetch).toHaveBeenCalled()
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('/api/sessions/session-123/recordings')
      expect(options.method).toBe('POST')
      expect(options.body).toBeInstanceOf(FormData)
      expect(result).toEqual({ recording_id: 'rec-123' })
    })

    it('uploads both audio and screen blobs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ recording_id: 'rec-456' }),
      })

      const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
      const screenBlob = new Blob(['screen'], { type: 'video/webm' })
      const result = await api.uploadRecording('session-123', audioBlob, screenBlob)

      expect(result).toEqual({ recording_id: 'rec-456' })
    })
  })

  describe('analyzeSession', () => {
    it('posts to analyze endpoint', async () => {
      const mockAnalysis = {
        session_id: 'session-123',
        analysis: { presentation_level: {}, segment_analyses: [] },
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalysis),
      })

      const result = await api.analyzeSession('session-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-123/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: undefined }),
      })
      expect(result).toEqual(mockAnalysis)
    })

    it('includes recording_id when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session_id: 'session-123', analysis: {} }),
      })

      await api.analyzeSession('session-123', 'rec-456')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-123/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: 'rec-456' }),
      })
    })
  })

  describe('getAnalysis', () => {
    it('fetches analysis by session ID', async () => {
      const mockAnalysis = {
        session_id: 'session-123',
        analysis: { presentation_level: {} },
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAnalysis),
      })

      const result = await api.getAnalysis('session-123')

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-123/analysis', undefined)
      expect(result).toEqual(mockAnalysis)
    })
  })

  describe('getSpeechToken', () => {
    it('fetches speech token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: 'abc123', region: 'westus2' }),
      })

      const result = await api.getSpeechToken()

      expect(mockFetch).toHaveBeenCalledWith('/api/speech/token', undefined)
      expect(result).toEqual({ token: 'abc123', region: 'westus2' })
    })
  })

  describe('analyzeSampleVideo', () => {
    it('posts to sample analysis endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session_id: 'sample-123', analysis: {} }),
      })

      await api.analyzeSampleVideo('investment_pitch')

      expect(mockFetch).toHaveBeenCalledWith('/api/test/sample-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentation_type: 'investment_pitch' }),
      })
    })
  })

  describe('uploadAndAnalyzeVideo', () => {
    it('uploads video file with presentation type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session_id: 'upload-123', analysis: {} }),
      })

      const videoFile = new File(['video data'], 'test.mp4', { type: 'video/mp4' })
      await api.uploadAndAnalyzeVideo(videoFile, 'demo')

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('/api/upload-video')
      expect(options.method).toBe('POST')
      expect(options.body).toBeInstanceOf(FormData)
    })
  })

  describe('error handling', () => {
    it('uses error.error from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Specific error' }),
      })

      await expect(api.getConfig()).rejects.toThrow('Specific error')
    })

    it('uses error.message from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Message error' }),
      })

      await expect(api.getConfig()).rejects.toThrow('Message error')
    })

    it('uses fallback error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      })

      await expect(api.getConfig()).rejects.toThrow('Failed to fetch config')
    })

    it('handles JSON parse failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      await expect(api.getConfig()).rejects.toThrow('Failed to fetch config')
    })
  })
})
