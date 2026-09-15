/**
 * Minimal two-column CSV line parser for admin bulk-import textareas
 * (contestants: name,bio — episodes: episodeNumber,airDate). Splits each
 * line on the first comma only, so a bio/description may itself contain
 * commas without breaking parsing.
 */
export function parseTwoColumnCsv(raw: string): [string, string][] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const idx = line.indexOf(',')
      if (idx === -1) return [line.trim(), '']
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    })
}
