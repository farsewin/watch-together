const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * Converts SRT content to VTT format.
 * @param {string} srt 
 * @returns {string}
 */
function srtToVtt(srt) {
  // Add WEBVTT header
  let vtt = "WEBVTT\n\n";
  
  // Replace comma with dot in timestamps
  // 00:00:20,000 -> 00:00:20.000
  vtt += srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  
  return vtt;
}

router.get('/subtitle-vtt', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("No subtitle URL provided");
  }

  try {
    console.log(`[Subtitle] Proxying/Converting: ${url}`);
    
    // Fetch the subtitle file
    const response = await axios.get(url, {
      responseType: 'text',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    let content = response.data;
    const isSrt = url.toLowerCase().endsWith('.srt') || content.includes(' --> ');
    const isVtt = url.toLowerCase().endsWith('.vtt') || content.startsWith('WEBVTT');

    if (isSrt && !isVtt) {
      console.log("[Subtitle] Detected SRT, converting to VTT");
      content = srtToVtt(content);
    }

    // Set headers for VTT
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(content);

  } catch (error) {
    console.error(`[Subtitle] Error proxying subtitle: ${error.message}`);
    res.status(500).send("Error fetching or converting subtitle");
  }
});

module.exports = router;
