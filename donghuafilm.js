/*
* scrape donghuafilm *
* author skrep: xvlovers *
* git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/donghuafilm.js *
* base URL: https://donghuafilm.com *
* credit: xv *
* chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E *

*/

const axios = require("axios")
const cheerio = require("cheerio")
const https = require("https")

const BASE = "https://donghuafilm.com"
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
  return String(str).replace(/\s+/g, " ").trim() || null
}

function absUrl(href) {
  if (!href) return null
  if (href.startsWith("http")) return href
  return BASE + (href.startsWith("/") ? href : "/" + href)
}

function isUrl(input) {
  return typeof input === "string" && /^https?:\/\//i.test(input.trim())
}

function parseList($, scope) {
  const items = []
  const seen = new Set()
  $(scope).find("article.bs").each((_, el) => {
    const $el = $(el)
    const $a = $el.find("a[itemprop='url']").first()
    const href = $a.attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)

    const $img = $el.find("img.ts-post-image").first()
    const poster = clean($img.attr("data-src")) || clean($img.attr("src"))
    const headline = clean($el.find("h2[itemprop='headline']").text()) || clean($a.attr("title"))
    const series = clean($el.find(".tt").clone().children().remove().end().text()) ||
      clean($el.find(".tt").text().split("\n").shift())
    const type = clean($el.find(".typez").text())
    const episode = clean($el.find(".epx").text())
    const sub = clean($el.find(".sb").text())
    const id = clean($a.attr("rel"))

    items.push({
      title: headline || series,
      series: series || null,
      episode: episode || null,
      type: type || null,
      sub: sub || null,
      url: absUrl(href),
      slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, ""),
      poster: poster ? absUrl(poster) : null,
      content_id: id || null
    })
  })
  return items
}

async function fetchHtml(path) {
  const url = path.startsWith("http") ? path : BASE + path
  const { data, status } = await client.get(url)
  if (status !== 200) throw new Error(`HTTP ${status} untuk ${url}`)
  return cheerio.load(data)
}

async function tryFetchHtml(path) {
  try {
    return await fetchHtml(path)
  } catch (e) {
    return null
  }
}

async function getHome() {
  const $ = await fetchHtml("/")

  const slider = []
  $("#slidertwo .swiper-slide.item").each((_, el) => {
    const $el = $(el)
    const $a = $el.find("h2 a").first()
    const href = $a.attr("href")
    if (!href) return
    const title = clean($a.attr("data-jtitle")) || clean($a.text())
    const bg = $el.find(".backdrop").attr("style") || ""
    const m = bg.match(/url\(['"]?([^'")]+)['"]?\)/)
    const backdrop = m ? m[1] : null
    const synopsis = clean($el.find(".info p").first().text())
    slider.push({
      title,
      url: absUrl(href),
      slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, ""),
      backdrop,
      synopsis
    })
  })

  const popular = []
  const sections = {}
  $(".bixbox").each((_, el) => {
    const $box = $(el)
    const title = clean($box.find(".releases h2, .releases h1").first().text())
    const items = parseList($, $box)
    if (title && items.length) {
      sections[title] = items
      if (/popular/i.test(title)) popular.push(...items)
    }
  })

  return { slider, popular, sections }
}

async function getList(path) {
  const $ = await fetchHtml(path)
  let items = parseList($, "#content")
  if (!items.length) items = parseList($, "body")
  const next = $("a.next.page-numbers, .pagination a.next").attr("href") || null
  const current = clean($(".pagination span.page-numbers.current").text())
  const total = clean($(".pagination a.page-numbers").last().text())
  return {
    items,
    next: next ? absUrl(next) : null,
    current_page: current ? parseInt(current) : 1,
    total_page: total ? total.replace(/,/g, "") : null
  }
}

async function search(query) {
  const $ = await fetchHtml(`/?s=${encodeURIComponent(query)}`)
  let items = parseList($, "#content")
  if (!items.length) items = parseList($, "body")
  const heading = clean($(".releases h1, .releases h2, .bixbox h1").first().text())
  return { query, heading, total: items.length, items }
}

function parseEpisodes($) {
  const episodes = []
  const seen = new Set()
  $(".eplister ul li, .episodelist ul li, .bixbox .eplister li, .eplister a").each((_, el) => {
    const $el = $(el)
    const $a = $el.is("a") ? $el : $el.find("a").first()
    const href = $a.attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)

    let title = clean($el.find(".epl-title").text())
    let epNum = clean($el.find(".epl-num").text())
    let epDate = clean($el.find(".epl-date").text())

    if (!title) {
      const rawText = clean($a.attr("title")) || clean($a.text())
      if (rawText) {
        const m = rawText.match(/Eps\s*(\d+(?:\.\d+)?)/i) || rawText.match(/Episode\s*(\d+(?:\.\d+)?)/i)
        if (m && !epNum) epNum = m[1]
        title = rawText
      }
    }

    episodes.push({
      episode: epNum || null,
      title: title || null,
      date: epDate || null,
      url: absUrl(href),
      slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, "")
    })
  })
  return episodes
}

