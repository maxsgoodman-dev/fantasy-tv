import { describe, it, expect } from 'vitest'
import { parseBakeoffWiki, diffBakeoffSnapshots } from './parse-bakeoff-wiki'

const HTML = `
<html><body>
<table class="wikitable">
  <tr><th>Placement</th><th>Contestant</th><th>Photo</th><th>Age</th><th>Location</th><th>Ep. 1</th><th>Ep. 2</th></tr>
  <tr><td>TBA</td><td>Clara Satchell-Silva</td><td></td><td>24</td><td>Hertfordshire</td><td>STAR BAKER</td><td>OUT</td></tr>
  <tr><td>TBA</td><td>Gary Harding</td><td></td><td>67</td><td>Nottinghamshire</td><td>HANDSHAKE</td><td>TBA</td></tr>
  <tr><td>TBA</td><td>Nikki</td><td></td><td>50</td><td>London</td><td>TBA</td><td>TBA</td></tr>
</table>
</body></html>
`

describe('parseBakeoffWiki', () => {
  it('extracts per-episode cell text keyed by wiki contestant name', () => {
    const snapshot = parseBakeoffWiki(HTML)
    expect(snapshot['Clara Satchell-Silva']).toEqual({ '1': 'STAR BAKER', '2': 'OUT' })
    expect(snapshot['Nikki']).toEqual({ '1': 'TBA', '2': 'TBA' })
  })
})

describe('diffBakeoffSnapshots', () => {
  it('awards pass_round plus a bonus for a newly-aired episode', () => {
    const prev = { 'Clara Satchell-Silva': { '1': 'TBA' } }
    const next = { 'Clara Satchell-Silva': { '1': 'STAR BAKER' } }
    const events = diffBakeoffSnapshots(prev, next, ['Clara'])
    expect(events).toEqual([
      { contestantName: 'Clara', episodeNumber: 1, eventCode: 'pass_round', label: expect.any(String), points: 1, kind: 'score' },
      { contestantName: 'Clara', episodeNumber: 1, eventCode: 'star_baker', label: expect.any(String), points: 2, kind: 'score' },
    ])
  })

  it('emits an eliminated marker instead of pass_round for OUT', () => {
    const prev = { Gary: { '1': 'TBA' } }
    const next = { Gary: { '1': 'OUT' } }
    const events = diffBakeoffSnapshots(prev, next, ['Gary'])
    expect(events).toEqual([
      { contestantName: 'Gary', episodeNumber: 1, eventCode: 'eliminated', label: expect.any(String), points: 0, kind: 'eliminated' },
    ])
  })

  it('produces nothing when the cell is unchanged or still blank', () => {
    const prev = { Nikki: { '1': 'TBA' } }
    const next = { Nikki: { '1': 'TBA' } }
    expect(diffBakeoffSnapshots(prev, next, ['Nikki'])).toEqual([])
  })

  it('skips contestants that cannot be matched to a DB name', () => {
    const prev = { 'Someone Unknown': { '1': 'TBA' } }
    const next = { 'Someone Unknown': { '1': 'STAR BAKER' } }
    expect(diffBakeoffSnapshots(prev, next, ['Nikki'])).toEqual([])
  })
})

describe('Series 17 wiki wording', () => {
  const S17_HTML = `
<table>
  <tr><th>Placement</th><th>Contestant</th><th>Photo</th><th>Age</th><th>Location</th><th>Ep. 1</th><th>Ep. 2</th><th>Ep. 3</th></tr>
  <tr><td>TBA</td><td>Tom Whittaker</td><td></td><td>30</td><td>X</td><td style="background:#EEE8AA;">HIGH<span>TechChall.Winner</span></td><td style="background:#FFD700;"><b>STAR</b></td><td>TBA</td></tr>
  <tr><td>TBA</td><td>Moyin Odeniran</td><td></td><td>30</td><td>X</td><td style="background:steelblue; color:#fff;">SAFE</td><td style="background:#F08080;">ELIM</td><td></td></tr>
</table>`

  it('reads STAR / ELIM / TechChall.Winner and steelblue handshake cells', () => {
    const snap = parseBakeoffWiki(S17_HTML)
    expect(snap['Tom Whittaker']).toEqual({ '1': 'HIGHTechChall.Winner', '2': 'STAR', '3': 'TBA' })
    expect(snap['Moyin Odeniran']['1']).toBe('SAFE HANDSHAKE')

    const codes = (ep: string, name: string) =>
      diffBakeoffSnapshots({}, snap, ['Tom', 'Moyin'])
        .filter((e) => String(e.episodeNumber) === ep && e.contestantName === name)
        .map((e) => e.eventCode)
    expect(codes('1', 'Tom')).toEqual(['pass_round', 'win_technical']) // not season_winner
    expect(codes('2', 'Tom')).toEqual(['pass_round', 'star_baker'])
    expect(codes('1', 'Moyin')).toEqual(['pass_round', 'hand_shake'])
    expect(codes('2', 'Moyin')).toEqual(['eliminated']) // no pass point for ELIM
  })

  it('only suggests the newly added marker when a scored cell is edited later', () => {
    const prev = { 'Moyin Odeniran': { '3': 'SAFE' } }
    const next = { 'Moyin Odeniran': { '3': 'SAFE HANDSHAKE' } }
    expect(diffBakeoffSnapshots(prev, next, ['Moyin']).map((e) => e.eventCode)).toEqual(['hand_shake'])
  })
})
