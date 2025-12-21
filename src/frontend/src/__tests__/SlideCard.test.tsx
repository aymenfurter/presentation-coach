import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideCard } from '../components/SlideCard'
import type { SlideAnalysis } from '../types'

const mockPassedSlide: SlideAnalysis = {
  segment_id: 'slide-1',
  slide_title: 'Introduction',
  quality_score: 5,
  passed: true,
  improvements: [],
  thumbnail_base64: 'base64thumbnaildata',
  start_time_ms: 0,
}

const mockFailedSlide: SlideAnalysis = {
  segment_id: 'slide-2',
  slide_title: 'Problem Statement',
  quality_score: 2,
  passed: false,
  improvements: ['Add more context', 'Include statistics'],
  thumbnail_base64: undefined,
  start_time_ms: 15000,
}

describe('SlideCard', () => {
  it('renders slide title', () => {
    render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={false} />)
    
    expect(screen.getByText('Introduction')).toBeInTheDocument()
  })

  it('shows passed status with score', () => {
    render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={false} />)
    
    expect(screen.getByText(/Passed/)).toBeInTheDocument()
    expect(screen.getByText(/5\/5/)).toBeInTheDocument()
  })

  it('shows needs work status with score for failed slides', () => {
    render(<SlideCard slide={mockFailedSlide} onClick={() => {}} selected={false} />)
    
    expect(screen.getByText(/Needs Work/)).toBeInTheDocument()
    expect(screen.getByText(/2\/5/)).toBeInTheDocument()
  })

  it('displays improvements for failed slides', () => {
    render(<SlideCard slide={mockFailedSlide} onClick={() => {}} selected={false} />)
    
    expect(screen.getByText('Improvements:')).toBeInTheDocument()
    expect(screen.getByText('Add more context')).toBeInTheDocument()
    expect(screen.getByText('Include statistics')).toBeInTheDocument()
  })

  it('shows passed message for passing slides', () => {
    render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={false} />)
    
    expect(screen.getByText('This slide meets quality standards')).toBeInTheDocument()
  })

  it('does not show improvements for passed slides', () => {
    render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={false} />)
    
    expect(screen.queryByText('Improvements:')).not.toBeInTheDocument()
  })

  it('renders thumbnail when available', () => {
    render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={false} />)
    
    const img = screen.getByAltText('Introduction')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,base64thumbnaildata')
  })

  it('renders placeholder when no thumbnail', () => {
    const { container } = render(<SlideCard slide={mockFailedSlide} onClick={() => {}} selected={false} />)
    
    expect(container.querySelector('.slide-thumbnail-placeholder')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<SlideCard slide={mockPassedSlide} onClick={handleClick} selected={false} />)
    
    const card = screen.getByText('Introduction').closest('.slide-card')
    fireEvent.click(card!)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies selected class when selected', () => {
    const { container } = render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={true} />)
    
    expect(container.querySelector('.slide-card.selected')).toBeInTheDocument()
  })

  it('does not apply selected class when not selected', () => {
    const { container } = render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={false} />)
    
    expect(container.querySelector('.slide-card.selected')).not.toBeInTheDocument()
  })

  it('applies passed badge class for passing slides', () => {
    const { container } = render(<SlideCard slide={mockPassedSlide} onClick={() => {}} selected={false} />)
    
    expect(container.querySelector('.rating-badge.passed')).toBeInTheDocument()
  })

  it('applies needs-work badge class for failed slides', () => {
    const { container } = render(<SlideCard slide={mockFailedSlide} onClick={() => {}} selected={false} />)
    
    expect(container.querySelector('.rating-badge.needs-work')).toBeInTheDocument()
  })
})
