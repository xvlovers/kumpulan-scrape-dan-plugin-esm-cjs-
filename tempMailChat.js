/*
**scrape tempmail chat get email & inbox**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/tempMailChat.js **
**base URL: https://tempmail.chat**
**credit: tempmail chat**

*/

const axios = require("axios")

const API_BASE = "https://tempmail-backend.hasnaintariq142.workers.dev"
const CREATE_API = `${API_BASE}/api/create-inbox`
const INBOX_API = `${API_BASE}/api/inbox`
const DELETE_API = `${API_BASE}/api/delete-inbox`

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function createInbox() {
  const response = await axios.post(CREATE_API, {}, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Origin": "https://tempmail.chat",
      "Referer": "https://tempmail.chat/"
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function getInbox(token) {
  const response = await axios.get(`${INBOX_API}?token=${encodeURIComponent(token)}`, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Origin": "https://tempmail.chat",
      "Referer": "https://tempmail.chat/"
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function deleteInbox(token) {
  const response = await axios.post(DELETE_API, {
    token: token
  }, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Origin": "https://tempmail.chat",
      "Referer": "https://tempmail.chat/"
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function waitForEmail(token, maxWait) {
  const maxAttempts = Math.ceil((maxWait || 120) / 5)
  const knownIds = new Set()

  for (let i = 0; i < maxAttempts; i++) {
    const inbox = await getInbox(token)

    if (inbox.status === 200 && inbox.data?.success) {
      const messages = inbox.data.messages || []

      for (const msg of messages) {
        const msgId = msg.id || msg.received_at || JSON.stringify(msg)
        if (!knownIds.has(msgId)) {
          knownIds.add(msgId)
          return inbox.data
        }
      }
    }

    await delay(5000)
  }

  return null
}

function normalizeMessages(messages) {
  return messages.map((m, index) => ({
    index: index + 1,
    id: m.id || null,
    from: m.sender || null,
    fromName: m.sender_name || null,
    to: m.recipient || null,
    subject: m.subject || null,
    body: m.text_body || null,
    html: m.html_body || null,
    date: m.received_at || null,
    expires: m.expires_at || null
  }))
}

async function main() {
  const mode = process.argv[2]
  const param = process.argv[3]

  if (!mode) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node tempmail.js <create|inbox|wait|auto|delete> [token]"
    }, null, 2))
    process.exit(1)
  }

  try {
    if (mode === "create") {
      const hasil = await createInbox()

      if (hasil.status === 200 && hasil.data?.success) {
        console.log(JSON.stringify({
          author: "xvlovers",
          status: true,
          data: {
            email: hasil.data.email,
            token: hasil.data.access_token,
            expires: hasil.data.expires_at || null
          }
        }, null, 2))
      } else {
        console.log(JSON.stringify({
          author: "xvlovers",
          status: false,
          message: hasil.data?.error || `HTTP ${hasil.status}`
        }, null, 2))
      }
    } else if (mode === "inbox" && param) {
      const hasil = await getInbox(param)

      if (hasil.status === 200 && hasil.data?.success) {
        const messages = normalizeMessages(hasil.data.messages || [])

        console.log(JSON.stringify({
          author: "xvlovers",
          status: true,
          data: {
            email: hasil.data.email || null,
            expires: hasil.data.expires_at || null,
            total: messages.length,
            messages
          }
        }, null, 2))
      } else {
        console.log(JSON.stringify({
          author: "xvlovers",
          status: false,
          message: hasil.data?.error || `HTTP ${hasil.status}`
        }, null, 2))
      }
    } else if (mode === "wait" && param) {
      const maxWait = parseInt(process.argv[4]) || 120

      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        stage: "waiting",
        message: `Menunggu email masuk (max ${maxWait}s)...`
      }, null, 2))

      const hasil = await waitForEmail(param, maxWait)

      if (hasil) {
        const messages = normalizeMessages(hasil.messages || [])

        console.log(JSON.stringify({
          author: "xvlovers",
          status: true,
          data: {
            email: hasil.email || null,
            expires: hasil.expires_at || null,
            total: messages.length,
            messages
          }
        }, null, 2))
      } else {
        console.log(JSON.stringify({
          author: "xvlovers",
          status: false,
          message: "Tidak ada email masuk dalam waktu yang ditentukan"
        }, null, 2))
      }
    } else if (mode === "auto") {
      const buat = await createInbox()

      if (buat.status !== 200 || !buat.data?.success) {
        throw new Error(buat.data?.error || "Gagal buat inbox")
      }

      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        stage: "created",
        message: "Email berhasil dibuat",
        data: {
          email: buat.data.email,
          token: buat.data.access_token,
          expires: buat.data.expires_at || null
        }
      }, null, 2))

      const maxWait = parseInt(process.argv[3]) || 120

      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        stage: "waiting",
        message: `Menunggu email masuk (max ${maxWait}s)...`
      }, null, 2))

      const hasil = await waitForEmail(buat.data.access_token, maxWait)

      if (hasil) {
        const messages = normalizeMessages(hasil.messages || [])

        console.log(JSON.stringify({
          author: "xvlovers",
          status: true,
          data: {
            email: hasil.email || buat.data.email,
            expires: hasil.expires_at || null,
            total: messages.length,
            messages
          }
        }, null, 2))
      } else {
        console.log(JSON.stringify({
          author: "xvlovers",
          status: false,
          message: "Tidak ada email masuk",
          data: {
            email: buat.data.email,
            token: buat.data.access_token
          }
        }, null, 2))
      }
    } else if (mode === "delete" && param) {
      const hasil = await deleteInbox(param)

      console.log(JSON.stringify({
        author: "xvlovers",
        status: hasil.status === 200 && hasil.data?.success,
        data: hasil.data
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