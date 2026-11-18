/**
 * Matches a wiki contestant name to one of our DB contestant names.
 *
 * Order: exact, case-insensitive exact, then first name, then a whole-word
 * prefix either way ("Clara" ↔ "Clara Satchell-Silva", "Abby Lee" ↔ "Abby Lee
 * Miller"). Never a bare substring, so "Mo" can't swallow "Moyin"/"Molly" and
 * "Abby" can't swallow "Abbey". Fuzzy steps only count when exactly one name
 * fits; an ambiguous name is skipped rather than credited to the wrong person.
 */
export function matchContestantName(wikiName: string, dbNames: string[]): string | undefined {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  const w = norm(wikiName)
  if (!w) return undefined

  const exact = dbNames.find((n) => n === wikiName) ?? dbNames.find((n) => norm(n) === w)
  if (exact) return exact

  const unique = (hits: string[]) => (hits.length === 1 ? hits[0] : undefined)
  const firstToken = w.split(' ')[0]
  const byFirstName = unique(dbNames.filter((n) => norm(n) === firstToken))
  if (byFirstName) return byFirstName

  const byPrefix = unique(
    dbNames.filter((n) => {
      const d = norm(n)
      return w.startsWith(`${d} `) || d.startsWith(`${w} `)
    })
  )
  if (byPrefix) return byPrefix

  // Nickname vs full first name with the same surname: "Dom Monaghan" ↔ "Dominic Monaghan".
  const [wFirst, ...wRest] = w.split(' ')
  const wLast = wRest.join(' ')
  if (!wLast) return undefined
  return unique(
    dbNames.filter((n) => {
      const [dFirst, ...dRest] = norm(n).split(' ')
      return dRest.join(' ') === wLast && (dFirst.startsWith(wFirst) || wFirst.startsWith(dFirst))
    })
  )
}
