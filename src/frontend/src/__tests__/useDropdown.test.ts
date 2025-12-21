import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDropdown } from '../hooks/useDropdown'

describe('useDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with closed state and null selection', () => {
    const { result } = renderHook(() => useDropdown<string>())
    
    expect(result.current.isOpen).toBe(false)
    expect(result.current.selected).toBeNull()
  })

  it('initializes with provided initial value', () => {
    const { result } = renderHook(() => useDropdown<string>('initial'))
    
    expect(result.current.selected).toBe('initial')
  })

  it('toggles open state', () => {
    const { result } = renderHook(() => useDropdown<string>())
    
    expect(result.current.isOpen).toBe(false)
    
    act(() => {
      result.current.toggle()
    })
    expect(result.current.isOpen).toBe(true)
    
    act(() => {
      result.current.toggle()
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('closes dropdown', () => {
    const { result } = renderHook(() => useDropdown<string>())
    
    act(() => {
      result.current.toggle()
    })
    expect(result.current.isOpen).toBe(true)
    
    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)
  })

  it('selects item and closes dropdown', () => {
    const { result } = renderHook(() => useDropdown<string>())
    
    act(() => {
      result.current.toggle()
    })
    expect(result.current.isOpen).toBe(true)
    
    act(() => {
      result.current.select('test-item')
    })
    
    expect(result.current.selected).toBe('test-item')
    expect(result.current.isOpen).toBe(false)
  })

  it('allows direct selection update via setSelected', () => {
    const { result } = renderHook(() => useDropdown<string>())
    
    act(() => {
      result.current.setSelected('direct-value')
    })
    
    expect(result.current.selected).toBe('direct-value')
  })

  it('provides a ref object', () => {
    const { result } = renderHook(() => useDropdown<string>())
    
    expect(result.current.ref).toBeDefined()
    expect(result.current.ref.current).toBeNull()
  })

  it('works with complex object types', () => {
    interface Item {
      id: number
      name: string
    }
    
    const { result } = renderHook(() => useDropdown<Item>())
    
    const item: Item = { id: 1, name: 'Test' }
    
    act(() => {
      result.current.select(item)
    })
    
    expect(result.current.selected).toEqual(item)
  })
})
