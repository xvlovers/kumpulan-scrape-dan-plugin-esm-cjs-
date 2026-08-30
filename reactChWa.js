/*
name: react channel
base url: https://satriareact.satriadeveloperz.workers.dev

author: xvlovers
github: xvlovers

fungsi: react channel wa via satria react server 3.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")

const BASE_URL = "https://satriareact.satriadeveloperz.workers.dev"
const SERVER = 3

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function handshake(server) {
  const response = await axios.post(`${BASE_URL}/api/handshake`, {
    server: server
  }, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Content-Type": "application/json",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    },
    validateStatus: () => true
  })

  return response.data
}

async function reactChannel(url, reactions, token, authToken, server) {
  const response = await axios.post(`${BASE_URL}/api/react`, {
    url: url,
    reactions: reactions,
    token: token,
    authToken: authToken || null,
    server: server
  }, {
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Content-Type": "application/json",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function main() {
  const link = process.argv[2]
  const emojis = process.argv[3] || "🔥"
  const jumlah = parseInt(process.argv[4]) || 1
  const delayMs = parseInt(process.argv[5]) || 800
  const server = parseInt(process.argv[6]) || SERVER

  if (!link) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node react3.js <link> [emoji] [jumlah] [delay-ms] [server-1-2-3]"
    }, null, 2))
    process.exit(1)
  }

  try {
    const hs = await handshake(server)

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      stage: "handshake",
      data: hs
    }, null, 2))

    if (!hs.success || !hs.token) {
      throw new Error(hs.error || "Handshake gagal")
    }

    const emojiList = emojis.split(",").map(e => e.trim()).filter(Boolean)
    let successCount = 0
    let failedCount = 0
    let token = hs.token
    let authToken = hs.authToken || null

    for (let i = 0; i < jumlah; i++) {
      const shuffled = [...emojiList].sort(() => Math.random() - 0.5)

      try {
        const result = await reactChannel(link.trim(), shuffled, token, authToken, server)

        if (result.status === 200 && result.data?.success) {
          successCount++
        } else if (result.status === 403) {
          const newHs = await handshake(server)
          if (newHs.success && newHs.token) {
            token = newHs.token
            authToken = newHs.authToken || null
            i--
            continue
          }
          failedCount++
        } else {
          failedCount++
        }
      } catch (e) {
        failedCount++
      }

      if (i < jumlah - 1 && delayMs > 0) {
        await delay(delayMs)
      }
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      stage: "done",
      message: successCount > 0 ? "React berhasil dikirim" : "Semua react gagal",
      data: {
        link,
        emojis: emojiList,
        jumlah,
        delay: delayMs,
        server,
        success: successCount,
        failed: failedCount
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