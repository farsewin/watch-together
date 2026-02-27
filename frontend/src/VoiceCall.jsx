import { useState, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
} from "@livekit/components-react";
import "@livekit/components-styles";

const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:3001";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";

function VoiceCall({ roomId, username }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch token when component mounts
    const fetchToken = async () => {
      try {
        const response = await fetch(`${API_URL}/livekit-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId, username }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          setToken(data.token);
        } else {
          setError(data.error || "Failed to fetch voice token");
        }
      } catch (err) {
        console.error("Token fetch error:", err);
        setError("Error connecting to voice server");
      }
    };

    if (roomId && username) {
      fetchToken();
    }
  }, [roomId, username]);

  if (error) {
    return <div className="voice-call-error">Voice Call Error: {error}</div>;
  }

  if (!token) {
    return <div className="voice-call-loading">Connecting to Voice...</div>;
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={LIVEKIT_URL}
      style={{ display: "inline-flex", alignItems: "center", flex: 1, margin: 0, padding: 0 }}
    >
      <ControlBar 
        controls={{ microphone: true, camera: false, screenShare: false, leave: false }} 
        className="custom-livekit-control"
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

export default VoiceCall;
