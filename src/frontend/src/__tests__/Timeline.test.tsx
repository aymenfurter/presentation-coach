import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Timeline } from '../components/Timeline'
import type { TimelineSegment } from '../types'

const mockTimelineData: TimelineSegment[] = [
  {
    segment_id: 'seg-1',
    start_time_ms: 0,
    end_time_ms: 30000,
    duration_ms: 30000,
    segment_type: 'introduction',
    description: 'Opening remarks',
    transcript: 'Welcome everyone...',
    pace_color: 'green',
    pace_status: 'optimal',
    words_per_second: 2.5,
    has_issues: false,
    improvements: [],
  },
  {
    segment_id: 'seg-2',
    start_time_ms: 30000,
    end_time_ms: 60000,
    duration_ms: 30000,
    segment_type: 'main_content',
    description: 'Main presentation',
    transcript: 'The main point is...',
    pace_color: 'yellow',
    pace_status: 'slightly_fast',
    words_per_second: 3.2,
    has_issues: true,
    improvements: [
      { description: 'Slow down', timecode_ms: 45000, severity: 'medium' as const }
    ],
  },
]

describe('Timeline', () => {
  it('renders timeline legend', () => {
    render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    expect(screen.getByText('Optimal')).toBeInTheDocument()
    expect(screen.getByText('Slightly fast')).toBeInTheDocument()
    expect(screen.getByText('Too fast')).toBeInTheDocument()
    expect(screen.getByText('Slow')).toBeInTheDocument()
  })

  it('renders time markers', () => {
    render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    expect(screen.getByText('0:00')).toBeInTheDocument()
    expect(screen.getByText('1:00')).toBeInTheDocument()
  })

  it('renders segments in timeline bar', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    const segments = container.querySelectorAll('.timeline-segment')
    expect(segments).toHaveLength(2)
  })

  it('applies correct pace color classes', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    expect(container.querySelector('.timeline-segment.pace-green')).toBeInTheDocument()
    expect(container.querySelector('.timeline-segment.pace-yellow')).toBeInTheDocument()
  })

  it('calls onSegmentClick when segment is clicked', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={handleClick}
      />
    )
    
    const segments = container.querySelectorAll('.timeline-segment')
    fireEvent.click(segments[0])
    
    expect(handleClick).toHaveBeenCalledWith('seg-1')
  })

  it('applies selected class to selected segment', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment="seg-1"
        onSegmentClick={() => {}}
      />
    )
    
    expect(container.querySelector('.timeline-segment.selected')).toBeInTheDocument()
  })

  it('renders improvement markers for segments with improvements', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    const markers = container.querySelectorAll('.timeline-improvement-marker')
    expect(markers).toHaveLength(1)
  })

  it('shows hover preview on mouse enter', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    const segment = container.querySelector('.timeline-segment')
    fireEvent.mouseEnter(segment!, { clientX: 100, clientY: 50 })
    
    expect(container.querySelector('.timeline-hover-preview')).toBeInTheDocument()
  })

  it('hides hover preview on mouse leave', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    const segment = container.querySelector('.timeline-segment')
    fireEvent.mouseEnter(segment!, { clientX: 100, clientY: 50 })
    fireEvent.mouseLeave(segment!)
    
    expect(container.querySelector('.timeline-hover-preview')).not.toBeInTheDocument()
  })

  it('displays correct segment type in preview', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    const segment = container.querySelector('.timeline-segment')
    fireEvent.mouseEnter(segment!, { clientX: 100, clientY: 50 })
    
    expect(screen.getByText('introduction')).toBeInTheDocument()
  })

  it('handles empty data gracefully', () => {
    const { container } = render(
      <Timeline 
        data={[]} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    expect(container.querySelector('.timeline-container')).toBeInTheDocument()
    expect(container.querySelectorAll('.timeline-segment')).toHaveLength(0)
  })

  it('calculates segment width based on duration', () => {
    const { container } = render(
      <Timeline 
        data={mockTimelineData} 
        totalDuration={60000}
        selectedSegment={null}
        onSegmentClick={() => {}}
      />
    )
    
    const segments = container.querySelectorAll('.timeline-segment')
    // Each segment is 30s out of 60s = 50%
    expect(segments[0]).toHaveStyle({ width: '50%' })
    expect(segments[1]).toHaveStyle({ width: '50%' })
  })
})
