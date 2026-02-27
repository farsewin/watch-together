import { useState, useEffect } from "react";
import socket, { saveSession, getSession, clearSession } from "./socket";
import VoiceCall from "./VoiceCall";

// Use environment variable or fallback to production URL
const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://watch-together-production-7fd9.up.railway.app";

function Room({ onJoinRoom, onLeaveRoom, roomId, setRoomId }) {
  const [status, setStatus] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState({});
  const [copied, setCopied] = useState(false);

  // Leave room and destroy session
  const leaveRoom = () => {
    // Emit leave-room event before disconnecting so backend can clean up
    if (socket.connected) {
      socket.emit("leave-room", { roomId });
    }
    socket.disconnect();
    clearSession();
    setIsJoined(false);
    setStatus("");
    setUserCount(0);
    setUsers({});
    onLeaveRoom();
  };

  // Auto-restore session on mount
  useEffect(() => {
    let active = true;
    const session = getSession();
    if (session && active) {
      setTimeout(() => {
        setUsername(session.username);
        setRoomId(session.roomId);
      }, 0);
    }
    return () => { active = false; };
  }, [setRoomId]);

  // Handle reconnection - auto rejoin room
  useEffect(() => {
    const handleReconnect = () => {
      const session = getSession();
      if (session && session.roomId) {
        console.log("Reconnected, rejoining room...");
        socket.emit("join-room", {
          roomId: session.roomId,
          username: session.username,
        });
      }
    };

    socket.on("reconnect", handleReconnect);
    return () => socket.off("reconnect", handleReconnect);
  }, []);

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
      saveSession(data.roomId, username, data.isHost);
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

    socket.on("room-closed", (data) => {
      console.log("Room closed by host:", data.message);
      clearSession();
      setIsJoined(false);
      setStatus("Room was closed by the host");
      setUserCount(0);
      setUsers({});
      socket.disconnect();
      onLeaveRoom();
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
                {name === username && (
                  <VoiceCall roomId={roomId} username={username} />
                )}
              </span>
            ))}
          </span>
          {status && <span className="status-inline">{status}</span>}
          <button className="leave-btn" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
}

export default Room;
