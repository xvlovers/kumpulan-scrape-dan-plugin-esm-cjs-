/*
* scrape savetik *
* author skrep: xvlovers *
* git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/savetik.js *
* base URL: https://savetik.co *
* credit: xv *
* chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E *
*/

const axios = require("axios")
const cheerio = require("cheerio")
const https = require("https")
const fs = require("fs")
const path = require("path")

const BASE = "https://savetik.co"
const UA = "Mozilla/5.0 (Android 16; Mobile; rv:157.0) Gecko/157.0 Firefox/157.0"

const client = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256",
    honorCipherOrder: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3"
  }),
  headers: {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,id-ID;q=0.9,ms-MY;q=0.8",
    "Referer": BASE + "/id/tiktok-downloader",
    "Origin": BASE
  }
})

function clean(str) {
  if (!str) return null
  return String(str).replace(/\s+/g, " ").trim() || null
}

function isTikTokUrl(url) {
  return /tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com/i.test(url)
}

function isDouyinUrl(url) {
  return /douyin\.com|v\.douyin\.com|iesdouyin\.com/i.test(url)
}

function detectPlatform(url) {
  if (isTikTokUrl(url)) return "tiktok"
  if (isDouyinUrl(url)) return "douyin"
  return "unknown"
}

async function fetchData(url) {
  const platform = detectPlatform(url)
  if (platform === "unknown") throw new Error("Hanya support link TikTok atau Douyin")

  const refererPath = platform === "douyin" ? "/id/douyin-downloader" : "/id/tiktok-downloader"

  const body = new URLSearchParams()
  body.append("q", url)
  body.append("lang", "id")

  const { data, status } = await client.post(`${BASE}/api/ajaxSearch`, body.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": BASE + refererPath
    }
  })

  if (status !== 200) throw new Error(`HTTP ${status}`)
  if (!data || data.status !== "ok") throw new Error(data?.msg || "API gagal mengembalikan data")
  if (data.statusCode && data.statusCode !== 200) throw new Error(data.msg || `Status ${data.statusCode}`)

  return { platform, html: data.data }
}

function parseHtml(html, originalUrl) {
  const $ = cheerio.load(html)

  const thumbnail = clean($(".thumbnail img").first().attr("src"))
  const title = clean($(".thumbnail .content h3").first().text())

  const downloads = []
  const seen = new Set()
  $(".dl-action a[href]").each((_, el) => {
    const $a = $(el)
    const href = clean($a.attr("href"))
    const label = clean($a.text())
    if (!href || seen.has(href)) return
    seen.add(href)
    downloads.push({
      label: label || null,
      url: href
    })
  })

  const mp4 = downloads.find(d => /mp4/i.test(d.label) && !/hd/i.test(d.label))
  const hd = downloads.find(d => /hd|1080|720|2k|4k/i.test(d.label)) ||
    downloads.find(d => /mp4/i.test(d.label) && d !== mp4)
  const mp3 = downloads.find(d => /mp3|audio|music/i.test(d.label))

  return {
    url: originalUrl,
    thumbnail,
    title,
    video_sd: mp4 ? mp4.url : (downloads[0]?.url || null),
    video_hd: hd ? hd.url : null,
    mp3: mp3 ? mp3.url : null,
    all_downloads: downloads.length ? downloads : null
  }
}

async function getVideo(url) {
  const { platform, html } = await fetchData(url)
  const parsed = parseHtml(html, url)
  return { platform, ...parsed }
}

async function downloadFile(url, outputPath, label) {
  const { data, headers, status } = await client.get(url, { responseType: "stream" })
  if (status !== 200) throw new Error(`HTTP ${status} saat download`)

  const total = parseInt(headers["content-length"]) || 0
  let downloaded = 0
  let lastPrint = 0

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath)
    data.on("data", chunk => {
      downloaded += chunk.length
      if (total) {
        const pct = Math.floor((downloaded / total) * 100)
        if (pct !== lastPrint && pct % 5 === 0) {
          lastPrint = pct
          process.stdout.write(`\r${label || "Downloading"}: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`)
        }
      }
    })
    data.on("error", reject)
    writer.on("error", reject)
    writer.on("finish", () => {
      if (total) process.stdout.write(`\r${label || "Downloading"}: 100% (${(downloaded / 1024 / 1024).toFixed(1)} MB)\n`)
      resolve({ path: outputPath, size: downloaded })
    })
    data.pipe(writer)
  })
}

function safeFilename(name) {
  return String(name || "video").replace(/[^\w\s.-]/g, "").replace(/\s+/g, "_").slice(0, 80)
}

async function main() {
  const args = process.argv.slice(2)
  const input = args[0]
  const flags = args.slice(1)

  try {
    if (!input) {
      throw new Error('Contoh:\n  node savetik.js "https://vt.tiktok.com/ZSbkmuajK/"\n  node savetik.js "https://vt.tiktok.com/ZSbkmuajK/" --download\n  node savetik.js "https://vt.tiktok.com/ZSbkmuajK/" --download hd')
    }

    const data = await getVideo(input)

    const shouldDownload = flags.includes("--download") || flags.includes("-d")
    const wantHd = flags.includes("hd") || flags.includes("--hd")

    if (shouldDownload) {
      const targetUrl = wantHd && data.video_hd ? data.video_hd : data.video_sd
      if (!targetUrl) throw new Error("Tidak ada URL download tersedia")

      const ext = data.mp3 && targetUrl === data.mp3 ? "mp3" : "mp4"
      const fname = `${safeFilename(data.title)}_${wantHd && data.video_hd ? "hd" : "sd"}.${ext}`
      const outPath = path.join(process.cwd(), fname)

      const result = await downloadFile(targetUrl, outPath, data.title || fname)

      data.downloaded = { path: result.path, size: result.size, quality: wantHd ? "hd" : "sd" }
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: error.message }, null, 2))
    process.exit(1)
  }
}

main()