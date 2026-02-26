import { io } from "socket.io-client";

// Use environment variable or fallback to production URL
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://watch-together-production-7fd9.up.railway.app";

const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

// Session persistence helpers
export const saveSession = (roomId, username, isHost) => {
  localStorage.setItem(
    "watchTogether_session",
    JSON.stringify({
      roomId,
      username,
      isHost,
      timestamp: Date.now(),
    }),
  );
};

export const getSession = () => {
  const session = localStorage.getItem("watchTogether_session");
  if (!session) return null;

  const data = JSON.parse(session);
  // Session expires after 1 hour
  if (Date.now() - data.timestamp > 3600000) {
    clearSession();
    return null;
  }
  return data;
};

export const clearSession = () => {
  localStorage.removeItem("watchTogether_session");
};

export default socket;
