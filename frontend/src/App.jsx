import { useState, useEffect } from "react";
import Room from "./Room";
import VideoPlayer from "./VideoPlayer";
import socket from "./socket";
import "./App.css";

// Default sample video URL
const DEFAULT_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO);

  const handleJoinRoom = (id) => {
    setJoinedRoom(id);
  };

  // Sync video URL between users
  useEffect(() => {
    if (!joinedRoom) return;

    // When receiving URL change
    const handleUrlChange = (data) => {
      console.log("Received URL change:", data.url);
      setVideoUrl(data.url);
    };

    // When another user requests our current URL (they just joined)
    const handleUrlRequest = () => {
      console.log("User requested URL, sending:", videoUrl);
      socket.emit("url-change", { roomId: joinedRoom, url: videoUrl });
    };

    socket.on("url-change", handleUrlChange);
    socket.on("request-url", handleUrlRequest);

    // Request current URL from other users when joining
    socket.emit("request-url", { roomId: joinedRoom });

    return () => {
      socket.off("url-change", handleUrlChange);
      socket.off("request-url", handleUrlRequest);
    };
  }, [joinedRoom, videoUrl]);

  // Handle URL input change and broadcast to other user
  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setVideoUrl(newUrl);
  };

  // Broadcast URL when user finishes typing (on blur or Enter)
  const broadcastUrl = () => {
    if (joinedRoom && videoUrl) {
      console.log("Broadcasting URL:", videoUrl);
      socket.emit("url-change", { roomId: joinedRoom, url: videoUrl });
    }
  };

  return (
    <div className="app">
      <Room onJoinRoom={handleJoinRoom} roomId={roomId} setRoomId={setRoomId} />

      {joinedRoom && (
        <div className="video-section">
          <div className="video-url-input">
            <label>Video URL:</label>
            <input
              type="text"
              value={videoUrl}
              onChange={handleUrlChange}
              onBlur={broadcastUrl}
              onKeyDown={(e) => e.key === "Enter" && broadcastUrl()}
              placeholder="Enter video URL"
            />
          </div>
          <VideoPlayer roomId={joinedRoom} videoUrl={videoUrl} />
        </div>
      )}
    </div>
  );
}

export default App;
