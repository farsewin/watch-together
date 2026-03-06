const express = require('express');
const router = express.Router();
const axios = require('axios');

const BASE_URL = 'https://api.opensubtitles.com/api/v1';
const API_KEY = process.env.OPENSUBTITLES_API_KEY || "FZxPCYLoYH8hfordb7tsoeXDqXK74ZQ0";

// Search Subtitles
// Query params: q (text), tmdb_id, type (movie/tv), season, episode
router.get('/search', async (req, res) => {
  const { q, tmdb_id, type, season, episode } = req.query;

  try {
    const params = {
      languages: 'ar,en', // Default to Arabic and English
      order_by: 'download_count',
      order_direction: 'desc'
    };

    if (tmdb_id) {
      params.tmdb_id = tmdb_id;
      if (type === 'tv') {
        params.parent_tmdb_id = tmdb_id; // Searching for episode usually requires tmdb_id as parent
        params.season_number = season;
        params.episode_number = episode;
      }
    } else if (q) {
      params.query = q;
    }

    console.log(`[OpenSubtitles] Searching with params:`, params);

    const response = await axios.get(`${BASE_URL}/subtitles`, {
      params,
      headers: {
        'Api-Key': API_KEY,
        'User-Agent': 'WatchTogether/1.0.0'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(`[OpenSubtitles] Search error:`, error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search subtitles' });
  }
});

// Get Download Link
router.post('/download', async (req, res) => {
  const { file_id } = req.body;

  if (!file_id) {
    return res.status(400).json({ error: 'file_id is required' });
  }

  try {
    const response = await axios.post(`${BASE_URL}/download`, 
      { file_id, sub_format: 'vtt' },
      {
        headers: {
          'Api-Key': API_KEY,
          'User-Agent': 'WatchTogether/1.0.0',
          'Content-Type': 'application/json'
        }
      }
    );

    // The response contains a 'link' which is the direct URL
    res.json(response.data);
  } catch (error) {
    console.error(`[OpenSubtitles] Download error:`, error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get download link' });
  }
});

module.exports = router;
