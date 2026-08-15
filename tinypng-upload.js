/*
name: tinypng uploader
base url: https://tinypng.com

author: xvlovers
github: xvlovers

fungsi: upload gambar ke tinypng untuk kompresi otomatis.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")

const BASE_URL = "https://tinypng.com"

async function scrapeUploadEndpoint() {
  const response = await axios.get(BASE_URL, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    validateStatus: status => status < 400
  })

  const html = response.data

  const apiPatterns = [
    /["'](\/api\/[^"']+)["']/g,
    /["'](\/web\/[^"']*compress[^"']*)["']/g,
    /["'](\/web\/[^"']*upload[^"']*)["']/g,
    /["'](\/backend[^"']+)["']/g,
    /["'](\/shrink[^"']+)["']/g
  ]

  const endpoints = []
  for (const pattern of apiPatterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      if (!endpoints.includes(match[1])) {
        endpoints.push(match[1])
      }
    }
  }

  const csrfMatch = html.match(/csrf[^"']*["']\s*:\s*["']([^"']+)["']/i) || html.match(/token["']\s*:\s*["']([^"']+)["']/i)
  const csrfToken = csrfMatch ? csrfMatch[1] : null

  const buildIdMatch = html.match(/"buildId"\s*:\s*"([^"]+)"/)
  const buildId = buildIdMatch ? buildIdMatch[1] : null

  return { endpoints, csrfToken, buildId }
}

async function uploadImage(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("File tidak ditemukan: " + filePath)
  }

  const fileName = path.basename(filePath)
  const fileExt = path.extname(filePath).toLowerCase()
  const validExt = [".png", ".jpg", ".jpeg", ".webp", ".avif"]

  if (!validExt.includes(fileExt)) {
    throw new Error("Format tidak didukung. Gunakan: png, jpg, jpeg, webp, avif")
  }

  const fileBuffer = fs.readFileSync(filePath)
  const fileSize = fileBuffer.length

  if (fileSize > 5 * 1024 * 1024) {
    throw new Error("File terlalu besar. Maksimal 5MB")
  }

  const uploadUrl = "https://tinypng.com/backend/opt/shrink"

  const response = await axios.post(uploadUrl, fileBuffer, {
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/octet-stream",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/",
      "Cache-Control": "no-cache"
    },
    maxRedirects: 5,
    validateStatus: status => status < 500
  })

  if (response.data && response.data.output) {
    return {
      originalSize: response.data.input?.size || fileSize,
      compressedSize: response.data.output?.size || null,
      ratio: response.data.output?.ratio || null,
      url: response.data.output?.url || null,
      width: response.data.output?.width || null,
      height: response.data.output?.height || null,
      compressionCount: response.data.compression_count || null,
      error: null
    }
  }

  if (response.data && response.data.error) {
    throw new Error(response.data.message || response.data.error)
  }

  return response.data
}

async function downloadCompressed(compressedUrl, outputPath) {
  if (!compressedUrl) {
    throw new Error("URL hasil kompresi tidak tersedia")
  }

  const writer = fs.createWriteStream(outputPath)

  const response = await axios.get(compressedUrl, {
    timeout: 60000,
    responseType: "stream",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": BASE_URL + "/"
    }
  })

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      const stats = fs.statSync(outputPath)
      resolve({
        filePath: outputPath,
        fileSize: stats.size
      })
    })
    writer.on("error", reject)
    response.data.on("error", reject)
  })
}

async function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node tinypng-upload.js <path-gambar>"
    }, null, 2))
    process.exit(1)
  }

  try {
    const info = await scrapeUploadEndpoint()

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      stage: "scraping",
      message: "Endpoint & token terdeteksi",
      data: info
    }, null, 2))

    const result = await uploadImage(filePath)

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      stage: "upload",
      message: "Upload & kompresi berhasil",
      data: result
    }, null, 2))

    if (result.url) {
      const outputPath = path.join(process.cwd(), "compressed_" + path.basename(filePath))
      const downloadResult = await downloadCompressed(result.url, outputPath)

      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        stage: "download",
        message: "File hasil kompresi berhasil diunduh",
        data: downloadResult
      }, null, 2))
    }
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