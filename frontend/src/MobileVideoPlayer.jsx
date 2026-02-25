import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

function MobileVideoPlayer({ roomId, videoUrl, isHost }) {
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [activated, setActivated] = useState(false);
  const [pendingSync, setPendingSync] = useState(null);

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

      setTimeout(() => {
        isRemote.current = false;
      }, 500);
    };

    socket.on("video-event", handleVideoEvent);

    return () => {
      socket.off("video-event", handleVideoEvent);
    };
  }, [roomId, activated]);

  // Handle user activation - must be triggered by user gesture
  const handleActivate = () => {
    console.log("MobileVideoPlayer: User activated playback");
    setActivated(true);

    // Apply any pending sync after activation
    if (pendingSync) {
      console.log("MobileVideoPlayer: Applying pending sync", pendingSync);
      const player = playerRef.current?.getInternalPlayer();
      if (player && player.seekTo) {
        player.seekTo(pendingSync.currentTime, true);
      }
      if (pendingSync.event === "play") {
        setPlaying(true);
        setSyncStatus("▶ Playing (synced)");
      }
      setPendingSync(null);
    }
  };

  const getCurrentTime = () => {
    if (playerRef.current) {
      return playerRef.current.getCurrentTime() || 0;
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

  const handleError = (error) => {
    console.log("MobileVideoPlayer error:", error);
    // Don't crash on NotAllowedError - just wait for user gesture
    if (error?.name === "NotAllowedError") {
      setActivated(false);
      setPlaying(false);
    }
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

      <div className="player-wrapper">
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
          onError={handleError}
          config={{
            youtube: {
              playerVars: {
                playsinline: 1,
                modestbranding: 1,
                fs: 1,
                rel: 0,
              },
            },
            file: {
              forceVideo: true,
              attributes: {
                playsInline: true,
                "webkit-playsinline": "true",
                "x5-playsinline": "true",
                "x5-video-player-type": "h5",
                "x5-video-player-fullscreen": "true",
                preload: "metadata",
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export default MobileVideoPlayer;
