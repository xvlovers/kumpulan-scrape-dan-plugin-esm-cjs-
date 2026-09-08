/*
**scrape manwhaku lengkap(supp image)**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/manwhaku.js **
**base URL: https://manwhaku.my.id**
**credit: manwhaku**


*/

const axios = require("axios")
const cheerio = require("cheerio")
const https = require("https")

const BASE_URL = "https://manwhaku.my.id"

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
})

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Sec-CH-UA": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-CH-UA-Mobile": "?1",
  "Sec-CH-UA-Platform": '"Android"'
}

let globalCookie = ""

async function getCookies() {
  if (globalCookie) return globalCookie

  const response = await axiosInstance.get(BASE_URL, {
    timeout: 30000,
    headers: HEADERS,
    maxRedirects: 10,
    validateStatus: () => true
  })

  const cookies = response.headers["set-cookie"] || []
  globalCookie = cookies.map(c => c.split(";")[0]).join("; ")

  return globalCookie
}

async function scrapeHome() {
  const cookie = await getCookies()

  const response = await axiosInstance.get(BASE_URL, {
    timeout: 30000,
    headers: { ...HEADERS, "Cookie": cookie }
  })

  const $ = cheerio.load(response.data)

  const mangaList = []

  $("a[href*='/manga/']").each((i, el) => {
    const href = $(el).attr("href")
    const imgEl = $(el).find("img").first()
    const title = imgEl.attr("alt") || $(el).text().trim()

    if (href && title && title.length > 3 && !href.includes("?")) {
      const thumbMatch = imgEl.attr("src") || ""
      const realThumb = thumbMatch.includes("url=")
        ? decodeURIComponent(thumbMatch.match(/url=(.+?)&w=/)?.[1] || thumbMatch)
        : thumbMatch

      mangaList.push({
        judul: title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        thumbnail: realThumb
      })
    }
  })

  const seen = new Set()
  const unique = mangaList.filter(m => {
    if (seen.has(m.url)) return false
    seen.add(m.url)
    return true
  })

  return {
    total: unique.length,
    manga: unique.slice(0, 40)
  }
}

async function searchManga(query) {
  const cookie = await getCookies()

  const searchUrl = `${BASE_URL}/manga?q=${encodeURIComponent(query)}`

  const response = await axiosInstance.get(searchUrl, {
    timeout: 30000,
    headers: { ...HEADERS, "Cookie": cookie }
  })

  const $ = cheerio.load(response.data)

  const results = []

  $("a[href*='/manga/']").each((i, el) => {
    const href = $(el).attr("href")
    const imgEl = $(el).find("img").first()
    const title = imgEl.attr("alt") || $(el).text().trim()

    if (href && title && title.length > 3 && !href.includes("?")) {
      results.push({
        judul: title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        thumbnail: imgEl.attr("src") || null
      })
    }
  })

  const seen = new Set()
  const unique = results.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  return {
    query,
    total: unique.length,
    results: unique.slice(0, 30)
  }
}

async function detailManga(url) {
  const cookie = await getCookies()

  const response = await axiosInstance.get(url, {
    timeout: 30000,
    headers: { ...HEADERS, "Cookie": cookie }
  })

  const $ = cheerio.load(response.data)

  const judul = $("h1").first().text().trim() || null
  const thumbnail = $("img").first().attr("src") || null

  const chapters = []
  $("a[href*='/read/']").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim().replace("Read →", "").trim()

    if (href && text && text.length > 2) {
      chapters.push({
        chapter: text,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`
      })
    }
  })

  return {
    judul,
    thumbnail,
    totalChapters: chapters.length,
    chapters
  }
}

function extractSlug(url) {
  const match = url.match(/\/read\/(.+)/)
  if (!match) return null

  return match[1]
    .replace(/-chapter-\d+.*$/, "")
    .replace(/-chapter-\d+-\d+.*$/, "")
    .replace(/-chapter-/g, "")
    .replace(/-v\d+$/, "")
    .replace(/-fix$/i, "")
}

function extractChapterNum(url) {
  const match = url.match(/chapter-(\d+(?:[-.]\d+)?)/)
  return match ? match[1].padStart(2, "0") : "01"
}

async function bacaChapter(url) {
  const cookie = await getCookies()

  const response = await axiosInstance.get(url, {
    timeout: 30000,
    headers: { ...HEADERS, "Cookie": cookie }
  })

  const $ = cheerio.load(response.data)
  const html = response.data

  const judul = $("h1").first().text().trim() || $("title").text().trim() || null
  const slug = extractSlug(url)
  const chapterNum = extractChapterNum(url)

  const images = []

  $("img").each((i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-lazy-src")

    if (src && src.includes("csid.skyfile.me")) {
      if (src.includes("/_next/image")) {
        const decoded = decodeURIComponent(src.match(/url=(.+?)&w=/)?.[1] || src)
        images.push(decoded)
      } else {
        images.push(src)
      }
    }
  })

  const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  if (jsonMatch) {
    const jsonStr = JSON.stringify(JSON.parse(jsonMatch[1]))
    const imgPattern = /https?:\/\/csid\.skyfile\.me\/[^"'\s]+\.webp/g
    let match
    while ((match = imgPattern.exec(jsonStr)) !== null) {
      if (!images.includes(match[0])) images.push(match[0])
    }
  }

  if (images.length <= 1 && slug) {
    const basePattern = `https://csid.skyfile.me/wp-content/uploads/images/${slug[0]}/${slug}/chapter-${chapterNum}`

    for (let i = 1; i <= 80; i++) {
      const testUrl = `${basePattern}/${i}.webp`

      try {
        const check = await axiosInstance.get(testUrl, {
          timeout: 5000,
          headers: { ...HEADERS, "Cookie": cookie },
          validateStatus: () => true
        })

        if (check.status === 200 && !images.includes(testUrl)) {
          images.push(testUrl)
        } else if (check.status !== 200) {
          break
        }
      } catch (e) {
        break
      }
    }
  }

  return {
    judul,
    slug,
    chapter: chapterNum,
    totalImages: images.length,
    images
  }
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv.slice(3).join(" ")

  if (!mode) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node manwhaku.js <home|search|detail|baca> [param]"
    }, null, 2))
    process.exit(1)
  }

  try {
    let data

    if (mode === "home") {
      data = await scrapeHome()
    } else if (mode === "search" && param) {
      data = await searchManga(param)
    } else if (mode === "detail" && param) {
      data = await detailManga(param)
    } else if (mode === "baca" && param) {
      data = await bacaChapter(param)
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