const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-default-secret-key";

// Express Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log("[AUTH] Request rejected: Missing token");
    return res.status(401).json({ error: "Access denied. Token missing." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.log(`[AUTH] Request rejected: Invalid/Expired token (${err.message})`);
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

const isAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "admin") {
      console.log(`[AUTH] Admin access granted: ${req.user.username}`);
      next();
    } else {
      console.log(`[AUTH] Admin access denied: User '${req.user.username}' has role '${req.user.role}'`);
      res.status(403).json({ error: "Forbidden. Admin access required." });
    }
  });
};

// Socket.IO Handshake Middleware
const verifySocketToken = (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    console.log(`[AUTH] Socket connection rejected: No token provided (Socket ID: ${socket.id})`);
    return next(new Error("Authentication error: Token missing"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user data to socket
    console.log(`[AUTH] Socket verified: ${decoded.username} (${decoded.role})`);
    next();
  } catch (err) {
    console.log(`[AUTH] Socket token verification failed: ${err.message}`);
    next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = { verifyToken, isAdmin, verifySocketToken, JWT_SECRET };
