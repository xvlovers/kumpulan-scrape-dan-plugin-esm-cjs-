/*
**scrape tmpfile**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/tmpfile.js**
**base URL: https://tmpfile.link**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")
const FormData = require("form-data")

const BASE = "https://tmpfile.link"
const API_UPLOAD = BASE + "/api/upload"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const client = axios.create({
  timeout: 300000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    "Origin": BASE,
    "Referer": BASE + "/"
  },
  maxRedirects: 5,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
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
  fail(msg || "Usage: node tmpfile.js <upload|download> <arg>")
}

async function uploadFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error("File tidak ditemukan: " + filePath)

  const stat = fs.statSync(filePath)
  if (stat.size > 100 * 1024 * 1024) {
    throw new Error("File terlalu besar (" + (stat.size / 1024 / 1024).toFixed(2) + " MB > 100 MB)")
  }

  const fd = new FormData()
  fd.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: "application/octet-stream"
  })

  process.stderr.write("[tmpfile] uploading " + path.basename(filePath) + " (" + (stat.size / 1024).toFixed(1) + " KB)...\n")

  const r = await client.post(API_UPLOAD, fd, {
    headers: fd.getHeaders()
  })

  const d = parseJson(r.data)
  if (r.status >= 400 || !d) {
    const err = typeof r.data === "string" ? r.data.slice(0, 300) : JSON.stringify(d).slice(0, 300)
    throw new Error("Upload gagal: HTTP " + r.status + " " + err)
  }

  return {
    input: { name: path.basename(filePath), size: stat.size },
    response: d,
    downloadUrl: d.downloadUrl || d.url || d.link || d.download_url || null,
    fileId: d.fileId || d.id || null,
    expiresAt: d.expiresAt || d.expires_at || null
  }
}

async function downloadFile(url, outPath) {
  const abs = url.startsWith("http") ? url : BASE + url
  const outName = outPath || path.basename(abs.split("?")[0]) || "tmpfile-" + Date.now()
  const out = path.join(process.cwd(), outName)
  const writer = fs.createWriteStream(out)

  const r = await axios.get(abs, {
    responseType: "stream",
    timeout: 0,
    maxContentLength: Infinity,
    headers: {
      "User-Agent": UA,
      "Accept": "*/*",
      "Referer": BASE + "/"
    },
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
        const pct = total ? ((size / total) * 100).toFixed(1) + "%" : ""
        process.stderr.write("\r[tmpfile] " + (size / 1024).toFixed(1) + " KB " + pct + "   ")
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

    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") usage()

    if (cmd === "upload" || cmd === "up") {
      const file = args[1]
      if (!file) usage("Usage: node tmpfile.js upload <file>")
      const result = await uploadFile(file)
      output(result)
    } else if (cmd === "download" || cmd === "dl") {
      const url = args[1]
      const out = args[2] || null
      if (!url) usage("Usage: node tmpfile.js download <url> [output]")
      const result = await downloadFile(url, out)
      output({ mode: "download", url, saved: result })
    } else {
      usage()
    }
  } catch (e) {
    fail(e.message)
  }
}

main()