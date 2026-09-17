export async function fetchWikiHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FantasyTVBot/1.0; +https://fantasytv.app)',
    },
    // Wiki pages change infrequently; avoid Next.js caching a stale fetch.
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  return res.text()
}
