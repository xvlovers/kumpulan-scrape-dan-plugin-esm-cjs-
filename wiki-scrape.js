/*
name: wikipedia scraper
base url: https://id.wikipedia.org

author: xvlovers
github: xvlovers

fungsi: scrape artikel wikipedia lengkap dengan metadata.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")
const cheerio = require("cheerio")

const WIKI_URL = "https://id.wikipedia.org"

async function scrapeWikipedia(query) {
  const searchUrl = `${WIKI_URL}/wiki/${encodeURIComponent(query.replace(/ /g, "_"))}`

  const response = await axios.get(searchUrl, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    validateStatus: status => status < 500
  })

  if (response.status === 404) {
    throw new Error("Artikel tidak ditemukan")
  }

  const $ = cheerio.load(response.data)

  const title = $("#firstHeading").text().trim() || $("h1").first().text().trim() || null

  const summary = $("#mw-content-text .mw-parser-output > p").first().text().trim() || null

  const paragraphs = []
  $("#mw-content-text .mw-parser-output > p").each((i, el) => {
    const text = $(el).text().trim()
    if (text) paragraphs.push(text)
  })

  const headings = []
  $("#mw-content-text .mw-parser-output h2, #mw-content-text .mw-parser-output h3").each((i, el) => {
    const text = $(el).find(".mw-headline").text().trim() || $(el).text().trim()
    if (text && !text.includes("[sunting")) {
      headings.push({
        tag: $(el).prop("tagName").toLowerCase(),
        text: text.replace("[sunting | sunting sumber]", "").trim()
      })
    }
  })

  const infobox = {}
  $(".infobox").first().find("tr").each((i, el) => {
    const label = $(el).find("th").text().trim()
    const value = $(el).find("td").text().trim()

    if (label && value && !label.includes("[") && !value.includes("[")) {
      infobox[label] = value
    }
  })

  const images = []
  $("#mw-content-text .mw-parser-output img, .infobox img, .thumb img").each((i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || null
    const alt = $(el).attr("alt") || null

    if (src && !src.includes("pixel") && !images.find(img => img.src === src)) {
      images.push({
        src: src.startsWith("//") ? "https:" + src : src,
        alt: alt
      })
    }
  })

  const references = []
  $("#mw-content-text .references a.external, #mw-content-text .reference a.external").each((i, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim()

    if (href && !references.includes(href)) {
      references.push({
        text: text || href,
        url: href
      })
    }
  })

  const categories = []
  $("#mw-normal-catlinks a, #catlinks a").each((i, el) => {
    const text = $(el).text().trim()
    if (text) categories.push(text)
  })

  const seeAlso = []
  $("#Lihat_pula, #Lihat_juga").parent().nextAll("ul").first().find("a").each((i, el) => {
    const text = $(el).text().trim()
    const href = $(el).attr("href")
    if (text) {
      seeAlso.push({
        text,
        url: href ? `${WIKI_URL}${href}` : null
      })
    }
  })

  const pageUrl = response.request.res.responseUrl || searchUrl

  return {
    title,
    url: pageUrl,
    summary,
    totalParagraphs: paragraphs.length,
    paragraphs: paragraphs.slice(0, 10),
    totalHeadings: headings.length,
    headings: headings.slice(0, 20),
    infobox,
    totalImages: images.length,
    images: images.slice(0, 10),
    totalReferences: references.length,
    references: references.slice(0, 15),
    totalCategories: categories.length,
    categories,
    seeAlso
  }
}

async function searchWikipedia(query) {
  const searchUrl = `${WIKI_URL}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&format=json`

  const response = await axios.get(searchUrl, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  })

  const data = response.data
  const results = []

  for (let i = 0; i < data[1].length; i++) {
    results.push({
      title: data[1][i],
      description: data[2][i] || null,
      url: data[3][i] || null
    })
  }

  return {
    query,
    total: results.length,
    results
  }
}

async function scrapeRandomArticle() {
  const randomUrl = `${WIKI_URL}/wiki/Special:Random`

  const response = await axios.get(randomUrl, {
    timeout: 15000,
    maxRedirects: 5,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  })

  const finalUrl = response.request.res.responseUrl || response.request.responseURL
  const title = finalUrl.split("/wiki/").pop().replace(/_/g, " ")

  return {
    title: decodeURIComponent(title),
    url: finalUrl
  }
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv.slice(3).join(" ")

  if (!mode) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node wiki-scrape.js <article|search|random> [judul/kata-kunci]"
    }, null, 2))
    process.exit(1)
  }

  try {
    let data

    if (mode === "article" && param) {
      data = await scrapeWikipedia(param)
    } else if (mode === "search" && param) {
      data = await searchWikipedia(param)
    } else if (mode === "random") {
      data = await scrapeRandomArticle()
    } else {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: false,
        message: "Mode tidak valid atau parameter kurang"
      }, null, 2))
      process.exit(1)
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: data
    }, null, 2))
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: false,
        message: "Artikel tidak ditemukan"
      }, null, 2))
    } else {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: false,
        message: error.message
      }, null, 2))
    }
    process.exit(1)
  }
}

main()