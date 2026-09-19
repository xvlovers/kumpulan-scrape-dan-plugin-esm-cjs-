/*
**scrape animasu**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/animasu.js**
**base URL: https://animasu.love**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const cheerio = require("cheerio")

const BASE = "https://animasu.love"
const AJAX = BASE + "/wp-admin/admin-ajax.php"
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
    if (!link) return
    if (seen.has(link)) return
    seen.add(link)

    const title = clean($el.find("h2, h3, .tt, .title, a[title]").first().text()) || clean($el.find("a[title]").attr("title"))
    const img = $el.find("img").first().attr("src") || $el.find("img").first().attr("data-src") || null
    const ep = clean($el.find(".epx, .epxs, .limit").first().text())
    const type = clean($el.find(".typez, .type").first().text())
    const status = clean($el.find(".status").first().text())

    out.push({
      title: title || null,
      url: link,
      image: img,
      episode: ep || null,
      type: type || null,
      status: status || null
    })
  })
  return out
}

async function latest(page = 1) {
  const url = page > 1
    ? BASE + "/pencarian/page/" + page + "/?urutan=update"
    : BASE + "/"
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, article.bs, .bixbox .bs")
  return { page, url, count: items.length, items }
}

async function search(query) {
  if (!query) throw new Error("Query kosong")
  const url = BASE + "/?s=" + encodeURIComponent(query)
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, article.bs")
  return { query, url, count: items.length, items }
}

async function filter(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(x => qs.append(k + "[]", x))
    else if (v) qs.append(k, v)
  }
  const url = BASE + "/pencarian/?" + qs.toString()
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)
  const items = parseCards($, ".listupd .bs, .listupd .bsx, article.bs")
  return { url, params, count: items.length, items }
}

async function detail(animeUrl) {
  if (!animeUrl) throw new Error("URL anime kosong")
  const abs = animeUrl.startsWith("http") ? animeUrl : BASE + animeUrl
  const html = await fetchHtml(abs)
  const $ = cheerio.load(html)

  const title = clean($("h1.entry-title, h1").first().text())
  const image = $(".thumb img, .infomanga img, .ims img").first().attr("src") || null
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
    const cleanHref = href.replace(/^https?:\/\/[^/]+/, "")
    if (seen.has(cleanHref)) return
    seen.add(cleanHref)
    const label = clean($(el).text())
    const m = label.match(/(\d+|end|END)/)
    episodes.push({
      url: href.startsWith("http") ? href : BASE + href,
      episode: m ? m[1] : null,
      label: label || null
    })
  })

  return {
    url: abs,
    title: title || null,
    image,
    synopsis: synopsis || null,
    status: meta.status || null,
    type: meta.type || null,
    released: meta.released || meta.rilis || null,
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
  const animeLink = $("a[href*='/anime/']").first().attr("href") || null

  const streams = []
  const seen = new Set()

  $("iframe").each((_, el) => {
    const src = $(el).attr("src")
    if (src && !seen.has(src)) {
      seen.add(src)
      streams.push({ source: "iframe", url: src, label: null })
    }
  })

  $("select option").each((_, el) => {
    const val = $(el).attr("value") || ""
    const label = clean($(el).text())
    const decoded = decodeBase64Iframe(val)
    if (decoded && !seen.has(decoded)) {
      seen.add(decoded)
      streams.push({ source: "option", url: decoded, label: label || null })
    }
  })

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || ""
    const text = clean($(el).text())
    if (/upbolt|mp4upload|streamtape|dood|filemoon|ok\.ru|acefile|mega\.nz|pixeldrain|gdrive|krakenfiles|mediafire|mirror|download/i.test(href + " " + text)) {
      if (!seen.has(href)) {
        seen.add(href)
        streams.push({ source: "link", url: href, label: text || null })
      }
    }
  })

  const downloads = []
  $("a[href*='.mkv'], a[href*='.mp4'], a[href*='.zip']").each((_, el) => {
    const href = $(el).attr("href")
    const text = clean($(el).text())
    if (href) downloads.push({ url: href, label: text || null })
  })

  const prev = $("a[href*='episode']:contains('Prev')").attr("href") || null
  const next = $("a[href*='episode']:contains('Next')").attr("href") || null

  return {
    url: abs,
    title: title || null,
    animeLink,
    streams,
    downloads,
    prevEpisode: prev,
    nextEpisode: next
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
        "  node animasu.js latest [page]",
        '  node animasu.js search "<judul>"',
        '  node animasu.js filter "genre[]=action" "status=ongoing" "tipe=tv" "urutan=update"',
        '  node animasu.js detail "<url_anime>"',
        '  node animasu.js episode "<url_episode>"'
      ].join("\n"))
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: result
    }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: e.message
    }, null, 2))
    process.exit(1)
  }
}

main()