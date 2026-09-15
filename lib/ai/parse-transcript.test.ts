import { describe, expect, it, vi } from 'vitest'
import { parseSuggestedEvents } from './parse-transcript'

describe('parseSuggestedEvents', () => {
  it('parses a well-formed JSON array response into typed events', () => {
    const raw = JSON.stringify([
      { eventType: 'eliminated', contestantName: 'Jordan', description: 'Jordan was voted out' },
    ])
    const result = parseSuggestedEvents(raw)
    expect(result).toEqual([
      { eventType: 'eliminated', contestantName: 'Jordan', description: 'Jordan was voted out' },
    ])
  })

  it('returns an empty array for malformed JSON', () => {
    const result = parseSuggestedEvents('not json')
    expect(result).toEqual([])
  })

  it('filters out entries missing required fields', () => {
    const raw = JSON.stringify([
      { eventType: 'eliminated' }, // missing contestantName
      { eventType: 'won', contestantName: 'Sam', description: 'Sam won the challenge' },
    ])
    const result = parseSuggestedEvents(raw)
    expect(result).toEqual([{ eventType: 'won', contestantName: 'Sam', description: 'Sam won the challenge' }])
  })
})
