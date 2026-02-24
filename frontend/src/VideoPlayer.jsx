import { useRef, useEffect } from "react";
import socket from "./socket";

const SYNC_INTERVAL = 3000; // 3 seconds
const DRIFT_THRESHOLD = 0.5; // 0.5 seconds

function VideoPlayer({ roomId, videoUrl }) {
  const videoRef = useRef(null);
  const isRemote = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomId) return;

    // Handle incoming video events
    const handleVideoEvent = (data) => {
      console.log("Received video event:", data);
      isRemote.current = true;

      switch (data.event) {
        case "play":
          video.currentTime = data.currentTime;
          video.play();
          break;
        case "pause":
          video.currentTime = data.currentTime;
          video.pause();
          break;
        case "seek":
          video.currentTime = data.currentTime;
          break;
        default:
          break;
      }

      // Reset flag after a short delay
      setTimeout(() => {
        isRemote.current = false;
      }, 100);
    };

    // Handle sync event (time drift correction)
    const handleSync = (data) => {
      const drift = Math.abs(video.currentTime - data.currentTime);
      if (drift > DRIFT_THRESHOLD) {
        console.log(`Drift detected: ${drift.toFixed(2)}s. Adjusting...`);
        isRemote.current = true;
        video.currentTime = data.currentTime;
        setTimeout(() => {
          isRemote.current = false;
        }, 100);
      }
    };

    socket.on("video-event", handleVideoEvent);
    socket.on("sync", handleSync);

    // Sync interval - send current time every 3 seconds
    const syncInterval = setInterval(() => {
      if (!video.paused) {
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
