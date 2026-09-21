/*
**scrape rfweb2apk**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/rfweb2apk.js**
**base URL: https://rfweb2apk.rfdevv.com**
**credit: *xv*
**chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E**

*/

const axios = require("axios")
const fs = require("fs")
const path = require("path")
const FormData = require("form-data")
const crypto = require("crypto")

const API = "https://rfweb2apk.rfdevv.com"
const TEMPMAIL = "https://akunlama.com/api"
const UA = "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
const ACCOUNTS_FILE = path.join(process.cwd(), "rfweb2apk-accounts.json")
const ACTIVE_FILE = path.join(process.cwd(), "rfweb2apk-active.json")

const client = axios.create({
  timeout: 300000,
  headers: {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Origin": API,
    "Referer": API + "/"
  },
  maxRedirects: 5,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  validateStatus: s => s < 600,
  transformResponse: [v => v]
})

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

function parseJson(d) {
  if (typeof d === "string") { try { return JSON.parse(d) } catch (_) { return null } }
  return d
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch (_) { return fallback }
}

function saveJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2))
}

let accounts = loadJson(ACCOUNTS_FILE, [])
let activeAccount = loadJson(ACTIVE_FILE, null)

function saveAccounts() { saveJson(ACCOUNTS_FILE, accounts) }
function saveActive() { saveJson(ACTIVE_FILE, activeAccount) }

function randomString(n) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let r = ""
  for (let i = 0; i < n; i++) r += chars[Math.floor(Math.random() * chars.length)]
  return r
}

function genEmail() {
  return randomString(8) + "-" + randomString(4) + "-" + Math.floor(Math.random() * 999) + "@akunlama.com"
}

function genUsername() {
  return "xv" + randomString(6) + Math.floor(Math.random() * 999)
}

function genPassword() {
  return randomString(10) + "Aa1!"
}

async function tmList(email) {
  try {
    const r = await axios.get(TEMPMAIL + "/list", {
      params: { recipient: email },
      timeout: 30000,
      headers: { "User-Agent": UA, "Accept": "application/json", "Origin": "https://akunlama.com", "Referer": "https://akunlama.com/" },
      validateStatus: () => true
    })
    return r.data
  } catch (_) { return null }
}

function extractOtp(text) {
  if (!text) return null
  const m = text.match(/font-size:\s*32px[^>]*>\s*(\d{4,8})\s*</i) ||
            text.match(/(?:kode|code|otp)[^\d]{0,40}(\d{4,8})/i) ||
            text.match(/>\s*(\d{6})\s*</)
  return m ? m[1] : null
}

async function tmReadMessage(key) {
  try {
    const [keyRes, htmlRes] = await Promise.all([
      axios.get(TEMPMAIL + "/getKey", { params: { region: "us", key }, timeout: 30000, headers: { "User-Agent": UA }, validateStatus: () => true }),
      axios.get(TEMPMAIL + "/getHtml", { params: { region: "us", key }, timeout: 30000, headers: { "User-Agent": UA }, validateStatus: () => true })
    ])
    return {
      detail: keyRes.data,
      html: typeof htmlRes.data === "string" ? htmlRes.data : null
    }
  } catch (_) { return null }
}

async function waitForOtp(email, maxWait = 180, interval = 5000) {
  const max = Math.ceil(maxWait * 1000 / interval)
  for (let i = 0; i < max; i++) {
    const list = await tmList(email)
    if (Array.isArray(list) && list.length > 0) {
      const msg = list[0]
      const key = msg.storage?.key || msg.key
      if (key) {
        const detail = await tmReadMessage(key)
        const html = detail?.html || msg.preview || ""
        const otp = extractOtp(html) || extractOtp(msg.preview || "")
        if (otp) return { otp, key, subject: msg.message?.headers?.subject || null }
      }
    }
    await delay(interval)
  }
  return null
}

async function apiRegister(email, username, password) {
  const r = await client.post(API + "/api/auth/register", { email, username, password }, {
    headers: { "Content-Type": "application/json" }
  })
  const d = parseJson(r.data)
  return { status: r.status, data: d }
}

