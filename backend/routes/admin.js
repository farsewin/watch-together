const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { getAllRooms, deleteRoom, reserveRoom } = require("../redis");
const { isAdmin, JWT_SECRET } = require("../middleware/auth");

// Admin login - Issue JWT
router.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { role: "admin", username: "ROOT_ADMIN" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

// Delete a room forcefully
router.delete("/admin/delete-room/:roomId", isAdmin, async (req, res) => {
  try {
    const { roomId } = req.params;
    await deleteRoom(roomId);
    res.json({ success: true, message: `Room ${roomId} deleted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Re-initialize public room
router.post("/admin/init-public", isAdmin, async (req, res) => {
  try {
    await reserveRoom("public", "Public Room", true);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
