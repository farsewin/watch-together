import { io } from "socket.io-client";

// Use environment variable or fallback to production URL
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:3001";

const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ["websocket"], // Force websocket to avoid sticky session issues
  upgrade: false,
  auth: (cb) => {
    // Prioritize admin token if it exists
    const adminToken = localStorage.getItem("watchTogether_adminToken");
    const guestToken = localStorage.getItem("watchTogether_token");
    cb({ token: adminToken || guestToken });
  },
});

socket.on("connect_error", (err) => {
  console.error("Socket connection error:", err.message);
  if (err.message.includes("Authentication error")) {
    console.warn("Auth failed. Clearing session...");
    clearSession();
    // Optional: window.location.reload(); or trigger a UI state change
  }
});

// Session persistence helpers
export const saveToken = (token) => {
  localStorage.setItem("watchTogether_token", token);
};

export const getToken = () => {
  return localStorage.getItem("watchTogether_token");
};

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
  localStorage.removeItem("watchTogether_token");
};

export default socket;
