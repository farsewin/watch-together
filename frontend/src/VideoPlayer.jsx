import { useRef, useEffect, useCallback } from "react";
import socket from "./socket";

const SYNC_INTERVAL = 5000; // 5 seconds (increased)
const DRIFT_THRESHOLD = 1.0; // 1 second (increased to reduce sensitivity)

function VideoPlayer({ roomId, videoUrl }) {
  const videoRef = useRef(null);
  const isRemote = useRef(false);
  const lastSyncTime = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomId) return;

    // Handle incoming video events
    const handleVideoEvent = (data) => {
      console.log("Received video event:", data);
      isRemote.current = true;

      const timeDiff = Math.abs(video.currentTime - data.currentTime);

      switch (data.event) {
        case "play":
          // Only adjust time if significantly different
          if (timeDiff > 0.5) {
            video.currentTime = data.currentTime;
          }
          video.play().catch(() => {});
          break;
        case "pause":
          if (timeDiff > 0.5) {
            video.currentTime = data.currentTime;
          }
          video.pause();
          break;
        case "seek":
          video.currentTime = data.currentTime;
          break;
        default:
          break;
      }

      // Reset flag after a longer delay
      setTimeout(() => {
        isRemote.current = false;
      }, 500);
    };

    // Handle sync event (time drift correction)
    const handleSync = (data) => {
      // Prevent sync if we recently synced
      const now = Date.now();
      if (now - lastSyncTime.current < 2000) return;

      const drift = Math.abs(video.currentTime - data.currentTime);
      if (drift > DRIFT_THRESHOLD && !video.paused) {
        console.log(`Drift detected: ${drift.toFixed(2)}s. Adjusting...`);
        isRemote.current = true;
        lastSyncTime.current = now;
        video.currentTime = data.currentTime;
        setTimeout(() => {
          isRemote.current = false;
        }, 500);
      }
    };

    socket.on("video-event", handleVideoEvent);
    socket.on("sync", handleSync);

    // Sync interval - send current time every 5 seconds
    const syncInterval = setInterval(() => {
      if (!video.paused && !isRemote.current) {
        socket.emit("sync", {
          roomId,
          currentTime: video.currentTime,
        });
      }
    }, SYNC_INTERVAL);

    return () => {
      socket.off("video-event", handleVideoEvent);
      socket.off("sync", handleSync);
      clearInterval(syncInterval);
    };
  }, [roomId]);

  // Emit play event
  const handlePlay = () => {
    if (isRemote.current) return;
    const video = videoRef.current;
    socket.emit("video-event", {
      roomId,
      event: "play",
      currentTime: video.currentTime,
    });
  };

  // Emit pause event
  const handlePause = () => {
    if (isRemote.current) return;
    const video = videoRef.current;
    socket.emit("video-event", {
      roomId,
      event: "pause",
      currentTime: video.currentTime,
    });
  };

  // Emit seek event
  const handleSeeked = () => {
    if (isRemote.current) return;
    const video = videoRef.current;
    socket.emit("video-event", {
      roomId,
      event: "seek",
      currentTime: video.currentTime,
    });
  };

  return (
    <div className="video-container">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        width="100%"
      />
    </div>
  );
}

export default VideoPlayer;
