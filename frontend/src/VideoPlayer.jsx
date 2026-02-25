import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

// Detect mobile device
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

// Check if URL is YouTube
const isYouTube = (url) => {
  return url && (url.includes("youtube.com") || url.includes("youtu.be"));
};

function VideoPlayer({ roomId, videoUrl, isHost }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [mobile] = useState(isMobile());

  const isYT = isYouTube(videoUrl);

  useEffect(() => {
    if (!roomId) return;

    console.log("VideoPlayer: Device:", mobile ? "MOBILE" : "PC");
    console.log("VideoPlayer: Setting up socket listeners for room:", roomId);

    // Handle incoming video events
    const handleVideoEvent = (data) => {
      console.log("VideoPlayer: Received video event:", data);

      // Block local events while processing remote
      isRemote.current = true;

      if (mobile || isYT) {
        // Mobile uses ReactPlayer for all URLs, PC uses it for YouTube
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
        // PC Native video for direct URLs
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

      // Reset flag after delay
      setTimeout(() => {
        isRemote.current = false;
      }, 500);
    };

    socket.on("video-event", handleVideoEvent);

    return () => {
      socket.off("video-event", handleVideoEvent);
    };
  }, [roomId, isYT]);

  // Get current time (mobile uses ReactPlayer for all, PC uses native for non-YouTube)
  const getCurrentTime = () => {
    if (mobile || isYT) {
      // Mobile always uses ReactPlayer, PC uses it for YouTube
      if (playerRef.current) {
        return playerRef.current.getCurrentTime() || 0;
      }
    } else if (videoRef.current) {
      // PC native video for direct URLs
      return videoRef.current.currentTime || 0;
    }
    return 0;
  };

  // Handle play (only host emits)
  const handlePlay = () => {
    if (isRemote.current || !isHost) return;
    const time = getCurrentTime();
    console.log("VideoPlayer: Host emitting play at", time);
    socket.emit("video-event", {
      roomId,
      event: "play",
      currentTime: time,
    });
    setSyncStatus("▶ Playing");
  };

  // Handle pause (only host emits)
  const handlePause = () => {
    if (isRemote.current || !isHost) return;
    const time = getCurrentTime();
    console.log("VideoPlayer: Host emitting pause at", time);
    socket.emit("video-event", {
      roomId,
      event: "pause",
      currentTime: time,
    });
    setSyncStatus("⏸ Paused");
  };

  // Handle seek (only host emits)
  const handleSeek = (seconds) => {
    if (isRemote.current || !isHost) return;
    const time = typeof seconds === "number" ? seconds : getCurrentTime();
    console.log("VideoPlayer: Host emitting seek to", time);
    socket.emit("video-event", {
      roomId,
      event: "seek",
      currentTime: time,
    });
    setSyncStatus(`⏩ Seeked to ${Math.floor(time)}s`);
  };

  // Mobile: Use ReactPlayer for everything (better mobile support)
  // PC: Use native video for direct URLs, ReactPlayer for YouTube
  const renderPlayer = () => {
    if (mobile) {
      // MOBILE VERSION - ReactPlayer for all URLs
      return (
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          controls={true}
          playing={playing}
          playsinline={true}
          width="100%"
          height="100%"
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          config={{
            youtube: {
              playerVars: {
                playsinline: 1,
                modestbranding: 1,
              },
            },
            file: {
              attributes: {
                playsInline: true,
                "webkit-playsinline": "true",
                preload: "auto",
              },
            },
          }}
        />
      );
    }

    // PC VERSION
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

    // PC - Native video for direct URLs
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
      <div className="device-indicator">
        {mobile ? "📱 Mobile Mode" : "💻 PC Mode"}
      </div>
      <div className="player-wrapper">{renderPlayer()}</div>
    </div>
  );
}

export default VideoPlayer;
