import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreCard } from '../components/analysis/ScoreCard'
import type { PresentationLevelAnalysis } from '../types'

const mockPresentationLevel: PresentationLevelAnalysis = {
  presentation_type: 'investment_pitch',
  checklist_items: [],
  missing_content: [],
  improvements: [],
  overall_score: 85,
  strengths: ['Clear speaking', 'Good structure', 'Engaging content'],
  summary: 'Good presentation',
}

describe('ScoreCard', () => {
  it('renders the overall score', () => {
    render(<ScoreCard presentationLevel={mockPresentationLevel} />)
    
    expect(screen.getByText('85')).toBeInTheDocument()
  })

  it('renders the Overall Score label', () => {
    render(<ScoreCard presentationLevel={mockPresentationLevel} />)
    
    expect(screen.getByText('Overall Score')).toBeInTheDocument()
  })

  it('renders up to 2 strengths', () => {
    render(<ScoreCard presentationLevel={mockPresentationLevel} />)
    
    expect(screen.getByText('✓ Clear speaking')).toBeInTheDocument()
    expect(screen.getByText('✓ Good structure')).toBeInTheDocument()
    // Third strength should not be rendered
    expect(screen.queryByText('✓ Engaging content')).not.toBeInTheDocument()
  })

  it('applies excellent class for score >= 80', () => {
    const { container } = render(<ScoreCard presentationLevel={mockPresentationLevel} />)
    
    expect(container.querySelector('.score-ring.excellent')).toBeInTheDocument()
  })

  it('applies good class for score 60-79', () => {
    const levelWithGoodScore = { ...mockPresentationLevel, overall_score: 70 }
    const { container } = render(<ScoreCard presentationLevel={levelWithGoodScore} />)
    
    expect(container.querySelector('.score-ring.good')).toBeInTheDocument()
  })

  it('applies fair class for score 40-59', () => {
    const levelWithFairScore = { ...mockPresentationLevel, overall_score: 50 }
    const { container } = render(<ScoreCard presentationLevel={levelWithFairScore} />)
    
    expect(container.querySelector('.score-ring.fair')).toBeInTheDocument()
  })

  it('applies needs-work class for score < 40', () => {
    const levelWithLowScore = { ...mockPresentationLevel, overall_score: 30 }
    const { container } = render(<ScoreCard presentationLevel={levelWithLowScore} />)
    
    expect(container.querySelector('.score-ring.needs-work')).toBeInTheDocument()
  })

  it('renders with empty strengths array', () => {
    const levelWithNoStrengths = { ...mockPresentationLevel, strengths: [] }
    const { container } = render(<ScoreCard presentationLevel={levelWithNoStrengths} />)
    
    expect(container.querySelector('.score-card')).toBeInTheDocument()
    expect(screen.queryByText(/✓/)).not.toBeInTheDocument()
  })

  it('renders with single strength', () => {
    const levelWithOneStrength = { ...mockPresentationLevel, strengths: ['One strength'] }
    render(<ScoreCard presentationLevel={levelWithOneStrength} />)
    
    expect(screen.getByText('✓ One strength')).toBeInTheDocument()
  })
})
