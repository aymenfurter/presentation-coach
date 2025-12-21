import { describe, it, expect } from 'vitest'
import { formatTime, formatTimeSeconds, formatPresentationType, getScoreClass } from '../utils/formatters'

describe('formatTime', () => {
  it('formats 0 milliseconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats seconds correctly', () => {
    expect(formatTime(5000)).toBe('0:05')
    expect(formatTime(30000)).toBe('0:30')
    expect(formatTime(59000)).toBe('0:59')
  })

  it('formats minutes correctly', () => {
    expect(formatTime(60000)).toBe('1:00')
    expect(formatTime(90000)).toBe('1:30')
    expect(formatTime(120000)).toBe('2:00')
  })

  it('formats mixed minutes and seconds', () => {
    expect(formatTime(65000)).toBe('1:05')
    expect(formatTime(185000)).toBe('3:05')
    expect(formatTime(3661000)).toBe('61:01')
  })

  it('pads seconds with leading zero', () => {
    expect(formatTime(1000)).toBe('0:01')
    expect(formatTime(9000)).toBe('0:09')
    expect(formatTime(61000)).toBe('1:01')
  })
})

describe('formatTimeSeconds', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatTimeSeconds(0)).toBe('00:00')
  })

  it('pads both minutes and seconds', () => {
    expect(formatTimeSeconds(5)).toBe('00:05')
    expect(formatTimeSeconds(65)).toBe('01:05')
    expect(formatTimeSeconds(125)).toBe('02:05')
  })

  it('handles double-digit minutes and seconds', () => {
    expect(formatTimeSeconds(45)).toBe('00:45')
    expect(formatTimeSeconds(600)).toBe('10:00')
    expect(formatTimeSeconds(754)).toBe('12:34')
  })
})

describe('formatPresentationType', () => {
  it('converts underscores to spaces and capitalizes words', () => {
    expect(formatPresentationType('investment_pitch')).toBe('Investment Pitch')
  })

  it('handles single words', () => {
    expect(formatPresentationType('demo')).toBe('Demo')
  })

  it('handles multiple underscores', () => {
    expect(formatPresentationType('product_demo_presentation')).toBe('Product Demo Presentation')
  })

  it('handles already capitalized input', () => {
    expect(formatPresentationType('Sales_Pitch')).toBe('Sales Pitch')
  })

  it('handles empty string', () => {
    expect(formatPresentationType('')).toBe('')
  })
})

describe('getScoreClass', () => {
  it('returns "excellent" for scores >= 80', () => {
    expect(getScoreClass(80)).toBe('excellent')
    expect(getScoreClass(90)).toBe('excellent')
    expect(getScoreClass(100)).toBe('excellent')
  })

  it('returns "good" for scores >= 60 and < 80', () => {
    expect(getScoreClass(60)).toBe('good')
    expect(getScoreClass(70)).toBe('good')
    expect(getScoreClass(79)).toBe('good')
  })

  it('returns "fair" for scores >= 40 and < 60', () => {
    expect(getScoreClass(40)).toBe('fair')
    expect(getScoreClass(50)).toBe('fair')
    expect(getScoreClass(59)).toBe('fair')
  })

  it('returns "needs-work" for scores < 40', () => {
    expect(getScoreClass(0)).toBe('needs-work')
    expect(getScoreClass(20)).toBe('needs-work')
    expect(getScoreClass(39)).toBe('needs-work')
  })
})
