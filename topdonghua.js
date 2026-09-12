/*
**scrape topdonghua**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/topdonghua.js **
**base URL: https://topdonghua.com**
**credit: topdonghua**

*/

const axios = require("axios")
const cheerio = require("cheerio")

const BASE_URL = "https://topdonghua.com"

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: HEADERS,
    maxRedirects: 5,
    validateStatus: () => true
  })

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.data
}

async function scrapeHome() {
  const html = await fetchHtml(BASE_URL)
  const $ = cheerio.load(html)

  const sections = {
    hotSeries: [],
    recentlyUpdated: [],
    ongoing: [],
    upcoming: [],
    completed: []
  }

  $("h2").each((i, el) => {
    const sectionTitle = $(el).text().trim()

    let targetKey = null
    if (sectionTitle.includes("Hot Series")) targetKey = "hotSeries"
    else if (sectionTitle.includes("Recently")) targetKey = "recentlyUpdated"
    else if (sectionTitle.includes("Ongoing")) targetKey = "ongoing"
    else if (sectionTitle.includes("Upcoming")) targetKey = "upcoming"
    else if (sectionTitle.includes("Completed")) targetKey = "completed"

    if (!targetKey) return

    let container = $(el).parent()
    for (let i = 0; i < 5; i++) {
      const links = container.find("a[href*='watch/'], a[href*='anime/']")
      if (links.length > 0) break
      container = container.parent()
    }

    const seen = new Set()
    container.find("a[href*='watch/'], a[href*='anime/']").each((j, linkEl) => {
      const href = $(linkEl).attr("href")
      const text = $(linkEl).text().trim().replace(/\s+/g, " ")

      if (!href || !text || text.length < 3) return
      if (seen.has(href)) return
      seen.add(href)

      sections[targetKey].push({
        judul: text,
        url: href.startsWith("http") ? href : `${BASE_URL}/${href.replace(/^\//, "")}`
      })
    })
  })

  return {
    hotSeries: {
      total: sections.hotSeries.length,
      data: sections.hotSeries.slice(0, 20)
    },
    recentlyUpdated: {
      total: sections.recentlyUpdated.length,
      data: sections.recentlyUpdated.slice(0, 20)
    },
    ongoing: {
      total: sections.ongoing.length,
      data: sections.ongoing.slice(0, 20)
    },
    upcoming: {
      total: sections.upcoming.length,
      data: sections.upcoming.slice(0, 20)
    },
    completed: {
      total: sections.completed.length,
      data: sections.completed.slice(0, 20)
    }
  }
}

async function searchDonghua(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const results = []
  const seen = new Set()

  $("a[href*='anime/']").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim().replace(/\s+/g, " ")

    if (!href || !text || text.length < 3) return
    if (seen.has(href)) return
    seen.add(href)

    results.push({
      judul: text,
      url: href.startsWith("http") ? href : `${BASE_URL}/${href.replace(/^\//, "")}`
    })
  })

  return {
    query,
    total: results.length,
    results: results.slice(0, 30)
  }
}

async function scrapeAnime(url) {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const judul = $("h1").first().text().trim() || $("title").text().trim() || null

  const sinopsis = $(".description, .synopsis, [class*='synopsis'], [class*='description']").first().text().trim() || null

  const genres = []
  $("a[href*='genre']").each((i, el) => {
    const text = $(el).text().trim()
    if (text && !genres.includes(text) && !text.includes("Genre List")) {
      genres.push(text)
    }
  })

  const episodes = []
  const seen = new Set()

  $("a[href*='watch/']").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim().replace(/\s+/g, " ")

    if (!href || !text) return
    if (seen.has(href)) return
    seen.add(href)

    episodes.push({
      episode: text,
      url: href.startsWith("http") ? href : `${BASE_URL}/${href.replace(/^\//, "")}`
    })
  })

  return {
    judul,
    sinopsis,
    genres,
    totalEpisodes: episodes.length,
    episodes
  }
}

async function scrapeWatch(url) {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const title = $("title").text().trim() || null
  const isLocked = /window\.__episodeLocked\s*=\s*true/.test(html)

  const serverUrlMatch = html.match(/window\.firstServerUrl\s*=\s*["']([^"']+)["']/)
  const serverUrl = serverUrlMatch ? serverUrlMatch[1] : null

  let dailymotionVideoId = null

  if (serverUrl) {
    const dmMatch = serverUrl.match(/video=([a-zA-Z0-9]+)/)
    if (dmMatch) dailymotionVideoId = dmMatch[1]
  }

  const episodeLinks = []
  const seen = new Set()

  $("a[href*='episode']").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim()

    if (!href || !text) return
    if (seen.has(href)) return
    seen.add(href)

    episodeLinks.push({
      episode: text,
      url: href.startsWith("http") ? href : `${BASE_URL}/${href.replace(/^\//, "")}`
    })
  })

  return {
    judul: title,
    locked: isLocked,
    video: dailymotionVideoId ? {
      platform: "dailymotion",
      videoId: dailymotionVideoId,
      embedUrl: serverUrl,
      watchUrl: `https://www.dailymotion.com/video/${dailymotionVideoId}`,
      streamCmd: `yt-dlp "https://www.dailymotion.com/video/${dailymotionVideoId}"`
    } : null,
    totalEpisodeLinks: episodeLinks.length,
    episodeLinks: episodeLinks.slice(0, 30)
  }
}

async function getDailymotionInfo(videoId) {
  const response = await axios.get(`https://api.dailymotion.com/video/${videoId}`, {
    params: {
      fields: "id,title,description,duration,thumbnail_720_url,views_total,created_time,owner.screenname,url"
    },
    timeout: 20000,
    headers: {
      "User-Agent": HEADERS["User-Agent"],
      "Accept": "application/json"
    },
    validateStatus: () => true
  })

  const d = response.data

  return {
    id: d.id,
    title: d.title,
    duration: d.duration,
    durationFormatted: d.duration ? `${Math.floor(d.duration / 60)}:${(d.duration % 60).toString().padStart(2, "0")}` : null,
    thumbnail: d.thumbnail_720_url,
    views: d.views_total,
    created: d.created_time ? new Date(d.created_time * 1000).toISOString() : null,
    owner: d["owner.screenname"],
    url: d.url
  }
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv.slice(3).join(" ")

  if (!mode) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node topdonghua.js <home|search|anime|watch|dm-info> [query|url|video-id]"
    }, null, 2))
    process.exit(1)
  }

  try {
    let data

    if (mode === "home") {
      data = await scrapeHome()
    } else if (mode === "search" && param) {
      data = await searchDonghua(param)
    } else if (mode === "anime" && param) {
      data = await scrapeAnime(param)
    } else if (mode === "watch" && param) {
      data = await scrapeWatch(param)
    } else if (mode === "dm-info" && param) {
      data = await getDailymotionInfo(param)
    } else {
      throw new Error("Parameter tidak valid")
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