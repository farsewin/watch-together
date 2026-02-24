import { io } from "socket.io-client";

// Use environment variable or fallback to production URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://watch-together-production-7fd9.up.railway.app";

const socket = io(BACKEND_URL, {
  autoConnect: false,
});

export default socket;
