/*
**scrape akunlama temp mail**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/akunlama.js **
**base URL: https://akunlama.com**
**credit: akunlama**

*/

const axios = require("axios")

const API_BASE = "https://akunlama.com/api"

function randomString(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generateEmail() {
  const username = `${randomString(6)}-${randomString(5)}-${Math.floor(Math.random() * 999)}`
  return `${username}@akunlama.com`
}

async function getList(email) {
  const response = await axios.get(`${API_BASE}/list`, {
    params: { recipient: email },
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Origin": "https://akunlama.com",
      "Referer": "https://akunlama.com/"
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function getKey(region, key) {
  const response = await axios.get(`${API_BASE}/getKey`, {
    params: { region, key },
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Origin": "https://akunlama.com",
      "Referer": "https://akunlama.com/"
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function getHtml(region, key) {
  const response = await axios.get(`${API_BASE}/getHtml`, {
    params: { region, key },
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html, */*",
      "Origin": "https://akunlama.com",
      "Referer": "https://akunlama.com/"
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForEmail(email, maxWait) {
  const maxAttempts = Math.ceil((maxWait || 120) / 5)

  for (let i = 0; i < maxAttempts; i++) {
    const list = await getList(email)

    if (list.status === 200 && Array.isArray(list.data) && list.data.length > 0) {
      return {
        email,
        total: list.data.length,
        messages: list.data
      }
    }

    await delay(5000)
  }

  return null
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv[3]

  if (!mode) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node akunlama.js <generate|list|wait|baca> [email|key] [region] [maxWait]"
    }, null, 2))
    process.exit(1)
  }

  try {
    if (mode === "generate") {
      const email = generateEmail()

      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        data: { email }
      }, null, 2))
    } else if (mode === "list" && param) {
      const hasil = await getList(param)

      if (hasil.status === 200 && Array.isArray(hasil.data)) {
        const messages = hasil.data.map(m => ({
          from: m.message?.headers?.from || null,
          to: m.message?.headers?.to || null,
          subject: m.message?.headers?.subject || null,
          preview: m.preview || null,
          timestamp: m.timestamp || null,
          read: m.read_at !== null,
          region: m.storage?.region || null,
          key: m.storage?.key || null
        }))

        console.log(JSON.stringify({
          author: "xvlovers",
          status: true,
          data: {
            email: param,
            total: messages.length,
            messages
          }
        }, null, 2))
      } else {
        console.log(JSON.stringify({
          author: "xvlovers",
          status: false,
          message: "Tidak ada pesan atau email tidak valid"
        }, null, 2))
      }
    } else if (mode === "wait" && param) {
      const maxWait = parseInt(process.argv[4]) || 120

      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        stage: "waiting",
        message: `Menunggu email ke ${param} (max ${maxWait}s)`
      }, null, 2))

      const hasil = await waitForEmail(param, maxWait)

      if (hasil) {
        const messages = hasil.messages.map(m => ({
          from: m.message?.headers?.from || null,
          subject: m.message?.headers?.subject || null,
          preview: m.preview || null,
          region: m.storage?.region || null,
          key: m.storage?.key || null
        }))

        console.log(JSON.stringify({
          author: "xvlovers",
          status: true,
          data: {
            email: param,
            total: messages.length,
            messages
          }
        }, null, 2))
      } else {
        console.log(JSON.stringify({
          author: "xvlovers",
          status: false,
          message: "Tidak ada email masuk"
        }, null, 2))
      }
    } else if (mode === "baca" && param) {
      const region = process.argv[4] || "us"

      const keyResult = await getKey(region, param)

      if (keyResult.status !== 200) {
        throw new Error(`HTTP ${keyResult.status}: gagal ambil detail`)
      }

      const htmlResult = await getHtml(region, param)

      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        data: {
          region,
          key: param,
          detail: keyResult.data,
          htmlPreview: typeof htmlResult.data === "string" ? htmlResult.data.substring(0, 3000) : null
        }
      }, null, 2))
    } else {
      throw new Error("Mode tidak valid")
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