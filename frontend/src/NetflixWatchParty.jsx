import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import NetflixDashboard from "./NetflixDashboard";
import NetflixPlayer from "./NetflixPlayer";
import Room from "./Room";

// Shared socket logic
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === "localhost" ? "http://localhost:3001" : "");

const NetflixWatchParty = () => {
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState(""); // Needed for Room component internal state
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
  const handleJoinRoom = (id, hostStatus, videoState) => {
    setRoom({ id }); 
    setIsHost(hostStatus);

    if (videoState && videoState.isNetflix) {
      setContent({
        tmdbId: videoState.tmdbId,
        type: videoState.type,
        season: videoState.season,
        episode: videoState.episode
      });
      setSyncState({
        currentTime: videoState.currentTime || 0,
        playing: videoState.playing
      });
    }
  };

  const handleLeaveRoom = () => {
    setRoom(null);
    setRoomId("");
    setContent(null);
  };

  // Socket listeners for Netflix events
  useEffect(() => {
    if (!socket) return;

    socket.on("netflix-sync", (data) => {
      console.log("[Netflix] Received sync:", data);
      
      // Update content info
      setContent({
        tmdbId: data.tmdbId,
        type: data.type,
        season: data.season,
        episode: data.episode
      });
      
      // Update playback state
      setSyncState(prev => {
        const drift = Math.abs(prev.currentTime - data.currentTime);
        // Only trigger a state update (which reloads iframe) if drift is high or it's a critical event
        if (drift > 10 || data.event === "seeked" || data.event === "load") {
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

    console.log("[Netflix] Host emitting event:", state.event);
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
    return (
      <Room 
        onJoinRoom={handleJoinRoom} 
        onLeaveRoom={handleLeaveRoom}
        roomId={roomId}
        setRoomId={setRoomId}
      />
    );
  }

  return (
    <div className="netflix-page" style={{ background: '#141414', minHeight: '100vh', padding: '20px' }}>
      <div className="netflix-content-wrapper" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {!content ? (
          <NetflixDashboard onSelect={handleContentSelect} />
        ) : (
          <div className="player-section">
            <div className="room-controls" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <button 
                onClick={() => setContent(null)} 
                className="back-btn"
                style={{ background: 'transparent', color: '#e50914', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ← Back to Selection
              </button>
              <button 
                onClick={handleLeaveRoom} 
                className="leave-btn"
                style={{ background: '#333', color: '#fff', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Leave Room
              </button>
            </div>
            
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
               <span>Room ID: {room.id}</span>
               <span>{isHost ? "🎬 You are the Host" : "👁 Watching as Guest"}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default NetflixWatchParty;
