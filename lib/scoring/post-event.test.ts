import { describe, expect, it } from 'vitest'
import { isEliminatingCode } from './post-event'

describe('isEliminatingCode', () => {
  it('flags rules that knock a contestant out', () => {
    expect(isEliminatingCode('murdered')).toBe(true)
    expect(isEliminatingCode('banished_faithful')).toBe(true)
    expect(isEliminatingCode('banished_traitor')).toBe(true)
  })

  it('does not flag ordinary scoring rules', () => {
    expect(isEliminatingCode('star_baker')).toBe(false)
    expect(isEliminatingCode('mission_earn')).toBe(false)
  })
})
