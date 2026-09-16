/*
name: DeepSeek AI Chat
base url: https://deep-seek.ai

author: xvlovers
github: xvlovers

fungsi: chat dengan DeepSeek (V4, R1, V3) via deep-seek.ai tanpa login

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")
const readline = require("readline")

const BASE = "https://deep-seek.ai"
const CHAT_URL = BASE + "/chat"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const MODELS = {
  "v4": "deepseek/deepseek-v4-flash",
  "v4flash": "deepseek/deepseek-v4-flash",
  "deepseek": "deepseek/deepseek-v4-flash",
  "deepseek-v4": "deepseek/deepseek-v4-flash",

  "r1": "deepseek/deepseek-r1",
  "deepseek-r1": "deepseek/deepseek-r1",
  "reasoner": "deepseek/deepseek-r1",

  "v3": "deepseek/deepseek-v3.2",
  "deepseek-v3": "deepseek/deepseek-v3.2",
  "chat": "deepseek/deepseek-v3.2"
}

const DEFAULT_MODEL = "deepseek/deepseek-v4-flash"

let cookieJar = ""
let csrfToken = ""

function updateCookie(setCookie) {
  if (!setCookie) return
  const list = Array.isArray(setCookie) ? setCookie : [setCookie]
  for (const c of list) {
    const kv = c.split(";")[0].trim()
    if (!kv) continue
    const name = kv.split("=")[0]
    const parts = cookieJar.split("; ").filter(x => x && !x.startsWith(name + "="))
    parts.push(kv)
    cookieJar = parts.join("; ")
  }
}

async function initSession() {
  const res = await axios.get(CHAT_URL, {
    timeout: 25000,
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8"
    },
    validateStatus: s => s < 600,
    transformResponse: [v => v]
  })
  if (res.status !== 200) throw new Error("HTTP " + res.status + " saat init session")
  updateCookie(res.headers["set-cookie"])
  const html = String(res.data)
  const m = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)
  if (!m) throw new Error("CSRF token tidak ditemukan di halaman chat")
  csrfToken = m[1]
  return { csrfToken, cookieJar }
}

function extractDelta(obj) {
  if (!obj || typeof obj !== "object") return ""
  const c = obj.choices?.[0]
  return (
    c?.delta?.content ||
    c?.message?.content ||
    c?.text ||
    obj.delta ||
    obj.content ||
    obj.text ||
    obj.response ||
    ""
  )
}

async function chat(messages, model = DEFAULT_MODEL) {
  if (!csrfToken) await initSession()

  const res = await axios.post(BASE + "/api/chat", {
    model,
    messages
  }, {
    timeout: 180000,
    responseType: "stream",
    headers: {
      "User-Agent": UA,
      "Accept": "text/event-stream, application/json",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": csrfToken,
      "Origin": BASE,
      "Referer": CHAT_URL,
      "Cookie": cookieJar
    },
    validateStatus: s => s < 600
  })

  if (res.status >= 400) {
    let body = ""
    for await (const c of res.data) body += c
    let msg = body
    try {
      const parsed = JSON.parse(body)
      msg = parsed.error || parsed.message || body
      if (parsed.limit_type) msg += " (limit: " + parsed.limit_type + ")"
    } catch (_) {}
    if (res.status === 429) throw new Error("Rate limit: " + msg)
    throw new Error("HTTP " + res.status + ": " + msg)
  }

  return new Promise((resolve, reject) => {
    let buffer = ""
    let accumulated = ""

    const handleLine = line => {
      const trimmed = line.trim()
      if (!trimmed) return
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === "[DONE]") return
        try {
          const obj = JSON.parse(payload)
          const delta = extractDelta(obj)
          if (delta) {
            accumulated += delta
            process.stdout.write(delta)
          }
        } catch (_) {
          accumulated += payload
          process.stdout.write(payload)
        }
      } else if (trimmed.startsWith("event:") || trimmed.startsWith(":")) {
        return
      } else {
        try {
          const obj = JSON.parse(trimmed)
          const delta = extractDelta(obj)
          if (delta) {
            accumulated += delta
            process.stdout.write(delta)
          }
        } catch (_) {
          accumulated += trimmed
          process.stdout.write(trimmed)
        }
      }
    }

    res.data.on("data", chunk => {
      buffer += chunk.toString("utf8")
      const lines = buffer.split("\n")
      buffer = lines.pop()
      for (const line of lines) handleLine(line)
    })

    res.data.on("end", () => {
      if (buffer) handleLine(buffer)
      process.stdout.write("\n")
      resolve(accumulated)
    })
    res.data.on("error", reject)
  })
}

function resolveModel(input) {
  if (!input) return DEFAULT_MODEL
  const key = String(input).toLowerCase().trim()
  if (MODELS[key]) return MODELS[key]
  if (/^deepseek\//i.test(input)) return input
  return DEFAULT_MODEL
}

async function askOnce(prompt, modelId) {
  await initSession()
  const messages = [{ role: "user", content: prompt }]
  const text = await chat(messages, modelId)
  console.log(JSON.stringify({
    author: "xvlovers",
    status: true,
    data: {
      model: modelId,
      prompt,
      response: text
    }
  }, null, 2))
}

async function interactive(modelId) {
  await initSession()
  console.log("[XV] DeepSeek chat siap. Model: " + modelId)
  console.log("[XV] Ketik 'exit' untuk keluar, 'reset' untuk hapus history.\n")

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const messages = []

  const loop = () => {
    rl.question("You > ", async input => {
      const text = input.trim()
      if (!text) return loop()
      if (text === "exit" || text === "quit") { rl.close(); return }
      if (text === "reset") { messages.length = 0; console.log("[XV] History dihapus.\n"); return loop() }

      messages.push({ role: "user", content: text })
      process.stdout.write("AI  > ")
      try {
        const reply = await chat(messages, modelId)
        messages.push({ role: "assistant", content: reply })
      } catch (e) {
        console.error("\n[error] " + e.message + "\n")
        messages.pop()
      }
      loop()
    })
  }
  loop()
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const isChat = args.includes("--chat") || args.includes("-c")
    const modelFlag = args.find(a => a.startsWith("--model="))
    const modelId = resolveModel(modelFlag ? modelFlag.split("=")[1] : null)

    const prompt = args.filter(a => !a.startsWith("-")).join(" ").trim()

    if (isChat) {
      await interactive(modelId)
      return
    }

    if (!prompt) {
      throw new Error('Pakai: node scraper.js "pertanyaan" [--model=v4|r1|v3] [--chat]')
    }

    await askOnce(prompt, modelId)
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