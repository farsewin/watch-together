/**
 * Utility to convert Pixeldrain user links into direct API file streams.
 * Example: https://pixeldrain.com/u/ID -> https://pixeldrain.com/api/file/ID
 */
export const convertVideoUrl = (url) => {
  if (!url) return "";

  // Pixeldrain conversion
  const pixeldrainRegex = /pixeldrain\.com\/u\/([a-zA-Z0-9]+)/;
  const pixeldrainMatch = url.match(pixeldrainRegex);
  if (pixeldrainMatch) {
    return `https://pixeldrain.com/api/file/${pixeldrainMatch[1]}`;
  }

  return url;
};

/**
 * Checks if local time has drifted too far from the target (host) time.
 * @param {number} localTime - Current playback time of the local player.
 * @param {number} targetTime - Current playback time received from the host.
 * @param {number} threshold - Maximum allowed drift in seconds (default 2s).
 * @returns {boolean} - True if drift exceeds threshold.
 */
export const hasDrifted = (localTime, targetTime, threshold = 1.5) => {
  return Math.abs(localTime - targetTime) > threshold;
};
/**
 * Detects the video type based on the URL.
 * Supports YouTube, HLS, and standard video files.
 */
/**
 * Detects the video type based on the URL.
 * Supports YouTube, HLS, and standard video files.
 */
export const getVideoType = (url) => {
  if (!url) return undefined;

  const urlLower = url.toLowerCase();

  if (urlLower.includes("youtube.com/") || urlLower.includes("youtu.be/")) {
    return "video/youtube";
  }

  if (urlLower.includes(".m3u8") || urlLower.includes("m3u8")) {
    return "application/x-mpegURL";
  }

  // Common extensions
  if (urlLower.endsWith(".mp4")) return "video/mp4";
  if (urlLower.endsWith(".webm")) return "video/webm";
  if (urlLower.endsWith(".ogg")) return "video/ogg";
  if (urlLower.endsWith(".mov")) return "video/mp4"; // MOV usually plays as mp4

  // If it's a known API like Pixeldrain or has no extension, 
  // let Video.js guess by returning undefined
  return undefined;
};
