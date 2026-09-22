/*
**scrape anichin**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/anichin.js**
**base URL: https://anichin.moe**
**credit: **
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const cheerio = require("cheerio")

const BASE = "https://anichin.moe"
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

function decodeBase64Iframe(str) {
  if (!str) return null
  try {
    const decoded = Buffer.from(str, "base64").toString("utf8")
    if (!/^<iframe/i.test(decoded.trim())) return null
    const src = decoded.match(/src=["']([^"']+)["']/i)
    return src ? src[1] : null
  } catch (_) {
    return null
  }
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
    const link = $el.find("a[href]").first().attr("href") || null
    if (!link || seen.has(link)) return
    seen.add(link)

    const title = clean($el.find("h2, h3, h4, .tt, .title, a[title]").first().text()) ||
                  clean($el.find("a[title]").attr("title"))
    const img = $el.find("img").first().attr("src") ||
                $el.find("img").first().attr("data-lazy-src") ||
                $el.find("img").first().attr("data-src") || null
    const ep = clean($el.find(".epx, .epxs, .limit").first().text())
    const type = clean($el.find(".typeflag, .type").first().text())
    const status = clean($el.find(".status").first().text())

    if (!title) return
    out.push({
      title,
      url: absoluteUrl(link),
      image: absoluteUrl(img),
      episode: ep || null,
      type: type || null,
      status: status || null
    })
  })
  return out
}

async function latest(page = 1) {
  const url = page > 1 ? BASE + "/page/" + page + "/" : BASE + "/"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, .bixbox .bs, article.bs, .serieslist li")
  return { page, url, count: items.length, items }
}

async function ongoing() {
  const html = await fetchHtml(BASE + "/ongoing/")
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, .bixbox .bs, article.bs")
  return { url: BASE + "/ongoing/", count: items.length, items }
}

async function completed() {
  const html = await fetchHtml(BASE + "/completed/")
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, .bixbox .bs, article.bs")
  return { url: BASE + "/completed/", count: items.length, items }
}

async function schedule() {
  const html = await fetchHtml(BASE + "/schedule/")
  const $ = cheerio.load(html)
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu", "Minggu", "Acak"]
  const out = []
  $(".bixbox").each((_, el) => {
    const $el = $(el)
    const header = clean($el.find(".releases h3, .releases h2, .releases h1").first().text())
    if (!days.includes(header)) return
    const anime = []
    $el.find(".listupd .bsx, .listupd .bs").each((__, item) => {
      const $item = $(item)
      const $a = $item.find("a[href*='/anime/'], a[href*='episode'], a[href]").first()
      const link = $a.attr("href")
      if (!link) return
      const title = clean($a.attr("title")) || clean($item.find(".tt").text())
      const img = $item.find("img").first().attr("src") || $item.find("img").first().attr("data-lazy-src") || null
      const ep = clean($item.find(".epx").first().text())
      anime.push({ title: title || null, url: absoluteUrl(link), image: absoluteUrl(img), status: ep || null })
    })
    if (anime.length) out.push({ day: header, count: anime.length, anime })
  })
  return { url: BASE + "/schedule/", dayCount: out.length, days: out }
}

async function search(query) {
  if (!query) throw new Error("Query kosong")
  const url = BASE + "/?s=" + encodeURIComponent(query)
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, .bixbox .bs, article.bs")
  return { query, url, count: items.length, items }
}

async function filter(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(x => qs.append(k + "[]", x))
    else if (v) qs.append(k, v)
  }
  const url = BASE + "/anime/?" + qs.toString()
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, .bixbox .bs, article.bs")
  return { url, params, count: items.length, items }
}

async function detail(animeUrl) {
  if (!animeUrl) throw new Error("URL donghua kosong")
  const abs = animeUrl.startsWith("http") ? animeUrl : BASE + animeUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("h1.entry-title, h1").first().text())
  const image = absoluteUrl($("meta[property='og:image']").attr("content")) ||
                absoluteUrl($(".thumb img").attr("src")) ||
                absoluteUrl($(".thumb img").attr("data-lazy-src"))
  const synopsis = clean($(".entry-content[itemprop='description'] p, .desc p, .entry-content p").first().text())

  const meta = {}
  $(".spe span, .infomanga .spe span").each((_, el) => {
    const txt = clean($(el).text())
    const idx = txt.indexOf(":")
    if (idx > 0) {
      const k = txt.slice(0, idx).trim().toLowerCase()
      const v = txt.slice(idx + 1).trim()
      if (k && v) meta[k] = v
    }
  })

  const genres = $(".genxed a, .mgen a, .genres a").map((_, el) => clean($(el).text())).get().filter(Boolean)

  const episodes = []
  const seen = new Set()
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    if (!/episode/i.test(href)) return
    const absHref = absoluteUrl(href)
    if (!absHref || seen.has(absHref)) return
    seen.add(absHref)
    const label = clean($(el).text())
    const m = label.match(/(\d+|end|END|movie)/i)
    episodes.push({ url: absHref, episode: m ? m[1] : null, label: label || null })
  })

  return {
    url: abs,
    title: title || null,
    image,
    synopsis: synopsis || null,
    status: meta.status || null,
    type: meta.type || meta.tipe || null,
    released: meta.released || meta.rilis || null,
    studio: meta.studio || null,
    genres,
    episodeCount: episodes.length,
    episodes
  }
}

async function episode(epUrl) {
  if (!epUrl) throw new Error("URL episode kosong")
  const abs = epUrl.startsWith("http") ? epUrl : BASE + epUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("h1.entry-title, h1").first().text())
  const animeLink = $("a[href*='/anime/'], a[href*='/series/']").first().attr("href") || null

  const streams = []
  const seen = new Set()

  $("iframe").each((_, el) => {
    const src = $(el).attr("src")
    if (src && !seen.has(src)) { seen.add(src); streams.push({ source: "iframe", url: src, label: null }) }
  })

  $("select option").each((_, el) => {
    const val = $(el).attr("value") || ""
    const label = clean($(el).text())
    const decoded = decodeBase64Iframe(val)
    if (decoded && !seen.has(decoded)) { seen.add(decoded); streams.push({ source: "option", url: decoded, label: label || null }) }
  })

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    const text = clean($(el).text())
    if (/mirrored|terabox|krakenfiles|mediafire|mypikpak|filepress|acefile|pixeldrain|gdrive|mega\.nz|safelink/i.test(href + " " + text)) {
      if (!seen.has(href)) { seen.add(href); streams.push({ source: "download", url: href, label: text || null }) }
    }
  })

  const downloads = []
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    const text = clean($(el).text())
    if (/(480p|720p|1080p|360p|\.mkv|\.mp4|\.zip)/i.test(text) || /safelinkearn/i.test(href)) {
      downloads.push({ url: href, label: text || null })
    }
  })

  return {
    url: abs,
    title: title || null,
    animeLink: absoluteUrl(animeLink),
    streams,
    downloads,
    streamCount: streams.length,
    downloadCount: downloads.length
  }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    let result

    if (!cmd || cmd === "latest") {
      result = { mode: "latest", ...(await latest(Number(args[1] || 1))) }
    } else if (cmd === "ongoing") {
      result = { mode: "ongoing", ...(await ongoing()) }
    } else if (cmd === "completed") {
      result = { mode: "completed", ...(await completed()) }
    } else if (cmd === "schedule") {
      result = { mode: "schedule", ...(await schedule()) }
    } else if (cmd === "search") {
      result = { mode: "search", ...(await search(args.slice(1).join(" "))) }
    } else if (cmd === "filter") {
      const params = {}
      for (const a of args.slice(1)) {
        const [k, v] = a.split("=")
        if (k && v) {
          if (k.endsWith("[]")) {
            const key = k.slice(0, -2)
            if (!params[key]) params[key] = []
            params[key].push(v)
          } else params[k] = v
        }
      }
      result = { mode: "filter", ...(await filter(params)) }
    } else if (cmd === "detail") {
      result = { mode: "detail", ...(await detail(args[1])) }
    } else if (cmd === "episode" || cmd === "ep") {
      result = { mode: "episode", ...(await episode(args[1])) }
    } else {
      throw new Error([
        "Perintah:",
        "  node anichin.js latest [page]",
        "  node anichin.js ongoing",
        "  node anichin.js completed",
        "  node anichin.js schedule",
        '  node anichin.js search "<judul>"',
        '  node anichin.js filter "genre[]=action" "status=ongoing" "type=donghua" "order=update"',
        '  node anichin.js detail "<url_donghua>"',
        '  node anichin.js episode "<url_episode>"'
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()