/*
**scrape jadwal sholat via aladhan**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/jadwalSholat.js **
**base URL: https://api.aladhan.com**
**credit: aladhan.com**

*/

const axios = require("axios")

const KOTA_KOORDINAT = {
  jakarta: { lat: -6.2088, lng: 106.8456 },
  surabaya: { lat: -7.2575, lng: 112.7521 },
  bandung: { lat: -6.9175, lng: 107.6191 },
  medan: { lat: 3.5952, lng: 98.6722 },
  semarang: { lat: -6.9667, lng: 110.4167 },
  makassar: { lat: -5.1477, lng: 119.4327 },
  yogyakarta: { lat: -7.7956, lng: 110.3695 },
  palembang: { lat: -2.9761, lng: 104.7754 },
  denpasar: { lat: -8.6705, lng: 115.2126 },
  balikpapan: { lat: -1.2379, lng: 116.8529 }
}

async function getJadwal(kota) {
  const key = kota.toLowerCase()
  const coords = KOTA_KOORDINAT[key]

  if (!coords) {
    throw new Error(`Kota "${kota}" tidak ada. Pilihan: ${Object.keys(KOTA_KOORDINAT).join(", ")}`)
  }

  const response = await axios.get("https://api.aladhan.com/v1/timings", {
    params: {
      latitude: coords.lat,
      longitude: coords.lng,
      method: 11,
      school: 0
    },
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    },
    validateStatus: () => true
  })

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}`)
  }

  const data = response.data
  const timings = data.data.timings
  const date = data.data.date

  return {
    kota: kota,
    tanggalMasehi: date.readable,
    tanggalHijriah: `${date.hijri.day} ${date.hijri.month.en} ${date.hijri.year} AH`,
    timezone: data.data.meta.timezone,
    jadwal: {
      imsak: timings.Imsak,
      subuh: timings.Fajr,
      terbit: timings.Sunrise,
      dhuha: timings.Dhuha || null,
      dzuhur: timings.Dhuhr,
      ashar: timings.Asr,
      maghrib: timings.Maghrib,
      isya: timings.Isha
    }
  }
}

async function main() {
  const kota = process.argv[2] || "jakarta"

  try {
    const data = await getJadwal(kota)

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data
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