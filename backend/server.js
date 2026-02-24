require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const roomRoutes = require("./routes/room");
const setupSocket = require("./socket");

const app = express();
const server = http.createServer(app);

// Allow frontend URLs
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://supportive-wisdom-production-eeec.up.railway.app";
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "https://supportive-wisdom-production-eeec.up.railway.app",
];

// CORS configuration
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// REST routes
app.use(roomRoutes);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

setupSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
