/*
name: nekopoi scraper
base url: https://nekopoi.care

author: xvlovers
github: xvlover

fungsi: scrape search & detail dari nekopoi.care.

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
    const title = titleEl.text().trim() || $(el).find("h2, h3").text().trim() || null
    const link = titleEl.attr("href") || null

    const imgEl = $(el).find("img")
    const thumbnail = imgEl.attr("src") || imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || null

    const category = $(el).find(".cat, .category, .genre").text().trim() || null
    const date = $(el).find(".date, .time, time").text().trim() || null
    const views = $(el).find(".views, .view").text().trim() || null

    if (title && link) {
      const fullLink = link.startsWith("http") ? link : `${BASE_URL}${link}`
      results.push({
        title,
        link: fullLink,
        thumbnail,
        category,
        date,
        views
      })
    }
  })

  if (results.length === 0) {
    $("a[href]").each((i, el) => {
      const href = $(el).attr("href")
      const text = $(el).text().trim()

      if (href && text && text.length > 5 && !href.includes("#") && !href.includes("javascript:")) {
        const fullLink = href.startsWith("http") ? href : `${BASE_URL}${href}`

        if (!results.find(r => r.link === fullLink) && fullLink.includes("nekopoi")) {
          const imgEl = $(el).find("img")
          results.push({
            title: text,
            link: fullLink,
            thumbnail: imgEl.attr("src") || imgEl.attr("data-src") || null,
            category: null,
            date: null,
            views: null
          })
        }
      }
    })
  }

  const seen = new Set()
  const unique = results.filter(r => {
    if (seen.has(r.link)) return false
    seen.add(r.link)
    return true
  })

  return {
    query,
    source: searchUrl,
    total: unique.length,
    results: unique.slice(0, 30)
  }
}

async function detail(url) {
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

  const title = $("h1.entry-title, h1.post-title, h1").first().text().trim() || null

  const thumbnail = $(".thumb img, .post-thumb img, .entry-content img, article img").first().attr("src") || $(".thumb img").attr("data-src") || null

  const infoList = []
  $(".info li, .entry-meta li, .gmr-movie-data li, .data li").each((i, el) => {
    infoList.push($(el).text().trim())
  })

  const infoText = $(".info, .entry-meta, .gmr-movie-data").text().trim() || null

  const synopsis = $(".synopsis, .entry-content, .gmr-movie-synopsis").first().text().trim() || null

  const genres = []
  $(".genre a, .genres a, .gmr-movie-genre a, .tag a").each((i, el) => {
    const text = $(el).text().trim()
    if (text && !genres.includes(text)) {
      genres.push(text)
    }
  })

  const downloadLinks = []
  $("a[href*='download'], a[href*='dl'], a[href*='sfl'], a[href*='link']").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim()

    if (href && !href.includes("#") && !href.includes("javascript:")) {
      downloadLinks.push({
        text: text || null,
        url: href
      })
    }
  })

  const allLinks = []
  $("a[href]").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim()

    if (href && text && text.length > 3 && !href.includes("#") && !href.includes("javascript:")) {
      allLinks.push({
        text,
        url: href
      })
    }
  })

  const images = []
  $("img").each((i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src")
    if (src) {
      images.push(src)
    }
  })

  return {
    url,
    title,
    thumbnail,
    info: infoList.length > 0 ? infoList : null,
    infoText,
    synopsis,
    genres,
    totalDownloadLinks: downloadLinks.length,
    downloadLinks: downloadLinks.slice(0, 20),
    totalAllLinks: allLinks.length,
    allLinks: allLinks.slice(0, 30),
    totalImages: images.length,
    images: images.slice(0, 15)
  }
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv.slice(3).join(" ")

  if (!mode || !param) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node nekopoi.js <search|detail> <query|url>"
    }, null, 2))
    process.exit(1)
  }

  try {
    let data

    if (mode === "search") {
      data = await search(param)
    } else if (mode === "detail") {
      data = await detail(param)
    } else {
      throw new Error("Mode tidak valid: search atau detail")
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