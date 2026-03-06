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
    console.log(`[Proxy] --> GET ${pixeldrainUrl} | Range: ${range || 'none'}`);
    
    const axiosConfig = {
      method: 'get',
      url: pixeldrainUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://pixeldrain.com/',
        'Accept': '*/*'
      },
      validateStatus: () => true // Forward all statuses (200, 206, 403, etc.)
    };

    // Add API Key for higher limits if available
    const apiKey = process.env.PIXELDRAIN_API_KEY;
    if (apiKey) {
      // Pixeldrain uses Basic Auth with empty username: "Authorization: Basic [base64(:apiKey)]"
      const auth = Buffer.from(`:${apiKey}`).toString('base64');
      axiosConfig.headers['Authorization'] = `Basic ${auth}`;
    }

    if (range) {
      axiosConfig.headers['Range'] = range;
    }

    const response = await axios(axiosConfig);
    const contentType = response.headers['content-type'] || '';

    console.log(`[Proxy] <-- Pixeldrain Result: ${response.status} | Content-Type: ${contentType} | Auth: ${apiKey ? 'Yes' : 'No'}`);

    // Check for specific Pixeldrain error messages
    if (response.status !== 200 && response.status !== 206) {
      let errorData = '';
      // We can't easily read the stream here without breaking piping, 
      // but if it's a small JSON error we can check it.
    }

    // CORB Protection: If Pixeldrain returns HTML (likely an error page), 
    // we should log it clearly. HTML in a video source triggers CORB.
    if (contentType.includes('text/html')) {
      console.error(`[Proxy] [WARNING] Pixeldrain returned HTML/Error instead of video. This will cause CORB. Check server logs for response status: ${response.status}`);
    }

    // Forward the status code
    res.status(response.status);
    
    // Transparently forward all headers except those known to cause issues with piping
    const hopByHopHeaders = [
      'connection',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'te',
      'trailers',
      'transfer-encoding',
      'upgrade'
    ];

    Object.keys(response.headers).forEach(header => {
      const lowerHeader = header.toLowerCase();
      // Skip hop-by-hop headers and ANY existing CORS headers from Pixeldrain
      if (!hopByHopHeaders.includes(lowerHeader) && !lowerHeader.startsWith('access-control-')) {
        res.setHeader(header, response.headers[header]);
      }
    });

    // Ensure our own CORS and fundamental streaming headers are set
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (!res.getHeader('accept-ranges')) res.setHeader("Accept-Ranges", "bytes");

    // Pipe the stream to the response
    response.data.pipe(res);

    response.data.on('error', (err) => {
      console.error(`[Proxy] Stream pipe error for ${id}:`, err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

  } catch (error) {
    console.error(`[Proxy] [CRITICAL] Network error for ${id}:`, error.message);
    if (!res.headersSent) {
      res.status(500).send("Proxy Network Error");
    }
  }
});

module.exports = router;
