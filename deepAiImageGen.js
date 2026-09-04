/*
**scrape image generator deepai final**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/deepAiImageGen.js **
**base URL: https://deepai.org**
**credit: deepai**

*/

const axios = require("axios")
const FormData = require("form-data")

const BASE_URL = "https://deepai.org"
const API_BASE = "https://api.deepai.org"
const MODEL_ID = "text2img"
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

function generateTryItKey() {
  const myrandomstr = Math.round((Math.random() * 100000000000)) + ""

  const myhashfunction = (function() {
    const a = []
    for (let b = 0; 64 > b;) {
      a[b] = 0 | 4294967296 * Math.sin(++b % Math.PI)
    }

    return function(input) {
      let d, e, f, g = [d = 1732584193, e = 4023233417, ~d, ~e]
      let h = []
      let l = unescape(encodeURI(input)) + "\u0080"
      let k = l.length

      let c = --k / 4 + 2 | 15
      for (h[--c] = 8 * k; ~k;) {
        h[k >> 2] |= l.charCodeAt(k) << 8 * k--
      }

      for (let b = 0, l = 0; b < c; b += 16) {
        for (k = g; 64 > l; k = [f = k[3], d + ((f = k[0] + [d & e | ~d & f, f & d | ~f & e, d ^ e ^ f, e ^ (d | ~f)][k = l >> 4] + a[l] + ~~h[b | [l, 5 * l + 1, 3 * l + 5, 7 * l][k] & 15]) << (k = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * k + l++ % 4]) | f >>> -k), d, e]) {
          d = k[1] | 0
          e = k[2]
        }
        for (l = 4; l;) {
          g[--l] += k[l]
        }
      }

      let result = ""
      for (let l = 0; 32 > l;) {
        result += (g[l >> 3] >> 4 * (1 ^ l++) & 15).toString(16)
      }
      return result.split("").reverse().join("")
    }
  })()

  const hash1 = myhashfunction(USER_AGENT + myhashfunction(USER_AGENT + myhashfunction(USER_AGENT + myrandomstr + 'hackers_become_a_little_stinkier_every_time_they_hack')))

  return 'tryit-' + myrandomstr + '-' + hash1
}

async function getCookies() {
  const response = await axios.get(`${BASE_URL}/machine-learning-model/text2img`, {
    timeout: 20000,
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  })

  return response.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ") || ""
}

async function generateImage(prompt, cookie, apiKey) {
  const formData = new FormData()
  formData.append("text", prompt)
  formData.append("generation_source", "img")

  const response = await axios.post(`${API_BASE}/api/${MODEL_ID}`, formData, {
    timeout: 180000,
    headers: {
      ...formData.getHeaders(),
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
      "api-key": apiKey,
      "Cookie": cookie,
      "Origin": BASE_URL,
      "Referer": `${BASE_URL}/machine-learning-model/text2img`
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

async function main() {
  const prompt = process.argv.slice(2).join(" ")

  if (!prompt) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node deepai-img.js <prompt>"
    }, null, 2))
    process.exit(1)
  }

  try {
    const cookie = await getCookies()
    const apiKey = generateTryItKey()

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      stage: "prepare",
      message: "Cookie & Api-Key siap",
      data: { apiKey: apiKey.substring(0, 20) + "..." }
    }, null, 2))

    const hasil = await generateImage(prompt, cookie, apiKey)

    if (hasil.status === 200 && hasil.data?.output_url) {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: true,
        data: {
          prompt,
          imageUrl: hasil.data.output_url,
          shareUrl: hasil.data.share_url || null,
          raw: hasil.data
        }
      }, null, 2))
    } else {
      console.log(JSON.stringify({
        author: "xvlovers",
        status: false,
        message: hasil.data?.status || hasil.data?.error || `HTTP ${hasil.status}`,
        data: hasil.data
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