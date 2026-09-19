import type { ScoringRule } from './traitors-rules'

export type ScoringOverrides = Record<string, number>

/** Points for one event under a league's overrides; unknown codes keep their logged points. */
export function effectivePoints(eventCode: string | null | undefined, loggedPoints: number, overrides: ScoringOverrides): number {
  if (eventCode && Object.prototype.hasOwnProperty.call(overrides, eventCode)) return overrides[eventCode]
  return loggedPoints
}

export type EffectiveRule = ScoringRule & { basePoints: number; modified: boolean }

export function effectiveRules(base: ScoringRule[], overrides: ScoringOverrides): EffectiveRule[] {
  return base.map((r) => {
    const points = effectivePoints(r.code, r.points, overrides)
    return { ...r, points, basePoints: r.points, modified: points !== r.points }
  })
}

/** Keeps only valid integer overrides that differ from the base rulebook. */
export function buildOverrides(base: ScoringRule[], submitted: Record<string, string>): ScoringOverrides {
  const overrides: ScoringOverrides = {}
  for (const rule of base) {
    const raw = submitted[rule.code]
    if (raw === undefined || raw.trim() === '') continue
    const value = Number(raw)
    if (!Number.isInteger(value)) continue
    if (value !== rule.points) overrides[rule.code] = value
  }
  return overrides
}

/** Reads a stored jsonb overrides value defensively. */
export function readOverrides(raw: unknown): ScoringOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ScoringOverrides = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}
