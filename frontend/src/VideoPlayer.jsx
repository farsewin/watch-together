import { useRef, useEffect } from "react";
import socket from "./socket";

function VideoPlayer({ roomId, videoUrl }) {
  const videoRef = useRef(null);
  const isRemote = useRef(false);

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
          video.play().catch(() => {});
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
