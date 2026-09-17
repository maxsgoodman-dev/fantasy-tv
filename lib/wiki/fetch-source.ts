export async function fetchWikiHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Fandom blocks generic/bot-labeled User-Agents with a 403; a
      // realistic browser UA is required to fetch these pages.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    // Wiki pages change infrequently; avoid Next.js caching a stale fetch.
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  return res.text()
}
