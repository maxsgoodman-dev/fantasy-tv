import { describe, it, expect } from 'vitest'
import { matchContestantName } from './match-name'

describe('matchContestantName', () => {
  const bake = ['Mo', 'Moyin', 'Molly', 'Clara', 'Nikki']
  const traitors = ['Abby Lee', 'Abbey Benjamin', 'Arisa Thomas', 'Kim Daily']

  it('matches first-name DB records to full wiki names (Bake Off)', () => {
    expect(matchContestantName('Mo Mahir', bake)).toBe('Mo')
    expect(matchContestantName('Moyin Odeniran', bake)).toBe('Moyin')
    expect(matchContestantName('Molly Chauhan', bake)).toBe('Molly')
    expect(matchContestantName('Nikki Porter', bake)).toBe('Nikki')
    expect(matchContestantName('Biscuit', bake)).toBeUndefined()
  })

  it('matches full names exactly and never by substring (Traitors)', () => {
    expect(matchContestantName('Abby Lee', traitors)).toBe('Abby Lee')
    expect(matchContestantName('Abbey Benjamin', traitors)).toBe('Abbey Benjamin')
    expect(matchContestantName('abby  lee', traitors)).toBe('Abby Lee')
    expect(matchContestantName('Abby Lee Miller', traitors)).toBe('Abby Lee')
    expect(matchContestantName('Abby', traitors)).toBe('Abby Lee') // whole word, and only one Abby
    expect(matchContestantName('Kim', ['Kim Daily', 'Kim Lee'])).toBeUndefined() // ambiguous: skip
    expect(matchContestantName('Lee', traitors)).toBeUndefined()
  })
})