async function apiVerify(email, code) {
  const r = await client.post(API + "/api/auth/verify-register", { email, code }, {
    headers: { "Content-Type": "application/json" }
  })
  const d = parseJson(r.data)
  return { status: r.status, data: d }
}

async function apiLogin(email, password) {
  const r = await client.post(API + "/api/auth/login", { email, password }, {
    headers: { "Content-Type": "application/json" }
  })
  const d = parseJson(r.data)
  return { status: r.status, data: d }
}

async function apiProfile(token) {
  const r = await client.get(API + "/api/user/profile", {
    headers: { Authorization: "Bearer " + token }
  })
  return parseJson(r.data)
}

async function apiCheckLimit(token) {
  const r = await client.get(API + "/api/user/check-limit", {
    headers: token ? { Authorization: "Bearer " + token } : {}
  })
  return parseJson(r.data) || { status: r.status }
}

async function createAccount() {
  const email = genEmail()
  const username = genUsername()
  const password = genPassword()

  console.log(JSON.stringify({ stage: "register", email, username }, null, 2))

  const reg = await apiRegister(email, username, password)
  if (!reg.data?.success) {
    throw new Error("Register gagal: " + (reg.data?.error || "HTTP " + reg.status))
  }

  console.log(JSON.stringify({ stage: "waiting-otp", email, timeout: 180 }, null, 2))
  const otpRes = await waitForOtp(email, 180)
  if (!otpRes) throw new Error("OTP tidak masuk dalam 3 menit")
  console.log(JSON.stringify({ stage: "otp-received", otp: otpRes.otp }, null, 2))

  const ver = await apiVerify(email, otpRes.otp)
  if (!ver.data?.success) {
    throw new Error("Verify gagal: " + (ver.data?.error || "HTTP " + ver.status))
  }

  const account = {
    id: ver.data.user?.id,
    email,
    username,
    password,
    token: ver.data.token,
    apiKey: ver.data.user?.apiKey || null,
    role: ver.data.user?.role || "free",
    createdAt: new Date().toISOString(),
    builds: 0
  }

  accounts.push(account)
  saveAccounts()
  setActive(account)

  return account
}

function setActive(account) {
  activeAccount = account
  saveActive()
}

function getToken() {
  return activeAccount?.token || null
}

async function buildApk(fdPayload, useAuth = true) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fdPayload)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item)
    } else if (v && typeof v === "object" && v.path) {
      fd.append(k, fs.createReadStream(v.path), { filename: v.filename || path.basename(v.path), contentType: v.contentType || "application/octet-stream" })
    } else if (v !== undefined && v !== null) {
      fd.append(k, String(v))
    }
  }

  const headers = { ...fd.getHeaders() }
  if (useAuth && getToken()) headers.Authorization = "Bearer " + getToken()

  const r = await client.post(API + "/api/apk/build", fd, { headers })
  return { status: r.status, data: parseJson(r.data) }
}

async function buildWithAutoRotate(payload, opts = {}) {
  const maxRetry = opts.maxRetry ?? 3

  if (!getToken()) {
    console.log(JSON.stringify({ stage: "no-account", action: "creating-new" }, null, 2))
    await createAccount()
  }

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const res = await buildApk(payload, true)
    const d = res.data

    if (d?.success && d?.downloadUrl) {
      if (activeAccount) {
        activeAccount.builds = (activeAccount.builds || 0) + 1
        saveAccounts()
      }
      return { attempt, ...d }
    }

    const errMsg = d?.error || ""
    const isLimit = res.status === 429 || /limit|habis|guest hanya/i.test(errMsg)

    if (isLimit) {
      console.log(JSON.stringify({ stage: "limit-hit", attempt, error: errMsg, action: "rotate-account" }, null, 2))
      const newAcc = await createAccount()
      console.log(JSON.stringify({ stage: "new-account", email: newAcc.email, username: newAcc.username }, null, 2))
      continue
    }

    throw new Error("Build gagal: " + (errMsg || "HTTP " + res.status))
  }

  throw new Error("Build gagal setelah " + maxRetry + " percobaan (semua akun limit)")
}

