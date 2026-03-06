import { useState, useEffect } from "react";
import Room from "./Room";
import AdminDashboard from "./AdminDashboard";
import VideoPlayer from "./VideoPlayer";
import Chat from "./Chat";
import socket from "./socket";
import "./App.css";
import NetflixWatchParty from "./NetflixWatchParty";
import SubtitleSearch from "./SubtitleSearch";

// Default sample video URL
const DEFAULT_VIDEO = "https://www.w3schools.com/html/mov_bbb.mp4";

function App() {
  // If we are on /netflix route, render the Netflix Watch Party
  if (window.location.pathname === "/netflix") {
    return <NetflixWatchParty />;
  }

  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO);
  const [subtitleUrl, setSubtitleUrl] = useState("");
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
      if (videoState.subtitleUrl) {
        setSubtitleUrl(videoState.subtitleUrl);
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
    setSubtitleUrl("");
    setRoomId("");
  };

  // Sync video URL between users
  useEffect(() => {
    if (!joinedRoom) return;

    // When receiving URL change (from host)
    const handleUrlChange = (data) => {
      console.log("Received video/sub change:", data);
      if (data.url) setVideoUrl(data.url);
      if (data.subtitleUrl !== undefined) setSubtitleUrl(data.subtitleUrl);
    };

    // When guest requests URL (only host responds)
    const handleUrlRequest = () => {
      if (isHost) {
        console.log("Guest requested config, sending:", { videoUrl, subtitleUrl });
        socket.emit("url-change", { roomId: joinedRoom, url: videoUrl, subtitleUrl });
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
      console.log("Host broadcasting config:", { videoUrl, subtitleUrl });
      socket.emit("url-change", { roomId: joinedRoom, url: videoUrl, subtitleUrl });
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
              <div className="input-row">
                <label>Video URL:</label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={handleUrlChange}
                  onBlur={broadcastUrl}
                  onKeyDown={(e) => e.key === "Enter" && broadcastUrl()}
                  placeholder={isHost ? "Enter video URL (Direct or Pixeldrain)" : "Host controls video"}
                  disabled={!isHost}
                />
              </div>
              <div className="input-row">
                <label>Subtitles (OpenSubtitles):</label>
                {isHost ? (
                  <SubtitleSearch 
                    onSelect={(url) => {
                      setSubtitleUrl(url);
                      // Trigger broadcast immediately
                      socket.emit("video-event", {
                        roomId: joinedRoom,
                        event: "url-change",
                        videoUrl,
                        subtitleUrl: url,
                        senderId: socket.id
                      });
                    }} 
                  />
                ) : (
                  <div className="input-with-helper">
                    <input
                      type="text"
                      value={subtitleUrl ? "Subtitles Loaded" : "No subtitles"}
                      disabled
                      placeholder="Host controls subtitles"
                    />
                  </div>
                )}
                {subtitleUrl && isHost && (
                   <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <span>✅ Subtitles Active</span>
                     <button 
                       onClick={() => {
                         setSubtitleUrl("");
                         socket.emit("video-event", {
                           roomId: joinedRoom,
                           event: "url-change",
                           videoUrl,
                           subtitleUrl: "",
                           senderId: socket.id
                         });
                       }} 
                       className="sub-helper-link"
                       style={{ background: 'rgba(255,255,255,0.05)', color: '#e50914', border: '1px solid #e50914' }}
                     >
                       Remove
                     </button>
                   </div>
                )}
              </div>
            </div>
            <VideoPlayer
              roomId={joinedRoom}
              videoUrl={videoUrl}
              subtitleUrl={subtitleUrl}
              isHost={isHost}
              initialState={initialState}
            />
          </div>
          <Chat roomId={joinedRoom} isHost={isHost} />
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
