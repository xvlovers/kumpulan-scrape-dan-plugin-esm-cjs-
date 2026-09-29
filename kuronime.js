/*
* scrape kuronime *
* author skrep: xvlovers *
* git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/kuronime.js *
* base URL: https://kuronime.sbs *
* credit: xv *
* chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E *

*/

const axios = require("axios")
const cheerio = require("cheerio")
const https = require("https")

const BASE = "https://kuronime.sbs"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 20000,
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

function parseCount(str) {
  if (!str) return null
  const s = String(str).replace(/,/g, "").trim()
  const n = parseInt(s)
  return isNaN(n) ? null : n
}

function parseEpisodeItem($, el) {
  const $el = $(el)
  const $a = $el.find("a[itemprop='url']").first()
  const $link = $a.length ? $a : $el.find("a").first()
  const href = $link.attr("href")
  if (!href) return null

  const $img = $el.find("img[itemprop='image']").first()
  const poster = clean($img.attr("src")) || clean($img.attr("data-src"))

  const series = clean($el.find(".bsuxtt h2, .tt h2, h2").first().text())
  const headline = clean($el.find("h2[itemprop='headline']").text())
  const episode = clean($el.find(".bt .ep").text())
  const time = clean($el.find(".bt .time").text())
  const views = parseCount($el.find(".post-views-count").text())
  const type = clean($el.find(".bt span.type").text())
  const rating = clean($el.find(".rating i").text())

  return {
    title: headline || series,
    series: series || null,
    episode: episode || null,
    type: type || null,
    url: absUrl(href),
    slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, ""),
    poster: poster ? absUrl(poster) : null,
    views,
    time,
    rating: rating ? parseFloat(rating) : null
  }
}

function parseSeriesItem($, el) {
  const $el = $(el)
  const $a = $el.find("a[itemprop='url']").first()
  const href = $a.attr("href")
  if (!href) return null
  const $img = $el.find("img[itemprop='image']").first()
  const poster = clean($img.attr("src")) || clean($img.attr("data-src"))
  const title = clean($el.find("h2[itemprop='headline']").text()) || clean($a.attr("title"))
  const type = clean($el.find(".bt span.type").text())
  const rating = clean($el.find(".rating i").text())
  const ratingRaw = clean($el.find(".rating .score").attr("data-current-rating"))
  const status = clean($el.find(".bt .status, .bt .ep").text())

  return {
    title,
    type: type || null,
    url: absUrl(href),
    slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, ""),
    poster: poster ? absUrl(poster) : null,
    rating: rating ? parseFloat(rating) : null,
    rating_raw: ratingRaw ? parseFloat(ratingRaw) : null,
    status: status || null
  }
}

async function fetchHtml(path) {
  const url = path.startsWith("http") ? path : BASE + path
  const { data, status } = await client.get(url)
  if (status !== 200) throw new Error(`HTTP ${status} untuk ${url}`)
  return cheerio.load(data)
}

async function getHome() {
  const $ = await fetchHtml("/")

  const newEpisodes = []
  const topEpisodes = []
  const newSeries = []
  const topAnime = []

  const boxes = $(".bixbox").toArray()
  for (const box of boxes) {
    const $box = $(box)
    const title = clean($box.find(".releases h1, .releases span").first().text())
    const articles = $box.find("article.bsu").toArray()
    if (title && /new episodes/i.test(title)) {
      articles.forEach(el => {
        const it = parseEpisodeItem($, el)
        if (it) newEpisodes.push(it)
      })
      continue
    }
    if (title && /top episodes/i.test(title)) {
      articles.forEach(el => {
        const it = parseEpisodeItem($, el)
        if (it) topEpisodes.push(it)
      })
      continue
    }
    if (title && /new anime series/i.test(title)) {
      $box.find("article.bs").each((_, el) => {
        const it = parseSeriesItem($, el)
        if (it) newSeries.push(it)
      })
    }
  }

  $("#sidebar .serieslist li").each((_, el) => {
    const $el = $(el)
    const $a = $el.find("a.series").first()
    const href = $a.attr("href")
    if (!href) return
    const rank = clean($el.find(".ctr").text())
    const title = clean($el.find("h2 a").text())
    const genres = $el.find(".leftseries span a[rel='tag']").map((_, a) => clean($(a).text())).get().filter(Boolean)
    const $img = $el.find(".imgseries img").first()
    const poster = clean($img.attr("src")) || clean($img.attr("data-src"))
    topAnime.push({
      rank: rank ? parseInt(rank) : null,
      title,
      url: absUrl(href),
      slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, ""),
      poster: poster ? absUrl(poster) : null,
      genres: genres.length ? genres : null
    })
  })

  return {
    new_episodes: newEpisodes,
    top_episodes: topEpisodes,
    new_series: newSeries,
    top_anime: topAnime
  }
}

async function getAnimeList(page = 1) {
  const path = page > 1 ? `/anime/page/${page}/?status=&type=&order=latest` : "/anime/?status=&type=&order=latest"
  const $ = await fetchHtml(path)
  const items = []
  $("article.bs").each((_, el) => {
    const it = parseSeriesItem($, el)
    if (it) items.push(it)
  })
  const next = $("a.next.page-numbers").attr("href") || null
  const total = clean($(".pagination a.page-numbers").last().text())
  return { items, next: next ? absUrl(next) : null, total_page: total || null }
}

