import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVideoPlayer } from '../hooks/useVideoPlayer'

describe('useVideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with not playing state', () => {
    const { result } = renderHook(() => useVideoPlayer())
    
    expect(result.current.isPlaying).toBe(false)
  })

  it('provides a video ref', () => {
    const { result } = renderHook(() => useVideoPlayer())
    
    expect(result.current.videoRef).toBeDefined()
    expect(result.current.videoRef.current).toBeNull()
  })

  it('toggle function is defined', () => {
    const { result } = renderHook(() => useVideoPlayer())
    
    expect(typeof result.current.toggle).toBe('function')
  })

  it('seekTo function is defined', () => {
    const { result } = renderHook(() => useVideoPlayer())
    
    expect(typeof result.current.seekTo).toBe('function')
  })

  it('setPlaying updates isPlaying state', () => {
    const { result } = renderHook(() => useVideoPlayer())
    
    expect(result.current.isPlaying).toBe(false)
    
    act(() => {
      result.current.setPlaying(true)
    })
    
    expect(result.current.isPlaying).toBe(true)
    
    act(() => {
      result.current.setPlaying(false)
    })
    
    expect(result.current.isPlaying).toBe(false)
  })

  it('toggle does nothing when videoRef is null', () => {
    const { result } = renderHook(() => useVideoPlayer())
    
    // Should not throw when toggling without a video element
    act(() => {
      result.current.toggle()
    })
    
    // State should NOT flip when videoRef.current is null (check implementation)
    expect(result.current.isPlaying).toBe(false)
  })

  it('seekTo does nothing when videoRef is null', () => {
    const { result } = renderHook(() => useVideoPlayer())
    
    // Should not throw when seeking without a video element
    act(() => {
      result.current.seekTo(5000)
    })
  })
})
