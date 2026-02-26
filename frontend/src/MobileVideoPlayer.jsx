import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

// Check if URL is YouTube
const isYouTube = (url) => {
  return url && (url.includes("youtube.com") || url.includes("youtu.be"));
};

function MobileVideoPlayer({ roomId, videoUrl, isHost, initialState }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [activated, setActivated] = useState(false);
  // Initialize pendingSync from initialState if provided
  const [pendingSync, setPendingSync] = useState(() => {
    if (initialState) {
      return {
        event: initialState.playing ? "play" : "pause",
        currentTime: initialState.currentTime,
      };
    }
    return null;
  });

  const isYT = isYouTube(videoUrl);

  useEffect(() => {
    if (!roomId) return;

    console.log(
      "MobileVideoPlayer: Setting up socket listeners for room:",
      roomId,
    );

    const handleVideoEvent = (data) => {
      console.log("MobileVideoPlayer: Received video event:", data);

      // If not activated yet, store pending sync and prompt user
      if (!activated) {
        console.log("MobileVideoPlayer: Not activated, storing pending sync");
        setPendingSync(data);
        return;
      }

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
        // Native HTML5 video
        const video = videoRef.current;
        if (!video) return;

        if (data.event === "play") {
          video.currentTime = data.currentTime;
          video.play().catch((e) => {
            console.log("MobileVideoPlayer: play() failed:", e);
          });
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
  }, [roomId, isYT, activated]);

  // Handle user activation - must be triggered by user gesture
  const handleActivate = () => {
    console.log("MobileVideoPlayer: User activated playback");
    setActivated(true);

    // Apply any pending sync after activation
    if (pendingSync) {
      console.log("MobileVideoPlayer: Applying pending sync", pendingSync);

      if (isYT) {
        const player = playerRef.current?.getInternalPlayer();
        if (player && player.seekTo) {
          player.seekTo(pendingSync.currentTime, true);
        }
        if (pendingSync.event === "play") {
          setPlaying(true);
        }
      } else {
        const video = videoRef.current;
        if (video) {
          video.currentTime = pendingSync.currentTime;
          if (pendingSync.event === "play") {
            video.play().catch(() => {});
          }
        }
      }

      setSyncStatus("▶ Synced with host");
      setPendingSync(null);
    }
  };

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
    // Ensure activated on any play interaction
    if (!activated) {
      setActivated(true);
    }

    if (isRemote.current || !isHost) return;
    const time = getCurrentTime();
    console.log("MobileVideoPlayer: Host emitting play at", time);
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
    console.log("MobileVideoPlayer: Host emitting pause at", time);
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
    console.log("MobileVideoPlayer: Host emitting seek to", time);
    socket.emit("video-event", {
      roomId,
      event: "seek",
      currentTime: time,
    });
    setSyncStatus(`⏩ Seeked to ${Math.floor(time)}s`);
  };

  const renderPlayer = () => {
    if (isYT) {
      // YouTube uses ReactPlayer
      return (
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          controls={true}
          playing={activated && playing}
          playsInline={true}
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
                fs: 1,
                rel: 0,
              },
            },
          }}
        />
      );
    }

    // Native HTML5 video for direct URLs (mobile-optimized)
    return (
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
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
      <div className="device-indicator">📱 Mobile Mode</div>

      {/* Activation overlay - must tap to start on mobile */}
      {!activated && (
        <div className="activation-overlay" onClick={handleActivate}>
          <button className="activate-btn" type="button">
            ▶ Tap to Start Watching
          </button>
          <p className="activate-hint">
            {pendingSync
              ? "Host started video - tap to sync"
              : "Tap to enable video playback"}
          </p>
        </div>
      )}

      <div className="player-wrapper">{renderPlayer()}</div>
    </div>
  );
}

export default MobileVideoPlayer;
