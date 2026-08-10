/*
name: kompass scrape
base url: https://www.kompas.com

author: xvlovers
github: xvlover

fungsi: scrape website kompas.com untuk mengambil info media.

credit: xvlovers

chanel WhatsApp untuk info : https://whatsapp.com/channel/0029VbCKJpb6LwHpbtC1mb3E
*/

const axios = require('axios');
const cheerio = require('cheerio');

const CONFIG = {
  BASE_URL: 'https://www.kompas.com',
  TIMEOUT: 30000,
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

function cleanText(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

async function scrapeHeadlines(limit = 10) {
  try {
    const response = await axios.get(CONFIG.BASE_URL, {
      headers: { 'User-Agent': CONFIG.USER_AGENT },
      timeout: CONFIG.TIMEOUT
    });

    const $ = cheerio.load(response.data);
    const headlines = [];
    const seen = new Set();

    $('.article__title, .most__title, .terkini__title, .headline__title, .article__link').each((_, el) => {
      const title = cleanText($(el).text());
      let link = $(el).closest('a').attr('href') || $(el).attr('href');
      
      if (title && title.length > 10 && !seen.has(title)) {
        if (link && !link.startsWith('http')) {
          link = CONFIG.BASE_URL + link;
        }
        if (link && link.includes('kompas.com')) {
          seen.add(title);
          headlines.push({
            title: title,
            url: link
          });
        }
      }
    });

    return headlines.slice(0, limit);
  } catch (error) {
    return [];
  }
}

async function main() {
  const limit = parseInt(process.argv[2]) || 10;
  const result = await scrapeHeadlines(limit);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = { scrapeHeadlines };