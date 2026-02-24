const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const roomRoutes = require("./routes/room");
const setupSocket = require("./socket");

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());

// REST routes
app.use(roomRoutes);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

setupSocket(io);

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
