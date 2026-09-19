/*
**scrape emailnator**
**author skrep: xvlovers**
*git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/emailnator.js *
**base URL: https://www.emailnator.com*
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")

const BASE = "https://www.emailnator.com"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const EMAIL_TYPES = {
  "domain": 1,
  "plus": 2,
  "plusgmail": 2,
  "dot": 3,
  "dotgmail": 3,
  "googlemail": 8,
  "google": 8
}

const client = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Origin": BASE,
    "Referer": BASE + "/"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

async function req(method, path, body) {
  const r = await client.request({
    method,
    url: BASE + path,
    data: body || undefined
  })
  let parsed = r.data
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed) } catch (_) {}
  }
  if (r.status >= 400) {
    const msg = parsed?.message || parsed?.error || `HTTP ${r.status}`
    throw new Error(msg)
  }
  return parsed
}

function parseTypes(input) {
  if (!input) return [1, 2, 3, 8]
  const list = String(input).split(",").map(s => s.trim().toLowerCase())
  const ids = []
  for (const t of list) {
    if (EMAIL_TYPES[t]) ids.push(EMAIL_TYPES[t])
    else if (/^\d+$/.test(t)) ids.push(Number(t))
  }
  return ids.length ? [...new Set(ids)] : [1, 2, 3, 8]
}

function extractEmails(resp) {
  if (!resp) return []
  if (Array.isArray(resp)) return resp
  if (Array.isArray(resp.emails)) return resp.emails
  if (Array.isArray(resp.email)) return resp.email
  if (Array.isArray(resp.data)) return resp.data
  if (typeof resp.email === "string") return [resp.email]
  if (typeof resp.data === "string") return [resp.data]
  if (typeof resp === "string") return [resp]
  return []
}

async function generateEmail(types) {
  const ids = parseTypes(types)
  const resp = await req("POST", "/api/generate-email", { ids })
  return { ids, raw: resp, emails: extractEmails(resp) }
}

async function generateBulk(types, count) {
  const ids = parseTypes(types)
  const n = Math.max(1, Math.min(100, Number(count) || 10))
  const resp = await req("POST", "/api/generate-bulk-email", { ids, count: n })
  return { ids, count: n, raw: resp, emails: extractEmails(resp) }
}

async function messageList(email, limit = 20) {
  if (!email) throw new Error("Email kosong")
  const resp = await req("POST", "/api/message-list", { email, limit })
  return resp
}

async function readMessage(messageId) {
  if (!messageId) throw new Error("Message ID kosong")
  const resp = await req("GET", "/api/message/" + encodeURIComponent(messageId))
  return resp
}

async function deleteMessage(messageId) {
  if (!messageId) throw new Error("Message ID kosong")
  const resp = await req("DELETE", "/api/delete-message/" + encodeURIComponent(messageId))
  return resp
}

async function extendEmail(email) {
  if (!email) throw new Error("Email kosong")
  const resp = await req("POST", "/api/extend-email", { email })
  return resp
}

function extractOtp(text) {
  if (!text || typeof text !== "string") return null
  const pats = [
    /(?:code|otp|verification)[^\d]{0,20}(\d{3,8})/i,
    /(\d{4,8})[^\d]{0,20}(?:code|otp|verification)/i,
    /【\s*(\d{3,8})\s*】/,
    /\b(\d{6})\b/,
    /\b(\d{4,5})\b/
  ]
  for (const re of pats) {
    const m = text.match(re)
    if (m) return m[1]
  }
  return null
}

async function waitForMessage(email, opts = {}) {
  const maxWait = opts.maxWait || 180
  const interval = opts.interval || 5000
  const filter = opts.filter || null
  const max = Math.ceil(maxWait * 1000 / interval)

  for (let i = 0; i < max; i++) {
    try {
      const list = await messageList(email, 20)
      const messages = list?.messages || list?.data || list?.messageData || []
      if (Array.isArray(messages) && messages.length > 0) {
        let target = messages[0]
        if (filter) {
          const found = messages.find(m => {
            const txt = JSON.stringify(m).toLowerCase()
            return txt.includes(filter.toLowerCase())
          })
          if (found) target = found
          else { await new Promise(r => setTimeout(r, interval)); continue }
        }
        return { list, target, messages }
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, interval))
  }
  return null
}

async function getMessageContent(messageRef) {
  if (!messageRef) return null
  const id = messageRef.messageId || messageRef.id || messageRef._id || messageRef.message_id
  if (!id) return messageRef
  try {
    const m = await readMessage(id)
    return m
  } catch (_) {
    return messageRef
  }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]

    let result

    if (cmd === "generate") {
      const types = args[1]
      const r = await generateEmail(types)
      result = { mode: "generate", ids: r.ids, emails: r.emails, raw: r.raw }
    } else if (cmd === "bulk") {
      const types = args[1]
      const count = args[2] || 10
      const r = await generateBulk(types, count)
      result = { mode: "bulk", ids: r.ids, count: r.count, emails: r.emails, raw: r.raw }
    } else if (cmd === "list") {
      const email = args[1]
      const limit = Number(args[2] || 20)
      const r = await messageList(email, limit)
      result = { mode: "list", email, raw: r }
    } else if (cmd === "read") {
      const id = args[1]
      const r = await readMessage(id)
      result = { mode: "read", messageId: id, raw: r }
    } else if (cmd === "delete") {
      const id = args[1]
      const r = await deleteMessage(id)
      result = { mode: "delete", messageId: id, raw: r }
    } else if (cmd === "extend") {
      const email = args[1]
      const r = await extendEmail(email)
      result = { mode: "extend", email, raw: r }
    } else if (cmd === "wait") {
      const email = args[1]
      const maxWait = Number(args[2] || 180)
      const filter = args[3] || null
      const found = await waitForMessage(email, { maxWait, filter })
      if (found) {
        const target = found.target
        const detail = await getMessageContent(target)
        const otp = extractOtp(JSON.stringify(target) + " " + JSON.stringify(detail || {}))
        result = {
          mode: "wait",
          email,
          total: found.messages.length,
          message: target,
          detail,
          otp
        }
      } else {
        result = { mode: "wait", email, message: "Tidak ada pesan masuk" }
      }
    } else if (cmd === "otp") {
      const email = args[1]
      const maxWait = Number(args[2] || 180)
      const found = await waitForMessage(email, { maxWait })
      if (!found) throw new Error("Tidak ada pesan masuk")
      const target = found.target
      const detail = await getMessageContent(target)
      const all = JSON.stringify(target) + " " + JSON.stringify(detail || {})
      const otp = extractOtp(all)
      result = { mode: "otp", email, otp, message: target, detail }
    } else if (cmd === "full") {
      const types = args[1] || "google"
      const gen = await generateEmail(types)
      const email = gen.emails[0]
      if (!email) throw new Error("Gagal generate email")
      result = { mode: "full", email, ids: gen.ids, raw: gen.raw }
    } else {
      throw new Error([
        "Perintah:",
        '  node emailnator.js generate [types]           → tipe: domain,plus,dot,google',
        '  node emailnator.js bulk <types> <count>       → generate 100 email sekaligus',
        '  node emailnator.js list <email> [limit]       → list pesan',
        '  node emailnator.js read <messageId>           → baca pesan',
        '  node emailnator.js delete <messageId>         → hapus pesan',
        '  node emailnator.js extend <email>             → perpanjang email',
        '  node emailnator.js wait <email> [maxWait] [filter]  → tunggu pesan + auto baca',
        '  node emailnator.js otp <email> [maxWait]      → tunggu pesan + ekstrak OTP',
        '  node emailnator.js full [types]               → generate + tampil',
        '',
        "Tipe email:",
        "  domain (1)     → custom domain",
        "  plus (2)       → user+tag@gmail.com",
        "  dot (3)        → u.s.e.r@gmail.com",
        "  google (8)     → Gmail asli"
      ].join("\n"))
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: result
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