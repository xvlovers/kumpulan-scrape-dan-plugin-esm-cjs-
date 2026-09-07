/*
**scrape multi harga crypto tradingview**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/tradingViewCrypto.js **
**base URL: https://id.tradingview.com**
**credit: tradingview**

*/

const axios = require("axios")

const SYMBOLS = [
  { symbol: "BTCUSD", nama: "Bitcoin" },
  { symbol: "ETHUSD", nama: "Ethereum" },
  { symbol: "SOLUSD", nama: "Solana" },
  { symbol: "BNBUSD", nama: "BNB" },
  { symbol: "XRPUSD", nama: "Ripple" },
  { symbol: "ADAUSD", nama: "Cardano" },
  { symbol: "DOGEUSD", nama: "Dogecoin" },
  { symbol: "AVAXUSD", nama: "Avalanche" },
  { symbol: "DOTUSD", nama: "Polkadot" },
  { symbol: "MATICUSD", nama: "Polygon" },
  { symbol: "LTCUSD", nama: "Litecoin" },
  { symbol: "LINKUSD", nama: "Chainlink" },
  { symbol: "UNIUSD", nama: "Uniswap" },
  { symbol: "ATOMUSD", nama: "Cosmos" },
  { symbol: "TRXUSD", nama: "TRON" }
]

async function getHargaCrypto(symbol) {
  const url = `https://id.tradingview.com/symbols/${symbol}/`

  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    }
  })

  const html = response.data

  const priceMatch = html.match(/"price"\s*:\s*([\d.]+)/)
  const changePctMatch = html.match(/"change_pct"\s*:\s*([-\d.]+)/)
  const changeAbsMatch = html.match(/"change_abs"\s*:\s*([-\d.]+)/)
  const highMatch = html.match(/"high"\s*:\s*([\d.]+)/)
  const lowMatch = html.match(/"low"\s*:\s*([\d.]+)/)
  const openMatch = html.match(/"open"\s*:\s*([\d.]+)/)
  const volumeMatch = html.match(/"volume"\s*:\s*([\d.]+)/)
  const marketCapMatch = html.match(/"market_cap"\s*:\s*([\d.]+)/)
  const titleMatch = html.match(/<title>([^<]+)<\/title>/)

  return {
    symbol,
    harga: priceMatch ? parseFloat(priceMatch[1]) : null,
    perubahan_persen: changePctMatch ? parseFloat(changePctMatch[1]) : null,
    perubahan_nominal: changeAbsMatch ? parseFloat(changeAbsMatch[1]) : null,
    high: highMatch ? parseFloat(highMatch[1]) : null,
    low: lowMatch ? parseFloat(lowMatch[1]) : null,
    open: openMatch ? parseFloat(openMatch[1]) : null,
    volume: volumeMatch ? parseFloat(volumeMatch[1]) : null,
    market_cap: marketCapMatch ? parseFloat(marketCapMatch[1]) : null,
    title: titleMatch ? titleMatch[1] : null
  }
}

async function main() {
  const filter = process.argv[2]?.toUpperCase() || null

  try {
    const results = []

    for (const coin of SYMBOLS) {
      if (filter && !coin.symbol.includes(filter) && !coin.nama.toUpperCase().includes(filter)) {
        continue
      }

      try {
        const data = await getHargaCrypto(coin.symbol)

        results.push({
          nama: coin.nama,
          ...data
        })

        console.log(JSON.stringify({
          author: "xvlovers",
          status: true,
          progress: `${results.length}/${filter ? "filtered" : SYMBOLS.length}`
        }, null, 2))
      } catch (e) {
        results.push({
          nama: coin.nama,
          symbol: coin.symbol,
          error: e.message
        })
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      total: results.length,
      data: results
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