async function getEpisodeList(path) {
  const $ = await fetchHtml(path)
  const items = []
  $("article.bsu").each((_, el) => {
    const it = parseEpisodeItem($, el)
    if (it) items.push(it)
  })
  if (!items.length) {
    $("article.bs").each((_, el) => {
      const it = parseSeriesItem($, el)
      if (it) items.push(it)
    })
  }
  const next = $("a.next.page-numbers").attr("href") || null
  const heading = clean($(".releases h1, .releases span").first().text())
  const total = clean($(".pagination a.page-numbers").last().text())
  return { heading, items, next: next ? absUrl(next) : null, total_page: total || null }
}

async function search(query) {
  const $ = await fetchHtml(`/?s=${encodeURIComponent(query)}`)
  const series = []
  const episodes = []
  $("article.bs").each((_, el) => {
    const it = parseSeriesItem($, el)
    if (it) series.push(it)
  })
  $("article.bsu").each((_, el) => {
    const it = parseEpisodeItem($, el)
    if (it) episodes.push(it)
  })
  return { query, series, episodes }
}

async function getDetail(slug) {
  const path = slug.startsWith("http") ? slug : (slug.startsWith("/") ? slug : "/anime/" + slug.replace(/^anime\//, "") + "/")
  const $ = await fetchHtml(path)

  const title = clean($(".entry-title, .jdlx h1, h1").first().text())
  const poster = clean($("meta[property='og:image']").attr("content")) || clean($(".thumb img, .ime img").first().attr("src"))
  const synopsis = clean($(".entry-content[itemprop='description'], .desc, .sinopsis, .entry-content p").first().text())

  const info = {}
  $(".spe span, .info span, .anime-info span").each((_, el) => {
    const $el = $(el)
    const label = clean($el.find("b").text()) || clean($el.text().split(":")[0])
    const value = clean($el.find("a").map((_, a) => $(a).text()).get().join(", ")) || clean($el.text().replace(/^[^:]+:\s*/, ""))
    if (label && value && label !== value) info[label.toLowerCase().replace(/\s+/g, "_")] = value
  })

  const genres = $("a[href*='/genres/']").map((_, el) => clean($(el).text())).get().filter(Boolean)
  const rating = clean($(".rating i, .rtg i").first().text())

  const episodes = []
  $(".lchx a, .episodelist a, ul.eps a").each((_, el) => {
    const $a = $(el)
    const href = $a.attr("href")
    if (!href) return
    const epTitle = clean($a.text())
    episodes.push({ title: epTitle, url: absUrl(href), slug: href.replace(BASE, "").replace(/^\//, "").replace(/\/$/, "") })
  })

  return {
    title,
    slug: path,
    url: absUrl(path),
    poster,
    synopsis,
    rating: rating ? parseFloat(rating) : null,
    genres: genres.length ? [...new Set(genres)] : null,
    info,
    total_episodes: episodes.length || null,
    episodes: episodes.length ? episodes : null
  }
}

async function getEpisode(url) {
  const $ = await fetchHtml(url)
  const title = clean($(".entry-title, h1").first().text())
  const servers = []
  $("select option[value], .mirror option, .server-list li").each((_, el) => {
    const $el = $(el)
    const val = $el.attr("value")
    const label = clean($el.text())
    if (val && label) servers.push({ label, value: val })
  })
  const iframe = $("iframe").map((_, el) => $(el).attr("src")).get().filter(Boolean)
  return { title, url: absUrl(url), servers: servers.length ? servers : null, iframes: iframe.length ? iframe : null }
}

async function getGenreList() {
  const $ = await fetchHtml("/genres/")
  const items = []
  $("a[href*='/genres/']").each((_, el) => {
    const $a = $(el)
    const href = $a.attr("href")
    if (!href || href === "/genres/") return
    const name = clean($a.text())
    if (!name) return
    items.push({ name, slug: href.replace(BASE, "").replace(/^\/genres\//, "").replace(/\/$/, ""), url: absUrl(href) })
  })
  const unique = []
  const seen = new Set()
  for (const it of items) {
    if (seen.has(it.slug)) continue
    seen.add(it.slug)
    unique.push(it)
  }
  return unique
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = (args[0] || "home").toLowerCase()
  const input = args.slice(1).join(" ").trim()

  try {
    let data
    if (cmd === "home") data = await getHome()
    else if (cmd === "anime") data = await getAnimeList(parseInt(input) || 1)
    else if (cmd === "search") {
      if (!input) throw new Error("Contoh: node kuronime.js search one piece")
      data = await search(input)
    }
    else if (cmd === "detail") {
      if (!input) throw new Error("Contoh: node kuronime.js detail one-piece-op")
      data = await getDetail(input)
    }
    else if (cmd === "episode") {
      if (!input) throw new Error("Contoh: node kuronime.js episode /nonton-one-piece-episode-1180/")
      data = await getEpisode(input)
    }
    else if (cmd === "genres") data = await getGenreList()
    else if (cmd === "ongoing") data = await getEpisodeList("/ongoing-anime/")
    else if (cmd === "popular") data = await getEpisodeList("/popular-anime/")
    else if (cmd === "jadwal") data = await getEpisodeList("/jadwal-rilis/")
    else if (cmd === "list") {
      if (!input) throw new Error("Contoh: node kuronime.js list /anime/?status=&type=&order=latest")
      data = await getEpisodeList(input)
    }
    else {
      throw new Error(`Command tidak dikenal: ${cmd}\nGunakan: home | anime [page] | search <q> | detail <slug> | episode <url> | genres | ongoing | popular | jadwal | list <path>`)
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: error.message }, null, 2))
    process.exit(1)
  }
}

main()