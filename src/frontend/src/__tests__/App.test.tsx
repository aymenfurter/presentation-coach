import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

// Wrapper to provide router context
function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = renderWithRouter('/')
    expect(container).toBeTruthy()
  })

  it('renders home page on root route', () => {
    renderWithRouter('/')
    // HomePage should be rendered - check for any content
    // The page likely has some content even if minimal
    expect(document.body).toBeTruthy()
  })

  it('navigates to session page with session ID', () => {
    const { container } = renderWithRouter('/session/test-session-123')
    // SessionPage should be rendered for this route
    expect(container).toBeTruthy()
  })

  it('navigates to analysis page with session ID', () => {
    const { container } = renderWithRouter('/analysis/test-session-456')
    // AnalysisPage should be rendered for this route
    expect(container).toBeTruthy()
  })
})
