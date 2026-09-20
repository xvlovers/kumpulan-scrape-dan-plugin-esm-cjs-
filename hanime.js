/*
**scrape hanime**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/hanime.js**
**base URL: https://hanime.tv**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")

const BASE = "https://hanime.tv"
const API = "https://guest.freeanimehentai.net"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json",
    "Origin": BASE,
    "Referer": BASE + "/"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function pickItem(v) {
  if (!v) return null
  return {
    id: v.id ?? null,
    name: v.name ?? null,
    slug: v.slug ?? null,
    brand: v.brand ?? null,
    views: v.views ?? null,
    likes: v.likes ?? null,
    dislikes: v.dislikes ?? null,
    downloads: v.downloads ?? null,
    cover: v.cover_url ?? null,
    poster: v.poster_url ?? null,
    tags: v.tags ?? [],
    releasedAt: v.released_at ?? null,
    createdAt: v.created_at ?? null,
    url: v.slug ? BASE + "/videos/" + v.slug : null
  }
}

function normalize(resp) {
  if (Array.isArray(resp)) return resp
  if (Array.isArray(resp?.data)) return resp.data
  if (Array.isArray(resp?.hits)) return resp.hits
  return []
}

async function search(query, page = 0) {
  const r = await client.get(API + "/api/v11/search_hvs", {
    params: { query: query || "", page }
  })
  let data = r.data
  if (typeof data === "string") {
    try { data = JSON.parse(data) } catch (_) { data = null }
  }
  if (r.status >= 400) throw new Error("HTTP " + r.status)
  const items = normalize(data).map(pickItem).filter(Boolean)
  return { query: query || "", page, count: items.length, items }
}

async function latest(page = 0) {
  return await search("", page)
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    let result

    if (!cmd || cmd === "latest") {
      const page = Number(args[1] || 0)
      result = { mode: "latest", ...(await latest(page)) }
    } else if (cmd === "search") {
      const q = args.slice(1).join(" ")
      if (!q) throw new Error('Pakai: node hanime.js search "<query>" [page]')
      result = { mode: "search", ...(await search(q, 0)) }
    } else {
      throw new Error([
        "Perintah:",
        "  node hanime.js latest [page]",
        '  node hanime.js search "<query>"'
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()