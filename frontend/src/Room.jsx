import { useState } from "react";
import socket from "./socket";

const API_URL = "http://localhost:3001";

function Room({ onJoinRoom, roomId, setRoomId }) {
  const [status, setStatus] = useState("");
  const [userCount, setUserCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);

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

    socket.connect();

    socket.on("room-joined", (data) => {
      setStatus(`Joined room successfully!`);
      setUserCount(data.userCount);
      setIsJoined(true);
      onJoinRoom(data.roomId);
    });

    socket.on("room-error", (data) => {
      setStatus(`Error: ${data.message}`);
    });

    socket.on("user-joined", (data) => {
      setUserCount(data.userCount);
      setStatus("Another user joined the room!");
    });

    socket.on("user-left", (data) => {
      setUserCount(data.userCount);
      setStatus("User left the room");
    });

    socket.emit("join-room", roomId);
  };

  return (
    <div className="room-container">
      <h2>Watch Together</h2>

      <div className="room-actions">
        <button onClick={createRoom} disabled={isJoined}>
          Create Room
        </button>
      </div>

      <div className="room-join">
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={isJoined}
        />
        <button onClick={joinRoom} disabled={isJoined || !roomId}>
          Join Room
        </button>
      </div>

      {status && <p className="status">{status}</p>}
      {isJoined && <p className="user-count">Users in room: {userCount}</p>}
    </div>
  );
}

export default Room;
