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
          .map((_, el) => {
            const text = $(el).text().trim()
            // Handshakes are shown only as a steelblue cell background, never as text.
            const style = ($(el).attr('style') ?? '').toLowerCase()
            const isHandshake = HANDSHAKE_BG_PATTERN.test(style) && !HANDSHAKE_PATTERN.test(text)
            return isHandshake ? `${text} HANDSHAKE`.trim() : text
          })
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

// The wiki's wording has varied by series: older pages used "OUT" / "STAR BAKER" /
// "TECHNICAL WIN"; Series 17 uses "ELIM" / "STAR" / "TechChall.Winner".
const ELIMINATED_PATTERN = /\b(OUT|ELIM|ELIMINATED)\b/i
const STAR_BAKER_PATTERN = /\bSTAR(\s*BAKER)?\b/i
const TECHNICAL_WIN_PATTERN = /TECH\s*CHALL\.?\s*WINNER|TECHNICAL WIN|WON TECHNICAL|1ST.*TECHNICAL|TECHNICAL.*1ST/i
const HANDSHAKE_PATTERN = /HANDSHAKE/i
const HANDSHAKE_BG_PATTERN = /background(-color)?\s*:\s*(steelblue|#4682b4)\b/i
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

type CellEvent = Pick<SuggestedEvent, 'eventCode' | 'label' | 'points' | 'kind'>

/** Every scoring/elimination event a single progress-table cell implies. */
export function eventsForCell(cellText: string): CellEvent[] {
  if (BLANK_PATTERN.test(cellText)) return [] // still hasn't aired
  if (ELIMINATED_PATTERN.test(cellText)) {
    return [{ eventCode: 'eliminated', label: 'Eliminated this episode (per wiki)', points: 0, kind: 'eliminated' }]
  }

  const score = (code: string): CellEvent => {
    const rule = findBakeoffRule(code)!
    return { eventCode: rule.code, label: rule.label, points: rule.points, kind: 'score' }
  }

  // Passed the round — baseline point for everyone still in.
  const events: CellEvent[] = [score('pass_round')]
  if (STAR_BAKER_PATTERN.test(cellText)) events.push(score('star_baker'))
  if (TECHNICAL_WIN_PATTERN.test(cellText)) events.push(score('win_technical'))
  if (HANDSHAKE_PATTERN.test(cellText)) events.push(score('hand_shake'))
  // Strip the technical marker first: "TechChall.Winner" is not a season win.
  if (WINNER_PATTERN.test(cellText.replace(TECHNICAL_WIN_PATTERN, ''))) events.push(score('season_winner'))
  return events
}

/**
 * Suggests only events that are new since the last snapshot. A cell that gains
 * a marker later (e.g. a handshake added after the episode was first written
 * up) yields just that new event, not a second pass_round.
 */
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
      const prevText = prev[wikiName]?.[epStr] ?? ''
      if (prevText === cellText) continue // no change since last check

      const already = new Set(eventsForCell(prevText).map((e) => e.eventCode))
      for (const e of eventsForCell(cellText)) {
        if (already.has(e.eventCode)) continue
        events.push({ contestantName: dbName, episodeNumber: Number(epStr), ...e })
      }
    }
  }

  return events
}

// Re-exported so callers don't need a separate import just to sanity-check rule codes exist.
export { BAKEOFF_RULES }
