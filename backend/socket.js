// In-memory room storage
const rooms = new Map();

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle room join
    socket.on("join-room", (roomId) => {
      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      const room = rooms.get(roomId);

      // Check max 2 users per room
      if (room.size >= 2) {
        socket.emit("room-error", { message: "Room is full (max 2 users)" });
        console.log(
          `User ${socket.id} rejected from room ${roomId} - room full`,
        );
        return;
      }

      // Join the room
      room.add(socket.id);
      socket.join(roomId);
      socket.roomId = roomId;

      console.log(
        `User ${socket.id} joined room ${roomId}. Users in room: ${room.size}`,
      );
      socket.emit("room-joined", { roomId, userCount: room.size });

      // Notify other user in room
      socket.to(roomId).emit("user-joined", { userCount: room.size });
    });

    // Handle video events (play, pause, seek)
    socket.on("video-event", (data) => {
      const { roomId, event, currentTime } = data;
      console.log(`Video event from ${socket.id}: ${event} at ${currentTime}s`);

      // Broadcast to other users in the room
      socket.to(roomId).emit("video-event", {
        event,
        currentTime,
        senderId: socket.id,
      });
    });

    // Handle URL change
    socket.on("url-change", (data) => {
      const { roomId, url } = data;
      console.log(`URL change from ${socket.id}: ${url}`);

      // Broadcast to other users in the room
      socket.to(roomId).emit("url-change", {
        url,
        senderId: socket.id,
      });
    });

    // Handle URL request (new user wants current URL)
    socket.on("request-url", (data) => {
      const { roomId } = data;
      console.log(`URL request from ${socket.id} in room ${roomId}`);

      // Ask other users in the room to share their URL
      socket.to(roomId).emit("request-url", {
        senderId: socket.id,
      });
    });

    // Handle sync event (every 3 seconds)
    socket.on("sync", (data) => {
      const { roomId, currentTime } = data;

      // Broadcast current time to other users
      socket.to(roomId).emit("sync", {
        currentTime,
        senderId: socket.id,
      });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);

      if (socket.roomId) {
        const room = rooms.get(socket.roomId);
        if (room) {
          room.delete(socket.id);
          console.log(
            `User ${socket.id} left room ${socket.roomId}. Users remaining: ${room.size}`,
          );

          // Notify remaining users
          socket.to(socket.roomId).emit("user-left", { userCount: room.size });

          // Clean up empty rooms
          if (room.size === 0) {
            rooms.delete(socket.roomId);
            console.log(`Room ${socket.roomId} deleted (empty)`);
          }
        }
      }
    });
  });
}

module.exports = setupSocket;
