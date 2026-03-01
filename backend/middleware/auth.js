const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-default-secret-key";

// Express Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access denied. Token missing." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

const isAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ error: "Forbidden. Admin access required." });
    }
  });
};

// Socket.IO Handshake Middleware
const verifySocketToken = (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: Token missing"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user data to socket
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = { verifyToken, isAdmin, verifySocketToken, JWT_SECRET };
