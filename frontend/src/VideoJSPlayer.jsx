import { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-youtube';

const VideoJSPlayer = (props) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const { options, onReady, onPlay, onPause, onSeek, onTimeUpdate } = props;

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current) {
      // The Video.js player needs to be _inside_ the component el for React 18 Strict Mode. 
      const videoElement = document.createElement("video");
      videoElement.classList.add('video-js', 'vjs-big-play-centered');
      videoElement.setAttribute("referrerpolicy", "no-referrer");
      videoElement.setAttribute("crossorigin", "anonymous");
      videoElement.setAttribute("playsinline", "true");
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        console.log('VideoJSPlayer: Initialized. Tech:', player.techName_);
        onReady && onReady(player);
      });

      // Status logging
      player.on('loadstart', () => console.log('VideoJSPlayer: Loading source:', player.src()));
      player.on('error', () => {
        const error = player.error();
        console.error('VideoJSPlayer: ERROR:', error.code, error.message);
      });

      // Event listeners for synchronization
      player.on('play', () => {
        if (!player.userInitiated) return;
        onPlay && onPlay(player.currentTime());
      });

      player.on('pause', () => {
        if (!player.userInitiated) return;
        onPause && onPause(player.currentTime());
      });

      player.on('seeked', () => {
        if (!player.userInitiated) return;
        onSeek && onSeek(player.currentTime());
      });

      player.on('timeupdate', () => {
        onTimeUpdate && onTimeUpdate(player.currentTime());
      });


    // You could update an existing player in the else block here, on prop change, for example:
    } else {
      const player = playerRef.current;

      player.autoplay(options.autoplay);
      
      // Update source only if changed
      const currentSrc = player.src();
      const newSrc = options.sources[0]?.src;
      if (newSrc && currentSrc !== newSrc) {
        player.src(options.sources);
      }

      // Handle subtitle tracks
      if (options.tracks) {
        // Clear existing tracks
        const existingTracks = player.remoteTextTracks();
        let i = existingTracks.length;
        while (i--) {
          player.removeRemoteTextTrack(existingTracks[i]);
        }
        
        // Add new tracks
        options.tracks.forEach(track => {
          player.addRemoteTextTrack(track, true);
        });
      }
    }
  }, [options, videoRef]);

  // Dispose the player on unmount
  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player>
      <div ref={videoRef} />
    </div>
  );
}

export default VideoJSPlayer;
