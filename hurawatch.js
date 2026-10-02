/*
* scrape hurawatch *
* author skrep: xvlovers *
* git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/hurawatch.js *
* base URL: https://hurawatch.cz *
* credit: xv *
* chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E *

*/

const axios = require("axios")
const https = require("https")

const BASE = "https://hurawatch.cz"
const TMDB = "https://api.themoviedb.org/3"
const TMDB_KEY = "9e7096a7575623aa30c66e9cc987e411"
const IMG = "https://image.tmdb.org/t/p"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 30000,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256",
    honorCipherOrder: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3"
  }),
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9,id-ID;q=0.8,id;q=0.7",
    "Origin": BASE,
    "Referer": BASE + "/"
  }
})

function clean(str) {
  if (!str) return null
  return String(str).replace(/\s+/g, " ").trim() || null
}

function imgUrl(path, size = "w500") {
  if (!path) return null
  return `${IMG}/${size}${path}`
}

function year(date) {
  if (!date) return null
  const m = String(date).match(/^(\d{4})/)
  return m ? parseInt(m[1]) : null
}

function fmtMedia(item) {
  if (!item) return null
  const isTv = item.media_type === "tv" || item.first_air_date !== undefined
  const date = item.release_date || item.first_air_date || null

  return {
    tmdb_id: item.id,
    media_type: item.media_type || (isTv ? "tv" : "movie"),
    title: clean(item.title || item.name),
    original_title: clean(item.original_title || item.original_name),
    overview: clean(item.overview),
    poster: imgUrl(item.poster_path, "w500"),
    backdrop: imgUrl(item.backdrop_path, "w1280"),
    year: year(date),
    release_date: date,
    vote_average: item.vote_average ?? null,
    vote_count: item.vote_count ?? null,
    popularity: item.popularity ?? null,
    genre_ids: item.genre_ids || null,
    original_language: item.original_language || null
  }
}

async function tmdbGet(path, params = {}) {
  const { data, status } = await client.get(`${TMDB}${path}`, {
    params: { api_key: TMDB_KEY, language: "en-US", ...params }
  })
  if (status !== 200) throw new Error(`TMDB HTTP ${status}`)
  return data
}

async function search(query, type = "multi") {
  if (!query) throw new Error("Query kosong")
  const data = await tmdbGet(`/search/${type}`, { query, include_adult: false })
  const results = (data.results || []).map(fmtMedia).filter(Boolean)
  return {
    query,
    type,
    total: data.total_results || results.length,
    page: data.page || 1,
    results
  }
}

async function trending(media = "all", window = "day") {
  const data = await tmdbGet(`/trending/${media}/${window}`)
  const results = (data.results || []).map(fmtMedia).filter(Boolean)
  return { media, window, total: results.length, results }
}

async function popular(type = "movie", page = 1) {
  const data = await tmdbGet(`/${type}/popular`, { page })
  const results = (data.results || []).map(fmtMedia).filter(Boolean)
  return { type, page: data.page, total_pages: data.total_pages, results }
}

async function topRated(type = "movie", page = 1) {
  const data = await tmdbGet(`/${type}/top_rated`, { page })
  const results = (data.results || []).map(fmtMedia).filter(Boolean)
  return { type, page: data.page, total_pages: data.total_pages, results }
}

async function detail(tmdbId, type = "movie") {
  if (!tmdbId) throw new Error("TMDB ID kosong")
  const data = await tmdbGet(`/${type}/${tmdbId}`, { append_to_response: "credits,videos,images,recommendations,similar,external_ids" })

  const genres = (data.genres || []).map(g => ({ id: g.id, name: g.name }))
  const cast = ((data.credits && data.credits.cast) || []).slice(0, 20).map(c => ({
    id: c.id,
    name: clean(c.name),
    character: clean(c.character),
    profile: imgUrl(c.profile_path, "w185"),
    order: c.order
  }))
  const crew = ((data.credits && data.credits.crew) || []).slice(0, 15).map(c => ({
    id: c.id,
    name: clean(c.name),
    job: clean(c.job),
    department: clean(c.department),
    profile: imgUrl(c.profile_path, "w185")
  }))

  let trailer = null
  if (data.videos && Array.isArray(data.videos.results)) {
    const t = data.videos.results.find(v => v.site === "YouTube" && /trailer/i.test(v.type)) ||
      data.videos.results.find(v => v.site === "YouTube")
    if (t) trailer = `https://www.youtube.com/watch?v=${t.key}`
  }

  const recommendations = ((data.recommendations && data.recommendations.results) || []).slice(0, 10)
    .map(r => fmtMedia({ ...r, media_type: type })).filter(Boolean)

  const similar = ((data.similar && data.similar.results) || []).slice(0, 10)
    .map(r => fmtMedia({ ...r, media_type: type })).filter(Boolean)

  return {
    tmdb_id: data.id,
    media_type: type,
    title: clean(data.title || data.name),
    original_title: clean(data.original_title || data.original_name),
    tagline: clean(data.tagline),
    overview: clean(data.overview),
    status: clean(data.status),
    poster: imgUrl(data.poster_path, "w500"),
    backdrop: imgUrl(data.backdrop_path, "w1280"),
    release_date: data.release_date || data.first_air_date || null,
    year: year(data.release_date || data.first_air_date),
    runtime: data.runtime || (Array.isArray(data.episode_run_time) ? data.episode_run_time[0] : null) || null,
    vote_average: data.vote_average ?? null,
    vote_count: data.vote_count ?? null,
    popularity: data.popularity ?? null,
    genres,
    production_companies: (data.production_companies || []).map(c => c.name),
    production_countries: (data.production_countries || []).map(c => c.name),
    spoken_languages: (data.spoken_languages || []).map(l => l.name),
    budget: data.budget || null,
    revenue: data.revenue || null,
    homepage: clean(data.homepage),
    imdb_id: (data.external_ids && data.external_ids.imdb_id) || data.imdb_id || null,
    number_of_seasons: data.number_of_seasons || null,
    number_of_episodes: data.number_of_episodes || null,
    seasons: (data.seasons || []).map(s => ({
      id: s.id,
      name: clean(s.name),
      season_number: s.season_number,
      episode_count: s.episode_count,
      air_date: s.air_date,
      poster: imgUrl(s.poster_path, "w342")
    })),
    cast,
    crew,
    trailer,
    recommendations,
    similar
  }
}

