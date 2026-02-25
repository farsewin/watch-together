import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

// Check if URL is YouTube
const isYouTube = (url) => {
  return url && (url.includes("youtube.com") || url.includes("youtu.be"));
};

function PCVideoPlayer({ roomId, videoUrl, isHost }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  const isYT = isYouTube(videoUrl);

  useEffect(() => {
    if (!roomId) return;

    console.log("PCVideoPlayer: Setting up socket listeners for room:", roomId);

    const handleVideoEvent = (data) => {
      console.log("PCVideoPlayer: Received video event:", data);
      isRemote.current = true;

      if (isYT) {
        // YouTube via ReactPlayer
        const player = playerRef.current?.getInternalPlayer();
        if (player && player.seekTo) {
          player.seekTo(data.currentTime, true);
        }
        if (data.event === "play") {
          setPlaying(true);
          setSyncStatus("▶ Playing (synced)");
        } else if (data.event === "pause") {
          setPlaying(false);
          setSyncStatus("⏸ Paused (synced)");
        } else if (data.event === "seek") {
          setSyncStatus(`⏩ Synced to ${Math.floor(data.currentTime)}s`);
        }
      } else {
        // Native video
        const video = videoRef.current;
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
      }

      setTimeout(() => {
        isRemote.current = false;
      }, 500);
    };

    socket.on("video-event", handleVideoEvent);

    return () => {
      socket.off("video-event", handleVideoEvent);
    };
  }, [roomId, isYT]);

  const getCurrentTime = () => {
    if (isYT && playerRef.current) {
      return playerRef.current.getCurrentTime() || 0;
    }
    if (videoRef.current) {
      return videoRef.current.currentTime || 0;
    }
    return 0;
  };

  const handlePlay = () => {
    if (isRemote.current || !isHost) return;
    const time = getCurrentTime();
    console.log("PCVideoPlayer: Host emitting play at", time);
    socket.emit("video-event", {
      roomId,
      event: "play",
      currentTime: time,
    });
    setSyncStatus("▶ Playing");
  };

  const handlePause = () => {
    if (isRemote.current || !isHost) return;
    const time = getCurrentTime();
    console.log("PCVideoPlayer: Host emitting pause at", time);
    socket.emit("video-event", {
      roomId,
      event: "pause",
      currentTime: time,
    });
    setSyncStatus("⏸ Paused");
  };

  const handleSeek = (seconds) => {
    if (isRemote.current || !isHost) return;
    const time = typeof seconds === "number" ? seconds : getCurrentTime();
    console.log("PCVideoPlayer: Host emitting seek to", time);
    socket.emit("video-event", {
      roomId,
      event: "seek",
      currentTime: time,
    });
    setSyncStatus(`⏩ Seeked to ${Math.floor(time)}s`);
  };

  const renderPlayer = () => {
    if (isYT) {
      return (
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          controls={true}
          playing={playing}
          width="100%"
          height="100%"
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          config={{
            youtube: {
              playerVars: {
                playsinline: 1,
              },
            },
          }}
        />
      );
    }

    // Native video for direct URLs
    return (
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        preload="metadata"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeek}
        style={{ width: "100%", height: "100%" }}
      />
    );
  };

  return (
    <div className="video-container">
      {syncStatus && <div className="sync-status">{syncStatus}</div>}
      <div className="device-indicator">💻 PC Mode</div>
      <div className="player-wrapper">{renderPlayer()}</div>
    </div>
  );
}

export default PCVideoPlayer;
