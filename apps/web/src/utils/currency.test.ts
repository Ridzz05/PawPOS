import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatNominalInput,
  formatThousand,
  parseThousand,
} from './currency'

describe('currency utilities', () => {
  describe('formatThousand', () => {
    it('formats 1000000 into 1.000.000', () => {
      expect(formatThousand(1000000)).toBe('1.000.000')
      expect(formatThousand('1000000')).toBe('1.000.000')
    })

    it('formats smaller numbers and zero properly', () => {
      expect(formatThousand(0)).toBe('0')
      expect(formatThousand(500)).toBe('500')
      expect(formatThousand(15000)).toBe('15.000')
      expect(formatThousand(250000)).toBe('250.000')
    })

    it('handles empty, null, and undefined values', () => {
      expect(formatThousand('')).toBe('')
      expect(formatThousand(null)).toBe('')
      expect(formatThousand(undefined)).toBe('')
    })

    it('strips non-numeric characters when string is provided', () => {
      expect(formatThousand('Rp 1.000.000')).toBe('1.000.000')
    })
  })

  describe('parseThousand', () => {
    it('parses thousand-formatted strings back to integer', () => {
      expect(parseThousand('1.000.000')).toBe(1000000)
      expect(parseThousand('50.000')).toBe(50000)
      expect(parseThousand('0')).toBe(0)
    })

    it('parses strings with currency prefixes or random characters', () => {
      expect(parseThousand('Rp 25.000')).toBe(25000)
      expect(parseThousand('')).toBe(0)
      expect(parseThousand(null)).toBe(0)
    })
  })

  describe('formatNominalInput', () => {
    it('formats user typing incrementally', () => {
      expect(formatNominalInput('1')).toBe('1')
      expect(formatNominalInput('10')).toBe('10')
      expect(formatNominalInput('100')).toBe('100')
      expect(formatNominalInput('1000')).toBe('1.000')
      expect(formatNominalInput('1000000')).toBe('1.000.000')
    })

    it('cleans up extra dots or non-digits when pasted or typed', () => {
      expect(formatNominalInput('1.000.0000')).toBe('10.000.000')
      expect(formatNominalInput('abc')).toBe('')
      expect(formatNominalInput('000500')).toBe('500')
    })
  })

  describe('formatCurrency', () => {
    it('formats with Rp prefix by default', () => {
      expect(formatCurrency(1000000)).toBe('Rp 1.000.000')
      expect(formatCurrency(18000)).toBe('Rp 18.000')
      expect(formatCurrency(0)).toBe('Rp 0')
    })

    it('formats without Rp prefix when specified', () => {
      expect(formatCurrency(1000000, false)).toBe('1.000.000')
    })

    it('handles null, undefined, and NaN gracefully', () => {
      expect(formatCurrency(null)).toBe('Rp 0')
      expect(formatCurrency(undefined)).toBe('Rp 0')
      expect(formatCurrency(NaN)).toBe('Rp 0')
    })
  })
})
