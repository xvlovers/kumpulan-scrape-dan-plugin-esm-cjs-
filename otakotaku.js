/*
* scrape otakotaku *
* author skrep: xvlovers *
* git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/otakotaku.js *
* base URL: https://otakotaku.com *
* credit: xv *
* chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E *
*/

const axios = require("axios")
const cheerio = require("cheerio")
const https = require("https")

const BASE = "https://otakotaku.com"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

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
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1"
  }
})

function clean(str) {
  if (!str) return null
  return String(str).replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim() || null
}

function absUrl(href) {
  if (!href) return null
  if (href.startsWith("http")) return href
  return BASE + (href.startsWith("/") ? href : "/" + href)
}

function slugFromUrl(url) {
  if (!url) return null
  const parts = url.replace(BASE, "").split("/").filter(Boolean)
  return parts[parts.length - 1] || null
}

function parseIdFromUrl(url) {
  if (!url) return null
  const m = url.match(/\/view\/(\d+)\//)
  return m ? m[1] : null
}

async function fetchHtml(path) {
  const url = path.startsWith("http") ? path : BASE + path
  const { data, status } = await client.get(url)
  if (status !== 200) throw new Error(`HTTP ${status} untuk ${url}`)
  const $ = cheerio.load(data)
  const title = clean($("title").first().text()) || ""
  if (/^404/.test(title)) throw new Error(`404 Not Found: ${url}`)
  return $
}

function parseListCard($, el) {
  const $el = $(el)
  const $a = $el.find(".anime-img a").first()
  const href = $a.attr("href")
  if (!href) return null

  const $title = $el.find(".anime-title a").first()
  const title = clean($title.text()) || clean($el.find(".anime-img img").attr("alt"))?.replace(/^Gambar\s+/, "")
  const $img = $el.find(".anime-img img").first()
  const poster = clean($img.attr("data-src")) || clean($img.attr("src"))

  const synopsis = clean($el.find(".sinopsis-anime").text())

  const info = {}
  $el.find(".col-md-3 table tr").each((_, tr) => {
    const $tr = $(tr)
    const label = clean($tr.find("td").first().text())?.replace(/:$/, "")
    const $val = $tr.find("td").last()
    const value = clean($val.find("a").text()) || clean($val.text())
    if (label && value) info[label.toLowerCase()] = value
  })

  const id = parseIdFromUrl(href)

  return {
    id: id || null,
    title: title || null,
    slug: slugFromUrl(href),
    url: absUrl(href),
    poster: poster ? absUrl(poster) : null,
    synopsis,
    type: info.tipe || null,
    episodes: info.eps || null,
    season: info.musim || null
  }
}

function parseList($) {
  const items = []
  const seen = new Set()
  $(".anime-list").each((_, el) => {
    const it = parseListCard($, el)
    if (!it || !it.url || seen.has(it.url)) return
    seen.add(it.url)
    items.push(it)
  })
  return items
}

function parseJsonLd($) {
  let result = null
  $("script[type='application/ld+json']").each((_, el) => {
    const raw = $(el).html()
    if (!raw) return
    try {
      const obj = JSON.parse(raw)
      if (obj && (obj["@type"] === "TVSeries" || obj["@type"] === "Movie" || obj.name)) {
        result = obj
      }
    } catch (e) {}
  })
  return result
}

async function getList(path) {
  const $ = await fetchHtml(path)
  const items = parseList($)

  const pageTitle = clean($("title").first().text())
  const heading = clean($(".content-top h1, .content h1").first().text()) ||
    clean($(".page-header h1, h1").first().text())

  const next = $("a[rel='next'], .pagination a.next").attr("href") ||
    $(".pagination li.next a").attr("href") || null

  return {
    heading: heading || pageTitle,
    page_title: pageTitle,
    total: items.length,
    next: next ? absUrl(next) : null,
    items
  }
}

async function getHome() {
  const $ = await fetchHtml("/")
  const items = parseList($)
  const sections = {}

  $(".anime-populer, .content .row").each((_, el) => {
    const $el = $(el)
    const title = clean($el.find("h2, h3, .title").first().text())
    const list = []
    $el.find(".anime-list").each((_, card) => {
      const it = parseListCard($, card)
      if (it) list.push(it)
    })
    if (title && list.length) sections[title] = list
  })

  return { title: clean($("title").first().text()), total: items.length, items, sections: Object.keys(sections).length ? sections : null }
}

async function search(query) {
  const candidates = [
    `/search?q=${encodeURIComponent(query)}`,
    `/?s=${encodeURIComponent(query)}`,
    `/anime/search?q=${encodeURIComponent(query)}`
  ]

  for (const path of candidates) {
    try {
      const $ = await fetchHtml(path)
      const items = parseList($)
      if (items.length) {
        const heading = clean($("h1").first().text()) || clean($("title").first().text())
        return { query, source: path, heading, total: items.length, items }
      }
    } catch (e) {}
  }

  return { query, total: 0, items: [] }
}

async function getDetail(input) {
  let path = input
  if (!path) throw new Error("Contoh: node otakotaku.js detail 3461/hirayasumi")

  if (!path.startsWith("http")) {
    if (/^\d+/.test(path)) {
      const parts = path.split("/")
      if (parts.length === 1) {
        path = `/anime/view/${parts[0]}/x`
      } else {
        path = `/anime/view/${parts[0]}/${parts[1]}`
      }
    } else if (!path.startsWith("/anime/")) {
      path = "/anime/view/" + path
    } else {
      path = path
    }
  }

  const $ = await fetchHtml(path)

  const title = clean($("h1#judul_anime").text()) || clean($("h1").first().text())
  const poster = clean($(".cover-content img").attr("src")) ||
    clean($("meta[property='og:image']").attr("content"))

  const jsonld = parseJsonLd($)

  let synopsis = clean($("meta[name='description']").attr("content"))
  if (synopsis && /^Sinopsis\s+/i.test(synopsis)) {
    synopsis = synopsis.replace(/^Sinopsis\s+[^:]+:\s*/i, "").trim()
  }
  if (!synopsis && jsonld) synopsis = clean(jsonld.description)

  const info = {}
  $("table.table-detail tr").each((_, tr) => {
    const $tr = $(tr)
    const $td = $tr.find("td")
    if ($td.length < 2) return
    const label = clean($td.eq(0).text())?.replace(/:$/, "")
    const $val = $td.eq(1)
    const value = clean($val.find("a").map((_, a) => $(a).text()).get().join(", ")) || clean($val.text())
    if (label && value && value !== "-") {
      const key = label.toLowerCase().replace(/\s+/g, "_")
      if (key) info[key] = value
    }
  })

  const genres = $("table.table-detail a[href*='/anime/genre/']").map((_, a) => clean($(a).text())).get().filter(Boolean)
  const studios = $("table.table-detail a[href*='/anime/producer/']").map((_, a) => clean($(a).text())).get().filter(Boolean)

  const score = clean($(".skor_anime").text())
  const scoreCount = clean($(".pemberi_skor").text())

  const characters = []
  const actors = []
  if (jsonld) {
    if (Array.isArray(jsonld.character)) {
      jsonld.character.forEach(c => characters.push({ name: clean(c.name), url: clean(c.sameAs) }))
    }
    if (Array.isArray(jsonld.actor)) {
      jsonld.actor.forEach(a => actors.push({ name: clean(a.name), url: clean(a.sameAs) }))
    }
  }

  const website = []
  $("table.table-detail a.btn[href^='http']").each((_, a) => {
    const href = $(a).attr("href")
    const label = clean($(a).attr("title")) || clean($(a).text())
    if (href) website.push({ label, url: href })
  })

  const $typeLink = $("table.table-detail a[href*='/anime/type/']").first()
  const $statusLink = $("table.table-detail a[href*='/anime/status/']").first()
  const $seasonLink = $("table.table-detail a[href*='/anime/season/']").first()

  return {
    id: parseIdFromUrl(path),
    slug: slugFromUrl(path),
    url: absUrl(path),
    title,
    japanese: clean($("table.table-detail tr:contains('Jepang') td:last-child").text()) || null,
    poster,
    synopsis,
    type: clean($typeLink.text()) || null,
    type_url: $typeLink.attr("href") ? absUrl($typeLink.attr("href")) : null,
    status: clean($statusLink.text()) || null,
    status_url: $statusLink.attr("href") ? absUrl($statusLink.attr("href")) : null,
    season: clean($seasonLink.text()) || null,
    season_url: $seasonLink.attr("href") ? absUrl($seasonLink.attr("href")) : null,
    aired: info.tayang || null,
    total_episodes: info.total_episode || null,
    duration: info.durasi || null,
    rating: info.rating || null,
    genres: genres.length ? [...new Set(genres)] : null,
    studios: studios.length ? [...new Set(studios)] : null,
    licensor: info.lisensor || null,
    producers: info.produser || null,
    score: score && score !== "-" ? parseFloat(score) : null,
    score_count: scoreCount ? parseInt(scoreCount) : null,
    characters: characters.length ? characters : null,
    seiyuu: actors.length ? actors : null,
    website: website.length ? website : null,
    info
  }
}

async function getType(type) {
  return getList(`/anime/type/${type}`)
}

async function getGenre(genre) {
  return getList(`/anime/genre/${genre}`)
}

async function getSeason(season) {
  return getList(`/anime/season/${season}`)
}

async function getProducer(input) {
  const path = input.startsWith("/") ? input : `/anime/producer/${input}`
  return getList(path)
}

async function getStatus(status) {
  return getList(`/anime/status/${status}`)
}

async function getFeed() {
  return getList("/anime/feed")
}

async function getPopular(season, week = 1) {
  const s = season || "summer-2026"
  return getList(`/anime/terpopuler/${s}/minggu-ke/${week}`)
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = (args[0] || "home").toLowerCase()
  const input = args.slice(1).join(" ").trim()

  try {
    let data
    if (cmd === "home") data = await getHome()
    else if (cmd === "feed" || cmd === "terbaru") data = await getFeed()
    else if (cmd === "type") {
      if (!input) throw new Error("Contoh: node otakotaku.js type tv")
      data = await getType(input.toLowerCase())
    }
    else if (cmd === "genre") {
      if (!input) throw new Error("Contoh: node otakotaku.js genre action")
      data = await getGenre(input.toLowerCase())
    }
    else if (cmd === "season") {
      if (!input) throw new Error("Contoh: node otakotaku.js season fall-2026")
      data = await getSeason(input.toLowerCase())
    }
    else if (cmd === "producer" || cmd === "studio") {
      if (!input) throw new Error("Contoh: node otakotaku.js producer 770/production-h")
      data = await getProducer(input)
    }
    else if (cmd === "status") {
      if (!input) throw new Error("Contoh: node otakotaku.js status ongoing")
      data = await getStatus(input.toLowerCase())
    }
    else if (cmd === "search") {
      if (!input) throw new Error("Contoh: node otakotaku.js search \"one piece\"")
      data = await search(input)
    }
    else if (cmd === "detail") {
      if (!input) throw new Error("Contoh: node otakotaku.js detail 3461/hirayasumi")
      data = await getDetail(input)
    }
    else if (cmd === "popular") {
      data = await getPopular(input || null)
    }
    else if (cmd === "page") {
      if (!input) throw new Error("Contoh: node otakotaku.js page /anime/feed")
      data = await getList(input)
    }
    else {
      throw new Error(`Command tidak dikenal: ${cmd}\nGunakan: home | feed | type <tv|movie|ova|ona|special> | genre <slug> | season <slug> | producer <id/slug> | status <status> | search <q> | detail <id/slug> | popular [season] | page <path>`)
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: error.message }, null, 2))
    process.exit(1)
  }
}

main()