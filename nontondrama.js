/*
**scrape nontondrama**
**author skrep: xvlovers**
*git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/nontondrama.js *
**base URL: https://tv9.nontondrama.my**
**credit: *xv***
*chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E *

*/

const axios = require("axios")
const cheerio = require("cheerio")
const https = require("https")

const BASE = "https://tv9.nontondrama.my"
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

function parseList($, scope) {
  const items = []
  const seen = new Set()
  $(scope).find("article[itemscope]").each((_, el) => {
    const $el = $(el)
    const $a = $el.find("figure a[itemprop='url']").first()
    const href = $a.attr("href")
    if (!href || seen.has(href)) return
    seen.add(href)
    const title = clean($el.find("h3.poster-title").text()) || clean($el.find("img").attr("title"))
    const rating = clean($el.find("[itemprop='ratingValue']").text()) || clean($el.find(".rating").text().replace(/[^\d.]/g, ""))
    const ratingCount = clean($el.find("meta[itemprop='ratingCount']").attr("content"))
    const year = clean($el.find("[itemprop='datePublished']").text())
    const episode = clean($el.find(".episode strong").text())
    const season = clean($el.find(".duration").text())
    const genre = clean($el.find("figcaption .genre").text()) || clean($el.find("meta[itemprop='genre']").attr("content"))
    const poster = clean($el.find("img.lazyload").attr("data-src")) || clean($el.find("img").attr("src"))
    items.push({
      title,
      slug: href,
      url: absUrl(href),
      poster,
      rating: rating ? parseFloat(rating) : null,
      rating_count: ratingCount ? parseInt(ratingCount) : null,
      year: year ? parseInt(year) : null,
      episode: episode ? parseInt(episode) : null,
      season,
      genre
    })
  })
  return items
}

async function fetchPage(path) {
  const url = path.startsWith("http") ? path : BASE + path
  const { data, status } = await client.get(url)
  if (status !== 200) throw new Error(`HTTP ${status} untuk ${url}`)
  return cheerio.load(data)
}

async function getHome() {
  const $ = await fetchPage("/")
  const sections = {}
  $(".widget").each((_, el) => {
    const $w = $(el)
    const title = clean($w.find(".header h2").first().text())
    const items = parseList($, $w)
    if (title && items.length) sections[title] = items
  })
  const latest = parseList($, "#post-container")
  return { sections, latest }
}

async function getList(path) {
  const $ = await fetchPage(path)
  const items = parseList($, "#post-container").length ? parseList($, "#post-container") : parseList($, "body")
  const next = $("a#linkToRelease").attr("href") || null
  return { items, next: next ? absUrl(next) : null }
}

async function search(query) {
  const $ = await fetchPage(`/search?s=${encodeURIComponent(query)}`)
  const items = parseList($, "#post-container").length ? parseList($, "#post-container") : parseList($, "body")
  return { query, items }
}

function parseJsonScript($, id) {
  const raw = $(`script#${id}`).html()
  if (!raw) return null
  try {
    return JSON.parse(raw.trim())
  } catch (e) {
    return null
  }
}

function parseJsonLd($) {
  const scripts = $("script[type='application/ld+json']").toArray()
  for (const el of scripts) {
    try {
      const obj = JSON.parse($(el).html())
      if (obj && obj["@type"] === "TVSeries") return obj
    } catch (e) {}
  }
  return null
}

