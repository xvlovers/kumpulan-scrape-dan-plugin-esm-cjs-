/*
name: squichy bot pairing
base url: https://squichy-bot.zone.id

author: xvlovers
github: xvlovers

fungsi: pairing nomor whatsapp ke squichy bot & no ads(iklan), gatau gabut aja nyekrep nya

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")

const BASE_URL = "https://squichy-bot.zone.id"
const PAIR_API = `${BASE_URL}/api/pair`

async function getCountries() {
  const response = await axios.get(`${BASE_URL}/countries.json`, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    }
  })

  return response.data
}

async function doPair(phoneNumber, countryCode) {
  const response = await axios.post(PAIR_API, {
    number: phoneNumber,
    country: countryCode
  }, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    },
    validateStatus: status => status < 500
  })

  return response.data
}

async function main() {
  const phoneNumber = process.argv[2]
  const countryCode = process.argv[3] || "62"

  if (!phoneNumber) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node squichy-pair.js <nomor> [kode-negara]"
    }, null, 2))
    process.exit(1)
  }

  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "")

  if (cleanNumber.length < 8 || cleanNumber.length > 15) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Format nomor tidak valid"
    }, null, 2))
    process.exit(1)
  }

  try {
    const countries = await getCountries()

    const countryInfo = countries.find(c => c.code === countryCode || c.name.toLowerCase().includes(countryCode.toLowerCase()))

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      stage: "countries",
      message: "Daftar negara berhasil diambil",
      data: {
        selected: countryInfo || { code: countryCode, name: "Unknown", flag: "🌍" },
        totalCountries: countries.length
      }
    }, null, 2))

    const result = await doPair(cleanNumber, countryCode)

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      stage: "pairing",
      message: "Proses pairing selesai",
      data: result
    }, null, 2))
  } catch (error) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: error.response?.data?.message || error.message
    }, null, 2))
    process.exit(1)
  }
}

main()