async function season(tmdbId, seasonNumber = 1) {
  const data = await tmdbGet(`/tv/${tmdbId}/season/${seasonNumber}`)
  return {
    tmdb_id: data.id,
    name: clean(data.name),
    season_number: data.season_number,
    overview: clean(data.overview),
    air_date: data.air_date || null,
    poster: imgUrl(data.poster_path, "w500"),
    episodes: (data.episodes || []).map(e => ({
      episode_number: e.episode_number,
      name: clean(e.name),
      overview: clean(e.overview),
      air_date: e.air_date || null,
      runtime: e.runtime || null,
      vote_average: e.vote_average ?? null,
      still: imgUrl(e.still_path, "w500")
    }))
  }
}

async function getHurawatchLinks(tmdbId, type = "movie", season = null, episode = null) {
  const variants = []
  if (type === "tv" && season && episode) {
    variants.push(`/tv/${tmdbId}/season/${season}/episode/${episode}`)
    variants.push(`/watch/tv/${tmdbId}/${season}/${episode}`)
    variants.push(`/play/tv/${tmdbId}/${season}/${episode}`)
  } else {
    variants.push(`/movie/${tmdbId}`)
    variants.push(`/watch/movie/${tmdbId}`)
    variants.push(`/play/movie/${tmdbId}`)
  }

  const links = []
  for (const path of variants) {
    try {
      const { data, status } = await client.get(BASE + path, {
        headers: { "Accept": "text/html" },
        maxRedirects: 5,
        validateStatus: s => s < 500
      })
      if (status === 200 && typeof data === "string") {
        const m3u8 = data.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || []
        const mp4 = data.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g) || []
        const embed = data.match(/https?:\/\/[^\s"']+\/(embed|e)\/[^\s"']+/g) || []
        if (m3u8.length || mp4.length || embed.length) {
          links.push({ path, m3u8: [...new Set(m3u8)], mp4: [...new Set(mp4)], embed: [...new Set(embed)] })
        }
      }
    } catch (e) {}
  }
  return links.length ? links : null
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = (args[0] || "help").toLowerCase()
  const input = args.slice(1).join(" ").trim()

  try {
    let data
    if (cmd === "search") {
      if (!input) throw new Error('Contoh: node hurawatch.js search "avatar"')
      data = await search(input)
    }
    else if (cmd === "trending") data = await trending(input || "all", "day")
    else if (cmd === "popular") data = await popular(input || "movie", 1)
    else if (cmd === "top" || cmd === "toprated") data = await topRated(input || "movie", 1)
    else if (cmd === "detail") {
      const parts = input.split(/\s+/)
      const id = parts[0]
      const type = parts[1] || "movie"
      if (!id) throw new Error("Contoh: node hurawatch.js detail 550 movie")
      data = await detail(id, type)
    }
    else if (cmd === "season") {
      const parts = input.split(/\s+/)
      const id = parts[0]
      const sn = parseInt(parts[1]) || 1
      if (!id) throw new Error("Contoh: node hurawatch.js season 246 1")
      data = await season(id, sn)
    }
    else if (cmd === "play") {
      const parts = input.split(/\s+/)
      const id = parts[0]
      const type = parts[1] || "movie"
      const s = parts[2] ? parseInt(parts[2]) : null
      const e = parts[3] ? parseInt(parts[3]) : null
      if (!id) throw new Error("Contoh: node hurawatch.js play 550 movie")
      data = await getHurawatchLinks(id, type, s, e)
    }
    else {
      data = {
        usage: [
          'node hurawatch.js search "avatar"',
          'node hurawatch.js trending [movie|tv|all]',
          'node hurawatch.js popular [movie|tv]',
          'node hurawatch.js top [movie|tv]',
          'node hurawatch.js detail <tmdb_id> [movie|tv]',
          'node hurawatch.js season <tmdb_id> <season>',
          'node hurawatch.js play <tmdb_id> [movie|tv] [season] [episode]'
        ],
        notes: [
          "Metadata diambil langsung dari TMDB (api.themoviedb.org) — bukan dari hurawatch",
          "Untuk stream link perlu scrape hurawatch.cz /play — kadang kosong kalau endpoint beda",
          "Kalau play kosong, kirim DevTools Network dari request m3u8 di hurawatch"
        ]
      }
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: error.message }, null, 2))
    process.exit(1)
  }
}

main()