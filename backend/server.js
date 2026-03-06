require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const cors = require("cors");
const roomRoutes = require("./routes/room");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const proxyRouter = require("./routes/proxy"); // Changed from proxyRoutes to proxyRouter
const subtitleRouter = require("./routes/subtitle"); // New
const opensubtitlesRouter = require('./routes/opensubtitles'); // New
const setupSocket = require("./socket");
const { connectRedis, redisPub, redisSub, reserveRoom } = require("./redis");

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
  "https://watch-too.up.railway.app";
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "https://watch-too.up.railway.app",
  "https://watch-together-production-7fd9.up.railway.app",
];

// CORS configuration with logging
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        console.warn(`CORS: Origin ${origin} is not allowed`);
        return callback(new Error("CORS: Not allowed"), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
  }),
);

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// REST routes
app.use(roomRoutes);
app.use(adminRoutes);
app.use(authRoutes);
app.use(proxyRoutes);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
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

    // Initialize persistent "Public Room"
    await reserveRoom("public", "Public Room", true);
    console.log("Persistent Public Room initialized");

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
