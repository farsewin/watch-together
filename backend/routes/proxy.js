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
    console.log(`Proxying Pixeldrain stream for ID: ${id} (Range: ${req.headers.range || 'none'})`);
    
    const axiosConfig = {
      method: 'get',
      url: pixeldrainUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    // Forward the Range header if present
    if (req.headers.range) {
      axiosConfig.headers['Range'] = req.headers.range;
    }

    const response = await axios(axiosConfig);

    // Forward status and headers from Pixeldrain
    res.status(response.status);
    
    // Forward relevant headers
    const headersToForward = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control'
    ];

    headersToForward.forEach(header => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });

    // Ensure accept-ranges is set
    res.setHeader("Accept-Ranges", "bytes");

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
    if (error.response) {
      console.error(`Proxy error for ID ${id}: ${error.response.status} ${error.response.statusText}`);
      res.status(error.response.status).send(error.response.statusText);
    } else {
      console.error(`Proxy error for ID ${id}:`, error.message);
      res.status(500).send("Internal Server Error");
    }
  }
});

module.exports = router;
