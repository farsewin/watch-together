import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

function VideoPlayer({ roomId, videoUrl }) {
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    if (!roomId) return;

    // Handle incoming video events (play, pause, seek only)
    const handleVideoEvent = (data) => {
      console.log("Received video event:", data);
      isRemote.current = true;

      switch (data.event) {
        case "play":
          if (playerRef.current) {
            playerRef.current.seekTo(data.currentTime, "seconds");
          }
          setPlaying(true);
          setSyncStatus("Playing");
          break;
        case "pause":
          if (playerRef.current) {
            playerRef.current.seekTo(data.currentTime, "seconds");
          }
          setPlaying(false);
          setSyncStatus("Paused");
          break;
        case "seek":
          if (playerRef.current) {
            playerRef.current.seekTo(data.currentTime, "seconds");
          }
          setSyncStatus(`Synced to ${Math.floor(data.currentTime)}s`);
          break;
        default:
          break;
      }

      // Reset flag after delay
      setTimeout(() => {
        isRemote.current = false;
      }, 500);
    };

    socket.on("video-event", handleVideoEvent);

    return () => {
      socket.off("video-event", handleVideoEvent);
    };
  }, [roomId]);

  // Get current time from player
  const getCurrentTime = () => {
    if (playerRef.current) {
      return playerRef.current.getCurrentTime() || 0;
    }
    return 0;
  };

  // Emit play event
  const handlePlay = () => {
    if (isRemote.current) return;
    socket.emit("video-event", {
      roomId,
      event: "play",
      currentTime: getCurrentTime(),
    });
    setSyncStatus("Playing");
  };

  // Emit pause event
  const handlePause = () => {
    if (isRemote.current) return;
    socket.emit("video-event", {
      roomId,
      event: "pause",
      currentTime: getCurrentTime(),
    });
    setSyncStatus("Paused");
  };

  // Emit seek event
  const handleSeek = (seconds) => {
    if (isRemote.current) return;
    socket.emit("video-event", {
      roomId,
      event: "seek",
      currentTime: seconds,
    });
    setSyncStatus(`Seeked to ${Math.floor(seconds)}s`);
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