async function getDetail(slug) {
  const path = slug.startsWith("http") ? slug : (slug.startsWith("/") ? slug : "/" + slug)
  const $ = await fetchPage(path)

  const jsonld = parseJsonLd($)
  const seasonData = parseJsonScript($, "season-data")
  const watchData = parseJsonScript($, "watch-history-data")

  const h1 = clean($(".movie-info h1").first().text())
  const title = h1 ? h1.replace(/\s*\(\d{4}\)\s*$/, "").trim() : (jsonld ? jsonld.name : null)

  const infoTags = $(".info-tag span").map((_, e) => clean($(e).text())).get().filter(Boolean)
  const releaseDate = infoTags[0] || null
  const region = infoTags[1] || null
  const status = infoTags[2] || null

  const countries = $(".tag-list .tag a[href^='/country/']").map((_, e) => clean($(e).text())).get().filter(Boolean)
  const genres = $(".tag-list .tag a[href^='/genre/']").map((_, e) => clean($(e).text())).get().filter(Boolean)

  const ratingRaw = clean($(".rating-number").attr("data-base-rating")) || clean($(".rating-number").text())
  const votesRaw = clean($(".rating-users").attr("data-base-votes")) || clean($(".rating-users").text().replace(/[^\d]/g, ""))

  const synopsis = clean($(".synopsis").first().text())

  let director = []
  let cast = []
  $(".detail p").each((_, el) => {
    const $p = $(el)
    const label = clean($p.find("span").first().text()) || ""
    const links = $p.find("a").map((_, a) => clean($(a).text())).get().filter(Boolean)
    if (/sutradara/i.test(label)) director = links
    if (/bintang/i.test(label)) cast = links
  })

  const poster = clean($("meta[property='og:image']").attr("content")) ||
    clean($(".detail img.lazyload").attr("data-src")) ||
    clean($(".detail img").attr("src")) ||
    (jsonld ? jsonld.image : null)

  let year = watchData ? watchData.year : null
  if (!year && releaseDate) {
    const m = releaseDate.match(/\b(19|20)\d{2}\b/)
    if (m) year = parseInt(m[0])
  }
  if (!year && jsonld && jsonld.datePublished) {
    const m = String(jsonld.datePublished).match(/\b(19|20)\d{2}\b/)
    if (m) year = parseInt(m[0])
  }

  const episodes = []
  if (seasonData && typeof seasonData === "object") {
    for (const [seasonKey, eps] of Object.entries(seasonData)) {
      if (!Array.isArray(eps)) continue
      for (const ep of eps) {
        episodes.push({
          season: ep.s || parseInt(seasonKey),
          episode: ep.episode_no,
          title: ep.title,
          slug: ep.slug,
          url: absUrl("/" + ep.slug)
        })
      }
    }
  }

  const playFirst = $(".movie-action a[href*='episode-1']").first().attr("href")
  const playLinks = $(".movie-action a").map((_, a) => $(a).attr("href")).get().filter(h => h && /episode/.test(h))
  const playLatest = playLinks[playLinks.length - 1] || null

  const related = parseList($, ".mob-related-series")

  return {
    title,
    slug: path,
    url: absUrl(path),
    poster,
    synopsis,
    rating: ratingRaw ? parseFloat(ratingRaw) : null,
    rating_count: votesRaw ? parseInt(votesRaw) : null,
    year,
    release_date: releaseDate,
    region,
    status,
    country: countries.length ? countries : null,
    genre: genres.length ? genres : (jsonld && jsonld.genre ? jsonld.genre : null),
    director: director.length ? director : (jsonld && jsonld.director ? jsonld.director.map(d => d.name) : null),
    cast: cast.length ? cast : (jsonld && jsonld.actor ? jsonld.actor.map(a => a.name) : null),
    total_episodes: watchData ? watchData.total_eps : null,
    total_seasons: watchData ? watchData.total_season : null,
    play_first: playFirst ? absUrl(playFirst) : null,
    play_latest: playLatest ? absUrl(playLatest) : null,
    episodes: episodes.length ? episodes : null,
    related: related.length ? related : null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = (args[0] || "home").toLowerCase()
  const input = args.slice(1).join(" ").trim()

  try {
    let data
    if (cmd === "home") data = await getHome()
    else if (cmd === "latest") data = await getList("/latest-series")
    else if (cmd === "popular") data = await getList("/populer/")
    else if (cmd === "rating") data = await getList("/rating/")
    else if (cmd === "movie") data = await getList("/latest")
    else if (cmd === "series") data = await getList("/latest-series")
    else if (cmd === "ongoing") data = await getList("/series/ongoing")
    else if (cmd === "complete") data = await getList("/series/complete")
    else if (cmd === "asian") data = await getList("/series/asian")
    else if (cmd === "west") data = await getList("/series/west")
    else if (cmd === "page") {
      if (!input) throw new Error("Contoh: node nontondrama.js page /release/page/2")
      data = await getList(input)
    }
    else if (cmd === "genre") {
      if (!input) throw new Error("Contoh: node nontondrama.js genre action")
      data = await getList(`/genre/${input.toLowerCase()}`)
    }
    else if (cmd === "country") {
      if (!input) throw new Error("Contoh: node nontondrama.js country south-korea")
      data = await getList(`/country/${input.toLowerCase()}`)
    }
    else if (cmd === "year") {
      if (!input) throw new Error("Contoh: node nontondrama.js year 2026")
      data = await getList(`/year/${input}`)
    }
    else if (cmd === "search") {
      if (!input) throw new Error("Contoh: node nontondrama.js search prophet")
      data = await search(input)
    }
    else if (cmd === "detail") {
      if (!input) throw new Error("Contoh: node nontondrama.js detail /prophet-2026")
      data = await getDetail(input)
    }
    else {
      throw new Error(`Command tidak dikenal: ${cmd}\nGunakan: home | latest | popular | rating | movie | series | ongoing | complete | asian | west | page <path> | genre <slug> | country <slug> | year <year> | search <q> | detail <slug>`)
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: error.message }, null, 2))
    process.exit(1)
  }
}

main()