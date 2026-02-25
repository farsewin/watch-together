import { useRef, useEffect, useState, useCallback } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

function VideoPlayer({ roomId, videoUrl }) {
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const lastEvent = useRef({ type: null, time: 0 });
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    if (!roomId) return;

    console.log("VideoPlayer: Setting up socket listeners for room:", roomId);

    // Handle incoming video events (play, pause, seek only)
    const handleVideoEvent = (data) => {
      console.log("VideoPlayer: Received video event:", data);
      
      // Set remote flag before making changes
      isRemote.current = true;
      lastEvent.current = { type: data.event, time: Date.now() };

      if (data.event === "play") {
        if (playerRef.current) {
          playerRef.current.currentTime = data.currentTime;
        }
        setPlaying(true);
        setSyncStatus("▶ Playing (synced)");
      } else if (data.event === "pause") {
        if (playerRef.current) {
          playerRef.current.currentTime = data.currentTime;
        }
        setPlaying(false);
        setSyncStatus("⏸ Paused (synced)");
      } else if (data.event === "seek") {
        if (playerRef.current) {
          playerRef.current.currentTime = data.currentTime;
        }
        setSyncStatus(`⏩ Synced to ${Math.floor(data.currentTime)}s`);
      }

      // Reset flag after longer delay
      setTimeout(() => {
        isRemote.current = false;
      }, 1000);
    };

    socket.on("video-event", handleVideoEvent);

    return () => {
      socket.off("video-event", handleVideoEvent);
    };
  }, [roomId]);

  // Get current time from player
  const getCurrentTime = () => {
    if (playerRef.current) {
      return playerRef.current.currentTime || 0;
    }
    return 0;
  };

  // Debounce check - prevent rapid fire events
  const shouldEmit = useCallback((eventType) => {
    if (isRemote.current) return false;
    
    const now = Date.now();
    // Don't emit same event type within 500ms
    if (lastEvent.current.type === eventType && now - lastEvent.current.time < 500) {
      return false;
    }
    lastEvent.current = { type: eventType, time: now };
    return true;
  }, []);

  // Emit play event
  const handlePlay = () => {
    if (!shouldEmit("play")) return;
    const time = getCurrentTime();
    console.log("VideoPlayer: Emitting play event at", time);
    socket.emit("video-event", {
      roomId,
      event: "play",
      currentTime: time,
    });
    setSyncStatus("▶ Playing");
  };

  // Emit pause event
  const handlePause = () => {
    if (!shouldEmit("pause")) return;
    const time = getCurrentTime();
    console.log("VideoPlayer: Emitting pause event at", time);
    socket.emit("video-event", {
      roomId,
      event: "pause",
      currentTime: time,
    });
    setSyncStatus("⏸ Paused");
  };

  // Emit seek event
  const handleSeek = (seconds) => {
    if (!shouldEmit("seek")) return;
    console.log("VideoPlayer: Emitting seek event to", seconds);
    socket.emit("video-event", {
      roomId,
      event: "seek",
      currentTime: seconds,
    });
    setSyncStatus(`⏩ Seeked to ${Math.floor(seconds)}s`);
  };

  return (
    <div className="video-container">
      {syncStatus && <div className="sync-status">{syncStatus}</div>}
      <div className="player-wrapper">
        <ReactPlayer
          ref={playerRef}
          src={videoUrl}
          controls={true}
          playing={playing}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
