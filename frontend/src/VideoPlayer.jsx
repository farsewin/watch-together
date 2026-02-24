import { useRef, useEffect, useState } from "react";
import socket from "./socket";

function VideoPlayer({ roomId, videoUrl }) {
  const videoRef = useRef(null);
  const isRemote = useRef(false);
  const [pendingPlay, setPendingPlay] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !roomId) return;

    // Handle incoming video events (play, pause, seek only)
    const handleVideoEvent = (data) => {
      console.log("Received video event:", data);
      isRemote.current = true;

      switch (data.event) {
        case "play":
          video.currentTime = data.currentTime;
          // Try to play, if blocked on mobile show notification
          video.play().catch((err) => {
            console.log("Autoplay blocked, user needs to tap play");
            setPendingPlay(data.currentTime);
          });
          break;
        case "pause":
          video.currentTime = data.currentTime;
          video.pause();
          setPendingPlay(null);
          break;
        case "seek":
          video.currentTime = data.currentTime;
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

  // Emit play event
  const handlePlay = () => {
    setPendingPlay(null);
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

  // Handle manual play for mobile (when autoplay is blocked)
  const handleManualPlay = () => {
    const video = videoRef.current;
    if (pendingPlay !== null) {
      video.currentTime = pendingPlay;
    }
    video.play();
    setPendingPlay(null);
  };

  return (
    <div className="video-container">
      {pendingPlay !== null && (
        <div className="play-prompt" onClick={handleManualPlay}>
          <button className="play-btn">▶ Tap to Play</button>
        </div>
      )}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        webkit-playsinline="true"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        width="100%"
      />
    </div>
  );
}

export default VideoPlayer;
