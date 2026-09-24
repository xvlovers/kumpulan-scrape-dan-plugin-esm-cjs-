/*
**scrape ssstik**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/ssstik.js**
**base URL: https://ssstik.io**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E

*/

const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const path = require("path")

const BASE = "https://ssstik.io"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"

let cookieJar = ""
let token = ""

const client = axios.create({
  timeout: 90000,
  headers: {
    "User-Agent": UA,
    "Accept": "*/*",
    "Accept-Language": "en-GB,en;q=0.9,id-ID;q=0.8"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function output(data) {
  console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
}

function fail(msg) {
  console.log(JSON.stringify({ author: "xvlovers", status: false, message: msg }, null, 2))
  process.exit(1)
}

function usage(msg) {
  fail(msg || "Usage: node ssstik.js <info|download> <tiktok_url> [mp4|mp3] [output]")
}

function sanitizeName(s) {
  return String(s || "tiktok").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100)
}

function decodeB64Url(str) {
  try {
    const padded = str + "=".repeat((4 - str.length % 4) % 4)
    return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  } catch (_) { return null }
}

async function initSession() {
  const r = await client.get(BASE + "/")
  const html = String(r.data)
  token = (html.match(/s_tt\s*=\s*['"]([^'"]+)['"]/) || [])[1] || ""
  const sc = r.headers["set-cookie"] || []
  cookieJar = sc.map(c => c.split(";")[0]).join("; ")
  if (!token) throw new Error("Token s_tt tidak ditemukan")
  return { token, cookieJar }
}

async function resolveShortUrl(url) {
  if (!/vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com\/t\//i.test(url)) return url
  try {
    const r = await axios.get(url, {
      maxRedirects: 0,
      timeout: 15000,
      headers: { "User-Agent": UA },
      validateStatus: s => s < 400
    })
    if (r.headers?.location) return r.headers.location
  } catch (e) {
    if (e.response?.headers?.location) return e.response.headers.location
  }
  return url
}

async function convert(tiktokUrl) {
  if (!token) await initSession()
  const resolved = await resolveShortUrl(tiktokUrl)

  const body = new URLSearchParams({
    id: resolved,
    locale: "en",
    tt: token
  }).toString()

  const headers = {
    "User-Agent": UA,
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded",
    "Hx-Current-Url": BASE + "/",
    "Hx-Request": "true",
    "Hx-Target": "target",
    "Hx-Trigger": "_gcaptcha_pt",
    "Origin": BASE,
    "Referer": BASE + "/"
  }
  if (cookieJar) headers["Cookie"] = cookieJar

  const r = await client.post(BASE + "/abc?url=dl", body, { headers })

  const setCookie = r.headers["set-cookie"] || []
  if (setCookie.length) {
    cookieJar += "; " + setCookie.map(c => c.split(";")[0]).join("; ")
  }

  const html = String(r.data)
  if (!html || html.length < 100) {
    throw new Error("Response kosong — set SSSTIK_COOKIE dari browser")
  }

  const $ = cheerio.load(html)

  const result = {
    resolvedUrl: resolved,
    author: $(".result_author").length ? $("h2").first().text().trim() : null,
    title: $("p.maintext").first().text().trim() || null,
    avatar: (() => {
      const src = $(".result_author").attr("src")
      if (!src) return null
      const m = src.match(/\/a\/([A-Za-z0-9_\-=]+)/)
      return m ? decodeB64Url(m[1]) : src
    })(),
    poster: (() => {
      const m = html.match(/url\(https:\/\/tikcdn\.io\/ssstik\/p\/([A-Za-z0-9_\-=]+)\)/)
      return m ? decodeB64Url(m[1]) : null
    })(),
    stats: {
      likes: $(".feather-thumbs-up").closest("div").next().text().trim() || null,
      comments: $(".feather-message-square").closest("div").next().text().trim() || null,
      shares: $(".feather-share-2").closest("div").next().text().trim() || null
    },
    video: {
      noWatermark: null,
      noWatermarkHd: null
    },
    audio: null
  }

  // Cari link no watermark (SD)
  $("a.download_link").each((_, el) => {
    const $el = $(el)
    const href = $el.attr("href")
    if (!href) return
    if ($el.hasClass("without_watermark") && !$el.hasClass("without_watermark_hd")) {
      result.video.noWatermark = href
    }
    if ($el.hasClass("without_watermark_hd")) {
      const direct = $el.attr("data-directurl")
      if (direct) result.video.noWatermarkHd = BASE + direct
      else result.video.noWatermarkHd = href
    }
    if ($el.hasClass("music")) {
      const m = href.match(/\/m\/([A-Za-z0-9_\-=]+)/)
      if (m) {
        const decoded = decodeB64Url(m[1])
        result.audio = decoded || href
      } else {
        result.audio = href
      }
    }
  })

  return result
}

async function downloadFile(url, outPath, onProgress) {
  const out = outPath || path.join(process.cwd(), "tiktok-" + Date.now())
  const writer = fs.createWriteStream(out)

  const r = await axios.get(url, {
    responseType: "stream",
    timeout: 0,
    maxContentLength: Infinity,
    headers: { "User-Agent": UA, "Referer": BASE + "/" },
    validateStatus: s => s < 600,
    maxRedirects: 10
  })

  if (r.status >= 400) {
    writer.close()
    try { fs.unlinkSync(out) } catch (_) {}
    throw new Error("Download gagal: HTTP " + r.status)
  }

  const total = Number(r.headers["content-length"] || 0)

  return new Promise((resolve, reject) => {
    let size = 0, last = 0
    r.data.on("data", c => {
      size += c.length
      const now = Date.now()
      if (now - last > 1000) {
        last = now
        if (typeof onProgress === "function") onProgress(size, total)
      }
    })
    r.data.pipe(writer)
    writer.on("finish", () => resolve({ path: out, size, expected: total || null }))
    writer.on("error", reject)
    r.data.on("error", reject)
  })
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]

    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") usage()

    if (cmd === "info") {
      const url = args[1]
      if (!url) usage("Usage: node ssstik.js info <tiktok_url>")
      output(await convert(url))
    } else if (cmd === "download" || cmd === "dl") {
      const url = args[1]
      const type = (args[2] || "mp4").toLowerCase()
      const out = args[3] || null
      if (!url) usage("Usage: node ssstik.js download <tiktok_url> [mp4|mp3] [output]")

      const data = await convert(url)
      let fileUrl
      if (type === "mp3") fileUrl = data.audio
      else if (type === "hd") fileUrl = data.video.noWatermarkHd
      else fileUrl = data.video.noWatermark

      if (!fileUrl) fail("Link " + type + " tidak ditemukan di response")
      if (fileUrl.startsWith(BASE)) {
        const r = await client.get(fileUrl, { headers: { Cookie: cookieJar } })
        const redirect = r.headers?.location || (typeof r.data === "string" ? r.data.trim() : null)
        if (redirect && redirect.startsWith("http")) fileUrl = redirect
      }

      const ext = type === "mp3" ? "mp3" : "mp4"
      const fileName = out || sanitizeName((data.title || "tiktok") + " - " + (data.author || "unknown")) + "." + ext

      process.stderr.write("[ssstik] downloading " + type + " → " + fileName + "\n")
      const saved = await downloadFile(fileUrl, fileName, (r, t) => {
        const mb = (r / 1024 / 1024).toFixed(2)
        const tmb = t ? (t / 1024 / 1024).toFixed(2) : "?"
        process.stderr.write("\r[ssstik] " + mb + "/" + tmb + " MB   ")
      })
      process.stderr.write("\n")
      output({ mode: "download", type, url, fileUrl, saved })
    } else {
      usage()
    }
  } catch (e) {
    fail(e.message)
  }
}

main()