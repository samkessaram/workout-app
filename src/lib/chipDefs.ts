export const NOTE_CHIPS = [
  'tight hips',
  'shaky',
  'form broke down',
  'left side failed first',
  'right side failed first',
  'felt easy',
  'felt heavy',
]

/** Reasons a missed target says nothing about progress. Stalls carrying one do not count. */
export const CONFOUNDER_CHIPS = ['poor sleep', 'ill', 'travel', 'missed food', 'injury']

export function isConfounder(chip: string): boolean {
  return CONFOUNDER_CHIPS.includes(chip)
}

export function hasConfounder(chips: string[]): boolean {
  return chips.some(isConfounder)
}

export function allChips(custom: string[]): string[] {
  return [...NOTE_CHIPS, ...CONFOUNDER_CHIPS, ...custom]
}

export function normalizeChip(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Returns the new custom chip list, or the same list when the chip is empty or already exists. */
export function withCustomChip(custom: string[], text: string): string[] {
  const chip = normalizeChip(text)
  if (!chip || allChips(custom).includes(chip)) return custom
  return [...custom, chip]
}

