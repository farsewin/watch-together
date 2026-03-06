const express = require("express");
const axios = require("axios");
const router = express.Router();

/**
 * Pixeldrain Streaming Proxy
 * Pipes the video stream from Pixeldrain to the client to avoid CORS and 403 issues.
 */
router.get("/stream/:id", async (req, res) => {
  const { id } = req.params;
  const pixeldrainUrl = `https://pixeldrain.com/api/file/${id}`;

  try {
    const range = req.headers.range;
    console.log(`[Proxy] Accessing ID ${id} - Range: ${range || 'none'}`);
    
    const axiosConfig = {
      method: 'get',
      url: pixeldrainUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://pixeldrain.com/'
      },
      validateStatus: false // Let us handle non-2xx statuses manually
    };

    if (range) {
      axiosConfig.headers['Range'] = range;
    }

    const response = await axios(axiosConfig);

    console.log(`[Proxy] Pixeldrain response for ${id}: ${response.status} ${response.statusText}`);

    // Forward the status code
    res.status(response.status);
    
    // Forward relevant headers from Pixeldrain
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'last-modified',
      'etag'
    ];

    headersToForward.forEach(header => {
      const value = response.headers[header];
      if (value) {
        res.setHeader(header, value);
      }
    });

    // Ensure common video player headers
    if (!res.getHeader('accept-ranges')) res.setHeader("Accept-Ranges", "bytes");

    // Pipe the stream to the response
    response.data.pipe(res);

    response.data.on('error', (err) => {
      console.error(`[Proxy] Stream error for ${id}:`, err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

  } catch (error) {
    console.error(`[Proxy] Critical error for ${id}:`, error.message);
    if (!res.headersSent) {
      res.status(500).send("External Network Error");
    }
  }
});

module.exports = router;
