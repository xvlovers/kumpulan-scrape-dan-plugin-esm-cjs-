/*
**scrape komiku**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/komiku.js**
**base URL: https://komiku.org**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E

*/

const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const path = require("path")

const BASE = "https://komiku.org"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function clean(t) {
  return String(t || "").replace(/\s+/g, " ").trim()
}

function absoluteUrl(u) {
  if (!u) return null
  if (u.startsWith("http")) return u
  if (u.startsWith("//")) return "https:" + u
  if (u.startsWith("/")) return BASE + u
  return BASE + "/" + u
}

async function fetchHtml(url) {
  const r = await client.get(url)
  if (r.status >= 400) throw new Error("HTTP " + r.status + " - " + url)
  return String(r.data)
}

function pickMangaCard($, el) {
  const $el = $(el)
  const link = $el.find("a[href*='/manga/']").first().attr("href") || $el.find("a[href]").first().attr("href")
  if (!link) return null

  const title = clean($el.find("h4, h3, .judul, a[title]").first().text()) ||
                clean($el.find("a").first().attr("title"))
  const img = $el.find("img").first().attr("data-src") ||
              $el.find("img").first().attr("src") ||
              $el.find("img").first().attr("data-lazy-src") || null
  const chapter = clean($el.find(".ls2t, .chapter, .ls24, span").first().text())
  const genre = clean($el.find(".ls2t + span, .genre").first().text())

  return {
    title: title || null,
    url: absoluteUrl(link),
    image: absoluteUrl(img),
    chapter: chapter || null,
    genre: genre || null
  }
}

function parseLatest($) {
  const items = []
  const seen = new Set()

  // Cari semua link yang mengandung "chapter"
  $("a[href*='-chapter-']").each((_, el) => {
    const href = $(el).attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)

    const $el = $(el)
    const title = clean($el.text())
    if (!title || title.length < 3) return

    // Cari parent card
    const $parent = $el.closest(".ls2, .ls4, .ls8, li, article, .bge, .bgei")
    const img = $parent.find("img").first().attr("data-src") ||
                $parent.find("img").first().attr("src") || null

    items.push({
      title,
      url: absoluteUrl(href),
      image: absoluteUrl(img)
    })
  })

  return items.slice(0, 30)
}

async function latest() {
  const html = await fetchHtml(BASE + "/")
  const $ = cheerio.load(html)
  const items = parseLatest($)
  return { url: BASE + "/", count: items.length, items }
}

async function ranking() {
  const html = await fetchHtml(BASE + "/p/ranking/")
  const $ = cheerio.load(html)
  const items = []
  const seen = new Set()

  $(".rank-panel a[href*='/manga/'], .rank-panel a[href*='-chapter-']").each((_, el) => {
    const href = $(el).attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)
    const title = clean($(el).text())
    if (title && title.length > 2) {
      items.push({ title, url: absoluteUrl(href) })
    }
  })

  return { url: BASE + "/p/ranking/", count: items.length, items: items.slice(0, 30) }
}

async function trending() {
  const html = await fetchHtml(BASE + "/p/trending/")
  const $ = cheerio.load(html)
  const items = []
  const seen = new Set()

  $("a[href*='/manga/']").each((_, el) => {
    const href = $(el).attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)
    const title = clean($(el).text())
    const img = $(el).find("img").first().attr("data-src") ||
                $(el).find("img").first().attr("src") || null
    if (title && title.length > 2) {
      items.push({ title, url: absoluteUrl(href), image: absoluteUrl(img) })
    }
  })

  return { url: BASE + "/p/trending/", count: items.length, items: items.slice(0, 30) }
}

async function search(query) {
  if (!query) throw new Error("Query kosong")
  const url = BASE + "/?post_type=manga&s=" + encodeURIComponent(query)
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = []
  const seen = new Set()

  $("a[href*='/manga/']").each((_, el) => {
    const href = $(el).attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)
    const $el = $(el)
    const title = clean($el.find("h4, h3, a[title]").first().text()) ||
                  clean($el.attr("title")) ||
                  clean($el.text())
    const img = $el.find("img").first().attr("data-src") ||
                $el.find("img").first().attr("src") || null
    if (title && title.length > 2) {
      items.push({ title, url: absoluteUrl(href), image: absoluteUrl(img) })
    }
  })

  return { query, url, count: items.length, items: items.slice(0, 30) }
}

async function filter(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.append(k, v)
  }
  const url = BASE + "/pustaka/?" + qs.toString()
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = []
  const seen = new Set()

  $("a[href*='/manga/']").each((_, el) => {
    const href = $(el).attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)
    const $el = $(el)
    const title = clean($el.find("h4, h3").first().text()) || clean($el.text())
    const img = $el.find("img").first().attr("data-src") ||
                $el.find("img").first().attr("src") || null
    if (title && title.length > 2) {
      items.push({ title, url: absoluteUrl(href), image: absoluteUrl(img) })
    }
  })

  return { params, url, count: items.length, items: items.slice(0, 40) }
}

