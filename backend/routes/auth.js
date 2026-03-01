const express = require("express");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");
const router = express.Router();

// Guest Login (assigns a unique userId and username)
router.post("/auth/login", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username is required" });

  const userId = "u_" + Math.random().toString(36).substring(2, 11);
  const token = jwt.sign(
    { userId, username, role: "guest" },
    JWT_SECRET,
    { expiresIn: "7d" } // Guests stay logged in for a week
  );

  res.json({ token, userId, username });
});

module.exports = router;
