/*
name: tiktok downloader
base url: https://tikwm.com/api

author: xvlovers
github: xvlover

fungsi: download video tiktok dengan watermark dari url publik.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/
const axios = require("axios")
const fs = require("fs")
const path = require("path")

const TIKTOK_API = "https://tikwm.com/api"

async function downloadTikTok(url) {
  const response = await axios.get(TIKTOK_API, {
    params: { url: url },
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json"
    },
    validateStatus: status => status < 400
  })

  const data = response.data

  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || "Gagal mengambil data video")
  }

  const video = data.data

  const cleanTitle = (video.title || "tiktok_video")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .substring(0, 50)
    .replace(/\s+/g, "_")

  const fileName = `tiktok_${video.id}_${cleanTitle}_wm.mp4`
  const filePath = path.join(process.cwd(), fileName)

  const writer = fs.createWriteStream(filePath)

  const videoResponse = await axios.get(video.wmplay, {
    timeout: 60000,
    responseType: "stream",
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Referer": "https://www.tiktok.com/",
      "Accept": "*/*"
    }
  })

  const totalSize = parseInt(videoResponse.headers["content-length"], 10) || 0
  let downloadedSize = 0

  videoResponse.data.on("data", (chunk) => {
    downloadedSize += chunk.length
    const percent = totalSize ? ((downloadedSize / totalSize) * 100).toFixed(1) : "?"
    process.stdout.write(`\rDownloading... ${percent}%`)
  })

  videoResponse.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      console.log("")
      resolve({
        id: video.id,
        title: video.title || null,
        cover: video.cover || null,
        duration: video.duration || null,
        playCount: video.play_count || null,
        diggCount: video.digg_count || null,
        commentCount: video.comment_count || null,
        shareCount: video.share_count || null,
        author: {
          id: video.author?.id || null,
          username: video.author?.unique_id || null,
          nickname: video.author?.nickname || null,
          avatar: video.author?.avatar || null
        },
        file: fileName,
        filePath: filePath,
        fileSize: totalSize,
        videoUrl: video.wmplay,
        type: "watermark"
      })
    })
    writer.on("error", reject)
    videoResponse.data.on("error", reject)
  })
}

async function main() {
  const url = process.argv[2]

  if (!url) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "example: node yournamefile.js tiktok url ------ tq to used this scrape><"
    }, null, 2))
    process.exit(1)
  }

  if (!url.includes("tiktok.com") && !url.includes("vm.tiktok.com")) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "URL bukan dari TikTok"
    }, null, 2))
    process.exit(1)
  }

  try {
    const data = await downloadTikTok(url)

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: data
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