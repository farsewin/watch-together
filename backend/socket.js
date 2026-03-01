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
  redisClient,
} = require("./redis");
const { verifySocketToken } = require("./middleware/auth");

// Track disconnection timers: userId -> timer
const disconnectTimers = new Map();
const DISCONNECT_GRACE = 30000; // 30 seconds

function setupSocket(io) {
  // Use JWT handshake middleware
  io.use(verifySocketToken);

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id} (user: ${socket.user.username})`);

    // Handle room join (async)
    socket.on("join-room", async (data) => {
      try {
        const { roomId } = data;
        const { userId, username } = socket.user;
        
        if (userId && disconnectTimers.has(userId)) {
          console.log(`User ${userId} reconnected within grace period. Canceling kick timer.`);
          clearTimeout(disconnectTimers.get(userId));
          disconnectTimers.delete(userId);
        }

        socket.userId = userId; // Still store on socket for easy access in disconnect
        socket.username = username;
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
          const result = await createRoom(roomId, userId);
          socket.join(roomId);
          socket.roomId = roomId;

          // Save username to Redis
          await saveUsername(roomId, userId, username);
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
          const result = await joinRoom(roomId, userId);

          if (result.error) {
            socket.emit("room-error", { message: result.error });
            console.log(
              `User ${socket.id} rejected from room ${roomId}: ${result.error}`,
            );
            return;
          }

          socket.join(roomId);
          socket.roomId = roomId;

          // Save username to Redis
          await saveUsername(roomId, userId, username);
          const users = await getRoomUsernames(roomId);

          const userIsHost = result.host === userId;

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
        const hostCheck = await isHost(roomId, socket.user.userId);

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
        const hostCheck = await isHost(roomId, socket.user.userId);

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
        const hostCheck = await isHost(roomId, socket.user.userId);

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
        userId: socket.user.userId,
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

    // Handle typing events
    socket.on("typing", (data) => {
      const { roomId } = data;
      socket.to(roomId).emit("typing", { username: socket.username });
    });

    socket.on("stop-typing", (data) => {
      const { roomId } = data;
      socket.to(roomId).emit("stop-typing", { username: socket.username });
    });

    // Handle host-initiated mute
    socket.on("mute-user", async (data) => {
      const { roomId, targetUserId } = data;

      try {
        const hostCheck = await isHost(roomId, socket.user.userId);
        if (!hostCheck) {
          console.log(`Unauthorized mute-user request from ${socket.username}`);
          return;
        }

        console.log(`Host ${socket.username} is muting user ${targetUserId}`);

        // Find the target user's socket
        let targetSocket = null;
        for (const [id, s] of io.of("/").sockets) {
          if (s.user?.userId === targetUserId) {
            targetSocket = s;
            break;
          }
        }

        if (targetSocket) {
          targetSocket.emit("force-mute", { mutedBy: socket.username });
        }
      } catch (err) {
        console.error("Error handling mute-user:", err);
      }
    });

    // Handle explicit leave room (user clicks Leave button)
    socket.on("leave-room", async (data) => {
      const { roomId } = data;

      if (!roomId) return;

      try {
        const hostCheck = await isHost(roomId, socket.user.userId);

        console.log(
          `User ${socket.username || socket.id} explicitly leaving room ${roomId}. Is host: ${hostCheck}`,
        );

        // Cancel any pending disconnect timer if they leave manually
        if (socket.userId && disconnectTimers.has(socket.userId)) {
          clearTimeout(disconnectTimers.get(socket.userId));
          disconnectTimers.delete(socket.userId);
        }

        if (hostCheck) {
          // Check if room is persistent before destroying
          const roomData = await getRoomData(roomId);
          const isPersistent = (await redisClient.hGet(`room:${roomId}`, "persistent")) === "true";

          if (isPersistent) {
            console.log(`Host leaving persistent room ${roomId} - skipping destruction`);
            await removeUsername(roomId, socket.user.userId);
            await leaveRoom(roomId, socket.user.userId);
            
            const users = await getRoomUsernames(roomId);
            const userCount = Object.keys(users).length;

            socket.to(roomId).emit("user-left", {
              userCount,
              users,
              username: socket.username,
            });
          } else {
            // Host is leaving non-persistent room - destroy it
            console.log(`Host leaving - destroying room ${roomId}`);

            // Notify all users in the room that it's closing
            io.to(roomId).emit("room-closed", {
              message: "Host closed the room",
            });

            // Remove username before deleting room
            await removeUsername(roomId, socket.user.userId);

            // Delete room completely from Redis
            await deleteRoom(roomId);
          }

          // Leave the socket room
          socket.leave(roomId);
          socket.roomId = null;
        } else {
          // Guest is leaving - just remove them normally
          await removeUsername(roomId, socket.user.userId);
          await leaveRoom(roomId, socket.user.userId);

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
      const { roomId, username, id, userId } = socket;
      console.log(`User ${username || id} (userId: ${userId}) disconnected. Starting 30s grace period.`);

      if (roomId && userId) {
        // Start a 30s timer before kicking the user
        const timer = setTimeout(async () => {
          try {
            console.log(`Grace period expired for user ${userId}. Kicking from room ${roomId}.`);
            disconnectTimers.delete(userId);

            // Remove username and leave room in Redis
            await removeUsername(roomId, userId);
            const result = await leaveRoom(roomId, userId);

            // Notify remaining users
            const users = await getRoomUsernames(roomId);
            io.to(roomId).emit("user-left", {
              userCount: result.userCount,
              users,
              username: username,
            });

            if (result.deleted) {
              console.log(`Room ${roomId} deleted (empty)`);
            }
          } catch (err) {
            console.error("Error handling grace period expiry:", err);
          }
        }, DISCONNECT_GRACE);

        disconnectTimers.set(userId, timer);
      }
    });

    // ============== Admin Events ==============
    socket.on("admin-broadcast", (data) => {
      const { message } = data;
      if (socket.user.role !== "admin") return;

      console.log(`[ADMIN BROADCAST] by ${socket.user.username}: ${message}`);
      io.emit("chat-message", {
        id: Date.now(),
        username: "📢 SYSTEM",
        message: message,
        timestamp: new Date().toISOString(),
        isAdmin: true,
      });
    });

    socket.on("admin-kick", async (data) => {
      const { targetSocketId, roomId } = data;
      if (socket.user.role !== "admin") return;

      console.log(`[ADMIN KICK] by ${socket.user.username}: ${targetSocketId} from ${roomId}`);
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      
      if (targetSocket) {
        targetSocket.emit("room-closed", { message: "You were removed by an administrator" });
        targetSocket.disconnect(true);
      }
    });
  });
}

module.exports = setupSocket;
