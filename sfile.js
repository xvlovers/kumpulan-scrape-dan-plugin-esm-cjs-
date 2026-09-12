/*
**scrape sfile uploader**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/sfile.js **
**base URL: https://sfile.co**
**credit: sfile**

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const https = require("https")
const FormData = require("form-data")

const BASE_URL = "https://sfile.co"
const UPLOAD_ENDPOINT = `${BASE_URL}/upload/resume_v1_guest.php`
const CHUNK_SIZE = 1048576

const COOKIE = "PHPSESSID=eda13e825b3d237c852eace0046bde3d; _u=26d1de2d49bc9fd27947478687238fb1; _ga_XNQ10X1V2J=GS2.1.s1789184041$o1$g1$t1789184125$j51$l0$h0; _ga=GA1.1.840926258.1789184042"

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
    honorCipherOrder: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3"
  })
})

const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Android 16; Mobile; rv:155.0) Gecko/155.0 Firefox/155.0",
  "Accept": "*/*",
  "Accept-Language": "id-ID,en-GB;q=0.9,ms-MY;q=0.8",
  "Cookie": COOKIE,
  "Origin": BASE_URL,
  "Referer": BASE_URL + "/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin"
}

function generateFlowIdentifier(fileName, fileSize) {
  const input = `${fileName}-${fileSize}-${CHUNK_SIZE}`
  return crypto.createHash("md5").update(input).digest("hex").substring(0, 32)
}

function computeMd5(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex")
}

async function uploadChunk(identifier, chunkNumber, chunkBuffer, fileName, fileSize, totalChunks, description, fileHash) {
  const form = new FormData()

  form.append("flowChunkNumber", chunkNumber)
  form.append("flowChunkSize", CHUNK_SIZE)
  form.append("flowCurrentChunkSize", chunkBuffer.length)
  form.append("flowTotalSize", fileSize)
  form.append("flowIdentifier", identifier)
  form.append("flowFilename", fileName)
  form.append("flowRelativePath", fileName)
  form.append("flowTotalChunks", totalChunks)
  form.append("des", description || "")
  form.append("file_hash", fileHash)
  form.append("desired_name", fileName)
  form.append("file", chunkBuffer, fileName)

  const response = await axiosInstance.post(UPLOAD_ENDPOINT, form, {
    timeout: 120000,
    headers: {
      ...BASE_HEADERS,
      ...form.getHeaders()
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
  const description = process.argv[3] || ""

  if (!filePath) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node sfile.js <file-path> [description]"
    }, null, 2))
    process.exit(1)
  }

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File tidak ditemukan: " + filePath)
    }

    const fileName = path.basename(filePath)
    const fileBuffer = fs.readFileSync(filePath)
    const fileSize = fileBuffer.length

    if (fileSize > 262144000) {
      throw new Error("File terlalu besar. Max 250MB")
    }

    const identifier = generateFlowIdentifier(fileName, fileSize)
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)
    const fileHash = computeMd5(fileBuffer)

    let finalResult = null

    for (let i = 1; i <= totalChunks; i++) {
      const start = (i - 1) * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, fileSize)
      const chunkBuffer = fileBuffer.slice(start, end)

      const upload = await uploadChunk(identifier, i, chunkBuffer, fileName, fileSize, totalChunks, description, fileHash)

      // Handle duplicate
      if (upload.data?.reason === "duplicate_hash") {
        finalResult = {
          duplicate: true,
          fileId: upload.data.file_id,
          fileName: upload.data.file_name,
          shareCode: upload.data.file_short,
          shareUrl: `${BASE_URL}/${upload.data.file_short}`,
          downloadUrl: `${BASE_URL}/${upload.data.file_short}`
        }
        break
      }

      // Handle success
      if (upload.data?.share_url) {
        finalResult = {
          duplicate: false,
          fileId: upload.data.file?.id || null,
          fileName: upload.data.file?.name || fileName,
          size: upload.data.file?.size_bytes || fileSize,
          sizeLabel: upload.data.file?.size_label || null,
          hash: upload.data.file?.hash || fileHash,
          shareCode: upload.data.share_code,
          shareUrl: upload.data.share_url,
          downloadUrl: upload.data.file?.download_url || upload.data.share_url,
          moderation: upload.data.file?.moderation || false
        }
        break
      }

      // Handle error
      if (upload.status !== 200 && upload.status !== 201) {
        throw new Error(`Chunk ${i} gagal: HTTP ${upload.status} - ${JSON.stringify(upload.data)}`)
      }
    }

    if (!finalResult) {
      throw new Error("Upload selesai tapi tidak ada hasil")
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: finalResult
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