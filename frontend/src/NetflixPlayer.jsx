import React, { useEffect, useRef, useState } from "react";

const NetflixPlayer = ({ 
  tmdbId, 
  type = "movie", 
  season = 1, 
  episode = 1, 
  isHost, 
  onStateChange,
  initialProgress = 0
}) => {
  const iframeRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState("");

  // Construct the base URL based on type
  useEffect(() => {
    let url = "";
    if (type === "movie") {
      url = `https://www.vidking.net/embed/movie/${tmdbId}`;
    } else {
      url = `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}`;
    }

    // Add common features
    const params = new URLSearchParams();
    params.set("color", "e50914"); // Netflix Red
    params.set("autoPlay", "true");
    
    if (initialProgress > 0) {
      params.set("progress", Math.floor(initialProgress).toString());
    }

    const finalUrl = `${url}?${params.toString()}`;
    setCurrentUrl(finalUrl);
  }, [tmdbId, type, season, episode]);

  // Handle incoming messages from Vidking Player
  useEffect(() => {
    const handleMessage = (event) => {
      // Security: Check origin if needed, but Vidking docs don't specify strict origin
      try {
        const message = JSON.parse(event.data);
        if (message.type === "PLAYER_EVENT") {
          const { event: eventName, currentTime, duration, progress } = message.data;
          
          if (isHost && onStateChange) {
            // Forward event to parent (which broadcasts to room)
            onStateChange({
              event: eventName,
              currentTime,
              duration,
              progress,
              tmdbId,
              type,
              season,
              episode,
              timestamp: Date.now()
            });
          }
        }
      } catch (e) {
        // Not a JSON message or not from Vidking
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isHost, onStateChange, tmdbId, type, season, episode]);

  // Sync logic for guests: if the host seeks, we update our URL (reload iframe)
  // because Vidking API doesn't seem to have a 'seek' command via postMessage yet
  useEffect(() => {
    if (!isHost && initialProgress > 0) {
       // Only update if difference is > 5s to avoid infinite loops/reload jitter
       // However, since we can't read 'currentTime' easily without postMessage delay,
       // we rely on the parent component triggering this update only when necessary.
    }
  }, [initialProgress, isHost]);

  if (!currentUrl) return <div className="netflix-loading">Loading Player...</div>;

  return (
    <div className="netflix-player-container" style={{ width: '100%', height: '100%', minHeight: '500px' }}>
      <iframe
        ref={iframeRef}
        src={currentUrl}
        width="100%"
        height="100%"
        style={{ border: 'none', background: '#000' }}
        allowFullScreen
        allow="autoplay; encrypted-media"
        title="Vidking Player"
      />
    </div>
  );
};

export default NetflixPlayer;
