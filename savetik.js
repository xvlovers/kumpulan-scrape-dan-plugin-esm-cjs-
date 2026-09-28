/*
**scrape savetik**
**author skrep: xvlovers**
**github:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/savetik.js**
**base URL: https://savetik.net**
**credit: xvlovers**
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")

const BASE = "https://savetik.net"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"

const COOKIE = process.env.SAVETIK_COOKIE || "ab_test=2"

const client = axios.create({
  timeout: 60000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9,id-ID;q=0.8",
    "Referer": BASE + "/en2",
    "Origin": BASE,
    ...(COOKIE ? { Cookie: COOKIE } : {})
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function parseJson(d) {
  if (typeof d === "string") { try { return JSON.parse(d) } catch (_) { return null } }
  return d
}

function output(data) {
  console.log(JSON.stringify({ author: "xvlovers", status: true, data }, null, 2))
}

function fail(msg) {
  console.log(JSON.stringify({ author: "xvlovers", status: false, message: msg }, null, 2))
  process.exit(1)
}

function usage(msg) {
  fail(msg || "Usage: node savetik.js <info|download> <tiktok_url> [mp4|mp3|hd] [output]")
}

function sanitizeName(s) {
  return String(s || "tiktok").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100)
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

async function fetchInfo(url) {
  const resolved = await resolveShortUrl(url)
  const r = await client.get(BASE + "/api/action", { params: { url: resolved } })
  const d = parseJson(r.data)
  if (r.status >= 400) {
    const err = typeof r.data === "string" ? r.data.slice(0, 200) : JSON.stringify(d).slice(0, 200)
    throw new Error("API gagal: HTTP " + r.status + " " + err)
  }
  if (!d) throw new Error("Response tidak valid: " + String(r.data).slice(0, 200))
  return { resolvedUrl: resolved, raw: d }
}

function pickVideo(raw, prefer) {
  if (!raw) return null
  const direct = {
    video: raw.video_link || raw.downloadUrl || raw.video || null,
    hd: raw.hdDownloadUrl || raw.hd || null,
    watermark: raw.wmDownloadUrl || raw.wm || null,
    audio: raw.music_link || raw.music || raw.audio || raw.mp3 || null,
    cover: raw.cover || raw.thumbnail || null
  }
  if (prefer === "hd") return direct.hd || direct.video
  if (prefer === "watermark") return direct.watermark || direct.video
  if (prefer === "audio") return direct.audio
  if (prefer === "cover") return direct.cover
  return direct.video || direct.hd
}

function pickInfo(raw) {
  if (!raw) return {}
  const p = raw.postinfo || {}
  const a = p.author || {}
  return {
    title: p.title || p.desc || raw.title || null,
    author: a.nickname || a.unique_id || (typeof p.author === "string" ? p.author : null),
    authorId: a.unique_id || a.id || null,
    cover: p.cover || p.origin_cover || raw.cover || null,
    duration: raw.duration || p.duration || null,
    likes: raw.stats?.diggCount ?? raw.stats?.likes ?? null,
    comments: raw.stats?.commentCount ?? raw.stats?.comments ?? null,
    shares: raw.stats?.shareCount ?? raw.stats?.shares ?? null,
    plays: raw.stats?.playCount ?? raw.stats?.plays ?? null,
    downloads: raw.stats?.downloadCount ?? null,
    statusCode: raw.status_code ?? null
  }
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
      if (!url) usage("Usage: node savetik.js info <tiktok_url>")
      const { resolvedUrl, raw } = await fetchInfo(url)
      output({
        resolvedUrl,
        info: pickInfo(raw),
        video: pickVideo(raw, "video"),
        videoHd: pickVideo(raw, "hd"),
        videoWithWatermark: pickVideo(raw, "watermark"),
        audio: pickVideo(raw, "audio"),
        cover: pickVideo(raw, "cover"),
        rawKeys: Object.keys(raw)
      })
    } else if (cmd === "download" || cmd === "dl") {
      const url = args[1]
      const type = (args[2] || "mp4").toLowerCase()
      const out = args[3] || null
      if (!url) usage("Usage: node savetik.js download <tiktok_url> [mp4|mp3|hd] [output]")

      const { resolvedUrl, raw } = await fetchInfo(url)
      const info = pickInfo(raw)

      let fileUrl
      if (type === "mp3" || type === "audio") fileUrl = pickVideo(raw, "audio")
      else if (type === "hd") fileUrl = pickVideo(raw, "hd")
      else if (type === "wm" || type === "watermark") fileUrl = pickVideo(raw, "watermark")
      else fileUrl = pickVideo(raw, "video")

      if (!fileUrl) fail("Link " + type + " tidak ditemukan di response. Jalankan: node savetik.js info <url>")

      const ext = (type === "mp3" || type === "audio") ? "mp3" : "mp4"
      const fileName = out || sanitizeName((info.title || "tiktok") + " - " + (info.author || "unknown")) + "." + ext

      process.stderr.write("[savetik] downloading " + type + " → " + fileName + "\n")
      const saved = await downloadFile(fileUrl, fileName, (r, t) => {
        const mb = (r / 1024 / 1024).toFixed(2)
        const tmb = t ? (t / 1024 / 1024).toFixed(2) : "?"
        process.stderr.write("\r[savetik] " + mb + "/" + tmb + " MB   ")
      })
      process.stderr.write("\n")
      output({ mode: "download", type, url: resolvedUrl, fileUrl, info, saved })
    } else {
      usage()
    }
  } catch (e) {
    fail(e.message)
  }
}

main()