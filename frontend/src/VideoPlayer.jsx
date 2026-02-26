import { useState } from "react";
import MobileVideoPlayer from "./MobileVideoPlayer";
import PCVideoPlayer from "./PCVideoPlayer";

// Detect mobile device
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

function VideoPlayer({ roomId, videoUrl, isHost, initialState }) {
  const [mobile] = useState(isMobile());

  if (mobile) {
    return (
      <MobileVideoPlayer
        roomId={roomId}
        videoUrl={videoUrl}
        isHost={isHost}
        initialState={initialState}
      />
    );
  }

  return (
    <PCVideoPlayer
      roomId={roomId}
      videoUrl={videoUrl}
      isHost={isHost}
      initialState={initialState}
    />
  );
}

export default VideoPlayer;
