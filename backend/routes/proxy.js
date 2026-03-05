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
    console.log(`Proxying Pixeldrain stream for ID: ${id}`);
    
    const response = await axios({
      method: 'get',
      url: pixeldrainUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Forward relevant headers
    res.setHeader("Content-Type", response.headers['content-type'] || "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    if (response.headers['content-length']) {
      res.setHeader("Content-Length", response.headers['content-length']);
    }

    // Pipe the stream to the response
    response.data.pipe(res);

    // Handle stream errors
    response.data.on('error', (err) => {
      console.error(`Stream error for ID ${id}:`, err.message);
      if (!res.headersSent) {
        res.status(500).send("Stream error");
      }
    });

  } catch (error) {
    console.error(`Proxy error for ID ${id}:`, error.message);
    if (error.response) {
      res.status(error.response.status).send(error.response.statusText);
    } else {
      res.status(500).send("Internal Server Error");
    }
  }
});

module.exports = router;
