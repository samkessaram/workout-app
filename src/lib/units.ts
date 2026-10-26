import type { Unit } from './db'

export const LB_PER_KG = 2.20462

export function convert(weight: number, from: Unit, to: Unit): number {
  if (from === to) return weight
  return from === 'kg' ? weight * LB_PER_KG : weight / LB_PER_KG
}

export function roundTo(value: number, step: number): number {
  if (step <= 0) return value
  const n = Math.round(value / step) * step
  return Math.round(n * 1000) / 1000
}

export function fmtWeight(weight: number, unit: Unit): string {
  const n = Math.round(weight * 100) / 100
  return `${n} ${unit}`
}

export function stepChips(unit: Unit): number[] {
  return unit === 'lb' ? [1, 2.5, 5, 10] : [0.5, 1, 2.5, 5]
}
