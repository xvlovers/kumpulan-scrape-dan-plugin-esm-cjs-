/*
name: github stalk
base url: https://api.github.com

author: xvlovers
github: xvlovers

fungsi: stalk profil github lengkap dengan repositori.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require("axios")

const GITHUB_API = "https://api.github.com"

async function stalkUser(username) {
  const response = await axios.get(`${GITHUB_API}/users/${username}`, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/vnd.github+json"
    },
    validateStatus: status => status < 500
  })

  if (response.status === 404) {
    throw new Error("User tidak ditemukan")
  }

  if (response.status === 403) {
    throw new Error("Rate limit GitHub tercapai. Coba lagi nanti.")
  }

  const user = response.data

  return {
    id: user.id || null,
    login: user.login || null,
    name: user.name || null,
    bio: user.bio || null,
    company: user.company || null,
    blog: user.blog || null,
    location: user.location || null,
    email: user.email || null,
    twitter: user.twitter_username || null,
    avatar: user.avatar_url || null,
    htmlUrl: user.html_url || null,
    followers: user.followers || 0,
    following: user.following || 0,
    publicRepos: user.public_repos || 0,
    publicGists: user.public_gists || 0,
    createdAt: user.created_at || null,
    updatedAt: user.updated_at || null,
    type: user.type || null,
    hireable: user.hireable || false,
    followersFormatted: formatNumber(user.followers || 0),
    followingFormatted: formatNumber(user.following || 0),
    publicReposFormatted: formatNumber(user.public_repos || 0)
  }
}

async function getRepos(username, limit) {
  const response = await axios.get(`${GITHUB_API}/users/${username}/repos`, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/vnd.github+json"
    },
    params: {
      sort: "updated",
      per_page: limit || 10
    },
    validateStatus: status => status < 500
  })

  const repos = response.data

  return repos.map(repo => ({
    id: repo.id || null,
    name: repo.name || null,
    fullName: repo.full_name || null,
    description: repo.description || null,
    language: repo.language || null,
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    watchers: repo.watchers_count || 0,
    openIssues: repo.open_issues_count || 0,
    defaultBranch: repo.default_branch || null,
    private: repo.private || false,
    fork: repo.fork || false,
    archived: repo.archived || false,
    createdAt: repo.created_at || null,
    updatedAt: repo.updated_at || null,
    pushedAt: repo.pushed_at || null,
    homepage: repo.homepage || null,
    url: repo.html_url || null,
    starsFormatted: formatNumber(repo.stargazers_count || 0),
    forksFormatted: formatNumber(repo.forks_count || 0)
  }))
}

async function getActivity(username) {
  try {
    const response = await axios.get(`${GITHUB_API}/users/${username}/events/public`, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/vnd.github+json"
      },
      params: {
        per_page: 10
      },
      validateStatus: status => status < 500
    })

    return response.data.map(event => ({
      type: event.type || null,
      repo: event.repo?.name || null,
      createdAt: event.created_at || null,
      action: event.payload?.action || null
    }))
  } catch (e) {
    return []
  }
}

async function getOrganizations(username) {
  try {
    const response = await axios.get(`${GITHUB_API}/users/${username}/orgs`, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/vnd.github+json"
      },
      validateStatus: status => status < 500
    })

    return response.data.map(org => ({
      login: org.login || null,
      description: org.description || null,
      avatar: org.avatar_url || null,
      url: org.url || null
    }))
  } catch (e) {
    return []
  }
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
  if (num >= 1000) return (num / 1000).toFixed(1) + "K"
  return num.toString()
}

async function main() {
  const username = process.argv[2]
  const limit = parseInt(process.argv[3]) || 5

  if (!username) {
    console.log(JSON.stringify({
      author: "xvlovers",
      status: false,
      message: "Usage: node github-stalk.js <username> [limit-repo]"
    }, null, 2))
    process.exit(1)
  }

  const cleanUsername = username.replace("https://github.com/", "").replace("/", "").trim()

  try {
    const profile = await stalkUser(cleanUsername)
    const repos = await getRepos(cleanUsername, limit)
    const activity = await getActivity(cleanUsername)
    const orgs = await getOrganizations(cleanUsername)

    console.log(JSON.stringify({
      author: "xvlovers",
      status: true,
      data: {
        profile,
        totalRepos: repos.length,
        repos,
        totalActivity: activity.length,
        activity,
        totalOrganizations: orgs.length,
        organizations: orgs
      }
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