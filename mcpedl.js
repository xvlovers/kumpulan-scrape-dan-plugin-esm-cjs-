/*
**scrape mcpedl**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/mcpedl.js**
**base URL: https://api.mcpedl.com**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")

const API = "https://api.mcpedl.com"
const WEB = "https://mcpedl.com"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Origin": WEB,
    "Referer": WEB + "/"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function parseJson(d) {
  if (typeof d === "string") { try { return JSON.parse(d) } catch (_) { return null } }
  return d
}

function pickItem(a) {
  if (!a) return null
  const dl = Array.isArray(a.downloads) ? a.downloads : []
  return {
    slug: a.slug ?? null,
    title: a.title ?? null,
    summary: a.summary ?? null,
    image: a.image ?? null,
    images: a.submission_images ?? [],
    thumbnails: a.thumbnails ?? [],
    url: a.slug ? WEB + "/" + a.slug + "/" : null,
    sourceUrl: a.url ?? null,
    downloadsCount: a.downloadCount ?? 0,
    averageRating: parseFloat(a.average_rating) || 0,
    popular: a.popular ?? {},
    tags: (a.tags || []).map(t => t.name).filter(Boolean),
    categories: a.categories ?? [],
    author: a.username ?? null,
    authorAvatar: a.user_avatar ?? null,
    authorId: a.user_id ?? null,
    createdAt: a.created_at ?? null,
    publishedAt: a.publish_date ?? null,
    updatedAt: a.update_date ?? null,
    sortDate: a.sort_date ?? null,
    files: dl.map(f => ({
      name: f.name ?? null,
      filename: f.filename ?? null,
      url: f.downloadUrl ?? null,
      size: f.fileLength ?? null,
      date: f.fileDate ?? null
    })),
    mainDownloadUrl: dl[0]?.downloadUrl ?? null,
    mainFilename: dl[0]?.filename ?? null
  }
}

async function fetchSubmissions(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.append(k, String(v))
  }
  const url = API + "/api/submissions" + (qs.toString() ? "?" + qs.toString() : "")
  const r = await client.get(url)
  if (r.status >= 400) throw new Error("HTTP " + r.status)
  const d = parseJson(r.data)
  if (!d || d.status !== "success") throw new Error("Response tidak valid")
  return { params: d.searchParams || {}, data: d.data || [] }
}

async function latest(limit = 15, from = 0) {
  const res = await fetchSubmissions({ from, size: limit })
  return { mode: "latest", from, size: limit, count: res.data.length, items: res.data.map(pickItem) }
}

async function detail(slug) {
  if (!slug) throw new Error("Slug kosong")
  const url = API + "/api/load-submission-by-type-and-slug?type=addons&slug=" + encodeURIComponent(slug)
  const r = await client.get(url)
  if (r.status >= 400) throw new Error("HTTP " + r.status)
  const d = parseJson(r.data)
  const item = d?.data?.find(x => x.slug === slug) || d?.data?.[0]
  if (!item) throw new Error("Addon tidak ditemukan: " + slug)
  return { mode: "detail", addon: pickItem(item) }
}

async function search(query, limit = 15) {
  if (!query) throw new Error("Query kosong")
  // Search pakai endpoint submissions dengan searchParams via POST body
  const body = {
    query,
    from: 0,
    size: limit
  }
  const r = await client.post(API + "/api/submissions", body, {
    headers: { "Content-Type": "application/json" }
  })
  const d = parseJson(r.data)
  if (d?.status === "success" && Array.isArray(d.data)) {
    return { mode: "search", query, count: d.data.length, items: d.data.map(pickItem) }
  }

  // Fallback: pakai GET tanpa search + filter client-side
  const all = await fetchSubmissions({ from: 0, size: 50 })
  const q = query.toLowerCase()
  const items = all.data
    .filter(a => (a.title || "").toLowerCase().includes(q) || (a.summary || "").toLowerCase().includes(q))
    .map(pickItem)
  return { mode: "search-fallback", query, count: items.length, items }
}

async function searchByKeyword(query, limit = 15) {
  // Pakai index Elasticsearch lewat GET (mirip internal)
  const body = {
    query: { multi_match: { query, fields: ["title", "summary", "tags.name"] } },
    sort: { sort_date: "desc" }
  }
  const r = await client.get(API + "/api/submissions", {
    params: { body: JSON.stringify(body), size: limit, from: 0 }
  })
  const d = parseJson(r.data)
  if (d?.status === "success") {
    return { mode: "search", query, count: d.data.length, items: d.data.map(pickItem) }
  }
  return await search(query, limit)
}

async function download(fileUrl, outPath) {
  if (!fileUrl) throw new Error("URL file kosong")
  const out = outPath || path.join(process.cwd(), decodeURIComponent(fileUrl.split("/").pop() || "addon.mcaddon"))
  const writer = fs.createWriteStream(out)

  const r = await axios.get(fileUrl, {
    responseType: "stream",
    timeout: 0,
    maxContentLength: Infinity,
    headers: { "User-Agent": UA, Referer: WEB + "/" },
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
    let size = 0
    let last = 0
    r.data.on("data", c => {
      size += c.length
      const now = Date.now()
      if (now - last > 1000) {
        last = now
        const pct = total ? ((size / total) * 100).toFixed(1) + "%" : ""
        process.stderr.write("\r[download] " + (size / 1024 / 1024).toFixed(2) + " MB " + pct)
      }
    })
    r.data.pipe(writer)
    writer.on("finish", () => { process.stderr.write("\n"); resolve({ path: out, size, expected: total || null }) })
    writer.on("error", reject)
    r.data.on("error", reject)
  })
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    let result

    if (!cmd || cmd === "latest") {
      result = await latest(Number(args[1] || 15), Number(args[2] || 0))
    } else if (cmd === "search") {
      const q = args.slice(1).join(" ")
      if (!q) throw new Error('Pakai: node mcpedl.js search "keyword"')
      result = await search(q, 15)
    } else if (cmd === "detail") {
      result = await detail(args[1])
    } else if (cmd === "download") {
      const slug = args[1]
      const out = args[2] || null
      if (!slug) throw new Error("Pakai: node mcpedl.js download <slug> [output]")
      const d = await detail(slug)
      const file = d.addon.files[0]
      if (!file || !file.url) throw new Error("File download tidak tersedia")
      const dl = await download(file.url, out || file.filename)
      result = { mode: "download", addon: { slug: d.addon.slug, title: d.addon.title, file: file.name }, saved: dl }
    } else if (cmd === "detail-download") {
      const url = args[1]
      const out = args[2] || null
      if (!url) throw new Error("Pakai: node mcpedl.js detail-download <url> [output]")
      const dl = await download(url, out)
      result = { mode: "detail-download", saved: dl }
    } else {
      throw new Error([
        "Perintah:",
        "  node mcpedl.js latest [limit] [from]",
        '  node mcpedl.js search "<keyword>"',
        "  node mcpedl.js detail <slug>",
        "  node mcpedl.js download <slug> [output]",
        "  node mcpedl.js detail-download <url> [output]"
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()