/*
**scrape htmlku**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/htmlku.js**
**base URL: https://main.htmlku.my.id**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const cheerio = require("cheerio")
const fs = require("fs")
const path = require("path")
const FormData = require("form-data")
const crypto = require("crypto")

const BASE = "https://main.htmlku.my.id"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
const SESSION_FILE = path.join(process.cwd(), ".htmlku-session.json")

let cookies = {}
let csrf = null

function loadSession() {
  if (!fs.existsSync(SESSION_FILE)) return
  try {
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"))
    cookies = s.cookies || {}
    csrf = s.csrf || null
  } catch (_) {}
}

function saveSession() {
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, csrf }, null, 2))
}

function parseCookies(setCookie) {
  if (!setCookie) return
  const list = Array.isArray(setCookie) ? setCookie : [setCookie]
  for (const c of list) {
    const kv = c.split(";")[0].trim()
    if (!kv) continue
    const idx = kv.indexOf("=")
    if (idx < 0) continue
    const name = kv.slice(0, idx)
    const value = kv.slice(idx + 1)
    cookies[name] = value
  }
}

function cookieString() {
  return Object.entries(cookies).map(([k, v]) => k + "=" + v).join("; ")
}

function buildClient() {
  return axios.create({
    timeout: 30000,
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      "Referer": BASE + "/",
      "Origin": BASE
    },
    maxRedirects: 5,
    validateStatus: s => s < 600,
    transformResponse: [v => v]
  })
}

function extractCsrf(html) {
  const m = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)
  if (m) return m[1]
  const $ = cheerio.load(html)
  const hidden = $("input[name='_token']").first().attr("value")
  return hidden || null
}

async function request(method, url, opts = {}) {
  const client = buildClient()
  const headers = {
    ...(opts.headers || {}),
    ...(Object.keys(cookies).length ? { Cookie: cookieString() } : {})
  }
  const r = await client.request({
    method,
    url: url.startsWith("http") ? url : BASE + url,
    headers,
    data: opts.data,
    params: opts.params
  })
  parseCookies(r.headers["set-cookie"])
  if (r.data && typeof r.data === "string") {
    const c = extractCsrf(r.data)
    if (c) csrf = c
  }
  return r
}

async function register(email, password) {
  const r1 = await request("GET", "/register")
  if (r1.status !== 200) throw new Error("Gagal buka /register")
  const token = extractCsrf(String(r1.data)) || csrf
  if (!token) throw new Error("CSRF tidak ditemukan")

  const body = new URLSearchParams({
    _token: token,
    email,
    password,
    password_confirmation: password
  }).toString()

  const r2 = await request("POST", "/register", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: body
  })

  if (r2.status !== 302 && r2.status !== 200) {
    throw new Error("Register gagal: HTTP " + r2.status)
  }

  saveSession()
  return { email, status: r2.status, location: r2.headers.location }
}

async function login(email, password) {
  const r1 = await request("GET", "/login")
  const token = extractCsrf(String(r1.data)) || csrf
  if (!token) throw new Error("CSRF tidak ditemukan")

  const body = new URLSearchParams({ _token: token, email, password }).toString()
  const r2 = await request("POST", "/login", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: body
  })

  if (r2.status !== 302 && r2.status !== 200) {
    throw new Error("Login gagal: HTTP " + r2.status)
  }
  saveSession()
  return { email, status: r2.status, location: r2.headers.location }
}

async function dashboard() {
  const r = await request("GET", "/dashboard")
  if (r.status !== 200) throw new Error("Dashboard gagal: HTTP " + r.status)
  const $ = cheerio.load(String(r.data))

  const userEmail = $("body").text().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+/)?.[0] || null

  // daftar project (cari tabel / list)
  const projects = []
  $("a[href*='.htmlku'], a[href*='/view'], a[href*='/p/'], .project, .card, tr").each((_, el) => {
    const text = $(el).text().trim()
    const link = $(el).find("a[href]").first().attr("href") || $(el).attr("href")
    if (text && link && /htmlku|project|preview/i.test(text + link)) {
      projects.push({ text: text.slice(0, 100), link })
    }
  })

  return {
    status: r.status,
    userEmail,
    title: $("title").text().trim(),
    hasUploadForm: $("form[action='/upload']").length > 0,
    formsCount: $("form").length,
    projectsPreview: projects.slice(0, 20)
  }
}

async function upload(filePath, projectName) {
  if (!fs.existsSync(filePath)) throw new Error("File tidak ditemukan: " + filePath)

  // refresh dashboard untuk CSRF terbaru
  await request("GET", "/dashboard")
  if (!csrf) throw new Error("CSRF tidak ditemukan. Login dulu.")

  const form = new FormData()
  form.append("_token", csrf)
  form.append("project_name", projectName)
  form.append("script", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: "text/html"
  })

  const client = buildClient()
  const r = await client.post(BASE + "/upload", form, {
    headers: {
      ...form.getHeaders(),
      Cookie: cookieString(),
      Referer: BASE + "/dashboard",
      Origin: BASE
    }
  })

  parseCookies(r.headers["set-cookie"])
  const html = typeof r.data === "string" ? r.data : ""

  // cari URL hasil deploy
  const urlMatch = html.match(/https?:\/\/[a-zA-Z0-9.\-]*htmlku\.my\.id\/[^\s"'<>()]+/i) ||
                   html.match(/\/p\/[a-zA-Z0-9\-_]+/i) ||
                   html.match(/\/view\/[a-zA-Z0-9\-_]+/i)

  return {
    status: r.status,
    location: r.headers.location || null,
    deployUrl: urlMatch ? urlMatch[0] : null,
    responsePreview: html.slice(0, 500)
  }
}

async function logout() {
  await request("GET", "/dashboard")
  const r = await request("POST", "/logout", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({ _token: csrf, _method: "POST" }).toString()
  })
  cookies = {}
  csrf = null
  saveSession()
  return { status: r.status }
}

function genEmail() {
  const rand = crypto.randomBytes(4).toString("hex")
  return `user${rand}@akunlama.com`
}

async function main() {
  try {
    loadSession()

    const args = process.argv.slice(2)
    const cmd = args[0]

    let result

    if (cmd === "register") {
      const email = args[1] || genEmail()
      const password = args[2] || crypto.randomBytes(6).toString("hex") + "A1!"
      result = await register(email, password)
      result.password = password
    } else if (cmd === "login") {
      const email = args[1]
      const password = args[2]
      if (!email || !password) throw new Error("Pakai: node htmlku.js login <email> <password>")
      result = await login(email, password)
    } else if (cmd === "dashboard" || cmd === "me") {
      result = await dashboard()
    } else if (cmd === "upload") {
      const file = args[1]
      const name = args[2] || path.basename(file, path.extname(file))
      if (!file) throw new Error("Pakai: node htmlku.js upload <file.html> [project_name]")
      result = await upload(file, name)
    } else if (cmd === "logout") {
      result = await logout()
    } else if (cmd === "session") {
      result = { hasSession: Object.keys(cookies).length > 0, cookies: Object.keys(cookies), csrf: csrf ? csrf.slice(0, 20) + "..." : null }
    } else {
      throw new Error([
        "Perintah:",
        '  node htmlku.js register [email] [password]',
        '  node htmlku.js login <email> <password>',
        '  node htmlku.js dashboard',
        '  node htmlku.js upload <file.html> [project_name]',
        '  node htmlku.js logout',
        '  node htmlku.js session'
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()