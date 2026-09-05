/**
 * Indonesian Rupiah and thousand separator utilities.
 * In Indonesian locale, '.' is the thousand separator (e.g. 1000000 -> 1.000.000)
 * and ',' is the decimal separator.
 */

/**
 * Formats a number or numeric string with thousand separators (dot).
 * e.g. 1000000 -> "1.000.000", "50000" -> "50.000", 0 -> "0", "" -> ""
 */
export function formatThousand(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const numStr =
    typeof value === 'number'
      ? Math.floor(value).toString()
      : value.toString().replace(/\D/g, '')

  if (!numStr) return ''
  // Remove leading zeros unless the whole string is just '0'
  const trimmed = numStr.replace(/^0+(?!$)/, '')
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Parses a thousand-separated string back to a numeric integer.
 * e.g. "1.000.000" -> 1000000, "50.000" -> 50000, "" -> 0
 */
export function parseThousand(formatted: string | null | undefined): number {
  if (!formatted) return 0
  const clean = formatted.toString().replace(/\D/g, '')
  if (!clean) return 0
  const parsed = parseInt(clean, 10)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Formats user input as they type, stripping non-digit characters and applying thousand dots.
 * e.g. typing "1000000" returns "1.000.000"
 */
export function formatNominalInput(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  const trimmed = digits.replace(/^0+(?!$)/, '')
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Formats amount into standard Indonesian Rupiah currency string.
 * e.g. 1000000 -> "Rp 1.000.000" (default prefix = true)
 *      1000000 -> "1.000.000" (prefix = false)
 */
export function formatCurrency(
  amount: number | null | undefined,
  includePrefix: boolean = true,
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return includePrefix ? 'Rp 0' : '0'
  }
  const formatted = formatThousand(amount) || '0'
  return includePrefix ? `Rp ${formatted}` : formatted
}
