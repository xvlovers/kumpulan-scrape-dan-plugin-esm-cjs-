/*
**scrape zfile uploader**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/zfile.js **
**base URL: https://zfile.web.id**
**credit: zfile**

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { createClient } = require("@supabase/supabase-js")

const BASE_URL = "https://zfile.web.id"
const INIT_API = `${BASE_URL}/api/v1/upload/init`
const FINALIZE_API = `${BASE_URL}/api/v1/upload/finalize`

const COOKIE = "zfile_verified=1789081248663.7455881472ed1fb9a1bde07a1b1183f1a71c9af70f14d6c4870238f7bea17cd3"

function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase()
  const mimes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".json": "application/json",
    ".zip": "application/zip",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime"
  }
  return mimes[ext] || "application/octet-stream"
}

async function initUpload(filePath, expiry) {
  const fileName = path.basename(filePath)
  const fileBuffer = fs.readFileSync(filePath)
  const fileSize = fileBuffer.length
  const mimeType = getMimeType(fileName)
  const contentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex")

  const response = await axios.post(INIT_API, {
    filename: fileName,
    size: fileSize,
    mimeType,
    expiry: expiry || "never",
    contentHash
  }, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Cookie": COOKIE
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function uploadToSignedUrl(init, fileBuffer, mimeType) {
  const supabase = createClient(init.upload.supabaseUrl, init.upload.anonKey)

  const { data, error } = await supabase.storage
    .from(init.upload.bucket)
    .uploadToSignedUrl(init.upload.path, init.upload.token, fileBuffer, {
      contentType: mimeType
    })

  if (error) throw new Error(error.message)

  return data
}

async function finalizeUpload(ticket) {
  const response = await axios.post(FINALIZE_API, {
    ticket
  }, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Cookie": COOKIE
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function main() {
  const filePath = process.argv[2]
  const expiry = process.argv[3] || "never"

  if (!filePath) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node zfile.js <file-path> [expiry: never|1h|1d|7d|30d|1y]"
    }, null, 2))
    process.exit(1)
  }

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File tidak ditemukan: " + filePath)
    }

    const fileBuffer = fs.readFileSync(filePath)
    const fileName = path.basename(filePath)
    const mimeType = getMimeType(fileName)

    const init = await initUpload(filePath, expiry)

    if (init.status !== 200) {
      throw new Error(`Init gagal: HTTP ${init.status} - ${JSON.stringify(init.data)}`)
    }

    if (init.data.deduped) {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        data: {
          url: init.data.url,
          slug: init.data.slug,
          size: init.data.size_bytes,
          expires: init.data.expires_at,
          deduped: true
        }
      }, null, 2))
      return
    }

    await uploadToSignedUrl(init.data, fileBuffer, mimeType)

    const final = await finalizeUpload(init.data.ticket)

    if (final.status !== 200) {
      throw new Error(`Finalize gagal: HTTP ${final.status} - ${JSON.stringify(final.data)}`)
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: {
        url: final.data.url,
        slug: final.data.slug,
        ext: final.data.ext,
        size: final.data.size_bytes,
        mimeType: final.data.mime_type,
        expires: final.data.expires_at,
        deduped: final.data.deduped
      }
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