/*
**scrape nunodrama**
**author skrep: xvlovers**
*git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/nunodrama.js *
**base URL: https://nunodrama.my.id**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const BASE = "https://nunodrama.my.id"
const API_TOKEN = "a3VjaW5nIGthbXB1bmc="
const PROXY_KEY = "62653239316130386264663034656439"
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"

const COOKIE = process.env.NUNODRAMA_COOKIE || ""

const client = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9,id-ID;q=0.8",
    "Origin": BASE,
    "Referer": BASE + "/",
    "X-Api-Token": API_TOKEN,
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
  fail(msg || "Usage: node nunodrama.js <search|stream|download> <arg>")
}

function sanitizeFilename(name) {
  return String(name || "drama").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 100)
}

function hasFfmpeg() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return true } catch (_) { return false }
}

function pickItem(it) {
  if (!it) return null
  return {
    id: it.id ?? it.bookId ?? null,
    bookId: it.bookId ?? it.id ?? null,
    title: it.title ?? it.bookName ?? null,
    bookName: it.bookName ?? null,
    cover: it.cover ?? null,
    description: it.description ?? it.desc ?? null,
    status: it.status ?? null,
    totalEpisodes: it.totalEpisodes ?? it.episodes ?? null,
    category: it.category ?? it.genre ?? null
  }
}

async function search(query, lang = "id") {
  if (!query) throw new Error("Query kosong")
  const r = await client.get(BASE + "/api/dramaverse/search", { params: { lang, keyword: query } })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d) throw new Error("Search gagal: HTTP " + r.status)
  if (!d.success) throw new Error("Search error: " + (d.message || "unknown"))
  const items = Array.isArray(d.data) ? d.data : []
  return { query, lang, count: items.length, items: items.map(pickItem) }
}

async function stream(bookId, episode) {
  if (!bookId) throw new Error("book_id wajib")
  const ep = Number(episode || 1)
  const r = await client.get(BASE + "/api/dramaverse/stream", {
    params: { book_id: bookId, episode: ep },
    headers: { Referer: BASE + "/watch/dramaverse/" + bookId + "?ep=" + ep }
  })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d) throw new Error("Stream gagal: HTTP " + r.status)
  if (d.success === false && d.message) throw new Error("Stream error: " + d.message)
  if (d.error) throw new Error("Stream error: " + JSON.stringify(d.error).slice(0, 200))

  const findUrl = obj => {
    if (!obj) return null
    if (typeof obj === "string") return obj.startsWith("http") ? obj : null
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && /\.m3u8|bytedrama/.test(v)) return v
      const nested = findUrl(v)
      if (nested) return nested
    }
    return null
  }

  const videoUrl = findUrl(d)
  const proxyUrl = videoUrl
    ? BASE + "/api/dramaverse/proxy_m3u8?url=" + encodeURIComponent(videoUrl) + "&key=" + PROXY_KEY + "&token=" + encodeURIComponent(API_TOKEN)
    : null

  return { bookId, episode: ep, raw: d, videoUrl, proxyUrl }
}

async function downloadVideo(m3u8Url, outPath) {
  if (!hasFfmpeg()) throw new Error("ffmpeg tidak terinstall. Jalankan: pkg install ffmpeg")
  const out = outPath || path.join(process.cwd(), "nunodrama-" + Date.now() + ".mp4")
  const headers = "X-Api-Token: " + API_TOKEN + "\r\nReferer: " + BASE + "/\r\n"
  const cmd = 'ffmpeg -y -headers "' + headers + '" -i "' + m3u8Url + '" -c copy -bsf:a aac_adtstoasc "' + out + '"'
  process.stderr.write("[nunodrama] download via ffmpeg...\n")
  try {
    execSync(cmd, { stdio: ["ignore", "ignore", "inherit"] })
  } catch (e) {
    throw new Error("ffmpeg gagal: " + e.message.slice(0, 200))
  }
  const stat = fs.statSync(out)
  return { path: out, size: stat.size }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]

    if (!cmd || cmd === "help") usage()

    if (cmd === "search") {
      const q = args.slice(1).join(" ")
      if (!q) usage("Usage: node nunodrama.js search <query>")
      output(await search(q))
    } else if (cmd === "stream") {
      const bookId = args[1]
      const ep = args[2] || 1
      if (!bookId) usage("Usage: node nunodrama.js stream <book_id> [episode]")
      output(await stream(bookId, ep))
    } else if (cmd === "download") {
      const bookId = args[1]
      const ep = args[2] || 1
      const out = args[3] || null
      if (!bookId) usage("Usage: node nunodrama.js download <book_id> [episode] [output.mp4]")
      const s = await stream(bookId, ep)
      if (!s.proxyUrl && !s.videoUrl) fail("m3u8 URL tidak ditemukan di response")
      const url = s.proxyUrl || s.videoUrl
      const fileName = out || sanitizeFilename("nunodrama-" + bookId + "-ep" + ep) + ".mp4"
      const saved = await downloadVideo(url, fileName)
      output({ mode: "download", bookId, episode: ep, videoUrl: s.videoUrl, saved })
    } else {
      usage()
    }
  } catch (e) {
    fail(e.message)
  }
}

main()