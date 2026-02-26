import { useState } from "react";
import socket from "./socket";

// Use environment variable or fallback to production URL
const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://watch-together-production-7fd9.up.railway.app";

function Room({ onJoinRoom, roomId, setRoomId }) {
  const [status, setStatus] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState({});
  const [copied, setCopied] = useState(false);

  // Copy room ID to clipboard
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Create a new room
  const createRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/create-room`, {
        method: "POST",
      });
      const data = await response.json();
      setRoomId(data.roomId);
      setStatus(`Room created: ${data.roomId}`);
    } catch (error) {
      setStatus("Error creating room");
      console.error(error);
    }
  };

  // Join existing room
  const joinRoom = () => {
    if (!roomId.trim()) {
      setStatus("Please enter a room ID");
      return;
    }

    if (!username.trim()) {
      setStatus("Please enter your name");
      return;
    }

    socket.connect();

    socket.on("room-joined", (data) => {
      setStatus(`Joined room successfully!`);
      setUserCount(data.userCount);
      setUsers(data.users || {});
      setIsJoined(true);
      onJoinRoom(data.roomId, data.isHost, data.videoState);
    });

    socket.on("room-error", (data) => {
      setStatus(`Error: ${data.message}`);
    });

    socket.on("user-joined", (data) => {
      setUserCount(data.userCount);
      setUsers(data.users || {});
      setStatus(`${data.username} joined the room!`);
    });

    socket.on("user-left", (data) => {
      setUserCount(data.userCount);
      setUsers(data.users || {});
      setStatus(`${data.username || "User"} left the room`);
    });

    socket.emit("join-room", { roomId, username });
  };

  return (
    <div className={`room-container ${isJoined ? "room-joined" : ""}`}>
      {!isJoined && <h2>Watch Together</h2>}

      {!isJoined && (
        <>
          <div className="room-actions">
            <button onClick={createRoom} disabled={isJoined}>
              Create Room
            </button>
          </div>

          <div className="room-join">
            <input
              type="text"
              placeholder="Your Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isJoined}
            />
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={isJoined}
            />
            <button
              onClick={joinRoom}
              disabled={isJoined || !roomId || !username}
            >
              Join Room
            </button>
          </div>

          {status && <p className="status">{status}</p>}
        </>
      )}

      {isJoined && (
        <div className="room-info-compact">
          <span className="room-id-label">
            Room: {roomId.slice(0, 8)}...
            <button
              className="copy-btn"
              onClick={copyRoomId}
              title="Copy Room ID"
            >
              {copied ? "✓" : "📋"}
            </button>
          </span>
          <span className="users-inline">
            <strong>Online ({userCount}):</strong>
            {Object.values(users).map((name, index) => (
              <span key={index} className="user-tag">
                {name}
              </span>
            ))}
          </span>
          {status && <span className="status-inline">{status}</span>}
        </div>
      )}
    </div>
  );
}

export default Room;
