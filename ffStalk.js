/*
**scrape free fire stalk adenpedia**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/ffStalk.js **
**base URL: https://adenpedia.my.id**
**credit: adenpedia**

*/

const axios = require("axios")

const BASE_URL = "https://adenpedia.my.id"
const INFO_API = `${BASE_URL}/adenbaru/info.php`

async function stalkUid(uid) {
  const response = await axios.get(`${INFO_API}?uid=${uid}`, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": `${BASE_URL}/adenbaru/`
    },
    validateStatus: () => true
  })

  return {
    status: response.status,
    data: response.data
  }
}

function parseData(data) {
  const basic = data.basicInfo || {}
  const clan = data.clanBasicInfo || {}
  const profile = data.profileInfo || {}
  const pet = data.petInfo || {}
  const social = data.socialInfo || {}

  return {
    nickname: basic.nickname || null,
    uid: basic.uid || null,
    level: basic.level || null,
    exp: basic.exp || null,
    rating: basic.rating || null,
    rank: basic.rank || null,
    region: basic.region || null,
    signature: social.signature || basic.signature || null,
    avatar: basic.headPic ? `https://ff.garena.com/avatar/${basic.headPic}` : null,
    createAt: basic.createAt || basic.createdAt || null,
    lastLogin: basic.lastLoginAt || null,
    primeLevel: basic.primeInfo?.primeLevel || null,
    badgeCount: basic.badgeCnt || null,
    clanName: clan.clanName || null,
    clanLevel: clan.clanLevel || null,
    clanMember: clan.clanMember || null,
    petName: pet.petName || pet.name || null,
    petLevel: pet.level || null,
    profile: profile
  }
}

async function main() {
  const uid = process.argv[2]

  if (!uid) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node ff-stalk.js <uid>"
    }, null, 2))
    process.exit(1)
  }

  if (uid.length < 8 || !/^\d+$/.test(uid)) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "UID harus minimal 8 digit angka"
    }, null, 2))
    process.exit(1)
  }

  try {
    const hasil = await stalkUid(uid)

    if (hasil.status !== 200 || !hasil.data?.basicInfo?.nickname) {
      throw new Error(hasil.data?.message || "Data tidak ditemukan")
    }

    const data = parseData(hasil.data)

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