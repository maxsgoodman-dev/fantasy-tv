import { describe, expect, it } from 'vitest'
import { parseSuggestedEvents } from './parse-transcript'

describe('parseSuggestedEvents', () => {
  it('parses a well-formed JSON array response into typed events', () => {
    const raw = JSON.stringify([
      { eventCode: 'star_baker', contestantName: 'Jordan', description: 'Jordan was named Star Baker' },
    ])
    expect(parseSuggestedEvents(raw)).toEqual([
      { eventCode: 'star_baker', contestantName: 'Jordan', description: 'Jordan was named Star Baker' },
    ])
  })

  it('returns an empty array for malformed JSON', () => {
    expect(parseSuggestedEvents('not json')).toEqual([])
  })

  it('filters out entries missing required fields', () => {
    const raw = JSON.stringify([
      { eventCode: 'star_baker' }, // missing contestantName
      { eventCode: 'hand_shake', contestantName: 'Sam', description: 'Sam got a handshake' },
    ])
    expect(parseSuggestedEvents(raw)).toEqual([
      { eventCode: 'hand_shake', contestantName: 'Sam', description: 'Sam got a handshake' },
    ])
  })

  it('strips markdown code fences around the JSON', () => {
    const raw = '```json\n[{"eventCode":"murdered","contestantName":"Ari","description":"Ari was murdered"}]\n```'
    expect(parseSuggestedEvents(raw)).toHaveLength(1)
  })

  it('drops events whose code is not in the rulebook', () => {
    const raw = JSON.stringify([
      { eventCode: 'made_up_code', contestantName: 'Sam', description: 'x' },
      { eventCode: 'hand_shake', contestantName: 'Sam', description: 'y' },
    ])
    const result = parseSuggestedEvents(raw, new Set(['hand_shake']))
    expect(result.map((e) => e.eventCode)).toEqual(['hand_shake'])
  })
})