function parseDetailHtml($, path) {
  const title = clean($(".entry-title, h1.entry-title, .bixbox h1").first().text()) || clean($("h1").first().text())
  const poster = clean($("meta[property='og:image']").attr("content")) ||
    clean($(".thumb img, .ime img, .bigcontent img").first().attr("src")) ||
    clean($(".bixbox img").first().attr("src"))

  const synopsis = clean($(".entry-content[itemprop='description'], .desc, .contyn p, .bixbox .entry-content p, .synopsis").first().text())

  const info = {}
  $(".spe span, .infox .spe span, .anime-info span, .info-content span").each((_, el) => {
    const $el = $(el)
    let label = clean($el.find("b").text())
    if (!label) {
      const clone = $el.clone()
      clone.find("a, span, b").remove()
      label = clean(clone.text()).replace(/[:\s]+$/, "")
    }
    const value = clean($el.find("a").map((_, a) => $(a).text()).get().join(", ")) ||
      clean($el.find("span").first().text()) ||
      clean($el.clone().children().remove().end().text())
    if (label && value && label !== value) {
      const key = label.toLowerCase().replace(/[:\s]+/g, "_").replace(/^_|_$/g, "")
      if (key) info[key] = value
    }
  })

  const genres = $("a[href*='/genres/'], a[href*='/genre/']").map((_, el) => clean($(el).text())).get().filter(Boolean)
  const rating = clean($(".rating strong, .rt .rating, .numscore, .rating i").first().text())
  const status = clean($(".spe span:contains('Status'), .infox .spe span:contains('Status')").text().replace(/Status:?/i, "")) ||
    clean($(".status").text())

  const episodes = parseEpisodes($)

  return {
    title,
    slug: path,
    url: absUrl(path),
    poster,
    synopsis,
    rating: rating ? parseFloat(rating) : null,
    status: status || null,
    genres: genres.length ? [...new Set(genres)] : null,
    info,
    total_episodes: episodes.length || null,
    episodes: episodes.length ? episodes : null
  }
}

