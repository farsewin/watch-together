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
