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

/**
 * Universal Proxy & Extractor
 * Handles any URL, and attempts to extract video sources from HTML pages.
 * Also handles recursive M3U8 rewriting for HLS streams.
 */
router.get("/proxy", async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).send("Missing URL parameter");

  try {
    const range = req.headers.range;
    console.log(`[Universal Proxy] --> Processing: ${targetUrl}`);

    const baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': new URL(targetUrl).origin + '/',
      'Accept': '*/*',
    };

    // Initial fetch to check content type or extract source
    let initialResponse = await axios({
      method: 'get',
      url: targetUrl,
      headers: baseHeaders,
      timeout: 10000
    });

    let contentType = initialResponse.headers['content-type'] || '';
    let finalUrl = targetUrl;
    let isHtml = contentType.includes('text/html');

    // 1. Extraction Logic: If it's HTML, try to find a video source
    if (isHtml) {
      const html = initialResponse.data;
      const sourceRegex = /(?:file|sources|src)\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4|webm)[^"']*)["']/i;
      const match = html.match(sourceRegex);
      
      if (match) {
        finalUrl = match[1];
        console.log(`[Universal Proxy] [Extracted] Found source: ${finalUrl}`);
        // Continue to step 2 with the extracted URL
      } else {
        console.warn(`[Universal Proxy] [Extraction Failed] No source found in HTML from ${targetUrl}`);
        return res.status(initialResponse.status).send(html);
      }
    }

    // 2. Stream/Playlist Fetching
    const streamResponse = await axios({
      method: 'get',
      url: finalUrl,
      responseType: 'arraybuffer', // Get as buffer so we can handle both text (m3u8) and binary (ts)
      headers: {
        ...baseHeaders,
        'Referer': new URL(finalUrl).origin + '/',
        'Range': range || ''
      },
      validateStatus: () => true
    });

    const streamContentType = streamResponse.headers['content-type'] || '';
    const isM3U8 = streamContentType.includes('mpegurl') || finalUrl.includes('.m3u8');

    // 3. M3U8 Recursive Rewriting
    if (isM3U8) {
      console.log(`[Universal Proxy] [HLS] Rewriting playlist: ${finalUrl}`);
      let m3u8Content = Buffer.from(streamResponse.data).toString('utf8');
      
      // Resolve base URL for relative links
      const baseUrl = finalUrl.split('?')[0].substring(0, finalUrl.lastIndexOf('/') + 1);
      const urlOrigin = new URL(finalUrl).origin;
      const selfBase = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;

      // Rewrite every line that looks like a URL or a relative path
      const lines = m3u8Content.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absoluteUrl = trimmed;
        if (!trimmed.startsWith('http')) {
          if (trimmed.startsWith('/')) {
            absoluteUrl = urlOrigin + trimmed;
          } else {
            absoluteUrl = baseUrl + trimmed;
          }
        }
        
        return `${selfBase}?url=${encodeURIComponent(absoluteUrl)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(streamResponse.status).send(rewrittenLines.join('\n'));
    }

    // 4. Standard Binary Proxy (Segments / MP4)
    res.status(streamResponse.status);
    const hopByHopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'];
    Object.keys(streamResponse.headers).forEach(header => {
      const lowerHeader = header.toLowerCase();
      if (!hopByHopHeaders.includes(lowerHeader) && !lowerHeader.startsWith('access-control-')) {
        res.setHeader(header, streamResponse.headers[header]);
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    if (!res.getHeader('accept-ranges')) res.setHeader("Accept-Ranges", "bytes");

    return res.send(Buffer.from(streamResponse.data));

  } catch (error) {
    console.error(`[Universal Proxy] [CRITICAL] Error:`, error.message);
    if (!res.headersSent) res.status(500).send("Proxy Error: " + error.message);
  }
});

module.exports = router;
