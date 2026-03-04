const { createClient } = require("redis");

// Redis URL from environment (Railway provides this automatically)
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Main Redis client for room storage
const redisClient = createClient({ url: REDIS_URL });

// Separate pub/sub clients for Socket.IO adapter
const redisPub = createClient({ url: REDIS_URL });
const redisSub = createClient({ url: REDIS_URL });

// Error handling
redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisPub.on("error", (err) => console.error("Redis Pub Error:", err));
redisSub.on("error", (err) => console.error("Redis Sub Error:", err));

// Connection events
redisClient.on("connect", () => console.log("Redis client connected"));
redisClient.on("reconnecting", () =>
  console.log("Redis client reconnecting..."),
);

// Connect all clients
async function connectRedis() {
  await Promise.all([
    redisClient.connect(),
    redisPub.connect(),
    redisSub.connect(),
  ]);
  console.log("All Redis connections established");
}

// Room TTL in seconds (24 hours)
const ROOM_TTL = 86400;

// Grace period for reconnection (30 seconds)
const RECONNECT_GRACE = 30;

// ============== Room Operations ==============

// Reserve a room (from REST endpoint) - no host yet
async function reserveRoom(roomId, roomName = "New Room", isPersistent = false, password = null) {
  const roomKey = `room:${roomId}`;
  const data = {
    reserved: "true",
    name: roomName,
    persistent: isPersistent ? "true" : "false",
    createdAt: Date.now().toString(), // Add timestamp
  };

  if (password) {
    data.password = password;
  }

  await redisClient.hSet(roomKey, data);
  if (!isPersistent) {
    await redisClient.expire(roomKey, ROOM_TTL);
  }
  return { reserved: true };
}

// Create a new room with host
async function createRoom(roomId, userId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  await redisClient.hSet(roomKey, "host", userId);
  await redisClient.sAdd(usersKey, userId);
  await redisClient.expire(roomKey, ROOM_TTL);
  await redisClient.expire(usersKey, ROOM_TTL);

  return { host: userId, userCount: 1 };
}

// Check if room exists
async function roomExists(roomId) {
  const roomKey = `room:${roomId}`;
  return (await redisClient.exists(roomKey)) === 1;
}

// Get room user count
async function getRoomUserCount(roomId) {
  const usersKey = `room:${roomId}:users`;
  return await redisClient.sCard(usersKey);
}

// Join an existing room
async function joinRoom(roomId, userId, password = null) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  // Check room exists
  const roomData = await redisClient.hGetAll(roomKey);
  if (!roomData || Object.keys(roomData).length === 0) {
    return { error: "Room not found" };
  }

  // Check password if protected
  if (roomData.password && roomData.password !== password) {
    return { error: "Incorrect password" };
  }

  // Check room is not full (max 5 users)
  const users = await redisClient.sMembers(usersKey);
  if (users.length >= 5 && !users.includes(userId)) {
    return { error: "Room is full" };
  }

  // Add user to room
  await redisClient.sAdd(usersKey, userId);

  // Refresh TTL
  if (roomData.persistent !== "true") {
    await redisClient.expire(roomKey, ROOM_TTL);
    await redisClient.expire(usersKey, ROOM_TTL);
  }

  const newCount = await getRoomUserCount(roomId);
  const host = await redisClient.hGet(roomKey, "host");

  return { host, userCount: newCount };
}

// Leave a room
async function leaveRoom(roomId, userId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  // Remove user from room
  await redisClient.sRem(usersKey, userId);

  const userCount = await getRoomUserCount(roomId);

  // Check if room is persistent
  const isPersistent = (await redisClient.hGet(roomKey, "persistent")) === "true";

  // If room is empty, set short TTL instead of deleting immediately (unless persistent)
  // This allows users to rejoin after refresh
  if (userCount === 0) {
    if (!isPersistent) {
      await redisClient.expire(roomKey, RECONNECT_GRACE);
      await redisClient.expire(usersKey, RECONNECT_GRACE);
    }
    return { deleted: false, userCount: 0, pendingDelete: !isPersistent };
  }

  // If host left, assign new host
  const host = await redisClient.hGet(roomKey, "host");
  if (host === userId) {
    const remainingUsers = await redisClient.sMembers(usersKey);
    if (remainingUsers.length > 0) {
      await redisClient.hSet(roomKey, "host", remainingUsers[0]);
    }
  }

  return { deleted: false, userCount };
}

