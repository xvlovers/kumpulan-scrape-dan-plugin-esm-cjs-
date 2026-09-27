/*
**scrape mineaddons**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/mineaddons.js**
**base URL: https://www.mineaddons.web.id**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")

const BASE = "https://www.mineaddons.web.id"
const SUPABASE = "https://uegktacgipzmwefwueki.supabase.co"
const ANON_KEY = process.env.MINEADDONS_SUPABASE_ANON_KEY
if (!ANON_KEY) throw new Error("MINEADDONS_SUPABASE_ANON_KEY env var wajib diset")
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": UA,
    "apikey": ANON_KEY,
    "Authorization": "Bearer " + ANON_KEY,
    "Accept": "application/json"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

async function query(params = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = SUPABASE + "/rest/v1/addons?" + qs
  const r = await client.get(url)
  if (r.status >= 400) {
    const err = typeof r.data === "string" ? r.data : JSON.stringify(r.data)
    throw new Error("Supabase error " + r.status + ": " + err.slice(0, 200))
  }
  let d = r.data
  if (typeof d === "string") { try { d = JSON.parse(d) } catch (_) {} }
  return Array.isArray(d) ? d : []
}

function pickItem(a) {
  if (!a) return null
  return {
    id: a.id ?? null,
    name: a.name ?? null,
    slug: a.slug ?? null,
    description: a.description ?? null,
    image: a.image_url ?? null,
    version: a.version ?? null,
    author: a.author ?? null,
    mcVersion: a.mc_version_tag ?? null,
    isPremium: !!a.is_premium,
    downloadUrl: a.download_url ?? null,
    premiumDownloadUrl: a.premium_download_url ?? null,
    downloadCount: a.download_count ?? 0,
    likes: a.likes ?? 0,
    shares: a.shares ?? 0,
    rating: a.rating ?? 0,
    ratingCount: a.rating_count ?? 0,
    status: a.status ?? null,
    linkStatus: a.link_status ?? null,
    uploaderId: a.uploader_id ?? null,
    createdAt: a.created_at ?? null,
    updatedAt: a.updated_at ?? null,
    url: a.slug ? BASE + "/addons/" + a.slug : null
  }
}

async function latest(limit = 20) {
  const items = await query({
    select: "*",
    status: "eq.approved",
    order: "created_at.desc",
    limit: String(limit)
  })
  return { mode: "latest", count: items.length, items: items.map(pickItem) }
}

async function trending(limit = 20) {
  const items = await query({
    select: "*",
    status: "eq.approved",
    order: "download_count.desc",
    limit: String(limit)
  })
  return { mode: "trending", count: items.length, items: items.map(pickItem) }
}

async function popular(limit = 20) {
  const items = await query({
    select: "*",
    status: "eq.approved",
    order: "likes.desc",
    limit: String(limit)
  })
  return { mode: "popular", count: items.length, items: items.map(pickItem) }
}

async function topRated(limit = 20) {
  const items = await query({
    select: "*",
    status: "eq.approved",
    "rating": "gt.0",
    order: "rating.desc",
    limit: String(limit)
  })
  return { mode: "top-rated", count: items.length, items: items.map(pickItem) }
}

async function search(q, limit = 30) {
  if (!q) throw new Error("Query kosong")
  const items = await query({
    select: "*",
    status: "eq.approved",
    or: "(name.ilike.*" + q + "*,description.ilike.*" + q + "*,author.ilike.*" + q + "*)",
    order: "download_count.desc",
    limit: String(limit)
  })
  return { mode: "search", query: q, count: items.length, items: items.map(pickItem) }
}

async function detail(idOrSlug) {
  if (!idOrSlug) throw new Error("ID/slug kosong")
  const isNumeric = /^\d+$/.test(String(idOrSlug))
  const items = await query({
    select: "*",
    ...(isNumeric ? { id: "eq." + idOrSlug } : { slug: "eq." + idOrSlug }),
    limit: "1"
  })
  if (!items.length) throw new Error("Addon tidak ditemukan")
  return { mode: "detail", addon: pickItem(items[0]) }
}

async function allVersions() {
  const items = await query({ select: "version", limit: "1000" })
  const set = new Set(items.map(i => i.version).filter(Boolean))
  return { mode: "versions", versions: [...set] }
}

async function stats() {
  const all = await query({ select: "id", limit: "10000" })
  const premium = await query({ select: "id", is_premium: "eq.true", limit: "10000" })
  return {
    mode: "stats",
    totalAddons: all.length,
    totalPremium: premium.length,
    totalFree: all.length - premium.length
  }
}

async function download(url, outName) {
  if (!url) throw new Error("URL download kosong")
  const safeOutName = safeName(outName || ("addon-" + Date.now() + ".mcaddon"))
  const out = path.join(process.cwd(), safeOutName)
  const writer = fs.createWriteStream(out)

  const r = await axios.get(url, {
    responseType: "stream",
    timeout: 0,
    maxContentLength: Infinity,
    headers: { "User-Agent": UA, Referer: BASE + "/" },
    validateStatus: s => s < 600,
    maxRedirects: 10
  })

  if (r.status >= 400) {
    writer.close()
    try { fs.unlinkSync(out) } catch (_) {}
    throw new Error("Download gagal: HTTP " + r.status)
  }

  return new Promise((resolve, reject) => {
    let size = 0
    let last = 0
    r.data.on("data", c => {
      size += c.length
      const now = Date.now()
      if (now - last > 1000) {
        last = now
        process.stderr.write("\r[download] " + (size / 1024).toFixed(1) + " KB")
      }
    })
    r.data.pipe(writer)
    writer.on("finish", () => { process.stderr.write("\n"); resolve({ path: out, size }) })
    writer.on("error", reject)
    r.data.on("error", reject)
  })
}

function safeName(s) {
  return String(s || "addon").replace(/[^\w\s\-.]/g, "_").slice(0, 80)
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    let result

    if (!cmd || cmd === "latest") {
      result = await latest(Number(args[1] || 20))
    } else if (cmd === "trending") {
      result = await trending(Number(args[1] || 20))
    } else if (cmd === "popular") {
      result = await popular(Number(args[1] || 20))
    } else if (cmd === "top-rated") {
      result = await topRated(Number(args[1] || 20))
    } else if (cmd === "search") {
      result = await search(args.slice(1).join(" "), 30)
    } else if (cmd === "detail") {
      result = await detail(args[1])
    } else if (cmd === "versions") {
      result = await allVersions()
    } else if (cmd === "stats") {
      result = await stats()
    } else if (cmd === "download") {
      const id = args[1]
      if (!id) throw new Error("Pakai: download <id_or_slug> [output]")
      const d = await detail(id)
      const addon = d.addon
      const url = addon.isPremium ? addon.premiumDownloadUrl : addon.downloadUrl
      if (!url) throw new Error("URL download tidak tersedia")
      const ext = /\.mcpack/i.test(url) ? ".mcpack" : /\.zip/i.test(url) ? ".zip" : ".mcaddon"
      const outName = args[2] || safeName(addon.name) + ext
      const dl = await download(url, outName)
      result = { mode: "download", addon, saved: dl }
    } else {
      throw new Error([
        "Perintah:",
        "  node mineaddons.js latest [limit]",
        "  node mineaddons.js trending [limit]",
        "  node mineaddons.js popular [limit]",
        "  node mineaddons.js top-rated [limit]",
        '  node mineaddons.js search "<keyword>"',
        "  node mineaddons.js detail <id_or_slug>",
        "  node mineaddons.js download <id_or_slug> [output]",
        "  node mineaddons.js versions",
        "  node mineaddons.js stats"
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()