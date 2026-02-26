const {
  createRoom,
  roomExists,
  joinRoom,
  leaveRoom,
  deleteRoom,
  isHost,
  getRoomData,
  getRoomUserCount,
  saveVideoState,
  getVideoState,
  saveUsername,
  removeUsername,
  getRoomUsernames,
} = require("./redis");

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle room join (async)
    socket.on("join-room", async (data) => {
      try {
        // Support both old format (string) and new format (object)
        const roomId = typeof data === "string" ? data : data.roomId;
        const username = typeof data === "object" ? data.username : "Anonymous";

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
          socket.username = username;

          // Save username to Redis
          await saveUsername(roomId, socket.id, username);
          const users = await getRoomUsernames(roomId);

          // Get saved video state for reconnection
          const videoState = await getVideoState(roomId);

          console.log(
            `User ${username} (${socket.id}) created room ${roomId} as HOST. Users: ${result.userCount}`,
          );

          socket.emit("room-joined", {
            roomId,
            userCount: result.userCount,
            isHost: true,
            videoState,
            users,
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
          socket.username = username;

          // Save username to Redis
          await saveUsername(roomId, socket.id, username);
          const users = await getRoomUsernames(roomId);

          const userIsHost = result.host === socket.id;

          console.log(
            `User ${username} (${socket.id}) joined room ${roomId} as ${userIsHost ? "HOST" : "GUEST"}. Users: ${result.userCount}`,
          );

          // Get saved video state for guest
          const videoState = await getVideoState(roomId);

          socket.emit("room-joined", {
            roomId,
            userCount: result.userCount,
            isHost: userIsHost,
            videoState,
            users,
          });

          // Notify other users in room with updated user list
          socket.to(roomId).emit("user-joined", {
            userCount: result.userCount,
            users,
            username,
          });
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

        // Save video state to Redis
        await saveVideoState(roomId, {
          currentTime,
          playing: event === "play",
        });

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

        // Save URL to Redis
        await saveVideoState(roomId, { url, currentTime: 0, playing: false });

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

    // Handle chat messages
    socket.on("chat-message", (data) => {
      const { roomId, message } = data;

      if (!socket.roomId || !message || !message.trim()) {
        return;
      }

      const chatMessage = {
        id: Date.now(),
        username: socket.username || "Anonymous",
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };

      console.log(
        `Chat in room ${roomId}: ${chatMessage.username}: ${chatMessage.message}`,
      );

      // Send to all users in the room including sender
      io.to(roomId).emit("chat-message", chatMessage);
    });

    // Handle explicit leave room (user clicks Leave button)
    socket.on("leave-room", async (data) => {
      const { roomId } = data;

      if (!roomId) return;

      try {
        const hostCheck = await isHost(roomId, socket.id);

        console.log(
          `User ${socket.username || socket.id} leaving room ${roomId}. Is host: ${hostCheck}`,
        );

        if (hostCheck) {
          // Host is leaving - destroy the room completely
          console.log(`Host leaving - destroying room ${roomId}`);

          // Notify all users in the room that it's closing
          io.to(roomId).emit("room-closed", {
            message: "Host closed the room",
          });

          // Remove username before deleting room
          await removeUsername(roomId, socket.id);

          // Delete room completely from Redis
          await deleteRoom(roomId);

          // Leave the socket room
          socket.leave(roomId);
          socket.roomId = null;
        } else {
          // Guest is leaving - just remove them normally
          await removeUsername(roomId, socket.id);
          await leaveRoom(roomId, socket.id);

          const users = await getRoomUsernames(roomId);
          const userCount = Object.keys(users).length;

          socket.to(roomId).emit("user-left", {
            userCount,
            users,
            username: socket.username,
          });

          socket.leave(roomId);
          socket.roomId = null;
        }
      } catch (err) {
        console.error("Error handling leave-room:", err);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User ${socket.username || socket.id} disconnected`);

      if (socket.roomId) {
        try {
          // Remove username from Redis
          await removeUsername(socket.roomId, socket.id);

          const result = await leaveRoom(socket.roomId, socket.id);

          console.log(
            `User ${socket.username || socket.id} left room ${socket.roomId}. Users remaining: ${result.userCount}`,
          );

          if (result.deleted) {
            console.log(`Room ${socket.roomId} deleted (empty)`);
          } else {
            // Get updated user list and notify remaining users
            const users = await getRoomUsernames(socket.roomId);
            socket.to(socket.roomId).emit("user-left", {
              userCount: result.userCount,
              users,
              username: socket.username,
            });
          }
        } catch (err) {
          console.error("Error handling disconnect:", err);
        }
      }
    });
  });
}

module.exports = setupSocket;
