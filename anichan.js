/*
**scrape anichan**
**author skrep: xvlovers**
*git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/anichan.js*
**base URL: https://anichan.to**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")

const BASE = "https://anichan.to"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Referer": BASE + "/",
    "Origin": BASE
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

async function api(path, opts = {}) {
  const r = await client.request({
    method: opts.method || "GET",
    url: BASE + path,
    params: opts.params,
    data: opts.body
  })
  let data = r.data
  if (typeof data === "string") {
    try { data = JSON.parse(data) } catch (_) {}
  }
  if (r.status >= 400) {
    const msg = data?.message || data?.error || "HTTP " + r.status
    throw new Error(msg)
  }
  return data
}

function pickAnime(a) {
  if (!a) return null
  return {
    id: a.id ?? null,
    idMal: a.idMal ?? null,
    title: a.title ?? null,
    titleRomaji: a.titleRomaji ?? null,
    titleNative: a.titleNative ?? null,
    synonyms: a.synonyms ?? [],
    poster: a.poster ?? null,
    banner: a.banner ?? null,
    description: a.description ?? null,
    format: a.format ?? null,
    status: a.status ?? null,
    episodes: a.episodes ?? null,
    duration: a.duration ?? null,
    score: a.score ?? null,
    popularity: a.popularity ?? null,
    favourites: a.favourites ?? null,
    genres: a.genres ?? [],
    studios: a.studios ?? [],
    season: a.season ?? null,
    seasonYear: a.seasonYear ?? null,
    startDate: a.startDate ?? null,
    endDate: a.endDate ?? null,
    trailer: a.trailer ?? null,
    selfhost: a.selfhost ?? null,
    eps: a.eps ?? null,
    nextAiringEpisode: a.nextAiringEpisode ?? null
  }
}

function normalizeList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.anime)) return data.anime
  return []
}

async function trending() {
  const d = await api("/api/catalog/trending")
  return normalizeList(d).map(pickAnime)
}

async function airing() {
  const d = await api("/api/catalog/airing")
  return normalizeList(d).map(pickAnime)
}

async function animeDetail(anilistId) {
  if (!anilistId) throw new Error("anilistId wajib")
  const d = await api("/api/catalog/anime/" + encodeURIComponent(anilistId))
  return d?.anime ? pickAnime(d.anime) : pickAnime(d)
}

async function search(q) {
  if (!q) throw new Error("Query kosong")
  let d
  try {
    d = await api("/api/search", { params: { q } })
  } catch (_) {
    d = await api("/api/suggest", { params: { q } })
  }
  return normalizeList(d).map(pickAnime)
}

async function suggest(q) {
  if (!q) throw new Error("Query kosong")
  const d = await api("/api/suggest", { params: { q } })
  return normalizeList(d).map(a => ({
    id: a.id ?? null,
    title: a.title ?? null,
    poster: a.poster ?? null,
    format: a.format ?? null,
    seasonYear: a.seasonYear ?? null
  }))
}

async function episodes(anilistId) {
  if (!anilistId) throw new Error("anilistId wajib")
  return await api("/api/watch/episodes", { params: { anilistId } })
}

async function servers(anilistId) {
  if (!anilistId) throw new Error("anilistId wajib")
  return await api("/api/watch/servers", { params: { anilistId } })
}

async function comments(animeId, limit = 30) {
  if (!animeId) throw new Error("animeId wajib")
  return await api("/api/comments", { params: { anime_id: animeId, limit } })
}

async function siteConfig() {
  return await api("/site-config")
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    const param = args[1]
    const extra = args[2]

    let result

    if (cmd === "trending") {
      result = { mode: "trending", items: await trending() }
    } else if (cmd === "airing") {
      result = { mode: "airing", items: await airing() }
    } else if (cmd === "search") {
      result = { mode: "search", query: param, results: await search(param) }
    } else if (cmd === "suggest") {
      result = { mode: "suggest", query: param, results: await suggest(param) }
    } else if (cmd === "detail") {
      result = { mode: "detail", id: param, anime: await animeDetail(param) }
    } else if (cmd === "episodes") {
      result = { mode: "episodes", anilistId: param, data: await episodes(param) }
    } else if (cmd === "servers") {
      result = { mode: "servers", anilistId: param, data: await servers(param) }
    } else if (cmd === "comments") {
      result = { mode: "comments", animeId: param, limit: extra || 30, data: await comments(param, Number(extra || 30)) }
    } else if (cmd === "config") {
      result = { mode: "config", data: await siteConfig() }
    } else if (cmd === "full") {
      const id = param
      const detail = await animeDetail(id)
      const eps = await episodes(id).catch(() => null)
      const srv = await servers(id).catch(() => null)
      result = { mode: "full", anime: detail, episodes: eps, servers: srv }
    } else {
      throw new Error([
        "Perintah:",
        "  node anichan.js trending",
        "  node anichan.js airing",
        '  node anichan.js search "<judul>"',
        '  node anichan.js suggest "<judul>"',
        "  node anichan.js detail <anilistId>",
        "  node anichan.js episodes <anilistId>",
        "  node anichan.js servers <anilistId>",
        "  node anichan.js comments <animeId> [limit]",
        "  node anichan.js full <anilistId>",
        "  node anichan.js config"
      ].join("\n"))
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: result
    }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: error.message
    }, null, 2))
    process.exit(1)
  }
}

main()