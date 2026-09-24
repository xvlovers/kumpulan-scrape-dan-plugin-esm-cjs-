/*
**scrape y2mate**
**author skrep: xvlovers**
*git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/y2mate.js*
**base URL: https://y2mate.gs**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")

const API_KEY = process.env.Y2MATE_API_KEY
if (!API_KEY) throw new Error("Y2MATE_API_KEY env var wajib diset")
const API_HOST = "https://eta.etacloud.org"
const REFERER = "https://y2mate.gs/"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 120000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Origin": REFERER.replace(/\/$/, ""),
    "Referer": REFERER
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function parseYoutubeId(url) {
  if (!url) throw new Error("URL YouTube kosong")
  const re = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|live\/|shorts\/)|[?&]v=)([a-zA-Z0-9_-]{11})/
  const m = String(url).match(re)
  if (!m) throw new Error("URL YouTube tidak valid")
  return m[1]
}

function parseJson(data) {
  if (typeof data === "string") {
    try { return JSON.parse(data) } catch (_) { return null }
  }
  return data
}

function hasError(d) {
  if (!d) return true
  return Number(d.error ?? d.err ?? 0) > 0
}

async function auth() {
  const r = await client.get(API_HOST + "/api/v1/auth", {
    params: { api_key: API_KEY, _: Date.now() }
  })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d || hasError(d)) throw new Error("Auth gagal")
  return d
}

async function init(key) {
  const r = await client.get(API_HOST + "/api/v1/init", {
    params: { _: Date.now() },
    headers: { Authorization: "Bearer " + key }
  })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d || hasError(d)) throw new Error("Init gagal")
  return d
}

async function callConvert(url, videoId, format) {
  const base = url.split("&v=")[0]
  const r = await client.get(base, {
    params: { v: videoId, f: format, _: Date.now() }
  })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d) throw new Error("Convert gagal: HTTP " + r.status)
  if (Number(d.error) > 0) throw new Error("Convert error: " + d.error)
  return d
}

async function callProgress(progressUrl) {
  const r = await client.get(progressUrl, { params: { _: Date.now() } })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d) throw new Error("Progress gagal: HTTP " + r.status)
  if (Number(d.error) > 0) throw new Error("Progress error: " + d.error)
  return d
}

async function getDownloadUrl(youtubeUrl, format = "mp3", maxWait = 120, onStatus) {
  const videoId = parseYoutubeId(youtubeUrl)
  const fmt = String(format).toLowerCase()
  if (!["mp3", "mp4"].includes(fmt)) throw new Error("Format harus mp3 atau mp4")

  const status = typeof onStatus === "function" ? onStatus : () => {}

  status("auth")
  const authRes = await auth()
  status("init")
  const initRes = await init(authRes.key)

  let currentUrl = initRes.convertURL
  let title = ""
  let downloadURL = ""
  let progressURL = ""
  const startTime = Date.now()
  const timeoutMs = maxWait * 1000

  for (let i = 0; i < 30; i++) {
    if (Date.now() - startTime > timeoutMs) throw new Error("Timeout")

    const res = await callConvert(currentUrl, videoId, fmt)

    if (res.title) title = res.title
    if (res.downloadURL) { downloadURL = res.downloadURL; break }
    if (res.progressURL) progressURL = res.progressURL

    if (res.redirectURL) {
      currentUrl = res.redirectURL
      status("redirect-" + i)
      await new Promise(r => setTimeout(r, 1000))
      continue
    }
    if (res.redirect && res.redirectURL) {
      currentUrl = res.redirectURL
      continue
    }
    break
  }

  if (!downloadURL && progressURL) {
    status("progress-start")
    const pollStart = Date.now()
    while (Date.now() - pollStart < timeoutMs) {
      await new Promise(r => setTimeout(r, 3000))
      const pr = await callProgress(progressURL)
      if (pr.title) title = pr.title
      if (pr.downloadURL) { downloadURL = pr.downloadURL; break }
      if (pr.redirectURL) {
        const rr = await callConvert(pr.redirectURL, videoId, fmt)
        if (rr.title) title = rr.title
        if (rr.downloadURL) { downloadURL = rr.downloadURL; break }
        if (rr.progressURL) progressURL = rr.progressURL
      }
      if (Number(pr.progress) >= 3 && !pr.downloadURL) {
        throw new Error("Konversi selesai tapi downloadURL kosong")
      }
      status("progress-" + (pr.progress || 0))
    }
  }

  if (!downloadURL) throw new Error("Download URL tidak ditemukan setelah redirect & progress")

  return {
    videoId,
    format: fmt,
    title: title || null,
    downloadURL,
    directURL: downloadURL + "&v=" + videoId + "&f=" + fmt + "&r=" + encodeURIComponent("y2mate.gs")
  }
}

async function downloadFile(url, outPath, onProgress) {
  const out = outPath || path.join(process.cwd(), "download-" + Date.now())
  const writer = fs.createWriteStream(out)

  const r = await axios.get(url, {
    responseType: "stream",
    timeout: 0,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      "User-Agent": UA,
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "Referer": REFERER,
      "Origin": REFERER.replace(/\/$/, "")
    },
    validateStatus: s => s < 600
  })

  if (r.status >= 400) {
    writer.close()
    try { fs.unlinkSync(out) } catch (_) {}
    throw new Error("Download gagal: HTTP " + r.status)
  }

  const total = Number(r.headers["content-length"] || 0)

  return new Promise((resolve, reject) => {
    let received = 0
    let lastReport = 0

    r.data.on("data", chunk => {
      received += chunk.length
      if (typeof onProgress === "function" && Date.now() - lastReport > 1000) {
        lastReport = Date.now()
        const pct = total ? ((received / total) * 100).toFixed(1) : null
        onProgress(received, total, pct)
      }
    })

    r.data.pipe(writer)
    writer.on("finish", () => resolve({ path: out, size: received, expected: total || null }))
    writer.on("error", reject)
    r.data.on("error", reject)
  })
}

function safeName(title, videoId, ext) {
  const base = (title || videoId).replace(/[^\w\s\-.]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80)
  return base + "." + ext
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    let result

    const log = msg => process.stderr.write("[y2mate] " + msg + "\n")

    if (cmd === "info" || cmd === "get") {
      const url = args[1]
      const fmt = (args[2] || "mp3").toLowerCase()
      if (!url) throw new Error('URL YouTube wajib. Contoh: node y2mate.js get "https://youtu.be/xxx" mp3')
      const data = await getDownloadUrl(url, fmt, 120, log)
      result = { mode: "info", ...data }
    } else if (cmd === "download" || cmd === "dl") {
      const url = args[1]
      const fmt = (args[2] || "mp3").toLowerCase()
      const outArg = args[3]
      if (!url) throw new Error('URL YouTube wajib. Contoh: node y2mate.js download "https://youtu.be/xxx" mp3')
      const data = await getDownloadUrl(url, fmt, 120, log)
      const ext = fmt === "mp3" ? "mp3" : "mp4"
      const outPath = outArg || path.join(process.cwd(), safeName(data.title, data.videoId, ext))
      log("download-start → " + outPath)
      const dl = await downloadFile(data.directURL, outPath, (received, total, pct) => {
        const mb = (received / 1024 / 1024).toFixed(2)
        const totalMb = total ? (total / 1024 / 1024).toFixed(2) : "?"
        process.stderr.write("\r[y2mate] " + mb + "/" + totalMb + " MB" + (pct ? " (" + pct + "%)" : "") + "   ")
      })
      process.stderr.write("\n")
      result = { mode: "download", ...data, saved: dl }
    } else if (cmd === "auth") {
      const a = await auth()
      result = { mode: "auth", ...a }
    } else {
      throw new Error([
        "Perintah:",
        '  node y2mate.js get "<youtube_url>" [mp3|mp4]',
        '  node y2mate.js download "<youtube_url>" [mp3|mp4] [output]',
        "  node y2mate.js auth",
        "",
        "Contoh:",
        '  node y2mate.js get "https://youtu.be/dQw4w9WgXcQ" mp3',
        '  node y2mate.js download "https://youtu.be/dQw4w9WgXcQ" mp3 lagu.mp3'
      ].join("\n"))
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: result
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