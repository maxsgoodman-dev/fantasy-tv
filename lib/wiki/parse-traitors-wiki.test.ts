import { describe, it, expect } from 'vitest'
import { parseTraitorsWiki, diffTraitorsSnapshots } from './parse-traitors-wiki'

const HTML = `
<html><body>
<table class="wikitable">
  <tr><th>Name</th><th>Age</th><th>Location</th><th>Occupation</th><th>Faction</th><th>Result</th><th>Exit Episode</th><th>Finish</th></tr>
  <tr><td>Abbey Benjamin</td><td>37</td><td>Mangham, Louisiana</td><td>Nurse</td><td>Faithful</td><td></td><td></td><td></td></tr>
  <tr><td>Abby Lee</td><td>29</td><td>Saint Paul, Minnesota</td><td>Astrophysicist</td><td>Faithful</td><td>Murdered</td><td>3</td><td>21st</td></tr>
  <tr><td>Arisa Thomas</td><td>36</td><td>Los Angeles, California</td><td>Dog groomer</td><td>Traitor</td><td>Banished</td><td>4</td><td>20th</td></tr>
</table>
</body></html>
`

describe('parseTraitorsWiki', () => {
  it('extracts faction/result/exit episode per contestant', () => {
    const snapshot = parseTraitorsWiki(HTML)
    expect(snapshot['Abbey Benjamin']).toEqual({ faction: 'Faithful', result: '', exitEpisode: '' })
    expect(snapshot['Abby Lee']).toEqual({ faction: 'Faithful', result: 'Murdered', exitEpisode: '3' })
    expect(snapshot['Arisa Thomas']).toEqual({ faction: 'Traitor', result: 'Banished', exitEpisode: '4' })
  })
})

describe('diffTraitorsSnapshots', () => {
  it('maps a newly-murdered Faithful to the murdered rule', () => {
    const prev = { 'Abby Lee': { faction: 'Faithful', result: '', exitEpisode: '' } }
    const next = { 'Abby Lee': { faction: 'Faithful', result: 'Murdered', exitEpisode: '3' } }
    const events = diffTraitorsSnapshots(prev, next, ['Abby Lee'], 10)
    expect(events).toEqual([
      { contestantName: 'Abby Lee', episodeNumber: 3, eventCode: 'murdered', label: expect.any(String), points: -6, kind: 'score' },
    ])
  })

  it('distinguishes banished-as-Traitor from banished-as-Faithful', () => {
    const prev = { 'Arisa Thomas': { faction: 'Traitor', result: '', exitEpisode: '' } }
    const next = { 'Arisa Thomas': { faction: 'Traitor', result: 'Banished', exitEpisode: '4' } }
    const events = diffTraitorsSnapshots(prev, next, ['Arisa Thomas'], 10)
    expect(events[0].eventCode).toBe('banished_traitor')
    expect(events[0].points).toBe(-10)
  })

  it('ignores contestants still active', () => {
    const prev = { 'Abbey Benjamin': { faction: 'Faithful', result: '', exitEpisode: '' } }
    const next = { 'Abbey Benjamin': { faction: 'Faithful', result: '', exitEpisode: '' } }
    expect(diffTraitorsSnapshots(prev, next, ['Abbey Benjamin'], 10)).toEqual([])
  })

  it('falls back to the final episode number for the season winner', () => {
    const prev = { 'Abbey Benjamin': { faction: 'Faithful', result: '', exitEpisode: '' } }
    const next = { 'Abbey Benjamin': { faction: 'Faithful', result: 'Winner', exitEpisode: '' } }
    const events = diffTraitorsSnapshots(prev, next, ['Abbey Benjamin'], 12)
    expect(events).toEqual([
      { contestantName: 'Abbey Benjamin', episodeNumber: 12, eventCode: 'wins_season', label: expect.any(String), points: 25, kind: 'score' },
    ])
  })
})
