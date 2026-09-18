/**
 * Fandom sits behind Cloudflare's JS challenge ("cf-mitigated: challenge") —
 * a plain server-side fetch can never solve that, no matter the headers.
 * When SCRAPERAPI_KEY is set, route through ScraperAPI's render mode, which
 * runs a real browser server-side and hands back the resolved HTML. Without
 * a key, falls back to a direct fetch (fine for any source that isn't
 * Cloudflare-protected).
 */
export async function fetchWikiHtml(url: string): Promise<string> {
  const apiKey = process.env.SCRAPERAPI_KEY

  if (apiKey) {
    const proxied = `https://api.scraperapi.com/?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}&render=true`
    const res = await fetch(proxied, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`ScraperAPI fetch failed for ${url}: ${res.status} ${res.statusText}`)
    }
    return res.text()
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${res.status} ${res.statusText} (no SCRAPERAPI_KEY set — required for Cloudflare-protected sources like Fandom)`
    )
  }
  return res.text()
}
