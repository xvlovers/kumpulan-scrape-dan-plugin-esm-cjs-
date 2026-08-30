/*
name: notrack ai chat unlimited
base url: https://notrack.ai 

author: xvlovers
github: xvlovers

fungsi: chat dengan notrack ai (unlimited chat)

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")

const BASE_URL = "https://notrack.ai"
const DISPATCH_API = `${BASE_URL}/api/dispatch`

async function kirimChat(pesan) {
  const payload = {
    user_input: pesan,
    mode: "usual"
  }

  const response = await axios.post(DISPATCH_API, payload, {
    timeout: 120000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/event-stream, application/json, */*",
      "Content-Type": "application/json",
      "Origin": BASE_URL,
      "Referer": `${BASE_URL}/chat`
    },
    validateStatus: () => true
  })

  return response.data
}

function parseJawaban(raw) {
  const teks = String(raw)
  const messages = []

  const lines = teks.split("\n")

  for (const line of lines) {
    const clean = line.trim()

    if (!clean.startsWith("data:")) continue

    const data = clean.substring(5).trim()

    if (data === "[DONE]") continue

    try {
      const parsed = JSON.parse(data)

      if (parsed.type === "message") {
        messages.push({
          speaker: parsed.speaker,
          content: parsed.content
        })
      }

      if (parsed.type === "done") {
        break
      }
    } catch (e) {}
  }

  return messages
}

function speakerName(code) {
  const names = {
    "C": "NoTrack",
    "A": "Minimax",
    "B": "ChatGPT",
    "F": "Consensus"
  }
  return names[code] || code
}

async function main() {
  const pesan = process.argv.slice(2).join(" ")

  if (!pesan) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node notrack.js <pesan>"
    }, null, 2))
    process.exit(1)
  }

  try {
    const raw = await kirimChat(pesan)

    const messages = parseJawaban(raw)

    if (messages.length === 0) {
      throw new Error("Tidak ada response")
    }

    const hasil = messages.map(m => ({
      speaker: speakerName(m.speaker),
      jawaban: m.content
    }))

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: {
        pertanyaan: pesan,
        totalResponses: hasil.length,
        responses: hasil
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