// In-memory room storage - stores { users: Set, host: socketId }
const rooms = new Map();

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle room join
    socket.on("join-room", (roomId) => {
      // Initialize room if it doesn't exist (first user is host)
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Set(), host: socket.id });
      }

      const room = rooms.get(roomId);

      // Check max 2 users per room
      if (room.users.size >= 2) {
        socket.emit("room-error", { message: "Room is full (max 2 users)" });
        console.log(
          `User ${socket.id} rejected from room ${roomId} - room full`,
        );
        return;
      }

      // Determine if this user is the host (first to join)
      const isHost = room.users.size === 0;
      if (isHost) {
        room.host = socket.id;
      }

      // Join the room
      room.users.add(socket.id);
      socket.join(roomId);
      socket.roomId = roomId;

      console.log(
        `User ${socket.id} joined room ${roomId} as ${isHost ? "HOST" : "GUEST"}. Users in room: ${room.users.size}`,
      );
      socket.emit("room-joined", {
        roomId,
        userCount: room.users.size,
        isHost,
      });

      // Notify other user in room
      socket.to(roomId).emit("user-joined", { userCount: room.users.size });
    });

    // Handle video events (play, pause, seek) - only host can send
    socket.on("video-event", (data) => {
      const { roomId, event, currentTime } = data;
      const room = rooms.get(roomId);

      // Only allow host to control video
      if (!room || room.host !== socket.id) {
        console.log(`Guest ${socket.id} tried to send video event - ignored`);
        return;
      }

      console.log(
        `Video event from HOST ${socket.id}: ${event} at ${currentTime}s`,
      );

      // Broadcast to other users in the room
      socket.to(roomId).emit("video-event", {
        event,
        currentTime,
        senderId: socket.id,
      });
    });

    // Handle URL change - only host can change
    socket.on("url-change", (data) => {
      const { roomId, url } = data;
      const room = rooms.get(roomId);

      // Only allow host to change URL
      if (!room || room.host !== socket.id) {
        console.log(`Guest ${socket.id} tried to change URL - ignored`);
        return;
      }

      console.log(`URL change from HOST ${socket.id}: ${url}`);

      // Broadcast to other users in the room
      socket.to(roomId).emit("url-change", {
        url,
        senderId: socket.id,
      });
    });

    // Handle URL request (guest requests URL from host)
    socket.on("request-url", (data) => {
      const { roomId } = data;
      console.log(`URL request from ${socket.id} in room ${roomId}`);

      // Ask host to share URL
      socket.to(roomId).emit("request-url", {
        senderId: socket.id,
      });
    });

    // Handle sync event - only host can sync
    socket.on("sync", (data) => {
      const { roomId, currentTime } = data;
      const room = rooms.get(roomId);

      if (!room || room.host !== socket.id) {
        return;
      }

      // Broadcast current time to guest
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
          room.users.delete(socket.id);
          console.log(
            `User ${socket.id} left room ${socket.roomId}. Users remaining: ${room.users.size}`,
          );

          // Notify remaining users
          socket
            .to(socket.roomId)
            .emit("user-left", { userCount: room.users.size });

          // Clean up empty rooms
          if (room.users.size === 0) {
            rooms.delete(socket.roomId);
            console.log(`Room ${socket.roomId} deleted (empty)`);
          }
        }
      }
    });
  });
}

module.exports = setupSocket;
