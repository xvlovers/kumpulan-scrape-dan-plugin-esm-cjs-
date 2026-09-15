/*
name: Adenpedia Cek Prime
base url: https://adenpedia.my.id

author: xvlovers
github: xvlovers

fungsi: hitung harga Prime Points, level Prime 1-8, dan Booyah Pass sesuai kalkulator Adenpedia

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const CONFIG = {
  PRICE_PER_POINT: 128,
  PRICE_PER_DIAMOND: 126,
  LOGO_POINT_RATE: 126,
  MAX_PRIME_POINTS: 10000000,
  BOOYAH_DIAMONDS_PER_LEVEL: 20,
  PRIME_LOGO_BASE: "https://www.adenpedia.my.id/cekprime/prime",
  PRIME_LEVELS: {
    1: 100,
    2: 1000,
    3: 3000,
    4: 10000,
    5: 30000,
    6: 60000,
    7: 120000,
    8: 200000
  },
  LOGO_THRESHOLDS: [
    { level: 8, minScore: 25200000 },
    { level: 7, minScore: 15120000 },
    { level: 6, minScore: 7560000 },
    { level: 5, minScore: 3780000 },
    { level: 4, minScore: 1260000 },
    { level: 3, minScore: 378000 },
    { level: 2, minScore: 126000 },
    { level: 1, minScore: 0 }
  ]
}

function rupiah(n) {
  return "Rp" + Number(n).toLocaleString("id-ID")
}

function parseNumber(raw) {
  if (raw === undefined || raw === null) return NaN
  const cleaned = String(raw).trim().replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, "")
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function computePrimePoints(points) {
  if (!Number.isFinite(points) || points <= 0) throw new Error("Jumlah Prime Points harus angka > 0")
  if (points > CONFIG.MAX_PRIME_POINTS) throw new Error("Melebihi batas maksimal " + CONFIG.MAX_PRIME_POINTS.toLocaleString("id-ID") + " points")
  const total = points * CONFIG.PRICE_PER_POINT
  return {
    type: "prime-points",
    input: points,
    ratePerPoint: CONFIG.PRICE_PER_POINT,
    total,
    totalFormatted: rupiah(total)
  }
}

function computePrimeLevel(level) {
  const lv = Number(level)
  if (!Number.isInteger(lv) || lv < 1 || lv > 8) throw new Error("Level Prime harus 1-8")
  const diamonds = CONFIG.PRIME_LEVELS[lv]
  const total = diamonds * CONFIG.PRICE_PER_DIAMOND
  return {
    type: "prime-level",
    level: lv,
    diamonds,
    ratePerDiamond: CONFIG.PRICE_PER_DIAMOND,
    total,
    totalFormatted: rupiah(total)
  }
}

function computeBooyah(diamonds) {
  const d = Number(diamonds)
  if (!Number.isFinite(d) || d <= 0) throw new Error("Jumlah diamond Booyah Pass harus angka > 0")
  const total = d * CONFIG.PRICE_PER_DIAMOND
  const levels = Math.floor(d / CONFIG.BOOYAH_DIAMONDS_PER_LEVEL)
  return {
    type: "booyah-pass",
    diamonds: d,
    diamondsPerLevel: CONFIG.BOOYAH_DIAMONDS_PER_LEVEL,
    estimatedLevels: levels,
    ratePerDiamond: CONFIG.PRICE_PER_DIAMOND,
    total,
    totalFormatted: rupiah(total)
  }
}

function computeLogo(score) {
  const s = Number(score)
  if (!Number.isFinite(s) || s <= 0) throw new Error("Score logo harus angka > 0")
  const total = s * CONFIG.LOGO_POINT_RATE
  let tier = 1
  for (const t of CONFIG.LOGO_THRESHOLDS) {
    if (s >= t.minScore) { tier = t.level; break }
  }
  return {
    type: "logo-prime",
    score: s,
    tier,
    ratePerPoint: CONFIG.LOGO_POINT_RATE,
    total,
    totalFormatted: rupiah(total)
  }
}

function showAllPrices() {
  const primes = []
  for (let lv = 1; lv <= 8; lv++) primes.push(computePrimeLevel(lv))
  const samplePoints = [100, 500, 1000, 5000, 10000, 50000, 100000].map(computePrimePoints)
  const sampleBooyah = [20, 100, 271, 500, 1000].map(computeBooyah)
  const sampleLogo = [126000, 378000, 1260000, 3780000].map(computeLogo)
  return { primes, samplePoints, sampleBooyah, sampleLogo }
}

function dispatch(rawNum, rawMode) {
  const mode = (rawMode || "").toLowerCase().trim()
  const n = parseNumber(rawNum)

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Angka tidak valid: " + rawNum)
  }

  if (mode === "prime" || mode === "level" || mode === "pl") return computePrimeLevel(n)
  if (mode === "booyah" || mode === "bp" || mode === "pass") return computeBooyah(n)
  if (mode === "logo" || mode === "score") return computeLogo(n)
  if (mode === "point" || mode === "points" || mode === "pts") return computePrimePoints(n)

  if (n <= 8 && Number.isInteger(n)) {
    return { primePoints: computePrimePoints(n), primeLevel: computePrimeLevel(n) }
  }
  if (n <= 1000) return computePrimePoints(n)
  if (n >= 100000 && n <= 10000000) return { primePoints: computePrimePoints(n), logo: computeLogo(n) }
  return computeBooyah(n)
}

function main() {
  try {
    const args = process.argv.slice(2).filter(a => a && a.trim() !== "")
    const a1 = args[0]
    const a2 = args[1]

    let result

    if (!a1) {
      result = { mode: "price-list", ...showAllPrices() }
    } else {
      result = dispatch(a1, a2)
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: {
        source: "adenpedia.my.id",
        calculator: "cekprime",
        config: {
          pricePerPoint: CONFIG.PRICE_PER_POINT,
          pricePerDiamond: CONFIG.PRICE_PER_DIAMOND,
          logoPointRate: CONFIG.LOGO_POINT_RATE,
          maxPrimePoints: CONFIG.MAX_PRIME_POINTS
        },
        result
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