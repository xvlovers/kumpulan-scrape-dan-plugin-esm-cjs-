/*
**scrape drowify music search lirik play**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/drowifyMusic.js **
**base URL: https://drowify-music.biz.id**
**credit: drowify music**

*/

const axios = require("axios")
const https = require("https")

const BASE_URL = "https://drowify-music.biz.id"

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
})

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": BASE_URL + "/play/"
}

function formatSong(s) {
  return {
    judul: s.title || null,
    artist: s.artist || null,
    artistId: s.artistId || null,
    album: s.album || null,
    albumId: s.albumId || null,
    durasi: s.duration || null,
    videoId: s.videoId || null,
    thumbnail: s.thumbnail || null,
    url: s.url || null
  }
}

async function search(query) {
  const res = await axiosInstance.get(`${BASE_URL}/api/search`, {
    params: { query },
    timeout: 30000,
    headers: HEADERS,
    validateStatus: () => true
  })

  if (res.status !== 200 || !res.data?.status) {
    throw new Error(res.data?.message || `HTTP ${res.status}`)
  }

  const songs = (res.data.result?.songs || []).map(formatSong)

  return {
    query,
    total: songs.length,
    songs
  }
}

async function suggest(query) {
  const res = await axiosInstance.get(`${BASE_URL}/api/suggest`, {
    params: { query },
    timeout: 20000,
    headers: HEADERS,
    validateStatus: () => true
  })

  if (res.status !== 200 || !Array.isArray(res.data)) {
    throw new Error(`HTTP ${res.status}`)
  }

  return {
    query,
    total: res.data.length,
    suggestions: res.data
  }
}

async function lyrics(videoId) {
  const res = await axiosInstance.get(`${BASE_URL}/api/lyrics`, {
    params: { id: videoId },
    timeout: 30000,
    headers: HEADERS,
    validateStatus: () => true
  })

  if (res.status !== 200 || !res.data?.status) {
    throw new Error(res.data?.message || `HTTP ${res.status}`)
  }

  const result = res.data.result
  const lyricsData = result?.lyrics
  const lines = lyricsData?.lines || []

  const lirikBersih = lines
    .map(l => l.text)
    .filter(t => t && t.trim() !== "• • •")
    .join("\n")

  return {
    videoId: result?.videoId || videoId,
    judul: result?.title || null,
    artist: result?.artist || null,
    album: result?.album || null,
    source: result?.source || null,
    tipeLirik: lyricsData?.type || null,
    totalBaris: lines.length,
    lirik: lirikBersih,
    synced: lines.map(l => ({
      waktu: l.time || null,
      teks: l.text || null,
      terjemahan: l.translation || null
    }))
  }
}

async function play(query) {
  const res = await axiosInstance.post(`${BASE_URL}/api/ytplay`, { query }, {
    timeout: 60000,
    headers: { ...HEADERS, "Content-Type": "application/json" },
    validateStatus: () => true
  })

  if (res.status !== 200 || !res.data?.status) {
    throw new Error(res.data?.message || res.data?.error || `HTTP ${res.status}`)
  }

  return {
    query,
    result: res.data.result || res.data
  }
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv.slice(3).join(" ")

  if (!mode || !param) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node drowify.js <search|suggest|lyrics|play> <query|videoId>"
    }, null, 2))
    process.exit(1)
  }

  try {
    let data

    if (mode === "search") {
      data = await search(param)
    } else if (mode === "suggest") {
      data = await suggest(param)
    } else if (mode === "lyrics") {
      data = await lyrics(param)
    } else if (mode === "play") {
      data = await play(param)
    } else {
      throw new Error("Mode tidak valid: search, suggest, lyrics, play")
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data
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