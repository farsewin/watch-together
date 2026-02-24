import { useState } from "react";
import Room from "./Room";
import VideoPlayer from "./VideoPlayer";
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
              onChange={(e) => setVideoUrl(e.target.value)}
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
