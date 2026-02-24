require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const roomRoutes = require("./routes/room");
const setupSocket = require("./socket");

const app = express();
const server = http.createServer(app);

// Allow frontend URL from environment variable
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// CORS configuration
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());

// REST routes
app.use(roomRoutes);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

setupSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
