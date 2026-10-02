/*
* scrape nekopoi *
* author skrep: xvlovers *
* git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/nekopoi.js *
* base URL: https://nekopoi.care *
* credit: xv *
* chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E *

*/

const axios = require("axios")
const cheerio = require("cheerio")
const https = require("https")
const { execFile } = require("child_process")
const { promisify } = require("util")

const execFileAsync = promisify(execFile)

const BASE = "https://nekopoi.care"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

const CURL_HEADERS = [
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer: https://nekopoi.care/",
  "Upgrade-Insecure-Requests: 1"
]

const client = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256",
    honorCipherOrder: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3"
  }),
  headers: {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": BASE + "/",
    "Upgrade-Insecure-Requests": "1"
  }
})

function clean(str) {
  if (!str) return null
  return String(str).replace(/\s+/g, " ").trim() || null
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function absUrl(href) {
  if (!href) return null
  if (href.startsWith("http")) return href
  return BASE + (href.startsWith("/") ? href : "/" + href)
}

function ensureSlash(url) {
  if (!url) return url
  if (/\.\w+(\?|$)/.test(url)) return url
  return url.endsWith("/") ? url : url + "/"
}

function extractBgUrl(style) {
  if (!style) return null
  const m = String(style).match(/url\(['"]?([^'")]+)['"]?\)/)
  return m ? m[1] : null
}

function isBlocked(html) {
  return /Internet Positif|InternetPositif|positifkan diri/i.test(html)
}

async function fetchCurl(url) {
  const args = ["-sLk", "--compressed", "--max-time", "30", "-A", UA]
  for (const h of CURL_HEADERS) args.push("-H", h)
  args.push(url)
  const { stdout } = await execFileAsync("curl", args, { maxBuffer: 20 * 1024 * 1024 })
  return stdout
}

async function fetchRaw(url, retry = 3) {
  let lastErr
  for (let i = 0; i < retry; i++) {
    try {
      const { data, status } = await client.get(url)
      if (status !== 200) throw new Error(`HTTP ${status}`)
      const str = typeof data === "string" ? data : String(data)
      if (isBlocked(str)) {
        lastErr = new Error("Blocked by Internet Positif (ISP)")
        if (i < retry - 1) await sleep(3000 * (i + 1))
        continue
      }
      return str
    } catch (e) {
      lastErr = e
      if (/EPROTO|ECONNRESET|socket hang up|handshake|tlsv1/i.test(e.message) || e.code === "EPROTO") {
        try {
          const str = await fetchCurl(url)
          if (isBlocked(str)) {
            lastErr = new Error("Blocked by Internet Positif (ISP)")
            if (i < retry - 1) await sleep(3000 * (i + 1))
            continue
          }
          return str
        } catch (e2) {
          lastErr = e2
        }
      }
      if (i < retry - 1) await sleep(1000 * (i + 1))
    }
  }
  throw lastErr || new Error("fetch failed")
}

async function fetchHtml(path) {
  let url = path.startsWith("http") ? path : BASE + path
  url = ensureSlash(url)
  const html = await fetchRaw(url)
  const $ = cheerio.load(html)
  const title = clean($("title").first().text()) || ""
  if (/^404|not found|tidak ditemukan/i.test(title)) throw new Error(`404 Not Found: ${url}`)
  return $
}

function skipTitle(title) {
  if (!title || title.length < 3) return true
  return /^(Hentai|JAV|Cosplay|3D Hentai|Hentai List|JAV List|Genre List|Home|Jadwal New Hentai|Unduh|Download)$/i.test(title)
}

function parseCards($) {
  const posts = []
  const seen = new Set()
  $("a[href*='/hentai/'], a[href*='/jav/']").each((_, el) => {
    const $a = $(el)
    const href = clean($a.attr("href"))
    if (!href || seen.has(href)) return
    if (/\/category\/|\/hentai-list\/|\/jav-list\/|\/genre-list\/|\/jadwal-|\/page\//i.test(href)) return
    if (!/^https?:\/\/nekopoi\.care\/(hentai|jav)\//i.test(href)) return
    seen.add(href)

    const title = clean($a.attr("title")) || clean($a.find("h2, h3, .title").text()) || clean($a.text())
    if (skipTitle(title)) return

    const $img = $a.find("img").first()
    const poster = clean($img.attr("data-src")) || clean($img.attr("src"))

    posts.push({
      title,
      url: href,
      slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, ""),
      poster: poster ? absUrl(poster) : null
    })
  })
  return posts
}

async function getHome() {
  const $ = await fetchHtml("/")
  const posts = parseCards($)
  return { total: posts.length, posts }
}

async function getList(path) {
  const $ = await fetchHtml(path)
  const posts = parseCards($)
  const next = $("a.next.page-numbers, .pagination a.next").attr("href") ||
    $("a[rel='next']").attr("href") || null
  return { total: posts.length, next: next ? absUrl(next) : null, posts }
}

async function search(query) {
  const $ = await fetchHtml(`/?s=${encodeURIComponent(query)}`)
  const posts = parseCards($)
  return { query, total: posts.length, posts }
}

function cleanSynopsis(raw) {
  if (!raw) return null
  let s = String(raw).replace(/\s+/g, " ").trim()
  s = s.replace(/^Episode\s+Terbaru\s+.*?(?=Menceritakan|[A-Z][a-z]{4,})/i, "")
  s = s.replace(/^(UNCENSORED|Unduh|Episode\s+\d+)\s*/gi, "")
  s = s.replace(/\s*(Unduh|Download|Streaming)\s*$/i, "")
  return s.trim() || null
}

function parseEpisodeCards($) {
  const episodes = []
  const seen = new Set()
  $(".nk-episode-card").each((_, el) => {
    const $el = $(el)
    const $a = $el.find("a").first()
    const href = clean($a.attr("href"))
    if (!href || seen.has(href)) return
    if (!/^https?:\/\/nekopoi\.care\/[^/]*episode-\d+/i.test(href)) return
    seen.add(href)

    const title = clean($el.find(".nk-episode-card-title").text()) || clean($a.attr("title"))
    if (skipTitle(title)) return

    const thumb = extractBgUrl($el.find(".nk-episode-card-thumb").attr("style"))

    episodes.push({
      title,
      url: href,
      slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, ""),
      thumbnail: thumb ? absUrl(thumb) : null
    })
  })
  return episodes
}

async function getSeries(slug) {
  const path = slug.startsWith("http") ? slug : (slug.startsWith("/") ? slug : "/hentai/" + slug.replace(/^hentai\//, "").replace(/\/$/, "") + "/")
  const $ = await fetchHtml(path)

  const title = clean($(".nk-series-synopsis b").first().text()) ||
    clean($("title").first().text()).replace(/\s*[–—-]\s*NekoPoi.*$/i, "")

  const poster = extractBgUrl($(".nk-series-poster").attr("style"))

  const $syn = $(".nk-series-synopsis").clone()
  $syn.find("b").remove()
  const synopsis = cleanSynopsis($syn.text())

  const genres = []
  $(".nk-series-synopsis a[href*='/genre/'], .nk-series-info a[href*='/genre/'], a[href*='/genre/']").each((_, el) => {
    const g = clean($(el).text())
    if (g && !/^(Genre List|Hentai List|JAV List)$/i.test(g)) genres.push(g)
  })

  const episodes = parseEpisodeCards($)

  return {
    title,
    slug: path,
    url: absUrl(path),
    poster: poster ? absUrl(poster) : null,
    synopsis,
    genres: genres.length ? [...new Set(genres)] : null,
    total_episodes: episodes.length || null,
    episodes: episodes.length ? episodes : null
  }
}

async function getEpisode(url) {
  const path = url.startsWith("http") ? url : absUrl(url)
  const $ = await fetchHtml(path)

  const title = clean($("title").first().text()).replace(/\s*[–—-]\s*NekoPoi.*$/i, "")

  const series = clean($(".nk-player-series-title").first().text())
  const seriesUrl = $(".nk-player-series").attr("href")
  const seriesThumb = extractBgUrl($(".nk-player-series-thumb").attr("style"))

  const streams = []
  const serverLabels = []
  $(".nk-player-frame iframe").each((_, el) => {
    const src = clean($(el).attr("src"))
    if (src) streams.push(src)
  })
  $("#nk-player-tabs a").each((_, el) => {
    const label = clean($(el).text())
    if (label) serverLabels.push(label)
  })

  const downloads = []
  $(".nk-download-row").each((_, row) => {
    const $row = $(row)
    const nameRaw = clean($row.find(".nk-download-name").text())
    if (!nameRaw) return

    const qMatch = nameRaw.match(/\[(\d+p)\]/i)
    const quality = qMatch ? qMatch[1] : null
    const name = clean(nameRaw.replace(/\[\d+p\]/i, "")).trim()

    const hosts = []
    const seenHost = new Set()
    $row.find(".nk-download-links a").each((_, a) => {
      const $a = $(a)
      const href = clean($a.attr("href"))
      const label = clean($a.text())
      if (!href || seenHost.has(href)) return
      seenHost.add(href)
      const isOuo = /ouo\.io/i.test(href)
      const isLinkpoi = /linkpoi\.me/i.test(href)
      hosts.push({
        name: label,
        url: href,
        provider: isOuo ? "ouo" : isLinkpoi ? "linkpoi" : "direct"
      })
    })

    downloads.push({ quality, name, hosts: hosts.length ? hosts : null })
  })

  const prev = $(".nk-episode-prev").attr("href")
  const next = $(".nk-episode-next").attr("href")

  return {
    title,
    url: absUrl(path),
    series: series || null,
    series_url: seriesUrl ? absUrl(seriesUrl) : null,
    series_thumbnail: seriesThumb ? absUrl(seriesThumb) : null,
    streams: streams.length ? streams : null,
    stream_servers: serverLabels.length ? serverLabels : null,
    downloads: downloads.length ? downloads : null,
    prev: prev ? absUrl(prev) : null,
    next: next ? absUrl(next) : null
  }
}

async function resolveLinkpoi(linkpoiUrl) {
  const html = await fetchRaw(linkpoiUrl)
  const $ = cheerio.load(html)
  const meta = $("meta[http-equiv='refresh']").attr("content") || ""
  const m = meta.match(/url=([^;]+)/i)
  if (m) return { final: m[1].trim(), via: "meta-refresh" }
  const $a = $("a[href^='http']").first()
  const href = $a.attr("href")
  if (href) return { final: href, via: "anchor" }
  return { final: null, via: "unknown", raw: String(html).slice(0, 400) }
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = (args[0] || "help").toLowerCase()
  const input = args.slice(1).join(" ").trim()

  try {
    let data
    if (cmd === "home") data = await getHome()
    else if (cmd === "list") data = await getList(input || "/hentai-list/")
    else if (cmd === "hentai-list") data = await getList("/hentai-list/")
    else if (cmd === "jav-list") data = await getList("/jav-list/")
    else if (cmd === "genre-list") data = await getList("/genre-list/")
    else if (cmd === "search") {
      if (!input) throw new Error('Contoh: node nekopoi.js search "jewelry"')
      data = await search(input)
    }
    else if (cmd === "series" || cmd === "detail") {
      if (!input) throw new Error("Contoh: node nekopoi.js series jewelry")
      data = await getSeries(input)
    }
    else if (cmd === "episode" || cmd === "download") {
      if (!input) throw new Error("Contoh: node nekopoi.js episode jewelry-episode-1-subtitle-indonesia")
      data = await getEpisode(input)
    }
    else if (cmd === "resolve") {
      if (!input) throw new Error("Contoh: node nekopoi.js resolve https://linkpoi.me/xxxxx")
      data = await resolveLinkpoi(input)
    }
    else {
      data = {
        usage: [
          "node nekopoi.js home",
          "node nekopoi.js hentai-list",
          "node nekopoi.js jav-list",
          "node nekopoi.js genre-list",
          "node nekopoi.js list <path>",
          'node nekopoi.js search "jewelry"',
          "node nekopoi.js series <slug>",
          "node nekopoi.js episode <slug-or-url>",
          "node nekopoi.js resolve <linkpoi-url>"
        ],
        notes: [
          "Kalau kena 'Internet Positif' → server block, tunggu 30-60 detik",
          "Retry otomatis 3x dengan delay",
          "Fallback curl otomatis kalau axios TLS error"
        ]
      }
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: error.message }, null, 2))
    process.exit(1)
  }
}

main()