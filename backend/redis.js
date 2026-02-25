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
async function reserveRoom(roomId) {
  const roomKey = `room:${roomId}`;
  await redisClient.hSet(roomKey, "reserved", "true");
  await redisClient.expire(roomKey, ROOM_TTL);
  return { reserved: true };
}

// Create a new room with host
async function createRoom(roomId, hostSocketId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  await redisClient.hSet(roomKey, "host", hostSocketId);
  await redisClient.sAdd(usersKey, hostSocketId);
  await redisClient.expire(roomKey, ROOM_TTL);
  await redisClient.expire(usersKey, ROOM_TTL);

  return { host: hostSocketId, userCount: 1 };
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
async function joinRoom(roomId, socketId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  // Check room exists
  const exists = await roomExists(roomId);
  if (!exists) {
    return { error: "Room not found" };
  }

  // Check room is not full (max 2 users)
  const userCount = await getRoomUserCount(roomId);
  if (userCount >= 2) {
    return { error: "Room is full" };
  }

  // Add user to room
  await redisClient.sAdd(usersKey, socketId);

  // Refresh TTL
  await redisClient.expire(roomKey, ROOM_TTL);
  await redisClient.expire(usersKey, ROOM_TTL);

  const newCount = await getRoomUserCount(roomId);
  const host = await redisClient.hGet(roomKey, "host");

  return { host, userCount: newCount };
}

// Leave a room
async function leaveRoom(roomId, socketId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  // Remove user from room
  await redisClient.sRem(usersKey, socketId);

  const userCount = await getRoomUserCount(roomId);

  // If room is empty, set short TTL instead of deleting immediately
  // This allows users to rejoin after refresh
  if (userCount === 0) {
    await redisClient.expire(roomKey, RECONNECT_GRACE);
    await redisClient.expire(usersKey, RECONNECT_GRACE);
    return { deleted: false, userCount: 0, pendingDelete: true };
  }

  // If host left, assign new host
  const host = await redisClient.hGet(roomKey, "host");
  if (host === socketId) {
    const users = await redisClient.sMembers(usersKey);
    if (users.length > 0) {
      await redisClient.hSet(roomKey, "host", users[0]);
    }
  }

  return { deleted: false, userCount };
}

// Check if socket is the host
async function isHost(roomId, socketId) {
  const roomKey = `room:${roomId}`;
  const host = await redisClient.hGet(roomKey, "host");
  return host === socketId;
}

// Get all room data
async function getRoomData(roomId) {
  const roomKey = `room:${roomId}`;
  const usersKey = `room:${roomId}:users`;

  const host = await redisClient.hGet(roomKey, "host");
  const users = await redisClient.sMembers(usersKey);

  return { host, users, userCount: users.length };
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
  isHost,
  getRoomData,
};
