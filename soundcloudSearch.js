/*
**scrape soundcloud search**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/soundcloudSearch.js **
**base URL: https://m.soundcloud.com**
**credit: soundcloud**

*/

const axios = require("axios")

const BASE_URL = "https://m.soundcloud.com"

async function searchSoundcloud(query) {
  const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(query)}`

  const response = await axios.get(searchUrl, {
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  })

  const html = response.data

  const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)

  if (!jsonMatch) {
    throw new Error("Data tidak ditemukan")
  }

  const data = JSON.parse(jsonMatch[1])
  const tracks = data?.props?.pageProps?.initialStoreState?.entities?.tracks || {}

  const results = Object.values(tracks).map(trackData => {
    const track = trackData.data || {}

    const transcodings = track.media?.transcodings || []
    const mp3Stream = transcodings.find(t => t.format?.protocol === "progressive")
    const hlsStream = transcodings.find(t => t.format?.protocol === "hls")

    return {
      judul: track.title || null,
      artist: track.publisher_metadata?.artist || track.user?.username || null,
      durasi: track.full_duration ? formatDuration(track.full_duration) : null,
      likes: track.likes_count || 0,
      plays: track.playback_count || 0,
      genre: track.genre || null,
      artwork: track.artwork_url || null,
      url: track.permalink_url || null,
      streamUrl: mp3Stream?.url || hlsStream?.url || null
    }
  })

  return {
    query,
    total: results.length,
    tracks: results
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

async function main() {
  const query = process.argv.slice(2).join(" ")

  if (!query) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node soundcloud.js <query>"
    }, null, 2))
    process.exit(1)
  }

  try {
    const data = await searchSoundcloud(query)

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