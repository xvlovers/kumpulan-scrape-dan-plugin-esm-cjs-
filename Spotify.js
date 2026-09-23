/*
**scrape spotify**
**author skrep: xvlovers**
*git: https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/spotify.js *
**base URL: https://spotsaver.net**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const BASE = "https://spotsaver.net"
const YTM_API = "https://music.youtube.com/youtubei/v1/search"
const YTM_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30"
const YTM_VERSION = "1.20260915.14.00"
const Y2MATE_API = "https://eta.etacloud.org"
const Y2MATE_KEY = "c6a644f406b57d0dd83837c868a7482e"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 90000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Referer": BASE + "/id/",
    "Origin": BASE
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

const y2mateClient = axios.create({
  timeout: 90000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://y2mate.gs",
    "Referer": "https://y2mate.gs/"
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
  fail(msg || "Usage: node spotify.js <search|info|preview|download|batch> <arg>")
}

function sanitizeFilename(name) {
  return String(name || "track")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
}

function hasFfmpeg() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return true } catch (_) { return false }
}

function tagAudio(filePath, meta) {
  if (!hasFfmpeg()) return { tagged: false, reason: "ffmpeg-not-installed" }
  try {
    const args = ["-y", "-i", JSON.stringify(filePath)]
    if (meta.title) args.push("-metadata", "title=" + JSON.stringify(meta.title))
    if (meta.artist) args.push("-metadata", "artist=" + JSON.stringify(meta.artist))
    if (meta.album) args.push("-metadata", "album=" + JSON.stringify(meta.album))
    const tmp = filePath.replace(/\.mp3$/i, ".tagged.mp3")
    args.push("-codec", "copy", JSON.stringify(tmp))
    execSync("ffmpeg " + args.join(" "), { stdio: "ignore" })
    fs.unlinkSync(filePath)
    fs.renameSync(tmp, filePath)
    return { tagged: true }
  } catch (e) {
    return { tagged: false, reason: e.message.slice(0, 100) }
  }
}

function pickTrack(t) {
  if (!t) return null
  return {
    id: t.id ?? null,
    title: t.title ?? null,
    artist: t.artist ?? null,
    album: t.album ?? null,
    duration: t.duration ?? null,
    thumbnail: t.thumbnail ?? null,
    previewUrl: t.previewUrl ?? t.preview_url ?? null,
    spotifyUrl: t.id && String(t.id).length === 22 ? "https://open.spotify.com/track/" + t.id : null
  }
}

async function spotsaverSearch(q) {
  if (!q) throw new Error("Query kosong")
  const r = await client.get(BASE + "/api/spotify", { params: { q } })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d?.items) throw new Error("Search gagal: HTTP " + r.status)
  return { query: q, type: d.type || "search", count: d.items.length, items: d.items.map(pickTrack) }
}

async function spotsaverInfo(url) {
  if (!url) throw new Error("URL kosong")
  const r = await client.get(BASE + "/api/spotify", { params: { url } })
  const d = parseJson(r.data)
  if (r.status >= 400 || !d?.items) throw new Error("Info gagal: HTTP " + r.status)
  return { type: d.type, url, count: d.items.length, items: d.items.map(pickTrack) }
}

async function saveAudio(audioUrl, outPath, onProgress) {
  const out = outPath || path.join(process.cwd(), "track-" + Date.now() + ".mp3")
  const writer = fs.createWriteStream(out)
  const r = await axios.get(audioUrl, {
    responseType: "stream",
    timeout: 0,
    maxContentLength: Infinity,
    headers: {
      "User-Agent": UA,
      "Accept": "*/*",
      "Origin": "https://y2mate.gs",
      "Referer": "https://y2mate.gs/"
    },
    validateStatus: s => s < 600
  })
  if (r.status >= 400) {
    writer.close()
    try { fs.unlinkSync(out) } catch (_) {}
    throw new Error("Save gagal: HTTP " + r.status)
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

async function ytmSearch(query) {
  const body = {
    context: { client: { clientName: "WEB_REMIX", clientVersion: YTM_VERSION, hl: "id", gl: "ID" } },
    query,
    params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D"
  }
  const r = await axios.post(YTM_API + "?key=" + YTM_KEY + "&prettyPrint=false", body, {
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      "X-Goog-Api-Key": YTM_KEY,
      "X-YouTube-Client-Name": "67",
      "X-YouTube-Client-Version": YTM_VERSION,
      "Origin": "https://music.youtube.com",
      "Referer": "https://music.youtube.com/"
    },
    timeout: 20000,
    validateStatus: s => s < 600,
    transformResponse: [v => v]
  })
  let d = r.data
  if (typeof d === "string") { try { d = JSON.parse(d) } catch (_) {} }
  const out = []
  const tabs = d?.contents?.tabbedSearchResultsRenderer?.tabs || []
  for (const tab of tabs) {
    const secs = tab?.tabRenderer?.content?.sectionListRenderer?.contents || []
    for (const sec of secs) {
      const shelf = sec.musicShelfRenderer
      if (!shelf) continue
      for (const it of shelf.contents || []) {
        const item = it.musicResponsiveListItemRenderer
        if (!item) continue
        const vid = item?.playlistItemData?.videoId || null
        const flexTexts = (item.flexColumns || []).map(col => {
          const runs = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []
          return runs.map(x => x.text).join("").trim()
        }).filter(Boolean)
        const thumb = item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
        const image = Array.isArray(thumb) && thumb.length ? thumb[thumb.length - 1].url : null
        if (vid && flexTexts[0]) {
          out.push({
            videoId: vid,
            title: flexTexts[0],
            subtitle: flexTexts[1] || null,
            thumbnail: image
          })
        }
      }
    }
  }
  return out
}

