/*
name: nekopoi stream
base url: https://nekopoi.care

author: xvlovers
github: xvlover

fungsi: scrape & stream dari nekopoi.care.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")
const cheerio = require("cheerio")

const BASE_URL = "https://nekopoi.care"

async function search(query) {
  const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`

  const response = await axios.get(searchUrl, {
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    validateStatus: status => status < 500
  })

  const $ = cheerio.load(response.data)
  const results = []

  $("article, .post, .hentry, .item, .box").each((i, el) => {
    const titleEl = $(el).find("h2 a, h1 a, .title a, .entry-title a")
    const title = titleEl.text().trim() || null
    const link = titleEl.attr("href") || null

    const imgEl = $(el).find("img")
    const thumbnail = imgEl.attr("src") || imgEl.attr("data-src") || null

    if (title && link) {
      results.push({
        title,
        link: link.startsWith("http") ? link : `${BASE_URL}${link}`,
        thumbnail
      })
    }
  })

  if (results.length === 0) {
    $("a[href]").each((i, el) => {
      const href = $(el).attr("href")
      const text = $(el).text().trim()
      if (href && text && text.length > 5 && href.includes("nekopoi")) {
        results.push({
          title: text,
          link: href.startsWith("http") ? href : `${BASE_URL}${href}`,
          thumbnail: null
        })
      }
    })
  }

  return results.slice(0, 20)
}

async function getDetail(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    validateStatus: status => status < 500
  })

  const $ = cheerio.load(response.data)
  const html = response.data

  const title = $("h1.entry-title, h1.post-title, h1").first().text().trim() || null

  const thumbnail = $(".thumb img, .post-thumb img").first().attr("src") || null

  const infoList = []
  $(".info li, .entry-meta li, .gmr-movie-data li").each((i, el) => {
    infoList.push($(el).text().trim())
  })

  const genres = []
  $(".genre a, .genres a, .tag a").each((i, el) => {
    const text = $(el).text().trim()
    if (text) genres.push(text)
  })

  const streamLinks = []
  $("iframe, video source, a[href*='stream'], a[href*='watch'], a[href*='embed']").each((i, el) => {
    const src = $(el).attr("src") || $(el).attr("href")
    if (src) {
      streamLinks.push(src)
    }
  })

  const downloadLinks = []
  $("a[href*='download'], a[href*='dl'], a[href*='sfl']").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim()
    if (href) {
      downloadLinks.push({
        text: text || null,
        url: href
      })
    }
  })

  return {
    url,
    title,
    thumbnail,
    info: infoList,
    genres,
    streamLinks,
    downloadLinks
  }
}

async function getStream(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Referer": BASE_URL + "/"
    },
    validateStatus: status => status < 500
  })

  const $ = cheerio.load(response.data)
  const html = response.data

  const iframeSrc = $("iframe").attr("src") || null

  const videoSrc = $("video source").attr("src") || $("video").attr("src") || null

  const m3u8Match = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/)
  const mp4Match = html.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/)

  return {
    url,
    iframeSrc,
    videoSrc,
    m3u8: m3u8Match ? m3u8Match[0] : null,
    mp4: mp4Match ? mp4Match[0] : null
  }
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv.slice(3).join(" ")

  if (!mode || !param) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node nekopoi-stream.js <search|detail|stream> <query|url>"
    }, null, 2))
    process.exit(1)
  }

  try {
    let data

    if (mode === "search") {
      data = await search(param)
    } else if (mode === "detail") {
      data = await getDetail(param)
    } else if (mode === "stream") {
      data = await getStream(param)
    } else {
      throw new Error("Mode tidak valid: search, detail, stream")
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