const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { reserveRoom } = require("../redis");

const router = express.Router();

// Create a new room
router.post("/create-room", async (req, res) => {
  const roomId = uuidv4();
  await reserveRoom(roomId);
  console.log(`Room reserved: ${roomId}`);
  res.json({ roomId });
});

module.exports = router;
