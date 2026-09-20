/*
**scrape bacakomik**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/bacakomik.js**
**base URL: https://bacakomik.my**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const cheerio = require("cheerio")

const BASE = "https://bacakomik.my"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 25000,
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

function getImage($el) {
  // Prioritas: data-lazy-src → data-src → noscript img → src (kalau bukan placeholder)
  let img = $el.find("img").first()
  let src = img.attr("data-lazy-src") || img.attr("data-src") || img.attr("data-original")
  if (!src) {
    const noscriptHtml = $el.find("noscript").html()
    if (noscriptHtml) {
      const m = noscriptHtml.match(/src=["']([^"']+)["']/)
      if (m) src = m[1]
    }
  }
  if (!src) {
    const raw = img.attr("src")
    if (raw && !raw.startsWith("data:")) src = raw
  }
  return absoluteUrl(src)
}

async function fetchHtml(url) {
  const r = await client.get(url)
  if (r.status >= 400) throw new Error("HTTP " + r.status + " - " + url)
  return String(r.data)
}

function parseCards($, rootSelector) {
  const out = []
  const seen = new Set()

  $(rootSelector).each((_, el) => {
    const $el = $(el)
    const $link = $el.find("a[href*='/komik/']").first()
    const href = $link.attr("href")
    if (!href || seen.has(href)) return

    const $titleEl = $el.find(".tt h4, .tt, h4").first()
    let title = clean($titleEl.text())
    if (!title) title = clean($link.attr("title")).replace(/^Komik\s+/i, "")
    if (!title) return

    seen.add(href)

    const image = getImage($el.find(".limit").first().length ? $el.find(".limit") : $el)

    const $chapLink = $el.find(".adds .lsch a, .adds a").first()
    const chapterLabel = clean($chapLink.text())
    const chapHref = $chapLink.attr("href")
    const chapMatch = chapterLabel.match(/ch\.?\s*(\d+(?:\.\d+)?)/i) || chapterLabel.match(/(\d+(?:\.\d+)?)/)

    const dateText = clean($el.find(".datech").first().text())

    const type = clean($el.find(".typeflag").first().text())
    const isColor = $el.find(".warnalabel").length > 0
    const isHot = $el.find(".hot").length > 0

    out.push({
      title,
      url: absoluteUrl(href),
      image,
      latestChapter: chapMatch ? chapMatch[1] : null,
      latestChapterUrl: chapHref ? absoluteUrl(chapHref) : null,
      latestChapterLabel: chapterLabel || null,
      updatedAt: dateText || null,
      type: type || null,
      color: isColor,
      hot: isHot
    })
  })
  return out
}

async function latest(page = 1) {
  const url = page > 1 ? BASE + "/page/" + page + "/" : BASE + "/"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const items = parseCards($, ".listupd .animepost")

  const popular = []
  $(".serieslist ul li").each((_, el) => {
    if (popular.length >= 10) return
    const $el = $(el)
    const $a = $el.find("h4 a.series, a.series").first()
    const href = $a.attr("href")
    if (!href) return
    popular.push({
      rank: clean($el.find(".ctr").first().text()) || null,
      title: clean($a.text()) || clean($a.attr("title")).replace(/^Komik\s+/i, ""),
      url: absoluteUrl(href),
      image: getImage($el.find(".imgseries")),
      rating: clean($el.find(".loveviews").text()).replace(/[^\d.]/g, "") || null
    })
  })

  return { page, url, count: items.length, items, popular }
}

async function search(query) {
  if (!query) throw new Error("Query kosong")
  const url = BASE + "/?s=" + encodeURIComponent(query)
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .animepost, .listupd .bs, .listupd .bsx")
  return { query, url, count: items.length, items }
}

async function detail(komikUrl) {
  if (!komikUrl) throw new Error("URL komik kosong")
  const abs = komikUrl.startsWith("http") ? komikUrl : BASE + komikUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("h1.entry-title, h1").first().text()) || clean($("title").text()).split(" - ")[0]
  const image = absoluteUrl(
    $("meta[property='og:image']").attr("content") ||
    $(".thumb img").attr("data-lazy-src") ||
    $(".thumb img").attr("src")
  )
  const synopsis = clean($(".entry-content[itemprop='description'] p, .desc p, .entry-content p").first().text())

  const meta = {}
  $(".spe span, .infomanga .spe span, .seriesinfo span").each((_, el) => {
    const txt = clean($(el).text())
    const idx = txt.indexOf(":")
    if (idx > 0) {
      const k = txt.slice(0, idx).trim().toLowerCase()
      const v = txt.slice(idx + 1).trim()
      if (k && v) meta[k] = v
    }
  })

  const genres = $(".genxed a, .mgen a, .genres a").map((_, el) => clean($(el).text())).get().filter(Boolean)

  // Chapter list: cari link dengan pola -chapter- atau /chapter/
  const chapters = []
  const seen = new Set()
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    const isChapterHref = /-chapter-\d+|chapter-\d+|\/chapter\/|episode-\d+/i.test(href)
    if (!isChapterHref) return
    const absHref = absoluteUrl(href)
    if (!absHref || seen.has(absHref)) return
    seen.add(absHref)
    const label = clean($(el).text())
    const m = href.match(/(\d+(?:\.\d+)?)(?:-|$|\/)/)
    chapters.push({
      url: absHref,
      chapter: m ? m[1] : null,
      label: label || null,
      date: clean($(el).parent().find(".dt, time, .date").first().text()) || null
    })
  })

  chapters.sort((a, b) => {
    const na = parseFloat(a.chapter) || 0
    const nb = parseFloat(b.chapter) || 0
    return nb - na
  })

  return {
    url: abs,
    title: title || null,
    image,
    synopsis: synopsis || null,
    status: meta.status || null,
    type: meta.type || meta.tipe || null,
    author: meta.author || meta.pengarang || null,
    artist: meta.artist || null,
    released: meta.released || meta.rilis || null,
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

  const title = clean($("h1.entry-title, h1").first().text()) || clean($("title").text()).split(" - ")[0]

  const komikLink = $("a[href*='/komik/']").first().attr("href") || null

  const images = []
  const seen = new Set()

  const push = src => {
    const a = absoluteUrl(src)
    if (!a || seen.has(a)) return
    if (a.startsWith("data:")) return
    if (/logo|avatar|icon|banner|ads|placeholder|loading|favicon|emoji/i.test(a)) return
    seen.add(a)
    images.push({ index: images.length + 1, url: a })
  }

  // Selector reader umum
  const readerSelectors = [
    "#readerarea img",
    ".chapter-content img",
    ".reading-content img",
    ".entry-content img",
    ".main-reading img",
    "#chimg img",
    ".chimg img",
    ".maincontent img"
  ]

  for (const sel of readerSelectors) {
    $(sel).each((_, el) => {
      push($(el).attr("src"))
      push($(el).attr("data-lazy-src"))
      push($(el).attr("data-src"))
      push($(el).attr("data-original"))
    })
    if (images.length > 0) break
  }

  // Fallback: semua img
  if (images.length < 2) {
    $("img").each((_, el) => {
      push($(el).attr("src"))
      push($(el).attr("data-lazy-src"))
      push($(el).attr("data-src"))
    })
  }

  const prev = $("a[href*='chapter']:contains('Prev')").attr("href") ||
               $("a:contains('Previous')").attr("href") ||
               $(".naveps a, .chapter-nav a").eq(0).attr("href") || null
  const next = $("a[href*='chapter']:contains('Next')").attr("href") ||
               $("a:contains('Next')").attr("href") ||
               $(".naveps a, .chapter-nav a").eq(1).attr("href") || null

  return {
    url: abs,
    title: title || null,
    komikLink: absoluteUrl(komikLink),
    imageCount: images.length,
    images,
    prevChapter: absoluteUrl(prev),
    nextChapter: absoluteUrl(next)
  }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    let result

    if (!cmd || cmd === "latest") {
      const page = Number(args[1] || 1)
      result = { mode: "latest", ...(await latest(page)) }
    } else if (cmd === "search") {
      result = { mode: "search", ...(await search(args.slice(1).join(" "))) }
    } else if (cmd === "detail") {
      result = { mode: "detail", ...(await detail(args[1])) }
    } else if (cmd === "chapter" || cmd === "ch") {
      result = { mode: "chapter", ...(await chapter(args[1])) }
    } else {
      throw new Error([
        "Perintah:",
        "  node bacakomik.js latest [page]",
        '  node bacakomik.js search "<judul>"',
        '  node bacakomik.js detail "<url_komik>"',
        '  node bacakomik.js chapter "<url_chapter>"'
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()