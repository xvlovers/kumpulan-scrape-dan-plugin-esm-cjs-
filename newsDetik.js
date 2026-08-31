/*
**scrape trending topic detik news**
**author skrep: xvlovers**
**base URL: https://news.detik.com**
**credit: detik news**

*/

const axios = require("axios")
const cheerio = require("cheerio")

const BASE_URL = "https://news.detik.com"

async function getTrending() {
  const response = await axios.get(BASE_URL, {
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

  const trending = []

  $(".trending-list li, .trending li, .popular li, [class*='trending'] li, [class*='popular'] li").each((i, el) => {
    const linkEl = $(el).find("a")
    const title = linkEl.text().trim() || $(el).text().trim() || null
    const link = linkEl.attr("href") || null

    if (title && link && title.length > 3) {
      trending.push({
        title,
        link: link.startsWith("http") ? link : `${BASE_URL}${link}`
      })
    }
  })

  if (trending.length === 0) {
    $("a[href*='/berita/'], a[href*='/news/']").each((i, el) => {
      const href = $(el).attr("href")
      const text = $(el).text().trim()

      if (href && text && text.length > 10) {
        trending.push({
          title: text,
          link: href.startsWith("http") ? href : `${BASE_URL}${href}`
        })
      }
    })
  }

  const seen = new Set()
  const unique = trending.filter(t => {
    if (seen.has(t.link)) return false
    seen.add(t.link)
    return true
  })

  return {
    source: BASE_URL,
    total: unique.length,
    trending: unique.slice(0, 20)
  }
}

async function main() {
  try {
    const data = await getTrending()

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