/*
**reaction whatsapp**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/reactionWa.js **
**base URL: https://reaction-whatsapp.edgeone.dev**
**credit: reaction whatsapp**

*/

const axios = require("axios")

const BASE_URL = "https://reaction-whatsapp.edgeone.dev"
const API_KEY = "9J88DPLJ"

async function main() {
  const link = process.argv[2]
  const emoji = process.argv[3]

  if (!link || !emoji) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node reaction-wa.js <link> <emoji>"
    }, null, 2))
    process.exit(1)
  }

  try {
    const res = await axios.post(`${BASE_URL}/react`, {
      link,
      emoji
    }, {
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "Origin": BASE_URL,
        "Referer": BASE_URL + "/"
      },
      validateStatus: () => true
    })

    console.log(JSON.stringify({
      author: "xvlovers",
      status: res.status === 200,
      httpStatus: res.status,
      data: res.data
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