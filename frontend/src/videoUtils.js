/**
 * Helper to get backend URL reliably across environments
 */
const getBackendUrl = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http" + (window.location.hostname === "localhost" ? "://localhost:3001" : "s://" + window.location.host.replace("3000", "3001"));
  // Ensure we point to 3001 in dev
  return backendUrl.includes("localhost:5173") ? "http://localhost:3001" : backendUrl;
};

/**
 * Utility to convert Pixeldrain user links into direct API file streams,
 * and Streamwish/Filemoon links into proxied streams.
 */
export const convertVideoUrl = (url) => {
  if (!url) return "";

  // Pixeldrain conversion
  const pixeldrainIdRegex = /pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9]+)/;
  const match = url.match(pixeldrainIdRegex);
  
  if (match) {
    const fileId = match[1];
    return `${getBackendUrl()}/stream/${fileId}`;
  }

  // Universal Proxy for other streaming sites (Streamwish, Filemoon, etc.)
  const streamingDomains = ["streamwish.fun", "streamwish.to", "filemoon.sx", "filemoon.to", "voe.sx"];
  if (streamingDomains.some(domain => url.includes(domain))) {
    return `${getBackendUrl()}/proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
};

/**
 * Checks if local time has drifted too far from the target (host) time.
 */
export const hasDrifted = (localTime, targetTime, threshold = 1.5) => {
  return Math.abs(localTime - targetTime) > threshold;
};

/**
 * Detects the video type based on the URL.
 * Supports YouTube, HLS, and standard video files.
 */
export const getVideoType = (url) => {
  if (!url) return "video/mp4";

  const urlLower = url.toLowerCase();

  // YouTube
  if (urlLower.includes("youtube.com/") || urlLower.includes("youtu.be/")) {
    return "video/youtube";
  }

  // Pixeldrain API or generic API streams
  if (urlLower.includes("pixeldrain.com/api/file/")) {
    return "video/mp4";
  }

  // HLS Detection (M3U8)
  // Check if it's a known streaming site or has .m3u8 in the URL
  if (urlLower.includes(".m3u8") || urlLower.includes("m3u8") || 
      urlLower.includes("streamwish") || urlLower.includes("filemoon")) {
    return "application/x-mpegURL";
  }

  // Common extensions (WebM, Ogg)
  if (urlLower.endsWith(".webm")) return "video/webm";
  if (urlLower.endsWith(".ogg")) return "video/ogg";
  
  // Default fallback for everything else
  return "video/mp4";
};
