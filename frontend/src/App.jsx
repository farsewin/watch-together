import { useState, useEffect } from "react";
import Room from "./Room";
import AdminDashboard from "./AdminDashboard";
import VideoPlayer from "./VideoPlayer";
import Chat from "./Chat";
import socket from "./socket";
import "./App.css";

// Default sample video URL
const DEFAULT_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO);
  const [initialState, setInitialState] = useState(null);

  const handleJoinRoom = (id, hostStatus, videoState) => {
    setJoinedRoom(id);
    setIsHost(hostStatus);

    // Restore video state from Redis on reconnect
    if (videoState) {
      console.log("Restoring video state:", videoState);
      if (videoState.url) {
        setVideoUrl(videoState.url);
      }
      setInitialState({
        currentTime: videoState.currentTime || 0,
        playing: videoState.playing || false,
      });
    }
  };

  const handleLeaveRoom = () => {
    setJoinedRoom(null);
    setIsHost(false);
    setVideoUrl(DEFAULT_VIDEO);
    setRoomId("");
  };

  // Sync video URL between users
  useEffect(() => {
    if (!joinedRoom) return;

    // When receiving URL change (from host)
    const handleUrlChange = (data) => {
      console.log("Received URL change:", data.url);
      setVideoUrl(data.url);
    };

    // When guest requests URL (only host responds)
    const handleUrlRequest = () => {
      if (isHost) {
        console.log("Guest requested URL, sending:", videoUrl);
        socket.emit("url-change", { roomId: joinedRoom, url: videoUrl });
      }
    };

    socket.on("url-change", handleUrlChange);
    socket.on("request-url", handleUrlRequest);

    // Guest requests current URL from host when joining
    if (!isHost) {
      socket.emit("request-url", { roomId: joinedRoom });
    }

    return () => {
      socket.off("url-change", handleUrlChange);
      socket.off("request-url", handleUrlRequest);
    };
  }, [joinedRoom, videoUrl, isHost]);

  // Handle URL input change (only host can change)
  const handleUrlChange = (e) => {
    if (!isHost) return;
    const newUrl = e.target.value;
    setVideoUrl(newUrl);
  };

  // Broadcast URL when host finishes typing
  const broadcastUrl = () => {
    if (isHost && joinedRoom && videoUrl) {
      console.log("Host broadcasting URL:", videoUrl);
      socket.emit("url-change", { roomId: joinedRoom, url: videoUrl });
    }
  };

  if (window.location.pathname === "/admin") {
    return <AdminDashboard />;
  }

  return (
    <div className="app">
      <Room
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={handleLeaveRoom}
        roomId={roomId}
        setRoomId={setRoomId}
      />

      {joinedRoom && (
        <div className="room-layout">
          <div className="video-section">
            {isHost ? (
              <div className="role-badge host">🎬 You are the HOST</div>
            ) : (
              <div className="role-badge guest">
                👁 You are a GUEST (view only)
              </div>
            )}
            <div className="video-url-input">
              <label>Video URL:</label>
              <input
                type="text"
                value={videoUrl}
                onChange={handleUrlChange}
                onBlur={broadcastUrl}
                onKeyDown={(e) => e.key === "Enter" && broadcastUrl()}
                placeholder={isHost ? "Enter video URL" : "Host controls video"}
                disabled={!isHost}
              />
            </div>
            <VideoPlayer
              roomId={joinedRoom}
              videoUrl={videoUrl}
              isHost={isHost}
              initialState={initialState}
            />
          </div>
          <Chat roomId={joinedRoom} />
        </div>
      )}
      <div className="app-footer">
        <a href="mailto:farsewin@gmail.com" className="feedback-button">
          📩 Feedback
        </a>
      </div>
    </div>
  );
}

export default App;
