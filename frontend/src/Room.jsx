import { useState, useEffect } from "react";
import socket, { saveSession, getSession, clearSession, saveToken, getToken } from "./socket";
import VoiceCall from "./VoiceCall";

// Use environment variable or fallback to production URL
const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:3001";

function Room({ onJoinRoom, onLeaveRoom, roomId, setRoomId }) {
  const [status, setStatus] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState({});
  const [copied, setCopied] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState("");
  const [roomPasswordInput, setRoomPasswordInput] = useState("");
  const [activeRooms, setActiveRooms] = useState([]);
  const [roomName, setRoomName] = useState(""); // Current room's name

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

  // Fetch all active rooms
  const fetchActiveRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/list-rooms`);
      if (response.ok) {
        const data = await response.json();
        setActiveRooms(data);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  useEffect(() => {
    if (!isJoined) {
      fetchActiveRooms();
      const interval = setInterval(fetchActiveRooms, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [isJoined]);

  // Create a new room
  const createRoom = async () => {
    try {
      const response = await fetch(`${API_URL}/create-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: roomNameInput, roomPassword: roomPasswordInput }),
      });
      const data = await response.json();
      setRoomId(data.roomId);
      setRoomName(data.roomName);
      setStatus(`Room "${data.roomName}" created!`);
      setRoomPasswordInput(""); // Clear password
      fetchActiveRooms(); // Update list
    } catch (error) {
      setStatus("Error creating room");
      console.error(error);
    }
  };

  // Join existing room
  const handleJoin = async (targetRoomId, targetUsername, targetPassword = null) => {
    if (!targetRoomId.trim() || !targetUsername.trim()) {
      setStatus("Please enter a name and room ID");
      return;
    }

    // If we don't have a token, we need to "login" first
    let token = getToken();
    if (!token) {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: targetUsername }),
        });
        const data = await res.json();
        if (data.token) {
          token = data.token;
          saveToken(token);
        } else {
          throw new Error("No token received");
        }
      } catch (err) {
        console.error("Auth failed:", err);
        setStatus("Authentication failed. Please try again.");
        return;
      }
    }

    if (!socket.connected) {
      socket.connect();
    }

    // Remove existing listeners to avoid duplicates on rejoin
    socket.off("room-joined");
    socket.off("user-joined");
    socket.off("user-left");
    socket.off("room-error");
    socket.off("room-closed");

    socket.on("room-joined", (data) => {
      console.log("Room joined successfully:", data.roomId);
      setIsJoined(true);
      setUsers(data.users || {});
      setUserCount(data.userCount || 1);
      setRoomId(data.roomId);
      setRoomName(data.name || "Room");
      setStatus("");
      
      // Save session for recovery
      saveSession(data.roomId, targetUsername, data.isHost);
      onJoinRoom(data.roomId, data.isHost, data.videoState);
    });

    socket.on("user-joined", (data) => {
      setUserCount(data.userCount);
      setUsers(data.users);
      console.log(`User ${data.username} joined. Total users: ${data.userCount}`);
    });

    socket.on("user-left", (data) => {
      setUserCount(data.userCount);
      setUsers(data.users);
      console.log(`User ${data.username} left. Total users: ${data.userCount}`);
    });

    socket.on("room-error", (data) => {
      alert(data.message);
      setStatus(data.message);
      socket.disconnect();
      onLeaveRoom();
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

    socket.emit("join-room", { roomId: targetRoomId, password: targetPassword });
  };

  return (
    <div className={`room-container ${isJoined ? "room-joined" : ""}`}>
      {!isJoined && <h2>Watch Together</h2>}

      {!isJoined && (
        <>
          <div className="room-create-section">
            <div className="input-group">
              <input
                type="text"
                placeholder="Room Name (e.g. Movie Night)"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="room-name-input"
              />
              <input
                type="password"
                placeholder="Password (Optional)"
                value={roomPasswordInput}
                onChange={(e) => setRoomPasswordInput(e.target.value)}
                className="room-password-input"
              />
            </div>
            <button onClick={createRoom} disabled={isJoined || !roomNameInput.trim()}>
              Create Room
            </button>
          </div>

          <div className="separator"><span>OR</span></div>

          <div className="active-rooms-section">
            <h3>Active Rooms</h3>
            {activeRooms.length === 0 ? (
              <p className="no-rooms">No active rooms found</p>
            ) : (
              <div className="room-list">
                {activeRooms.map((room) => (
                  <div 
                    key={room.roomId} 
                    className={`room-item ${roomId === room.roomId ? 'selected' : ''}`}
                    onClick={() => {
                      if (room.isProtected) {
                        const pass = prompt("Enter room password:");
                        if (pass !== null) handleJoin(room.roomId, username, pass);
                      } else {
                        handleJoin(room.roomId, username);
                      }
                    }}
                  >
                    <div className="room-item-info">
                      <span className="room-item-name">
                        {room.isProtected && <span className="lock-icon" title="Protected Room">🔒</span>}
                        {room.name}
                      </span>
                      <span className="room-item-users">👥 {room.userCount}/5</span>
                    </div>
                    {room.persistent && <span className="persistent-badge">Public</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="separator"><span>OR JOIN BY ID</span></div>

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
              onClick={() => {
                const knownRoom = activeRooms.find(r => r.roomId === roomId);
                if (knownRoom?.isProtected) {
                  const pass = prompt("Enter room password:");
                  if (pass !== null) handleJoin(roomId, username, pass);
                } else {
                  handleJoin(roomId, username);
                }
              }}
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
          <span className="room-name-display">
            🏠 {roomName || "Room"}
          </span>
          <span className="room-id-label">
            ID: {roomId.slice(0, 8)}...
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
