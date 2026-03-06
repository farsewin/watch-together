import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import NetflixDashboard from "./NetflixDashboard";
import NetflixPlayer from "./NetflixPlayer";
import Room from "./Room";

// Shared socket logic
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : "");

const NetflixWatchParty = () => {
  const [room, setRoom] = useState(null);
  const [socket, setSocket] = useState(null);
  const [content, setContent] = useState(null); // { tmdbId, type, season, episode }
  const [syncState, setSyncState] = useState({ currentTime: 0, playing: true });
  const [isHost, setIsHost] = useState(false);

  // Initialize Socket
  useEffect(() => {
    const s = io(BACKEND_URL, { withCredentials: true });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  // Handle Room Join/State
  const handleRoomJoined = (roomData) => {
    setRoom(roomData);
    // If there's an existing video state in the room, restore it
    if (roomData.videoState && roomData.videoState.tmdbId) {
      setContent({
        tmdbId: roomData.videoState.tmdbId,
        type: roomData.videoState.type,
        season: roomData.videoState.season,
        episode: roomData.videoState.episode
      });
      setSyncState({
        currentTime: roomData.videoState.currentTime || 0,
        playing: roomData.videoState.playing
      });
    }
  };

  // Check if current user is host
  useEffect(() => {
    if (room && socket) {
      setIsHost(room.hostId === socket.id);
    }
  }, [room, socket]);

  // Socket listeners for Netflix events
  useEffect(() => {
    if (!socket) return;

    socket.on("netflix-sync", (data) => {
      console.log("[Netflix] Received sync:", data);
      setContent({
        tmdbId: data.tmdbId,
        type: data.type,
        season: data.season,
        episode: data.episode
      });
      
      // We only update syncState if the drift is significant
      // to avoid iframe reloads on every 'timeupdate'
      setSyncState(prev => {
        const drift = Math.abs(prev.currentTime - data.currentTime);
        if (drift > 5 || data.event === "seeked" || data.event === "play" || data.event === "pause") {
           return { currentTime: data.currentTime, playing: data.playing };
        }
        return prev;
      });
    });

    return () => socket.off("netflix-sync");
  }, [socket]);

  // Host: Broadcast changes
  const handlePlayerStateChange = (state) => {
    if (!isHost || !socket || !room) return;

    // Emit to backend to broadcast to others
    socket.emit("netflix-event", {
      roomId: room.id,
      ...state,
      playing: state.event !== "pause"
    });
  };

  const handleContentSelect = (selectedContent) => {
    setContent(selectedContent);
    if (isHost && socket && room) {
       socket.emit("netflix-event", {
         roomId: room.id,
         event: "load",
         ...selectedContent,
         currentTime: 0,
         playing: true
       });
    }
  };

  if (!room) {
    return <Room onJoined={handleRoomJoined} />;
  }

  return (
    <div className="netflix-page" style={{ background: '#141414', minHeight: '100vh', padding: '20px' }}>
      <div className="netflix-content-wrapper" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {!content ? (
          <NetflixDashboard onSelect={handleContentSelect} />
        ) : (
          <div className="player-section">
            <button 
              onClick={() => setContent(null)} 
              className="back-btn"
              style={{ background: 'transparent', color: '#666', border: 'none', marginBottom: '10px', cursor: 'pointer' }}
            >
              ← Back to Selection
            </button>
            
            <div className="video-viewport" style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                <NetflixPlayer 
                  {...content}
                  isHost={isHost}
                  initialProgress={syncState.currentTime}
                  onStateChange={handlePlayerStateChange}
                />
              </div>
            </div>

            <div className="room-info" style={{ marginTop: '20px', color: '#999', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
               <span>Room: {room.name || room.id}</span>
               <span>{isHost ? "You are the Host" : "Watching as Guest"}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default NetflixWatchParty;
