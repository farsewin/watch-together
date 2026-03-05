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
  if (!url) return "video/mp4";

  const urlLower = url.toLowerCase();

  // YouTube
  if (urlLower.includes("youtube.com/") || urlLower.includes("youtu.be/")) {
    return "video/youtube";
  }

  // HLS
  if (urlLower.includes(".m3u8") || urlLower.includes("m3u8")) {
    return "application/x-mpegURL";
  }

  // Common extensions (WebM, Ogg)
  if (urlLower.endsWith(".webm")) return "video/webm";
  if (urlLower.endsWith(".ogg")) return "video/ogg";
  
  // Default fallback for everything else (Pixeldrain, MP4, etc.)
  // Providing an explicit type helps Video.js choose the right tech 
  // when the URL has no extension.
  return "video/mp4";
};

