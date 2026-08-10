/*
name: tiktok stalk
base url: https://www.kompas.com

author: xvlovers
github: xvlover

fungsi: stalking tiktok account
credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/
const axios = require("axios")

async function main() {
  const username = process.argv[2]

  if (!username) {
    console.log(JSON.stringify({
      status: false,
      message: "Usage: node tiktok-stalk.js <username>"
    }, null, 2))
    process.exit(1)
  }

  try {
    const cleanUsername = username.replace("@", "").trim()
    const apiUrl = `https://www.tiktok.com/@${cleanUsername}`

    const response = await axios.get(apiUrl, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br"
      },
      maxRedirects: 5,
      validateStatus: status => status < 400
    })

    const html = response.data

    const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/)

    if (!jsonMatch || !jsonMatch[1]) {
      console.log(JSON.stringify({
        status: false,
        message: "Failed to extract profile data. User may not exist or TikTok blocked the request."
      }, null, 2))
      process.exit(1)
    }

    const raw = JSON.parse(jsonMatch[1])
    const userData = raw?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo

    if (!userData) {
      console.log(JSON.stringify({
        status: false,
        message: "User not found or account is private"
      }, null, 2))
      process.exit(1)
    }

    const user = userData.user
    const stats = userData.stats

    const topVideos = []

    if (userData.posts && Array.isArray(userData.posts)) {
      const sorted = userData.posts
        .sort((a, b) => (b.stats?.playCount || 0) - (a.stats?.playCount || 0))
        .slice(0, 3)

      for (const post of sorted) {
        topVideos.push({
          id: post.id || null,
          description: post.desc || null,
          playCount: post.stats?.playCount || 0,
          diggCount: post.stats?.diggCount || 0,
          commentCount: post.stats?.commentCount || 0,
          shareCount: post.stats?.shareCount || 0,
          duration: post.video?.duration || null,
          coverUrl: post.video?.cover || post.video?.originCover || null,
          videoUrl: post.video?.downloadAddr || post.video?.playAddr || null,
          createTime: post.createTime ? new Date(post.createTime * 1000).toISOString() : null
        })
      }
    }

    const result = {
      status: true,
      data: {
        profile: {
          id: user.id || null,
          username: user.uniqueId || null,
          nickname: user.nickname || null,
          avatar: user.avatarLarger || user.avatarMedium || user.avatarThumb || null,
          signature: user.signature || null,
          bioDescription: user.bioDescription || null,
          verified: user.verified || false,
          privateAccount: user.secret || false,
          commerceUser: user.commerceUserInfo?.commerceUser || false,
          ttSeller: user.ttSeller || false,
          region: user.region || null,
          language: user.language || null,
          createTime: user.createTime ? new Date(user.createTime * 1000).toISOString() : null,
          profileLink: user.uniqueId ? `https://www.tiktok.com/@${user.uniqueId}` : null
        },
        stats: {
          followingCount: stats.followingCount || 0,
          followerCount: stats.followerCount || 0,
          heartCount: stats.heartCount || 0,
          videoCount: stats.videoCount || 0,
          heartCountFormatted: formatNumber(stats.heartCount || 0),
          followerCountFormatted: formatNumber(stats.followerCount || 0),
          videoCountFormatted: formatNumber(stats.videoCount || 0)
        },
        topVideos: topVideos
      }
    }

    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(JSON.stringify({
        status: false,
        message: "User not found"
      }, null, 2))
    } else {
      console.log(JSON.stringify({
        status: false,
        message: error.message
      }, null, 2))
    }
    process.exit(1)
  }
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

main()