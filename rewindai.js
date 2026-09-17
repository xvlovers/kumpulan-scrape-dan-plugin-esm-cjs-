/*
**scrape rewind.ai chat**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/rewindai.js**
**base URL: https://api.rewind.ai**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const readline = require("readline")

const API = "https://api.rewind.ai"
const WEB = "https://rewind.ai"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

const MODELS = {
  "qwen": "qwen/qwen-2.5-7b-instruct",
  "qwen25": "qwen/qwen-2.5-7b-instruct",
  "qwen-7b": "qwen/qwen-2.5-7b-instruct",
  "mistral": "mistralai/mistral-7b-instruct",
  "llama": "meta-llama/llama-3.1-8b-instruct",
  "gemma": "google/gemma-2-9b-it"
}

const DEFAULT_MODEL = "qwen/qwen-2.5-7b-instruct"
const API_KEY = process.env.REWIND_API_KEY || ""

const client = axios.create({
  timeout: 120000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/event-stream, */*",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Origin": WEB,
    "Referer": WEB + "/chat/"
  },
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

async function listModels() {
  const r = await client.get(API + "/v1/models")
  return r.data
}

async function chat(messages, model = DEFAULT_MODEL, stream = true) {
  const headers = {}
  if (API_KEY) headers.Authorization = "Bearer " + API_KEY

  const res = await client.post(API + "/v1/chat/completions/", {
    model,
    messages,
    stream
  }, {
    responseType: stream ? "stream" : "json",
    headers
  })

  if (res.status >= 400) {
    const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data)
    throw new Error("HTTP " + res.status + ": " + body.slice(0, 400))
  }

  if (!stream) {
    const obj = typeof res.data === "string" ? JSON.parse(res.data) : res.data
    return obj.choices?.[0]?.message?.content || ""
  }

  return new Promise((resolve, reject) => {
    let buffer = ""
    let accumulated = ""
    let done = false

    const handleLine = line => {
      const trimmed = line.trim()
      if (!trimmed || done) return
      if (trimmed === "data: [DONE]" || trimmed === "[DONE]") { done = true; return }
      let payload = trimmed
      if (payload.startsWith("data:")) payload = payload.slice(5).trim()
      if (!payload) return
      try {
        const obj = JSON.parse(payload)
        const delta = obj.choices?.[0]?.delta?.content || obj.choices?.[0]?.message?.content || ""
        if (delta) {
          accumulated += delta
          process.stdout.write(delta)
        }
      } catch (_) {}
    }

    res.data.on("data", chunk => {
      buffer += chunk.toString("utf8")
      const lines = buffer.split("\n")
      buffer = lines.pop()
      for (const l of lines) handleLine(l)
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
  const k = String(input).toLowerCase().trim()
  if (MODELS[k]) return MODELS[k]
  if (/^[a-z0-9-]+\/[a-z0-9.\-]+$/i.test(input)) return input
  return DEFAULT_MODEL
}

async function askOnce(prompt, modelId) {
  const messages = [{ role: "user", content: prompt }]
  const text = await chat(messages, modelId, true)
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
  console.log("[XV] Rewind.ai chat siap. Model: " + modelId)
  console.log("[XV] Commands: exit | reset | model <nama> | models\n")

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const messages = []
  let currentModel = modelId

  const loop = () => {
    rl.question("You > ", async input => {
      const text = input.trim()
      if (!text) return loop()
      if (text === "exit" || text === "quit") { rl.close(); return }
      if (text === "reset") { messages.length = 0; console.log("[XV] History dihapus.\n"); return loop() }
      if (text === "models") {
        const m = await listModels().catch(() => null)
        console.log(JSON.stringify(m, null, 2) + "\n")
        return loop()
      }
      if (text.startsWith("model ")) {
        currentModel = resolveModel(text.slice(6))
        console.log("[XV] Model: " + currentModel + "\n")
        return loop()
      }

      messages.push({ role: "user", content: text })
      process.stdout.write("AI  > ")
      try {
        const reply = await chat(messages, currentModel, true)
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
    const cmd = args[0]

    if (cmd === "models") {
      const m = await listModels()
      console.log(JSON.stringify({ author: "xvlovers", status: true, data: m }, null, 2))
      return
    }

    const isChat = args.includes("--chat") || args.includes("-c")
    const modelFlag = args.find(a => a.startsWith("--model="))
    const modelId = resolveModel(modelFlag ? modelFlag.split("=")[1] : null)
    const prompt = args.filter(a => !a.startsWith("-")).join(" ").trim()

    if (isChat) { await interactive(modelId); return }

    if (!prompt) {
      throw new Error('Pakai: node rewindai.js "pertanyaan" [--model=qwen|mistral|llama] [--chat] atau "models"')
    }

    await askOnce(prompt, modelId)
  } catch (error) {
    console.log(JSON.stringify({
      author: "xvlovers", status: false, message: error.message
    }, null, 2))
    process.exit(1)
  }
}

main()