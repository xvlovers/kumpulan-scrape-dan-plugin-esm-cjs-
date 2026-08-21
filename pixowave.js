/*
name: pixowave uploader v2
base url: https://pixowave.my.id

author: xvlovers
github: xvlover

fungsi: upload & kompres image ke pixowave.my.id.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")
const FormData = require("form-data")
const fs = require("fs")
const path = require("path")

const BASE_URL = "https://pixowave.my.id"
const UPLOAD_URL = `${BASE_URL}/api/compress`

async function uploadImage(filePath, quality) {
  if (!fs.existsSync(filePath)) {
    throw new Error("File tidak ditemukan: " + filePath)
  }

  const fileName = path.basename(filePath)
  const fileExt = path.extname(filePath).toLowerCase()
  const validExt = [".jpg", ".jpeg", ".png"]

  if (!validExt.includes(fileExt)) {
    throw new Error("Format tidak didukung. Gunakan: jpg, jpeg, png")
  }

  const fileBuffer = fs.readFileSync(filePath)
  const fileSize = fileBuffer.length

  if (fileSize < 100) {
    throw new Error("File terlalu kecil, kemungkinan gambar tidak valid. Minimal 100 bytes")
  }

  if (fileSize > 10 * 1024 * 1024) {
    throw new Error("File terlalu besar. Maksimal 10MB")
  }

  const formData = new FormData()
  formData.append("files", fileBuffer, {
    filename: fileName,
    contentType: fileExt === ".png" ? "image/png" : "image/jpeg"
  })
  formData.append("quality", String(quality || 70))

  const response = await axios.post(UPLOAD_URL, formData, {
    timeout: 120000,
    headers: {
      ...formData.getHeaders(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    },
    validateStatus: status => status < 500
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function main() {
  const filePath = process.argv[2]
  const quality = parseInt(process.argv[3]) || 70

  if (!filePath) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node pixowave.js <path-gambar> [quality]"
    }, null, 2))
    process.exit(1)
  }

  try {
    const result = await uploadImage(filePath, quality)

    if (result.status === 200 && result.data.status !== false) {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        message: "Upload berhasil",
        data: result.data
      }, null, 2))
    } else {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: false,
        message: result.data.message || "Upload gagal",
        data: result.data
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