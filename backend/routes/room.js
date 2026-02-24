const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// Create a new room
router.post("/create-room", (req, res) => {
  const roomId = uuidv4();
  console.log(`Room created: ${roomId}`);
  res.json({ roomId });
});

module.exports = router;