async function y2mateAuth() {
  const r = await y2mateClient.get(Y2MATE_API + "/api/v1/auth", {
    params: { api_key: Y2MATE_KEY, _: Date.now() }
  })
  const d = parseJson(r.data)
  if (!d?.key) throw new Error("y2mate auth gagal: " + JSON.stringify(d).slice(0, 200))
  return d.key
}

async function y2mateInit(key) {
  const r = await y2mateClient.get(Y2MATE_API + "/api/v1/init", {
    params: { _: Date.now() },
    headers: { Authorization: "Bearer " + key }
  })
  const d = parseJson(r.data)
  if (!d?.convertURL) throw new Error("y2mate init gagal: " + JSON.stringify(d).slice(0, 200))
  return d
}

async function y2mateConvert(url, videoId) {
  const base = url.split("&v=")[0]
  const r = await y2mateClient.get(base, { params: { v: videoId, f: "mp3", _: Date.now() } })
  const d = parseJson(r.data)
  if (!d) throw new Error("y2mate convert invalid response")
  if (Number(d.error) > 0) throw new Error("y2mate convert error: " + d.error)
  return d
}

async function y2mateProgress(progressUrl) {
  const r = await y2mateClient.get(progressUrl, { params: { _: Date.now() } })
  const d = parseJson(r.data)
  if (!d) throw new Error("y2mate progress invalid response")
  if (Number(d.error) > 0) throw new Error("y2mate progress error: " + d.error)
  return d
}

async function y2mateGetMp3(videoId) {
  const auth = await y2mateAuth()
  const init = await y2mateInit(auth)
  let currentUrl = init.convertURL
  let downloadURL = null
  let progressURL = null

  for (let i = 0; i < 20; i++) {
    const d = await y2mateConvert(currentUrl, videoId)
    if (d.downloadURL) { downloadURL = d.downloadURL; break }
    if (d.progressURL) progressURL = d.progressURL
    if (d.redirectURL) {
      currentUrl = d.redirectURL
      await new Promise(x => setTimeout(x, 1500))
      continue
    }
    break
  }

  if (!downloadURL && progressURL) {
    for (let i = 0; i < 30; i++) {
      await new Promise(x => setTimeout(x, 3000))
      const d = await y2mateProgress(progressURL)
      if (d.downloadURL) { downloadURL = d.downloadURL; break }
      if (d.redirectURL) {
        const rd = await y2mateConvert(d.redirectURL, videoId)
        if (rd.downloadURL) { downloadURL = rd.downloadURL; break }
        if (rd.progressURL) progressURL = rd.progressURL
      }
      if (Number(d.progress) >= 3) break
    }
  }

  if (!downloadURL) throw new Error("y2mate: downloadURL tidak ditemukan")
  return downloadURL + "&v=" + videoId + "&f=mp3&r=y2mate.gs"
}

