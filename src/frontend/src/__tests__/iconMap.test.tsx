import { describe, it, expect } from 'vitest'
import { getPresentationIcon, presentationIconMap } from '../utils/iconMap'

describe('presentationIconMap', () => {
  it('contains Money icon', () => {
    expect(presentationIconMap['Money']).toBeDefined()
  })

  it('contains Laptop icon', () => {
    expect(presentationIconMap['Laptop']).toBeDefined()
  })

  it('contains People icon', () => {
    expect(presentationIconMap['People']).toBeDefined()
  })
})

describe('getPresentationIcon', () => {
  it('returns Money icon for "Money"', () => {
    const icon = getPresentationIcon('Money')
    expect(icon).toBeDefined()
    expect(icon).toEqual(presentationIconMap['Money'])
  })

  it('returns Laptop icon for "Laptop"', () => {
    const icon = getPresentationIcon('Laptop')
    expect(icon).toBeDefined()
    expect(icon).toEqual(presentationIconMap['Laptop'])
  })

  it('returns People icon for "People"', () => {
    const icon = getPresentationIcon('People')
    expect(icon).toBeDefined()
    expect(icon).toEqual(presentationIconMap['People'])
  })

  it('returns default Money icon for unknown icon name', () => {
    const icon = getPresentationIcon('Unknown')
    expect(icon).toBeDefined()
    expect(icon).toEqual(presentationIconMap['Money'])
  })

  it('returns default icon for empty string', () => {
    const icon = getPresentationIcon('')
    expect(icon).toBeDefined()
    expect(icon).toEqual(presentationIconMap['Money'])
  })
})
