import { useRef, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import socket from "./socket";

function MobileVideoPlayer({ roomId, videoUrl, isHost }) {
  const playerRef = useRef(null);
  const isRemote = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    if (!roomId) return;

    console.log(
      "MobileVideoPlayer: Setting up socket listeners for room:",
      roomId,
    );

    const handleVideoEvent = (data) => {
      console.log("MobileVideoPlayer: Received video event:", data);
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
  }, [roomId]);

  const getCurrentTime = () => {
    if (playerRef.current) {
      return playerRef.current.getCurrentTime() || 0;
    }
    return 0;
  };

  const handlePlay = () => {
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

  return (
    <div className="video-container">
      {syncStatus && <div className="sync-status">{syncStatus}</div>}
      <div className="device-indicator">📱 Mobile Mode</div>
      <div className="player-wrapper">
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          controls={true}
          playing={playing}
          playsInline={true}
          crossOrigin="anonymous"
          width="100%"
          height="100%"
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          onError={(e) => console.log("MobileVideoPlayer error:", e)}
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
                preload: "auto",
                crossOrigin: "anonymous",
              },
            },
          }}
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export default MobileVideoPlayer;