async function doDownload(queryOrUrl, outputPath, opts = {}) {
  let searchQuery = queryOrUrl
  let title = null
  let artist = null
  let album = null
  let thumbnail = null

  if (/open\.spotify\.com/i.test(queryOrUrl)) {
    process.stderr.write("[spotify] resolve spotify url...\n")
    const info = await spotsaverInfo(queryOrUrl.split("?")[0])
    const track = info.items[0]
    if (track) {
      searchQuery = track.title + (track.artist ? " " + track.artist : "")
      title = track.title
      artist = track.artist
      album = track.album
      thumbnail = track.thumbnail
    }
  }

  process.stderr.write("[spotify] search: " + searchQuery + "\n")
  const yt = await ytmSearch(searchQuery)
  if (!yt.length) throw new Error("Tidak ada hasil di YouTube Music")
  const top = yt[0]
  process.stderr.write("[spotify] match: " + top.title + " (" + top.videoId + ")\n")

  const mp3Url = await y2mateGetMp3(top.videoId)
  const rawName = opts.filename || (title ? (artist ? title + " - " + artist : title) : top.title)
  const safeName = sanitizeFilename(rawName) + ".mp3"
  const finalPath = outputPath || path.join(process.cwd(), safeName)

  process.stderr.write("[spotify] downloading → " + path.basename(finalPath) + "\n")
  const saved = await saveAudio(mp3Url, finalPath, (received, total) => {
    const mb = (received / 1024 / 1024).toFixed(2)
    const totalMb = total ? (total / 1024 / 1024).toFixed(2) : "?"
    process.stderr.write("\r[spotify] " + mb + "/" + totalMb + " MB   ")
  })
  process.stderr.write("\n")

  let tagResult = { tagged: false, reason: "disabled" }
  if (opts.tag !== false) {
    process.stderr.write("[spotify] tagging metadata...\n")
    tagResult = tagAudio(finalPath, { title: title || top.title, artist, album })
    if (!tagResult.tagged) process.stderr.write("[spotify] tag skip: " + (tagResult.reason || "unknown") + "\n")
  }

  return {
    mode: "download",
    query: queryOrUrl,
    matched: { title: title || top.title, artist, album, videoId: top.videoId, thumbnail: thumbnail || top.thumbnail },
    saved,
    tagged: tagResult.tagged
  }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]

    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
      usage()
    }

    if (cmd === "search") {
      const q = args.slice(1).join(" ")
      if (!q) usage("Usage: node spotify.js search <query>")
      output(await spotsaverSearch(q))
    } else if (cmd === "info") {
      const url = args[1]
      if (!url) usage("Usage: node spotify.js info <spotify_url>")
      output(await spotsaverInfo(url))
    } else if (cmd === "preview") {
      const url = args[1]
      const out = args[2] || null
      if (!url) usage("Usage: node spotify.js preview <spotify_url> [output.mp3]")
      const info = await spotsaverInfo(url)
      const track = info.items[0]
      if (!track?.previewUrl) fail("Preview URL tidak tersedia")
      const saved = await saveAudio(track.previewUrl, out, (r, t) => {
        const kb = (r / 1024).toFixed(1)
        process.stderr.write("\r[spotify] " + kb + " KB   ")
      })
      process.stderr.write("\n")
      output({ mode: "preview", track, saved })
    } else if (cmd === "download" || cmd === "dl") {
      const isMp3Arg = args[args.length - 1] && args[args.length - 1].toLowerCase().endsWith(".mp3")
      const outPath = isMp3Arg ? args.pop() : null
      const query = args.slice(1).join(" ")
      if (!query) usage("Usage: node spotify.js download <query_or_url> [output.mp3]")
      output(await doDownload(query, outPath))
    } else if (cmd === "batch") {
      const listFile = args[1]
      if (!listFile || !fs.existsSync(listFile)) usage("Usage: node spotify.js batch <list.txt>")
      const lines = fs.readFileSync(listFile, "utf8").split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const results = []
      for (let i = 0; i < lines.length; i++) {
        const q = lines[i]
        process.stderr.write("\n=== [" + (i + 1) + "/" + lines.length + "] " + q + " ===\n")
        try {
          results.push(await doDownload(q, null))
        } catch (e) {
          results.push({ query: q, error: e.message })
        }
        await new Promise(r => setTimeout(r, 2000))
      }
      output({ mode: "batch", total: results.length, results })
    } else {
      usage()
    }
  } catch (e) {
    fail(e.message)
  }
}

main()