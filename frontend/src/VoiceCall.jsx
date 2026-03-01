import { useState, useEffect, useMemo } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";
import socket from "./socket";

const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:3001";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";

function VoiceCallContent({ className }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  
  useEffect(() => {
    if (!localParticipant) return;

    const handleForceMute = ({ mutedBy }) => {
      console.log(`Force mute received from ${mutedBy}`);
      localParticipant.setMicrophoneEnabled(false);
      alert(`${mutedBy} (Host) has muted you.`);
    };

    socket.on("force-mute", handleForceMute);

    return () => {
      socket.off("force-mute", handleForceMute);
    };
  }, [localParticipant]);

  // Get list of all speakers (including local)
  const speakers = useMemo(() => {
    return participants
      .filter(p => p.isSpeaking)
      .map(p => p.identity);
  }, [participants]);

  const isLocalSpeaking = localParticipant?.isSpeaking;

  return (
    <div className="voice-call-interface">
      <ControlBar 
        controls={{ microphone: true, camera: false, screenShare: false, leave: false }} 
        className={`${className} ${isLocalSpeaking ? "is-speaking" : ""}`}
      />
      {speakers.length > 0 && (
        <div className="active-speakers">
          <span className="speaking-dot"></span>
          {speakers.join(", ")} is talking...
        </div>
      )}
      <RoomAudioRenderer />
    </div>
  );
}

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
      <VoiceCallContent className="custom-livekit-control" />
    </LiveKitRoom>
  );
}

export default VoiceCall;