async function detail(mangaUrl) {
  if (!mangaUrl) throw new Error("URL manga kosong")
  const abs = mangaUrl.startsWith("http") ? mangaUrl : BASE + mangaUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("h1").first().text())
  const image = absoluteUrl($("meta[property='og:image']").attr("content")) ||
                absoluteUrl($(".ims img, .thumb img").first().attr("src"))
  const synopsis = clean($(".desc, .entry-content-single, #Sinopsis, .sinopsis").first().text())

  const meta = {}
  $(".inftable tr, .spe span, .infomanga .spe span").each((_, el) => {
    const txt = clean($(el).text())
    const idx = txt.indexOf(":")
    if (idx > 0) {
      const k = txt.slice(0, idx).trim().toLowerCase()
      const v = txt.slice(idx + 1).trim()
      if (k && v) meta[k] = v
    }
  })

  const genres = $(".genre a, .genres a, .mgen a").map((_, el) => clean($(el).text())).get().filter(Boolean)

  // Daftar chapter
  const chapters = []
  const seen = new Set()
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    if (!/-chapter-/i.test(href)) return
    const absHref = absoluteUrl(href)
    if (!absHref || seen.has(absHref)) return
    seen.add(absHref)
    const label = clean($(el).text())
    const m = label.match(/(\d+(?:\.\d+)?)/)
    chapters.push({
      url: absHref,
      chapter: m ? m[1] : null,
      label: label || null
    })
  })

  return {
    url: abs,
    title: title || null,
    image,
    synopsis: synopsis || null,
    info: meta,
    genres,
    chapterCount: chapters.length,
    chapters: chapters.slice(0, 200)
  }
}

async function chapter(chapterUrl) {
  if (!chapterUrl) throw new Error("URL chapter kosong")
  const abs = chapterUrl.startsWith("http") ? chapterUrl : BASE + chapterUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("h1").first().text()) || clean($("title").text())
  const mangaLink = $("a[href*='/manga/']").first().attr("href") || null

  const images = []
  const seen = new Set()

  const push = src => {
    const a = absoluteUrl(src)
    if (!a || seen.has(a)) return
    if (a.startsWith("data:")) return
    if (/logo|favicon|avatar|banner|ads|placeholder|loading|icon/i.test(a)) return
    seen.add(a)
    images.push({ index: images.length + 1, url: a })
  }

  // Selector utama reader Komiku
  $("#Baca_Komik img, #baca-comic img, .chapter-content img, #readerarea img, .main-reading img, #chimg img").each((_, el) => {
    push($(el).attr("src"))
    push($(el).attr("data-src"))
    push($(el).attr("data-lazy-src"))
  })

  if (images.length < 2) {
    $("img").each((_, el) => {
      push($(el).attr("src"))
      push($(el).attr("data-src"))
      push($(el).attr("data-lazy-src"))
    })
  }

  const prev = $("a:contains('Prev'), a[rel='prev']").first().attr("href") || null
  const next = $("a:contains('Next'), a[rel='next']").first().attr("href") || null

  return {
    url: abs,
    title: title || null,
    mangaLink: absoluteUrl(mangaLink),
    imageCount: images.length,
    images,
    prevChapter: absoluteUrl(prev),
    nextChapter: absoluteUrl(next)
  }
}

function output(data) {
  console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
}

function fail(msg) {
  console.log(JSON.stringify({ author: "xvlovers", status: false, message: msg }, null, 2))
  process.exit(1)
}

function usage(msg) {
  fail(msg || "Usage: node komiku.js <latest|ranking|trending|search|filter|detail|chapter> <arg>")
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]

    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") usage()

    if (cmd === "latest") {
      output(await latest())
    } else if (cmd === "ranking") {
      output(await ranking())
    } else if (cmd === "trending") {
      output(await trending())
    } else if (cmd === "search") {
      const q = args.slice(1).join(" ")
      if (!q) usage("Usage: node komiku.js search <query>")
      output(await search(q))
    } else if (cmd === "filter") {
      const params = {}
      for (const a of args.slice(1)) {
        const m = a.match(/^--([^=]+)=(.+)$/)
        if (m) params[m[1]] = m[2]
      }
      output(await filter(params))
    } else if (cmd === "detail") {
      const url = args[1]
      if (!url) usage("Usage: node komiku.js detail <url_manga>")
      output(await detail(url))
    } else if (cmd === "chapter") {
      const url = args[1]
      if (!url) usage("Usage: node komiku.js chapter <url_chapter>")
      output(await chapter(url))
    } else {
      usage()
    }
  } catch (e) {
    fail(e.message)
  }
}

main()