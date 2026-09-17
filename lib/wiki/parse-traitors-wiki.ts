import * as cheerio from 'cheerio'
import { findRule } from '../scoring/traitors-rules'
import type { SuggestedEvent } from './types'

type ContestantRow = { faction: string; result: string; exitEpisode: string }
/** name -> { faction, result, exitEpisode } */
export type TraitorsSnapshot = Record<string, ContestantRow>

/**
 * Parses the contestants table on a Traitors (US) Fandom season page:
 * Name / Age / Location / Occupation / Faction / Result / Exit Episode /
 * Finish. Result + Exit Episode stay blank until a contestant is out.
 */
export function parseTraitorsWiki(html: string): TraitorsSnapshot {
  const $ = cheerio.load(html)
  const snapshot: TraitorsSnapshot = {}

  $('table').each((_, table) => {
    const $table = $(table)
    const headerCells = $table
      .find('tr')
      .first()
      .find('th, td')
      .map((_, el) => $(el).text().trim())
      .get()

    const nameIdx = headerCells.findIndex((t) => /^Name/i.test(t))
    const factionIdx = headerCells.findIndex((t) => /^Faction/i.test(t))
    const resultIdx = headerCells.findIndex((t) => /^Result/i.test(t))
    const exitEpIdx = headerCells.findIndex((t) => /^Exit Episode/i.test(t))

    if (nameIdx === -1 || factionIdx === -1 || resultIdx === -1) return // not the contestants table

    $table
      .find('tr')
      .slice(1)
      .each((_, row) => {
        const cells = $(row)
          .find('td, th')
          .map((_, el) => $(el).text().trim())
          .get()
        if (cells.length <= factionIdx) return
        const name = cells[nameIdx]
        if (!name) return

        snapshot[name] = {
          faction: cells[factionIdx] ?? '',
          result: cells[resultIdx] ?? '',
          exitEpisode: exitEpIdx !== -1 ? (cells[exitEpIdx] ?? '') : '',
        }
      })
  })

  return snapshot
}

function matchContestantName(wikiName: string, dbNames: string[]): string | undefined {
  return dbNames.find((n) => n === wikiName || wikiName.includes(n) || n.includes(wikiName))
}

export function diffTraitorsSnapshots(
  prev: TraitorsSnapshot,
  next: TraitorsSnapshot,
  dbContestantNames: string[],
  finalEpisodeNumber: number
): SuggestedEvent[] {
  const events: SuggestedEvent[] = []

  for (const [wikiName, row] of Object.entries(next)) {
    const prevRow = prev[wikiName]
    if (prevRow && prevRow.result === row.result) continue // unchanged
    if (!row.result) continue // still active, nothing to report

    const dbName = matchContestantName(wikiName, dbContestantNames)
    if (!dbName) continue

    const episodeNumber = Number(row.exitEpisode) || finalEpisodeNumber
    const isTraitor = /traitor/i.test(row.faction)

    let code: string | undefined
    if (/winner/i.test(row.result)) {
      code = 'wins_season'
    } else if (/murder/i.test(row.result)) {
      code = 'murdered'
    } else if (/banish/i.test(row.result)) {
      code = isTraitor ? 'banished_traitor' : 'banished_faithful'
    }
    if (!code) continue // e.g. "Finalist" — no matching scoring rule, leave for manual review

    const rule = findRule(code)
    if (!rule) continue

    events.push({
      contestantName: dbName,
      episodeNumber,
      eventCode: rule.code,
      label: `${rule.label} (per wiki)`,
      points: rule.points,
      kind: 'score',
    })
  }

  return events
}
