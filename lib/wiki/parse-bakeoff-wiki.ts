import * as cheerio from 'cheerio'
import { BAKEOFF_RULES, findBakeoffRule } from '../scoring/bakeoff-rules'
import type { SuggestedEvent } from './types'

/** name -> episode number -> raw cell text (e.g. "STAR BAKER", "OUT", "1st", "") */
export type BakeoffSnapshot = Record<string, Record<string, string>>

/**
 * Parses the "Contestant Progress" table on a GBBO Fandom series page:
 * rows are bakers, columns are Placement / Contestant / Photo / Age /
 * Location / Ep. 1 / Ep. 2 / ... Cell text for an aired episode holds
 * things like "STAR BAKER", "OUT", "HANDSHAKE", "WINNER".
 */
export function parseBakeoffWiki(html: string): BakeoffSnapshot {
  const $ = cheerio.load(html)
  const snapshot: BakeoffSnapshot = {}

  $('table').each((_, table) => {
    const $table = $(table)
    const headerCells = $table
      .find('tr')
      .first()
      .find('th, td')
      .map((_, el) => $(el).text().trim())
      .get()

    const episodeCols = headerCells
      .map((text, idx) => ({ text, idx }))
      .filter((c) => /^Ep\.?\s*\d+/i.test(c.text))
    const nameColIdx = headerCells.findIndex((t) => /^Contestant/i.test(t))

    if (episodeCols.length === 0 || nameColIdx === -1) return // not the progress table

    $table
      .find('tr')
      .slice(1)
      .each((_, row) => {
        const cells = $(row)
          .find('td, th')
          .map((_, el) => $(el).text().trim())
          .get()
        if (cells.length <= nameColIdx) return
        const rawName = cells[nameColIdx]
        if (!rawName) return

        const episodes: Record<string, string> = {}
        for (const col of episodeCols) {
          const epNum = col.text.match(/\d+/)?.[0]
          if (!epNum) continue
          episodes[epNum] = cells[col.idx] ?? ''
        }
        snapshot[rawName] = episodes
      })
  })

  return snapshot
}

const ELIMINATED_PATTERN = /\b(OUT|ELIMINATED)\b/i
const STAR_BAKER_PATTERN = /STAR BAKER/i
const TECHNICAL_WIN_PATTERN = /TECHNICAL WIN|WON TECHNICAL|1ST.*TECHNICAL|TECHNICAL.*1ST/i
const HANDSHAKE_PATTERN = /HANDSHAKE/i
const WINNER_PATTERN = /\bWINNER\b/i
const BLANK_PATTERN = /^(TBA|--|-|)$/i

/**
 * A wiki contestant name like "Clara Satchell-Silva" needs matching against
 * our DB's first-name-only contestant records ("Clara"). Falls back to
 * substring match either direction.
 */
function matchContestantName(wikiName: string, dbNames: string[]): string | undefined {
  const firstToken = wikiName.split(/\s+/)[0]
  return dbNames.find(
    (n) => n === firstToken || n === wikiName || wikiName.startsWith(n) || n.startsWith(firstToken)
  )
}

export function diffBakeoffSnapshots(
  prev: BakeoffSnapshot,
  next: BakeoffSnapshot,
  dbContestantNames: string[]
): SuggestedEvent[] {
  const events: SuggestedEvent[] = []

  for (const [wikiName, episodes] of Object.entries(next)) {
    const dbName = matchContestantName(wikiName, dbContestantNames)
    if (!dbName) continue

    for (const [epStr, cellText] of Object.entries(episodes)) {
      const episodeNumber = Number(epStr)
      const prevText = prev[wikiName]?.[epStr] ?? ''
      if (prevText === cellText) continue // no change since last check
      if (BLANK_PATTERN.test(cellText)) continue // still hasn't aired

      if (ELIMINATED_PATTERN.test(cellText)) {
        events.push({
          contestantName: dbName,
          episodeNumber,
          eventCode: 'eliminated',
          label: 'Eliminated this episode (per wiki)',
          points: 0,
          kind: 'eliminated',
        })
        continue
      }

      // Passed the round — baseline point for everyone still in.
      const passRule = findBakeoffRule('pass_round')!
      events.push({
        contestantName: dbName,
        episodeNumber,
        eventCode: passRule.code,
        label: passRule.label,
        points: passRule.points,
        kind: 'score',
      })

      if (STAR_BAKER_PATTERN.test(cellText)) {
        const rule = findBakeoffRule('star_baker')!
        events.push({ contestantName: dbName, episodeNumber, eventCode: rule.code, label: rule.label, points: rule.points, kind: 'score' })
      }
      if (TECHNICAL_WIN_PATTERN.test(cellText)) {
        const rule = findBakeoffRule('win_technical')!
        events.push({ contestantName: dbName, episodeNumber, eventCode: rule.code, label: rule.label, points: rule.points, kind: 'score' })
      }
      if (HANDSHAKE_PATTERN.test(cellText)) {
        const rule = findBakeoffRule('hand_shake')!
        events.push({ contestantName: dbName, episodeNumber, eventCode: rule.code, label: rule.label, points: rule.points, kind: 'score' })
      }
      if (WINNER_PATTERN.test(cellText)) {
        const rule = findBakeoffRule('season_winner')!
        events.push({ contestantName: dbName, episodeNumber, eventCode: rule.code, label: rule.label, points: rule.points, kind: 'score' })
      }
    }
  }

  return events
}

// Re-exported so callers don't need a separate import just to sanity-check rule codes exist.
export { BAKEOFF_RULES }