// Completely delete a room and all related data
async function deleteRoom(roomId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;
  const videoKey = `room:${roomId}:video`;
  const namesKey = `room:${roomId}:names`;

  await redisClient.del(roomKey, usersKey, videoKey, namesKey);
  console.log(`Room ${roomId} completely deleted from Redis`);
  return { deleted: true };
}

// Check if user is the host
async function isHost(roomId, userId) {
  const roomKey = `room:${roomId}`;
  const host = await redisClient.hGet(roomKey, "host");
  return host === userId;
}

// Get all room data
async function getRoomData(roomId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  const host = await redisClient.hGet(roomKey, "host");
  const users = await redisClient.sMembers(usersKey);

  return { host, users, userCount: users.length };
}

// ============== Video State Operations ==============

// Save video state (URL, currentTime, playing)
async function saveVideoState(roomId, state) {
  const stateKey = `room:${roomId}:video`;

  // Get existing state to merge
  const existing = await redisClient.hGetAll(stateKey);

  const newState = {
    url: state.url !== undefined ? state.url : existing.url || "",
    currentTime: String(
      state.currentTime !== undefined
        ? state.currentTime
        : existing.currentTime || 0,
    ),
    playing:
      state.playing !== undefined
        ? state.playing
          ? "1"
          : "0"
        : existing.playing || "0",
  };

  await redisClient.hSet(stateKey, newState);
  await redisClient.expire(stateKey, ROOM_TTL);
}

// Get video state
async function getVideoState(roomId) {
  const stateKey = `room:${roomId}:video`;
  const state = await redisClient.hGetAll(stateKey);

  if (!state || Object.keys(state).length === 0) {
    return null;
  }

  return {
    url: state.url || "",
    currentTime: parseFloat(state.currentTime) || 0,
    playing: state.playing === "1",
  };
}

// ============== Username Operations ==============

// Save username for a user
async function saveUsername(roomId, userId, username) {
  const namesKey = `room:${roomId}:names`;
  await redisClient.hSet(namesKey, userId, username);
  await redisClient.expire(namesKey, ROOM_TTL);
}

// Remove username when user leaves
async function removeUsername(roomId, userId) {
  const namesKey = `room:${roomId}:names`;
  await redisClient.hDel(namesKey, userId);
}

// Get all usernames in room
async function getRoomUsernames(roomId) {
  const namesKey = `room:${roomId}:names`;
  const names = await redisClient.hGetAll(namesKey);
  return names || {};
}

// Get username for a specific user
async function getUsername(roomId, userId) {
  const namesKey = `room:${roomId}:names`;
  return await redisClient.hGet(namesKey, userId);
}

// Get all active rooms
async function getAllRooms() {
  const rooms = [];
  const keys = await redisClient.keys("room:*");

  for (const key of keys) {
    // Filter out sub-keys like :users, :video, :names
    if (key.includes(":users") || key.includes(":video") || key.includes(":names")) {
      continue;
    }

    const roomId = key.split(":")[1];
    const data = await redisClient.hGetAll(key); // Get all fields at once for efficiency
    const usersKey = `room:${roomId}:users`;
    const userCount = await redisClient.sCard(usersKey);

    rooms.push({
      roomId,
      name: data.name || "Unnamed Room",
      persistent: data.persistent === "true",
      isProtected: !!data.password,
      createdAt: parseInt(data.createdAt) || 0,
      userCount: userCount || 0,
    });
  }

  // Sort rooms: Persistent (Public) first, then by createdAt descending
  rooms.sort((a, b) => {
    if (a.persistent && !b.persistent) return -1;
    if (!a.persistent && b.persistent) return 1;
    return b.createdAt - a.createdAt;
  });

  return rooms;
}

module.exports = {
  redisClient,
  redisPub,
  redisSub,
  connectRedis,
  reserveRoom,
  createRoom,
  roomExists,
  getRoomUserCount,
  joinRoom,
  leaveRoom,
  deleteRoom,
  isHost,
  getRoomData,
  saveVideoState,
  getVideoState,
  saveUsername,
  removeUsername,
  getRoomUsernames,
  getUsername,
  getAllRooms,
};
