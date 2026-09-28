/*
**scrape biddynamic (komiku mirror)**
**author skrep: xvlovers**
**github:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/biddynamic.js**
**base URL: https://biddynamic.com**
**credit: xvlovers**
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E

*/

const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const path = require("path")

const BASE = "https://biddynamic.com"
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

function parseCards($, selector) {
  const out = []
  const seen = new Set()

  $(selector).each((_, el) => {
    const $el = $(el)
    const link = $el.find("a[href*='/komik/']").first().attr("href") ||
                 $el.find("a[href*='/baca/']").first().attr("href") ||
                 $el.find("a[href]").first().attr("href")
    if (!link || seen.has(link)) return
    seen.add(link)

    const title = clean($el.find(".card__title, h3, h4, .judul").first().text()) ||
                  clean($el.find("a[title]").attr("title"))
    const img = $el.find("img").first().attr("src") ||
                $el.find("img").first().attr("data-src") || null
    const views = clean($el.find(".card__views").first().text())

    if (!title) return
    out.push({
      title,
      url: absoluteUrl(link),
      image: absoluteUrl(img),
      views: views || null
    })
  })

  return out
}

async function latest() {
  const html = await fetchHtml(BASE + "/")
  const $ = cheerio.load(html)
  const items = parseCards($, ".card, .rail__item, article")
  return { url: BASE + "/", count: items.length, items }
}

async function search(query) {
  if (!query) throw new Error("Query kosong")
  const url = BASE + "/cari?q=" + encodeURIComponent(query)
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".card, .rail__item, article")
  return { query, url, count: items.length, items }
}

async function detail(mangaUrl) {
  if (!mangaUrl) throw new Error("URL manga kosong")
  const abs = mangaUrl.startsWith("http") ? mangaUrl : BASE + mangaUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("#judul-chapter, .section__title h1, h1").first().text())
  const image = absoluteUrl($("meta[property='og:image']").attr("content")) ||
                absoluteUrl($(".komik__poster img, .card__cover img").first().attr("src"))
  const synopsis = clean($(".komik__sinopsis, .deskripsi, .sinopsis").first().text())

  const meta = {}
  $(".komik__statistik-teks, .komik__meta, .info-row").each((_, el) => {
    const txt = clean($(el).text())
    const idx = txt.indexOf(":")
    if (idx > 0) {
      const k = txt.slice(0, idx).trim().toLowerCase()
      const v = txt.slice(idx + 1).trim()
      if (k && v) meta[k] = v
    }
  })

  const genres = $(".chip--tautan, .komik__genre a, .genres a").map((_, el) => clean($(el).text())).get().filter(Boolean)

  const chapters = []
  const seen = new Set()
  $("ol.chapters li a.chapter, a.chapter.chapter--ringkas").each((_, el) => {
    const $el = $(el)
    const href = $el.attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)

    const name = clean($el.find(".chapter__nama").text()) || clean($el.text())
    const date = clean($el.find(".chapter__tanggal").text())
    const m = href.match(/\/(\d+(?:-\d+)?)\/?$/)
    chapters.push({
      url: absoluteUrl(href),
      chapter: m ? m[1] : null,
      label: name || null,
      date: date || null
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
    chapters
  }
}

async function chapter(chapterUrl) {
  if (!chapterUrl) throw new Error("URL chapter kosong")
  const abs = chapterUrl.startsWith("http") ? chapterUrl : BASE + chapterUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("#judul-chapter, h1, .section__title").first().text()) || clean($("title").text())

  // Cari semua gambar halaman
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

  // Selector reader umum
  $("#Baca_Komik img, #baca-komik img, .chapter-content img, .reader img, .main-reading img, #chimg img, .komik__baca img").each((_, el) => {
    push($(el).attr("src"))
    push($(el).attr("data-src"))
    push($(el).attr("data-lazy-src"))
  })

  if (images.length < 2) {
    $("img").each((_, el) => {
      push($(el).attr("src"))
      push($(el).attr("data-src"))
    })
  }

  const prev = $("a[rel='prev'], a:contains('Sebelumnya'), a:contains('Prev')").first().attr("href") || null
  const next = $("a[rel='next'], a:contains('Selanjutnya'), a:contains('Next')").first().attr("href") || null

  return {
    url: abs,
    title: title || null,
    imageCount: images.length,
    images,
    prevChapter: absoluteUrl(prev),
    nextChapter: absoluteUrl(next)
  }
}

async function downloadChapter(chapterUrl, outDir) {
  const ch = await chapter(chapterUrl)
  const dir = outDir || path.join(process.cwd(), "komiku-dl", String(Date.now()))

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const downloaded = []
  for (const img of ch.images) {
    try {
      const r = await client.get(img.url, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": UA, "Referer": BASE + "/" }
      })
      const num = String(img.index).padStart(3, "0")
      const ext = (img.url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i) || [".jpg"])[0]
      const p = path.join(dir, num + ext)
      fs.writeFileSync(p, r.data)
      downloaded.push({ index: img.index, url: img.url, path: p, size: r.data.length })
      process.stderr.write("\r[dl] " + img.index + "/" + ch.images.length)
    } catch (e) {
      downloaded.push({ index: img.index, url: img.url, error: e.message })
    }
  }
  process.stderr.write("\n")

  return { dir, total: ch.images.length, downloaded }
}

function output(data) {
  console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
}

function fail(msg) {
  console.log(JSON.stringify({ author: "xvlovers", status: false, message: msg }, null, 2))
  process.exit(1)
}

function usage(msg) {
  fail(msg || "Usage: node biddynamic.js <latest|search|detail|chapter|download> <arg>")
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]

    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") usage()

    if (cmd === "latest") output(await latest())
    else if (cmd === "search") {
      const q = args.slice(1).join(" ")
      if (!q) usage("Usage: node biddynamic.js search <query>")
      output(await search(q))
    } else if (cmd === "detail") {
      if (!args[1]) usage("Usage: node biddynamic.js detail <url_komik>")
      output(await detail(args[1]))
    } else if (cmd === "chapter") {
      if (!args[1]) usage("Usage: node biddynamic.js chapter <url_chapter>")
      output(await chapter(args[1]))
    } else if (cmd === "download") {
      if (!args[1]) usage("Usage: node biddynamic.js download <url_chapter> [outDir]")
      output(await downloadChapter(args[1], args[2]))
    } else {
      usage()
    }
  } catch (e) {
    fail(e.message)
  }
}

main()