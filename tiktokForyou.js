/*
**scrape tiktok foryou**
**author skrep: xvlovers**
**git:https://github.com/xvlovers/kumpulan-scrape-dan-plugin-esm-cjs-/blob/main/tiktokForyou.js **
**base URL: https://tikwm.com/api**
**credit: tiktok**

*/

const axios = require("axios")

const API_BASE = "https://tikwm.com/api"

async function getForYou(region, count) {
  const response = await axios.get(`${API_BASE}/feed/list`, {
    params: {
      region: region || "ID",
      count: count || 20
    },
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    },
    validateStatus: () => true
  })

  return response.data
}

function formatVideo(v) {
  return {
    id: v.video_id || null,
    judul: v.title || v.desc || null,
    cover: v.cover || v.origin_cover || null,
    durasi: v.duration || null,
    plays: v.play_count || 0,
    likes: v.digg_count || 0,
    komentar: v.comment_count || 0,
    share: v.share_count || 0,
    music: v.music_info?.title || null,
    author: {
      username: v.author?.unique_id || null,
      nickname: v.author?.nickname || null,
      avatar: v.author?.avatar || null
    },
    url: v.author?.unique_id
      ? `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`
      : null,
    videoUrl: v.play || v.hdplay || null,
    videoWm: v.wmplay || null
  }
}

async function main() {
  const region = process.argv[2] || "ID"
  const count = parseInt(process.argv[3]) || 20

  try {
    const result = await getForYou(region, count)

    if (result.code !== 0) {
      throw new Error(result.msg || "Gagal ambil feed")
    }

    const videos = (result.data || []).map(formatVideo)

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: {
        region,
        total: videos.length,
        videos
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