async function getDetail(slug) {
  const path = slug.startsWith("http") ? slug : (slug.startsWith("/") ? slug : "/" + slug)

  if (path.includes("/anime/")) {
    const $ = await tryFetchHtml(path)
    if ($) return parseDetailHtml($, path)

    const episodeSlug = path.replace(/^\/anime\//, "/")
    const $ep = await tryFetchHtml(episodeSlug)
    if ($ep) return parseDetailHtml($ep, episodeSlug)

    throw new Error(`404: ${path} (coba slug episode atau URL lengkap)`)
  }

  const $ = await tryFetchHtml(path)
  if (!$) throw new Error(`404: ${path}`)

  const $seriesLink = $(".infox a[href*='/anime/'], .info-content a[href*='/anime/'], a[href*='/anime/']").first()
  const seriesHref = $seriesLink.attr("href")

  if (seriesHref && seriesHref !== path) {
    const $series = await tryFetchHtml(seriesHref)
    if ($series) {
      const detail = parseDetailHtml($series, seriesHref)
      if (!detail.episodes) {
        const epsFromEp = parseEpisodes($)
        if (epsFromEp.length) detail.episodes = epsFromEp
        detail.total_episodes = detail.episodes ? detail.episodes.length : null
      }
      return detail
    }
  }

  return parseDetailHtml($, path)
}

async function getEpisode(url) {
  const path = url.startsWith("http") ? url : absUrl(url)
  const $ = await fetchHtml(path)

  const title = clean($(".entry-title, h1.entry-title, .bixbox h1").first().text()) || clean($("h1").first().text())
  const series = clean($(".infox a[href*='/anime/'], .info-content a[href*='/anime/']").first().text()) ||
    clean($(".ts-breadcrumb a[href*='/anime/']").last().text()) ||
    clean($(".eplister a").first().text())

  const servers = []
  $("select.mirror option, .mirror option, .server-list li, .mirrorstream ul li a").each((_, el) => {
    const $el = $(el)
    let val = clean($el.attr("value")) || clean($el.attr("data-video")) || clean($el.attr("href"))
    const label = clean($el.text())
    if (val && label) {
      let decoded = null
      try {
        const buf = Buffer.from(val, "base64")
        const str = buf.toString("utf8")
        if (str.includes("<iframe") || str.includes("http")) decoded = str
      } catch (e) {}
      servers.push({ label, value: val, decoded: decoded || null })
    }
  })

  const iframe = $("iframe").map((_, el) => $(el).attr("src")).get().filter(Boolean)

  const downloads = []
  $(".dlbox ul li a, .download-link a, .dlbox a").each((_, el) => {
    const $el = $(el)
    const href = $el.attr("href")
    const label = clean($el.text())
    if (href && label) downloads.push({ label, url: absUrl(href) })
  })

  const prev = clean($("a.prev, .naveps .nvs a[rel='prev']").attr("href"))
  const next = clean($("a.next, .naveps .nvs a[rel='next']").attr("href"))

  return {
    title,
    series: series || null,
    url: absUrl(path),
    servers: servers.length ? servers : null,
    iframes: iframe.length ? iframe : null,
    downloads: downloads.length ? downloads : null,
    prev: prev ? absUrl(prev) : null,
    next: next ? absUrl(next) : null
  }
}

async function getSchedule() {
  const $ = await fetchHtml("/segera-tayang/")
  const items = []
  $(".bixbox, .schedule-list, .jadwal").each((_, el) => {
    const $el = $(el)
    const day = clean($el.find(".releases h2, .releases h1, h2").first().text())
    const list = parseList($, $el)
    if (list.length) items.push({ day: day || null, items: list })
  })
  if (!items.length) {
    const list = parseList($, "#content")
    if (list.length) items.push({ day: null, items: list })
  }
  return items
}

async function getAzList(letter) {
  const path = letter ? `/az-list/?show=${encodeURIComponent(letter)}` : "/az-list/"
  const $ = await fetchHtml(path)
  let items = parseList($, "#content")
  if (!items.length) items = parseList($, "body")
  return { letter: letter || null, items }
}

async function resolve(input) {
  if (!input) throw new Error("Contoh: node donghuafilm.js resolve https://donghuafilm.com/apa-saja/")
  const url = isUrl(input) ? input : absUrl(input)

  if (/\/anime\//.test(url)) {
    const data = await getDetail(url)
    return { type: "anime", data }
  }

  if (/episode|subtitle-indonesia|\/\d{3,}/.test(url)) {
    const data = await getEpisode(url)
    return { type: "episode", data }
  }

  const $ = await fetchHtml(url)
  if ($("article.bs").length) {
    const items = parseList($, "#content").length ? parseList($, "#content") : parseList($, "body")
    return { type: "list", data: { url: absUrl(url), items } }
  }

  const detail = parseDetailHtml($, url)
  if (detail.episodes && detail.episodes.length) return { type: "anime", data: detail }

  throw new Error(`Tidak bisa deteksi tipe URL: ${url}`)
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = (args[0] || "home").toLowerCase()
  const input = args.slice(1).join(" ").trim()

  try {
    let data
    if (cmd === "home") data = await getHome()
    else if (cmd === "anime") data = await getList("/anime/?status=&type=&order=update")
    else if (cmd === "latest") data = await getList("/anime/?status=&type=&order=update")
    else if (cmd === "popular") data = await getList("/anime/?status=&type=&order=popular")
    else if (cmd === "ongoing") data = await getList("/anime/?status=ongoing&type=&order=update")
    else if (cmd === "complete") data = await getList("/anime/?status=completed&type=&order=update")
    else if (cmd === "movie") data = await getList("/anime/?status=&type=movie&order=update")
    else if (cmd === "page") {
      if (!input) throw new Error("Contoh: node donghuafilm.js page /anime/page/2/")
      data = await getList(input)
    }
    else if (cmd === "search") {
      if (!input) throw new Error("Contoh: node donghuafilm.js search \"swallowed star\"")
      data = await search(input)
    }
    else if (cmd === "detail") {
      if (!input) throw new Error("Contoh: node donghuafilm.js detail /anime/swallowed-star/\nAtau: node donghuafilm.js detail swallowed-star-episode-242-subtitle-indonesia")
      data = await getDetail(input)
    }
    else if (cmd === "episode") {
      if (!input) throw new Error("Contoh: node donghuafilm.js episode /swallowed-star-episode-242-subtitle-indonesia/")
      data = await getEpisode(input)
    }
    else if (cmd === "resolve") {
      if (!input) throw new Error("Contoh: node donghuafilm.js resolve https://donghuafilm.com/apa-saja/")
      data = await resolve(input)
    }
    else if (cmd === "jadwal" || cmd === "schedule") data = await getSchedule()
    else if (cmd === "az") data = await getAzList(input || null)
    else {
      throw new Error(`Command tidak dikenal: ${cmd}\nGunakan: home | anime | latest | popular | ongoing | complete | movie | page <path> | search <q> | detail <slug|url> | episode <url> | resolve <url> | jadwal | az [A|B|0-9]`)
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: error.message }, null, 2))
    process.exit(1)
  }
}

main()