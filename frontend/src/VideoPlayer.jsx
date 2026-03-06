import { useState, useEffect, useRef, useMemo } from "react";
import VideoJSPlayer from "./VideoJSPlayer";
import socket from "./socket";
import { convertVideoUrl, hasDrifted, getVideoType, convertSubtitleUrl } from "./videoUtils";

function VideoPlayer({ roomId, videoUrl, subtitleUrl, isHost, initialState }) {
  const playerRef = useRef(null);
  const syncedUrl = useMemo(() => convertVideoUrl(videoUrl), [videoUrl]);
  const syncedSubUrl = useMemo(() => convertSubtitleUrl(subtitleUrl), [subtitleUrl]);

  const handlePlayerReady = (player) => {
    playerRef.current = player;
    
    // Apply initial state if available (for guests joining mid-stream)
    if (initialState) {
      player.userInitiated = false;
      player.currentTime(initialState.currentTime);
      if (initialState.playing) {
        player.play().catch(e => console.log("Auto-play blocked", e));
      }
      player.userInitiated = true;
    }
  };

  // Synchronization logic
  useEffect(() => {
    if (!playerRef.current || !roomId) return;

    const player = playerRef.current;

    // Handle incoming synchronization events
    const handleSyncEvent = (data) => {
      // Don't react to our own events
      if (data.senderId === socket.id) return;

      player.userInitiated = false; // Flag to prevent triggering another outgoing event

      if (data.event === "play") {
        player.play().catch(() => {});
      } else if (data.event === "pause") {
        player.pause();
      }

      if (data.currentTime !== undefined) {
        if (hasDrifted(player.currentTime(), data.currentTime)) {
          player.currentTime(data.currentTime);
        }
      }

      player.userInitiated = true;
    };

    socket.on("video-event", handleSyncEvent);
    socket.on("sync", handleSyncEvent); // Heartbeat sync

    return () => {
      socket.off("video-event", handleSyncEvent);
      socket.off("sync", handleSyncEvent);
    };
  }, [roomId]);

  // Outgoing synchronization (only for host)
  const onPlay = (time) => {
    if (isHost && roomId) {
      socket.emit("video-event", { roomId, event: "play", currentTime: time });
    }
  };

  const onPause = (time) => {
    if (isHost && roomId) {
      socket.emit("video-event", { roomId, event: "pause", currentTime: time });
    }
  };

  const onSeek = (time) => {
    if (isHost && roomId) {
      socket.emit("video-event", { roomId, event: "seek", currentTime: time });
    }
  };

  // Optional: Periodic sync heartbeat from host
  useEffect(() => {
    if (!isHost || !playerRef.current || !roomId) return;
    
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player && !player.paused()) {
        socket.emit("sync", { 
          roomId, 
          event: "heartbeat", 
          currentTime: player.currentTime() 
        });
      }
    }, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, [isHost, roomId]);

  const playerOptions = useMemo(() => {
    const type = getVideoType(syncedUrl);
    const isYouTube = type === "video/youtube";
    const subLabel = subtitleUrl.toLowerCase().includes("ar") ? "Arabic Subtitles" : "Subtitles";
    
    return {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      techOrder: isYouTube ? ["youtube"] : ["html5"],
      sources: [{
        src: syncedUrl,
        type: type
      }],
      youtube: {
        ytControls: 0,
        iv_load_policy: 3,
        modestbranding: 1
      },
      tracks: syncedSubUrl ? [{
        kind: 'subtitles',
        src: syncedSubUrl,
        srclang: subtitleUrl.toLowerCase().includes("ar") ? 'ar' : 'en',
        label: subLabel,
        default: true
      }] : []
    };
  }, [syncedUrl, syncedSubUrl, subtitleUrl]);


  return (
    <div className="video-container">
      <div className="player-wrapper">
        <VideoJSPlayer 
          options={playerOptions}
          onReady={handlePlayerReady}
          onPlay={onPlay}
          onPause={onPause}
          onSeek={onSeek}
        />
      </div>
    </div>
  );
}

export default VideoPlayer;

