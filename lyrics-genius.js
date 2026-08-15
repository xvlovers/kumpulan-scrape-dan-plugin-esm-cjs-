/*
name: genius lyrics scraper
base url: https://genius.com

author: xvlovers
github: xvlovers

fungsi: scrape lirik lagu dari genius.com.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")
const cheerio = require("cheerio")

const GENIUS_URL = "https://genius.com"

async function scrapeLyrics(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br"
    },
    validateStatus: status => status < 500
  })

  const $ = cheerio.load(response.data)
  const html = response.data

  const ogTitle = $('meta[property="og:title"]').attr("content") || ""
  const titleMatch = ogTitle.match(/–\s*(.+)/)
  const artistMatch = ogTitle.match(/^(.+?)(?:\s*–|$)/)

  let title = titleMatch ? titleMatch[1].trim() : $("h1").first().text().trim()
  let artist = artistMatch ? artistMatch[1].trim() : null

  title = title.replace("Lyrics", "").replace("lyrics", "").trim()
  artist = artist.replace("Lyrics", "").replace("lyrics", "").trim()

  const lyricsContainers = [
    "div[data-lyrics-container='true']",
    "div.lyrics",
    "div[class*='Lyrics__Container']"
  ]

  let lyricsParts = []

  for (const container of lyricsContainers) {
    $(container).each((i, el) => {
      const text = $(el)
        .html()
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()

      if (text) lyricsParts.push(text)
    })

    if (lyricsParts.length > 0) break
  }

  let lyrics = lyricsParts.join("\n\n")

  lyrics = lyrics
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
    .trim()

  return {
    judul: title,
    author: artist,
    lirik: lyrics
  }
}

async function searchLyrics(query) {
  const searchUrl = `${GENIUS_URL}/api/search/song?q=${encodeURIComponent(query)}`

  const response = await axios.get(searchUrl, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    }
  })

  const songs = response.data?.response?.sections?.[0]?.hits || []

  return songs.map(hit => ({
    judul: hit.result?.title || null,
    author: hit.result?.artist_names || null,
    url: hit.result?.url || null
  }))
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv[3]

  if (!mode || !param) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node genius.js <lyrics|search> <url|query>"
    }, null, 2))
    process.exit(1)
  }

  try {
    let data

    if (mode === "lyrics") {
      data = await scrapeLyrics(param)
    } else if (mode === "search") {
      data = await searchLyrics(param)
    } else {
      throw new Error("Mode tidak valid: lyrics atau search")
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