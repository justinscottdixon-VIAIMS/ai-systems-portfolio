let apiPromise;

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    const timeout = setTimeout(() => fail(new Error('YouTube API timed out')), 15000);
    function fail(error) {
      clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      script.remove();
      apiPromise = undefined;
      reject(error);
    }
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previous;
      resolve(window.YT);
      previous?.();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => fail(new Error('YouTube API could not load'));
    document.head.append(script);
  });
  return apiPromise;
}

// Muting is asynchronous across the iframe boundary. Confirm it before autoplay.
export async function startYoutubePlayback(player, muted = true, {
  isCurrent = () => true,
  wait = () => new Promise(resolve => setTimeout(resolve, 50)),
} = {}) {
  if (!isCurrent()) return false;
  if (muted) {
    player.mute();
    for (let attempt = 0; attempt < 40 && isCurrent(); attempt++) {
      if (player.isMuted()) {
        player.playVideo();
        return true;
      }
      await wait();
    }
    return false;
  }
  player.unMute();
  player.playVideo();
  return true;
}

export function connectYoutubePlayer(iframe, { muted, onError = () => {} }) {
  let cancelled = false;
  let player;
  const isCurrent = () => !cancelled && iframe.isConnected;
  void loadYoutubeApi().then(YT => {
    if (!isCurrent()) return;
    player = new YT.Player(iframe, {
      events: {
        onReady: async event => {
          try {
            const started = await startYoutubePlayback(event.target, muted, { isCurrent });
            if (!started && isCurrent()) onError();
          } catch { if (isCurrent()) onError(); }
        },
        onError: () => { if (isCurrent()) onError(); },
      },
    });
  }).catch(() => { if (isCurrent()) onError(); });
  return () => {
    cancelled = true;
    player?.destroy();
  };
}
