/*
**scrape youtube music**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/ytmusic.js**
**base URL: https://music.youtube.com**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")

const BASE = "https://music.youtube.com"
const API_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30"
const CLIENT_VERSION = "1.20260915.14.00"
const CLIENT_NAME = "67"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const PARAMS = {
  all: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
  songs: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
  videos: "EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D",
  albums: "EgWKAQIoAWoKEAkQChAFEAMQBA%3D%3D",
  playlists: "EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D",
  artists: "EgWKAQJQAWoKEAkQChAFEAMQBA%3D%3D"
}

const client = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent": UA,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Origin": BASE,
    "Referer": BASE + "/"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function extractText(obj) {
  if (!obj) return null
  if (typeof obj === "string") return obj
  if (obj.simpleText) return obj.simpleText
  if (Array.isArray(obj.runs)) return obj.runs.map(r => r.text).join("")
  return null
}

function findRunsDeep(obj, key = "text") {
  const out = []
  const walk = o => {
    if (!o || typeof o !== "object") return
    if (Array.isArray(o)) { o.forEach(walk); return }
    if (o.runs && Array.isArray(o.runs)) {
      out.push(o.runs.map(r => r.text).join(""))
    }
    if (o.simpleText) out.push(o.simpleText)
    Object.values(o).forEach(walk)
  }
  walk(obj)
  return out
}

function getThumbnail(item) {
  const thumbs = item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
  if (!Array.isArray(thumbs) || !thumbs.length) return null
  return thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || null
}

function pickMusicItem(r) {
  if (!r) return null
  const item = r.musicResponsiveListItemRenderer
  if (!item) return null

  const videoId = item?.playlistItemData?.videoId ||
                  item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ||
                  item?.navigationEndpoint?.watchEndpoint?.videoId ||
                  item?.navigationEndpoint?.browseEndpoint?.browseId ||
                  null

  const pageType = item?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || null

  const flexTexts = []
  if (Array.isArray(item.flexColumns)) {
    for (const col of item.flexColumns) {
      const runs = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
      if (Array.isArray(runs)) {
        const txt = runs.map(x => x.text).join("").trim()
        if (txt) flexTexts.push(txt)
      }
    }
  }

  const title = flexTexts[0] || null
  const subtitle = flexTexts[1] || null
  const third = flexTexts[2] || null

  let artists = []
  let album = null
  let duration = null
  let plays = null

  if (subtitle) {
    const parts = subtitle.split("•").map(s => s.trim()).filter(Boolean)
    const durIdx = parts.findIndex(p => /^\d+:\d+/.test(p))
    if (durIdx >= 0) {
      duration = parts[durIdx]
      plays = parts[durIdx + 1] || null
      const before = parts.slice(0, durIdx)
      if (before.length) {
        if (before.length >= 2) {
          artists = [before[0]]
          album = before.slice(1).join(" • ")
        } else {
          artists = before
        }
      }
    } else {
      if (parts.length >= 2) {
        artists = [parts[0]]
        album = parts.slice(1).join(" • ")
      } else {
        artists = parts
      }
    }
  }

  const badges = []
  const badgeRuns = item?.badges || []
  for (const b of badgeRuns) {
    const txt = b?.musicInlineBadgeRenderer?.accessibilityData?.accessibilityData?.label ||
                b?.musicInlineBadgeRenderer?.icon?.iconType
    if (txt) badges.push(txt)
  }

  return {
    type: pageType || (videoId && videoId.length === 11 ? "song" : "browse"),
    videoId,
    browseId: pageType !== "MUSIC_PAGE_TYPE_TRACK" ? videoId : null,
    title,
    artists,
    album,
    duration,
    plays,
    thumbnail: getThumbnail(item),
    badges,
    raw: { flexTexts }
  }
}

async function callSearch(query, params, continuation = null) {
  const body = {
    context: {
      client: {
        clientName: "WEB_REMIX",
        clientVersion: CLIENT_VERSION,
        hl: "id",
        gl: "ID"
      }
    },
    query,
    params
  }
  if (continuation) body.continuation = continuation

  const r = await client.post(BASE + "/youtubei/v1/search?key=" + API_KEY + "&prettyPrint=false", body)
  if (r.status >= 400) {
    const err = typeof r.data === "string" ? r.data : JSON.stringify(r.data)
    throw new Error("HTTP " + r.status + ": " + err.slice(0, 200))
  }
  let d = r.data
  if (typeof d === "string") { try { d = JSON.parse(d) } catch (_) {} }
  return d
}

function collectFromResponse(d, filterType = null) {
  const out = []
  const tabs = d?.contents?.tabbedSearchResultsRenderer?.tabs || []
  for (const tab of tabs) {
    const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents || []
    for (const sec of sections) {
      const shelf = sec.musicShelfRenderer || sec.musicCardShelfRenderer
      if (!shelf) continue
      const items = shelf.contents || []
      for (const it of items) {
        const picked = pickMusicItem(it)
        if (!picked) continue
        if (filterType && picked.type !== filterType && filterType !== "all") {
          const vid = picked.videoId
          if (filterType === "song" && (!vid || vid.length !== 11)) continue
        }
        out.push(picked)
      }
    }
  }
  return out
}

function findContinuation(d) {
  const tabs = d?.contents?.tabbedSearchResultsRenderer?.tabs || []
  for (const tab of tabs) {
    const contents = tab?.tabRenderer?.content?.sectionListRenderer?.contents || []
    for (const sec of contents) {
      const cont = sec?.musicShelfRenderer?.continuations?.[0]?.nextContinuationData?.continuation ||
                   sec?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
      if (cont) return cont
    }
  }
  return null
}

async function search(query, type = "songs", limit = 20) {
  if (!query) throw new Error("Query kosong")
  const paramKey = PARAMS[type] ? type : "songs"
  const params = PARAMS[paramKey]

  let all = []
  let continuation = null

  for (let i = 0; i < 5; i++) {
    const d = await callSearch(query, params, continuation)
    const items = collectFromResponse(d)
    all.push(...items)
    if (all.length >= limit) break
    continuation = findContinuation(d)
    if (!continuation) break
    await new Promise(r => setTimeout(r, 800))
  }

  return {
    mode: "search",
    query,
    type: paramKey,
    count: Math.min(all.length, limit),
    items: all.slice(0, limit)
  }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]

    let result

    if (!cmd || cmd === "search" || cmd === "songs") {
      const q = cmd === "search" || cmd === "songs" ? args.slice(1).join(" ") : args.join(" ")
      if (!q) throw new Error('Pakai: node ytmusic.js search "<query>" [--limit=N]')
      const limitFlag = args.find(a => a.startsWith("--limit="))
      const limit = limitFlag ? Number(limitFlag.split("=")[1]) : 20
      result = await search(q, "songs", limit)
    } else if (cmd === "videos" || cmd === "albums" || cmd === "playlists" || cmd === "artists") {
      const q = args.slice(1).join(" ")
      if (!q) throw new Error("Pakai: node ytmusic.js " + cmd + ' "<query>"')
      result = await search(q, cmd, 20)
    } else {
      throw new Error([
        "Perintah:",
        '  node ytmusic.js search "<query>" [--limit=N]',
        '  node ytmusic.js songs "<query>"',
        '  node ytmusic.js videos "<query>"',
        '  node ytmusic.js albums "<query>"',
        '  node ytmusic.js playlists "<query>"',
        '  node ytmusic.js artists "<query>"'
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()