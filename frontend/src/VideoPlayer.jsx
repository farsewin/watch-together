import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

function VideoPlayer({ roomId, videoUrl }) {
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    if (!roomId) return;

    console.log("VideoPlayer: Setting up socket listeners for room:", roomId);

    // Handle incoming video events
    const handleVideoEvent = (data) => {
      console.log("VideoPlayer: Received video event:", data);
      
      // Block local events while processing remote
      isRemote.current = true;

      const video = playerRef.current;
      if (!video) return;

      if (data.event === "play") {
        video.currentTime = data.currentTime;
        video.play().catch(() => {});
        setSyncStatus("▶ Playing (synced)");
      } else if (data.event === "pause") {
        video.currentTime = data.currentTime;
        video.pause();
        setSyncStatus("⏸ Paused (synced)");
      } else if (data.event === "seek") {
        video.currentTime = data.currentTime;
        setSyncStatus(`⏩ Synced to ${Math.floor(data.currentTime)}s`);
      }

      // Reset flag after delay
      setTimeout(() => {
        isRemote.current = false;
      }, 300);
    };

    socket.on("video-event", handleVideoEvent);

    return () => {
      socket.off("video-event", handleVideoEvent);
    };
  }, [roomId]);

  // Handle play
  const handlePlay = () => {
    if (isRemote.current) return;
    const video = playerRef.current;
    if (!video) return;
    
    console.log("VideoPlayer: Emitting play at", video.currentTime);
    socket.emit("video-event", {
      roomId,
      event: "play",
      currentTime: video.currentTime || 0,
    });
    setSyncStatus("▶ Playing");
  };

  // Handle pause
  const handlePause = () => {
    if (isRemote.current) return;
    const video = playerRef.current;
    if (!video) return;
    
    console.log("VideoPlayer: Emitting pause at", video.currentTime);
    socket.emit("video-event", {
      roomId,
      event: "pause",
      currentTime: video.currentTime || 0,
    });
    setSyncStatus("⏸ Paused");
  };

  // Handle seek
  const handleSeek = () => {
    if (isRemote.current) return;
    const video = playerRef.current;
    if (!video) return;
    
    console.log("VideoPlayer: Emitting seek to", video.currentTime);
    socket.emit("video-event", {
      roomId,
      event: "seek",
      currentTime: video.currentTime || 0,
    });
    setSyncStatus(`⏩ Seeked to ${Math.floor(video.currentTime)}s`);
  };

  return (
    <div className="video-container">
      {syncStatus && <div className="sync-status">{syncStatus}</div>}
      <div className="player-wrapper">
        <video
          ref={playerRef}
          src={videoUrl}
          controls
          onPlay={handlePlay}
          onPause={handlePause}
          onSeeked={handleSeek}
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