async function buildUrl(url, opts = {}) {
  const payload = {
    appName: opts.appName || "My App",
    packageName: opts.packageName || "com." + randomString(6) + ".app",
    versionName: opts.versionName || "1.0",
    versionCode: String(opts.versionCode || 1),
    websiteUrl: url
  }
  if (opts.permissions) payload.permissions = opts.permissions
  return await buildWithAutoRotate(payload, opts)
}

async function buildZip(zipPath, opts = {}) {
  if (!fs.existsSync(zipPath)) throw new Error("ZIP tidak ada: " + zipPath)
  const payload = {
    appName: opts.appName || "My App",
    packageName: opts.packageName || "com." + randomString(6) + ".app",
    versionName: opts.versionName || "1.0",
    versionCode: String(opts.versionCode || 1),
    zip: { path: zipPath, filename: path.basename(zipPath), contentType: "application/zip" }
  }
  if (opts.iconPath && fs.existsSync(opts.iconPath)) {
    payload.iconFileInput = { path: opts.iconPath, filename: path.basename(opts.iconPath), contentType: "image/png" }
  }
  if (opts.splashPath && fs.existsSync(opts.splashPath)) {
    payload.splashFileInput = { path: opts.splashPath, filename: path.basename(opts.splashPath), contentType: "image/png" }
  }
  if (opts.permissions) payload.permissions = opts.permissions
  return await buildWithAutoRotate(payload, opts)
}

async function buildHtml(htmlPath, opts = {}) {
  if (!fs.existsSync(htmlPath)) throw new Error("HTML tidak ada: " + htmlPath)
  const payload = {
    appName: opts.appName || "My App",
    packageName: opts.packageName || "com." + randomString(6) + ".app",
    versionName: opts.versionName || "1.0",
    versionCode: String(opts.versionCode || 1),
    htmlFile: { path: htmlPath, filename: path.basename(htmlPath), contentType: "text/html" }
  }
  if (opts.iconPath && fs.existsSync(opts.iconPath)) {
    payload.iconFileInput = { path: opts.iconPath, filename: path.basename(opts.iconPath), contentType: "image/png" }
  }
  if (opts.splashPath && fs.existsSync(opts.splashPath)) {
    payload.splashFileInput = { path: opts.splashPath, filename: path.basename(opts.splashPath), contentType: "image/png" }
  }
  if (opts.permissions) payload.permissions = opts.permissions
  return await buildWithAutoRotate(payload, opts)
}

function resolveUrl(u) {
  if (!u) return null
  if (u.startsWith("http")) return u
  return API + (u.startsWith("/") ? u : "/" + u)
}

async function downloadApk(downloadUrl, outPath) {
  const url = resolveUrl(downloadUrl)
  if (!url) throw new Error("URL download kosong")

  const out = outPath || path.join(process.cwd(), "build-" + Date.now() + ".apk")
  const writer = fs.createWriteStream(out)

  const headers = { "User-Agent": UA, Referer: API + "/" }
  if (getToken()) headers.Authorization = "Bearer " + getToken()

  const r = await axios.get(encodeURI(url), {
    responseType: "stream",
    timeout: 0,
    headers,
    validateStatus: s => s < 600,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  })

  if (r.status >= 400) {
    writer.close()
    try { fs.unlinkSync(out) } catch (_) {}
    throw new Error("Download gagal: HTTP " + r.status)
  }

  return new Promise((resolve, reject) => {
    let size = 0
    let last = 0
    r.data.on("data", c => {
      size += c.length
      const now = Date.now()
      if (now - last > 1000) {
        last = now
        process.stderr.write("\r[download] " + (size / 1024).toFixed(1) + " KB")
      }
    })
    r.data.pipe(writer)
    writer.on("finish", () => {
      process.stderr.write("\n")
      resolve({ path: out, size })
    })
    writer.on("error", reject)
    r.data.on("error", reject)
  })
}

async function history() {
  if (!getToken()) throw new Error("Belum login")
  const r = await client.get(API + "/api/apk/history", {
    headers: { Authorization: "Bearer " + getToken() }
  })
  return parseJson(r.data)
}

