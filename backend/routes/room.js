const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { AccessToken } = require("livekit-server-sdk");
const { reserveRoom, roomExists } = require("../redis");

const router = express.Router();

// Create a new room
router.post("/create-room", async (req, res) => {
  const roomId = uuidv4();
  await reserveRoom(roomId);
  console.log(`Room reserved: ${roomId}`);
  res.json({ roomId });
});

// Generate LiveKit token for voice call
router.post("/livekit-token", async (req, res) => {
  const { roomId, username } = req.body;

  if (!roomId || !username) {
    console.log("Missing roomId or username", { roomId, username });
    return res.status(400).json({ error: "roomId and username are required" });
  }

  try {
    // Check if room exists in our Redis state first
    const exists = await roomExists(roomId);
    if (!exists) {
      console.log(`Room not found: ${roomId}`);
      return res.status(404).json({ error: "Room not found" });
    }

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error("Missing DB credentials:", { LIVEKIT_API_KEY: !!LIVEKIT_API_KEY, LIVEKIT_API_SECRET: !!LIVEKIT_API_SECRET });
      return res.status(500).json({ error: "LiveKit credentials not configured" });
    }

    // Create a generic token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: username,
      name: username,
    });
    
    // Add grants to the token
    token.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    res.json({ token: jwt });
  } catch (error) {
    console.error("Error generating LiveKit token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

module.exports = router;
