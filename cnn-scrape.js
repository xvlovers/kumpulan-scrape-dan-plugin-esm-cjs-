/*
name: cnn indonesia scraper
base url: https://www.cnnindonesia.com

author: xvlovers
github: xvlover

fungsi: scrape berita terbaru dari cnn indonesia.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")
const cheerio = require("cheerio")

const CNN_URL = "https://www.cnnindonesia.com"

async function scrapeHome() {
  const response = await axios.get(CNN_URL, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    validateStatus: status => status < 400
  })

  const $ = cheerio.load(response.data)
  const berita = []

  $("article, .news, .list-item, .item").each((i, el) => {
    const titleEl = $(el).find("h2 a, h3 a, .title a, a[href*='/nasional/'], a[href*='/internasional/'], a[href*='/ekonomi/'], a[href*='/olahraga/'], a[href*='/teknologi/'], a[href*='/hiburan/']")
    const title = titleEl.text().trim() || $(el).find("h2, h3").text().trim() || null
    const link = titleEl.attr("href") || null

    const imgEl = $(el).find("img")
    const thumbnail = imgEl.attr("src") || imgEl.attr("data-src") || null

    const kategori = $(el).find(".kategori, .category, .kanal").text().trim() || null
    const tanggal = $(el).find(".date, .tanggal, time").text().trim() || null

    if (title && link) {
      const fullLink = link.startsWith("http") ? link : `${CNN_URL}${link}`
      berita.push({ title, link: fullLink, thumbnail, kategori, tanggal })
    }
  })

  if (berita.length === 0) {
    $("a[href]").each((i, el) => {
      const href = $(el).attr("href")
      const text = $(el).text().trim()

      if (href && text && text.length > 20 && (
        href.includes("/nasional/") ||
        href.includes("/internasional/") ||
        href.includes("/ekonomi/") ||
        href.includes("/olahraga/") ||
        href.includes("/teknologi/") ||
        href.includes("/hiburan/")
      )) {
        const fullLink = href.startsWith("http") ? href : `${CNN_URL}${href}`
        if (!berita.find(b => b.link === fullLink)) {
          berita.push({ title: text, link: fullLink, thumbnail: null, kategori: null, tanggal: null })
        }
      }
    })
  }

  const seen = new Set()
  const uniqueBerita = berita.filter(b => {
    if (seen.has(b.link)) return false
    seen.add(b.link)
    return true
  })

  return {
    source: CNN_URL,
    total: uniqueBerita.length,
    berita: uniqueBerita.slice(0, 20)
  }
}

async function scrapeDetail(url) {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    validateStatus: status => status < 500
  })

  const $ = cheerio.load(response.data)

  const title = $("h1.title, h1.judul, .title h1").text().trim() || $("h1").first().text().trim() || null
  const tanggal = $(".date, .tanggal, time").text().trim() || null
  const author = $(".author, .penulis, .reporter").text().trim() || null

  const content = []
  $(".content p, .detail_text p, .berita p, .text_detail p, #content p").each((i, el) => {
    const text = $(el).text().trim()
    if (text && text.length > 10) {
      content.push(text)
    }
  })

  const images = []
  $(".content img, .detail_text img, .berita img").each((i, el) => {
    images.push({
      src: $(el).attr("src") || $(el).attr("data-src") || null,
      alt: $(el).attr("alt") || null
    })
  })

  const tags = []
  $(".tag a, .tags a, .keyword a").each((i, el) => {
    const text = $(el).text().trim()
    if (text) tags.push(text)
  })

  const kategori = $(".kategori, .category, .kanal a").first().text().trim() || null

  return {
    url,
    title,
    tanggal,
    author,
    kategori,
    totalParagraf: content.length,
    konten: content.join("\n\n"),
    images,
    tags
  }
}

async function scrapeKategori(kategori) {
  const validKategori = ["nasional", "internasional", "ekonomi", "olahraga", "teknologi", "hiburan", "gaya-hidup"]

  if (!validKategori.includes(kategori)) {
    throw new Error("Kategori tidak valid: " + validKategori.join(", "))
  }

  const kategoriUrl = `${CNN_URL}/${kategori}`

  const response = await axios.get(kategoriUrl, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    validateStatus: status => status < 400
  })

  const $ = cheerio.load(response.data)
  const berita = []

  $("article, .list-item, .item").each((i, el) => {
    const titleEl = $(el).find("h2 a, h3 a, .title a")
    const title = titleEl.text().trim() || null
    const link = titleEl.attr("href") || null

    if (title && link) {
      berita.push({
        title,
        link: link.startsWith("http") ? link : `${CNN_URL}${link}`,
        thumbnail: $(el).find("img").attr("src") || null,
        tanggal: $(el).find(".date, time").text().trim() || null
      })
    }
  })

  return {
    kategori,
    source: kategoriUrl,
    total: berita.length,
    berita: berita.slice(0, 20)
  }
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv[3]

  try {
    let data

    if (mode === "home") {
      data = await scrapeHome()
    } else if (mode === "detail" && param) {
      data = await scrapeDetail(param)
    } else if (mode === "kategori" && param) {
      data = await scrapeKategori(param)
    } else {
      data = await scrapeHome()
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: data
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