function parseFlags(args) {
  const flags = {}
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/)
    if (m) flags[m[1]] = m[2]
  }
  return flags
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const cmd = args[0]
    const log = m => process.stderr.write("[rf] " + m + "\n")

    let result

    if (cmd === "new-account") {
      const acc = await createAccount()
      result = { mode: "new-account", account: { email: acc.email, username: acc.username, role: acc.role, userId: acc.id } }
    } else if (cmd === "accounts") {
      result = { mode: "accounts", total: accounts.length, active: activeAccount?.email || null, accounts: accounts.map(a => ({ email: a.email, username: a.username, builds: a.builds, createdAt: a.createdAt })) }
    } else if (cmd === "active") {
      result = { mode: "active", account: activeAccount }
    } else if (cmd === "switch") {
      const idx = Number(args[1])
      if (!Number.isInteger(idx) || idx < 0 || idx >= accounts.length) throw new Error("Index akun tidak valid")
      setActive(accounts[idx])
      result = { mode: "switch", active: accounts[idx].email }
    } else if (cmd === "login") {
      const email = args[1]
      const password = args[2]
      if (!email || !password) throw new Error("Pakai: login <email> <password>")
      const r = await apiLogin(email, password)
      if (!r.data?.success) throw new Error("Login gagal: " + (r.data?.error || r.status))
      const acc = {
        id: r.data.user?.id,
        email,
        username: r.data.user?.username,
        password,
        token: r.data.token,
        apiKey: r.data.user?.apiKey,
        role: r.data.user?.role || "free",
        builds: 0,
        createdAt: new Date().toISOString()
      }
      const existing = accounts.findIndex(a => a.email === email)
      if (existing >= 0) accounts[existing] = acc
      else accounts.push(acc)
      saveAccounts()
      setActive(acc)
      result = { mode: "login", account: { email: acc.email, role: acc.role } }
    } else if (cmd === "profile") {
      if (!getToken()) throw new Error("Belum login")
      result = { mode: "profile", profile: await apiProfile(getToken()) }
    } else if (cmd === "limit") {
      result = { mode: "limit", limit: await apiCheckLimit(getToken()) }
    } else if (cmd === "history") {
      result = { mode: "history", history: await history() }
    } else if (cmd === "build-url") {
      const url = args[1]
      if (!url) throw new Error('Pakai: build-url "<url>" --appName="Nama" [--packageName=com.x.y]')
      const flags = parseFlags(args.slice(2))
      log("building from URL...")
      const build = await buildWithAutoRotate({
        appName: flags.appName || "My App",
        packageName: flags.packageName || "com." + randomString(6) + ".app",
        versionName: flags.versionName || "1.0",
        versionCode: String(flags.versionCode || 1),
        websiteUrl: url
      })
      const out = flags.output || path.join(process.cwd(), build.fileName || "build.apk")
      const dl = await downloadApk(build.downloadUrl, out)
      result = { mode: "build-url", build, saved: dl }
    } else if (cmd === "build-zip") {
      const zipPath = args[1]
      if (!zipPath) throw new Error('Pakai: build-zip <file.zip> --appName="Nama" [--packageName=com.x.y] [--icon=icon.png]')
      const flags = parseFlags(args.slice(2))
      log("building from ZIP...")
      const build = await buildWithAutoRotate({
        appName: flags.appName || "My App",
        packageName: flags.packageName || "com." + randomString(6) + ".app",
        versionName: flags.versionName || "1.0",
        versionCode: String(flags.versionCode || 1),
        zip: { path: zipPath, filename: path.basename(zipPath), contentType: "application/zip" },
        iconFileInput: flags.icon ? { path: flags.icon, filename: path.basename(flags.icon), contentType: "image/png" } : null,
        splashFileInput: flags.splash ? { path: flags.splash, filename: path.basename(flags.splash), contentType: "image/png" } : null
      })
      const out = flags.output || path.join(process.cwd(), build.fileName || "build.apk")
      const dl = await downloadApk(build.downloadUrl, out)
      result = { mode: "build-zip", build, saved: dl }
    } else if (cmd === "build-html") {
      const htmlPath = args[1]
      if (!htmlPath) throw new Error('Pakai: build-html <file.html> --appName="Nama"')
      const flags = parseFlags(args.slice(2))
      log("building from HTML...")
      const build = await buildWithAutoRotate({
        appName: flags.appName || "My App",
        packageName: flags.packageName || "com." + randomString(6) + ".app",
        versionName: flags.versionName || "1.0",
        versionCode: String(flags.versionCode || 1),
        htmlFile: { path: htmlPath, filename: path.basename(htmlPath), contentType: "text/html" },
        iconFileInput: flags.icon ? { path: flags.icon, filename: path.basename(flags.icon), contentType: "image/png" } : null,
        splashFileInput: flags.splash ? { path: flags.splash, filename: path.basename(flags.splash), contentType: "image/png" } : null
      })
      const out = flags.output || path.join(process.cwd(), build.fileName || "build.apk")
      const dl = await downloadApk(build.downloadUrl, out)
      result = { mode: "build-html", build, saved: dl }
    } else if (cmd === "download") {
      const url = args[1]
      const out = args[2] || null
      if (!url) throw new Error("Pakai: download <url> [output.apk]")
      const dl = await downloadApk(url, out)
      result = { mode: "download", saved: dl }
    } else if (cmd === "bulk-build") {
      const listFile = args[1]
      if (!listFile || !fs.existsSync(listFile)) throw new Error("Pakai: bulk-build <file.json>")
      const list = JSON.parse(fs.readFileSync(listFile, "utf8"))
      const results = []
      for (const item of list) {
        try {
          log("building: " + (item.appName || item.url || item.zip || item.html))
          let build
          if (item.zip) build = await buildWithAutoRotate({ appName: item.appName, packageName: item.packageName, versionName: item.versionName || "1.0", versionCode: "1", zip: { path: item.zip, filename: path.basename(item.zip), contentType: "application/zip" } })
          else if (item.html) build = await buildWithAutoRotate({ appName: item.appName, packageName: item.packageName, versionName: item.versionName || "1.0", versionCode: "1", htmlFile: { path: item.html, filename: path.basename(item.html), contentType: "text/html" } })
          else if (item.url) build = await buildWithAutoRotate({ appName: item.appName, packageName: item.packageName, versionName: item.versionName || "1.0", versionCode: "1", websiteUrl: item.url })
          else throw new Error("Item tidak valid")
          const out = item.output || path.join(process.cwd(), build.fileName || "build.apk")
          const dl = await downloadApk(build.downloadUrl, out)
          results.push({ item, build, saved: dl })
        } catch (e) {
          results.push({ item, error: e.message })
        }
      }
      result = { mode: "bulk-build", total: results.length, results }
    } else if (cmd === "session") {
      result = {
        mode: "session",
        accounts: accounts.length,
        active: activeAccount ? { email: activeAccount.email, username: activeAccount.username, role: activeAccount.role, builds: activeAccount.builds } : null
      }
    } else {
      throw new Error([
        "Perintah:",
        "  node rfweb2apk.js new-account",
        "  node rfweb2apk.js accounts",
        "  node rfweb2apk.js active",
        "  node rfweb2apk.js switch <index>",
        "  node rfweb2apk.js login <email> <password>",
        "  node rfweb2apk.js profile",
        "  node rfweb2apk.js limit",
        "  node rfweb2apk.js history",
        '  node rfweb2apk.js build-url "<url>" --appName="Nama" [--packageName=com.x.y]',
        '  node rfweb2apk.js build-zip <file.zip> --appName="Nama" [--icon=icon.png]',
        '  node rfweb2apk.js build-html <file.html> --appName="Nama"',
        '  node rfweb2apk.js bulk-build <list.json>',
        "  node rfweb2apk.js download <url> [output.apk]",
        "  node rfweb2apk.js session"
      ].join("\n"))
    }

    console.log(JSON.stringify({ author: "xvlovers", status: true, data: result }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ author: "xvlovers", status: false, message: e.message }, null, 2))
    process.exit(1)
  }
}

main()