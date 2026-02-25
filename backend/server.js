require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const cors = require("cors");
const roomRoutes = require("./routes/room");
const setupSocket = require("./socket");
const { connectRedis, redisPub, redisSub } = require("./redis");

// Global error handlers
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

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

const PORT = process.env.PORT || 3001;

// Initialize Redis and start server
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    console.log("Redis connected successfully");

    // Attach Redis adapter for horizontal scaling
    io.adapter(createAdapter(redisPub, redisSub));
    console.log("Socket.IO Redis adapter attached");

    // Setup socket handlers
    setupSocket(io);

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
