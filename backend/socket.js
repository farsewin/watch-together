const {
  createRoom,
  roomExists,
  joinRoom,
  leaveRoom,
  isHost,
  getRoomData,
  getRoomUserCount,
} = require("./redis");

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle room join (async)
    socket.on("join-room", async (roomId) => {
      try {
        const exists = await roomExists(roomId);

        // Room must be created via /create-room endpoint first
        if (!exists) {
          socket.emit("room-error", { message: "Room not found" });
          console.log(
            `User ${socket.id} tried to join non-existent room ${roomId}`,
          );
          return;
        }

        const userCount = await getRoomUserCount(roomId);

        if (userCount === 0) {
          // First user or rejoining empty room (grace period) - become host
          const result = await createRoom(roomId, socket.id);
          socket.join(roomId);
          socket.roomId = roomId;

          console.log(
            `User ${socket.id} created room ${roomId} as HOST. Users: ${result.userCount}`,
          );

          socket.emit("room-joined", {
            roomId,
            userCount: result.userCount,
            isHost: true,
          });
        } else {
          // Room exists with users - try to join
          const result = await joinRoom(roomId, socket.id);

          if (result.error) {
            socket.emit("room-error", { message: result.error });
            console.log(
              `User ${socket.id} rejected from room ${roomId}: ${result.error}`,
            );
            return;
          }

          socket.join(roomId);
          socket.roomId = roomId;

          const userIsHost = result.host === socket.id;

          console.log(
            `User ${socket.id} joined room ${roomId} as ${userIsHost ? "HOST" : "GUEST"}. Users: ${result.userCount}`,
          );

          socket.emit("room-joined", {
            roomId,
            userCount: result.userCount,
            isHost: userIsHost,
          });

          // Notify other user in room
          socket
            .to(roomId)
            .emit("user-joined", { userCount: result.userCount });
        }
      } catch (err) {
        console.error("Error joining room:", err);
        socket.emit("room-error", { message: "Server error" });
      }
    });

    // Handle video events (play, pause, seek) - only host can send
    socket.on("video-event", async (data) => {
      const { roomId, event, currentTime } = data;

      try {
        const hostCheck = await isHost(roomId, socket.id);

        if (!hostCheck) {
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
      } catch (err) {
        console.error("Error handling video event:", err);
      }
    });

    // Handle URL change - only host can change
    socket.on("url-change", async (data) => {
      const { roomId, url } = data;

      try {
        const hostCheck = await isHost(roomId, socket.id);

        if (!hostCheck) {
          console.log(`Guest ${socket.id} tried to change URL - ignored`);
          return;
        }

        console.log(`URL change from HOST ${socket.id}: ${url}`);

        // Broadcast to other users in the room
        socket.to(roomId).emit("url-change", {
          url,
          senderId: socket.id,
        });
      } catch (err) {
        console.error("Error handling URL change:", err);
      }
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
    socket.on("sync", async (data) => {
      const { roomId, currentTime } = data;

      try {
        const hostCheck = await isHost(roomId, socket.id);

        if (!hostCheck) {
          return;
        }

        // Broadcast current time to guest
        socket.to(roomId).emit("sync", {
          currentTime,
          senderId: socket.id,
        });
      } catch (err) {
        console.error("Error handling sync:", err);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.id}`);

      if (socket.roomId) {
        try {
          const result = await leaveRoom(socket.roomId, socket.id);

          console.log(
            `User ${socket.id} left room ${socket.roomId}. Users remaining: ${result.userCount}`,
          );

          if (result.deleted) {
            console.log(`Room ${socket.roomId} deleted (empty)`);
          } else {
            // Notify remaining users
            socket
              .to(socket.roomId)
              .emit("user-left", { userCount: result.userCount });
          }
        } catch (err) {
          console.error("Error handling disconnect:", err);
        }
      }
    });
  });
}

module.exports = setupSocket;
