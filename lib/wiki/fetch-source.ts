const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

export type WikiPage = { html: string; revid: string | null }

/**
 * Fandom serves its article pages behind Cloudflare's JS challenge, but the
 * MediaWiki API (/api.php) is not challenged: a direct call returns the same
 * rendered HTML plus the page revision id in ~0.3s for free. That's the
 * primary path. If the API ever gets challenged too, fall back to rendering
 * the article page through ScraperAPI (slow, costs credits).
 */
export async function fetchWikiPage(url: string): Promise<WikiPage> {
  try {
    return await fetchViaMediaWikiApi(url)
  } catch (apiError) {
    if (!process.env.SCRAPERAPI_KEY) throw apiError
    return { html: await fetchViaScraperApi(url), revid: null }
  }
}

async function fetchViaMediaWikiApi(url: string): Promise<WikiPage> {
  const parsed = new URL(url)
  const title = decodeURIComponent(parsed.pathname.replace(/^\/wiki\//, ''))
  const apiUrl =
    `${parsed.origin}/api.php?action=parse&page=${encodeURIComponent(title)}` +
    `&prop=text%7Crevid&format=json&formatversion=2&redirects=1`

  const res = await fetch(apiUrl, { headers: BROWSER_HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`MediaWiki API ${res.status} ${res.statusText} for ${url}`)

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) throw new Error(`MediaWiki API returned non-JSON (challenged?) for ${url}`)

  const body = (await res.json()) as { parse?: { text?: string; revid?: number }; error?: { info?: string } }
  if (!body.parse?.text) throw new Error(`MediaWiki API error for ${url}: ${body.error?.info ?? 'no page text'}`)

  return { html: body.parse.text, revid: body.parse.revid != null ? String(body.parse.revid) : null }
}

async function fetchViaScraperApi(url: string): Promise<string> {
  const apiKey = process.env.SCRAPERAPI_KEY!
  const proxied = `https://api.scraperapi.com/?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}&render=true`

  // ScraperAPI occasionally returns a transient 500 on hard-to-render pages;
  // their docs recommend retrying.
  let lastStatus = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(proxied, { cache: 'no-store' })
    if (res.ok) return res.text()
    lastStatus = `${res.status} ${res.statusText}`
    if (res.status < 500) break
  }
  throw new Error(`ScraperAPI fetch failed for ${url}: ${lastStatus}`)
}
