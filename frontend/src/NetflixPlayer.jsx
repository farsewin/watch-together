import React, { useEffect, useRef, useState } from "react";

const NetflixPlayer = ({ 
  tmdbId, 
  type = "movie", 
  season = 1, 
  episode = 1, 
  subtitleUrl = "",
  isHost, 
  onStateChange,
  initialProgress = 0
}) => {
  const iframeRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [videoTime, setVideoTime] = useState(0);
  const [cues, setCues] = useState([]);
  const [activeCue, setActiveCue] = useState(null);

  // Helper to parse VTT
  const parseVTT = (text) => {
    const cuesList = [];
    const blocks = text.split(/\r?\n\r?\n/);
    
    const parseTime = (timeStr) => {
      if (!timeStr) return 0;
      const parts = timeStr.trim().split(':');
      let seconds = 0;
      if (parts.length === 3) {
        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
      } else if (parts.length === 2) {
        seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
      }
      return seconds;
    };

    for (const block of blocks) {
      if (block.includes('-->')) {
        const lines = block.split(/\r?\n/);
        const timeLine = lines.find(l => l.includes('-->'));
        if (timeLine) {
          const [start, end] = timeLine.split(' --> ');
          const textLine = lines.slice(lines.indexOf(timeLine) + 1).join('\n').replace(/<[^>]+>/g, '');
          if (textLine.trim()) {
            cuesList.push({
              start: parseTime(start),
              end: parseTime(end),
              text: textLine.trim()
            });
          }
        }
      }
    }
    return cuesList;
  };

  // Fetch and parse subtitles
  useEffect(() => {
    if (!subtitleUrl) {
      setCues([]);
      return;
    }

    const loadSubtitles = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
        const proxyUrl = `${backendUrl}/subtitle-vtt?url=${encodeURIComponent(subtitleUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const text = await response.text();
          const parsedCues = parseVTT(text);
          console.log(`[Netflix] Loaded ${parsedCues.length} subtitles cues`);
          setCues(parsedCues);
        }
      } catch (err) {
        console.error("Failed to load subtitles:", err);
      }
    };

    loadSubtitles();
  }, [subtitleUrl]);

  // Update active cue based on videoTime
  useEffect(() => {
    if (cues.length === 0) {
      setActiveCue(null);
      return;
    }

    const currentCue = cues.find(c => videoTime >= c.start && videoTime <= c.end);
    if (currentCue !== activeCue) {
      setActiveCue(currentCue);
    }
  }, [videoTime, cues]);

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
      try {
        const message = JSON.parse(event.data);
        if (message.type === "PLAYER_EVENT") {
          const { event: eventName, currentTime, duration, progress } = message.data;
          
          // Update local time for subtitle sync
          if (currentTime !== undefined) {
            setVideoTime(currentTime);
          }

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
      } catch (e) { }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isHost, onStateChange, tmdbId, type, season, episode]);

  if (!currentUrl) return <div className="netflix-loading">Loading Player...</div>;

  return (
    <div className="netflix-player-container" style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
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
      
      {/* Subtitle Overlay */}
      {activeCue && (
        <div 
          className="subtitle-overlay"
          style={{
            position: 'absolute',
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            background: 'rgba(0,0,0,0.6)',
            padding: '10px 20px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '1.4rem',
            fontWeight: 'bold',
            textShadow: '2px 2px 4px rgba(0,0,0,1)',
            maxWidth: '80%',
            zIndex: 10,
            pointerEvents: 'none' // Click through overlay
          }}
        >
          {activeCue.text}
        </div>
      )}
    </div>
  );
};

export default NetflixPlayer;
