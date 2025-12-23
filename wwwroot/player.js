const video = document.getElementById('player');
const roleSelect = document.getElementById('role');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');

// Default source - user should replace or add media to /wwwroot/media/movie1
const hlsUrl = '/media/movie1/index.m3u8';

// Setup video source with Hls.js fallback
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

// returns a Promise that resolves when the source is attached/ready
async function attachVideoSrc(url, forceHls = false) {
  console.log('attachVideoSrc', url);
  statusEl.textContent = 'Attaching source: ' + url;
  if (!forceHls && video.canPlayType('application/vnd.apple.mpegurl')) {
    console.log('Browser supports HLS natively');
    video.src = url;
    statusEl.textContent = 'Native HLS: set src to ' + url;
    return Promise.resolve();
  }

  if (!window.Hls) {
    console.log('Hls.js not present, loading from CDN');
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.2/dist/hls.min.js');
      console.log('Hls.js loaded');
    } catch (e) {
      console.error('Failed to load Hls.js', e);
      return Promise.reject(e);
    }
  }

  if (window.Hls) {
    const hls = new Hls();
    hls.on(Hls.Events.ERROR, function (event, data) {
      console.error('Hls.js error', event, data);
    });
    try {
      // fetch playlist first to show network/CORS errors early
      try {
        const r = await fetch(url, { method: 'GET' });
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          console.error('Playlist fetch failed', r.status, text);
          statusEl.textContent = `Playlist fetch failed: ${r.status}`;
          return Promise.reject(new Error('playlist-fetch-failed'));
        }
        statusEl.textContent = 'Playlist fetched OK';
      } catch (fetchErr) {
        console.error('Fetch error for playlist', fetchErr);
        statusEl.textContent = 'Fetch error: ' + fetchErr.message;
        return Promise.reject(fetchErr);
      }

      hls.loadSource(url);
      hls.attachMedia(video);
    } catch (e) {
      console.error('Hls attach failed', e);
      statusEl.textContent = 'Hls attach failed: ' + e.message;
      return Promise.reject(e);
    }

    return new Promise((resolve) => {
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        console.log('Hls manifest parsed');
        statusEl.textContent = 'Hls manifest parsed';
        resolve();
      });
      // also resolve if MEDIA_ATTACHED
      hls.on(Hls.Events.MEDIA_ATTACHED, function () {
        // no-op: wait for manifest parsed
      });
    });
  }

  console.error('No HLS support: install Hls.js or use Safari');
  return Promise.reject(new Error('no-hls'));
}

const attachPromise = attachVideoSrc(hlsUrl).catch(err => {
  console.error('attachVideoSrc failed', err);
});

// Autoplay policies: mute by default so autoplay can start, provide a Start/Unmute button for user gesture
video.muted = true;
startBtn.addEventListener('click', async () => {
  try {
  // wait until HLS source is attached/ready
  await attachPromise;
  video.muted = false;
  await video.play();
    startBtn.style.display = 'none';
  } catch (e) {
    console.error('Play failed', e);
    // If not supported, try forcing Hls.js attach (useful on browsers that claim native HLS but fail)
    if (e && e.name === 'NotSupportedError') {
      console.log('Retrying with Hls.js forced');
      statusEl.textContent = 'Retrying with Hls.js';
      try {
        await attachVideoSrc(hlsUrl, true);
        video.muted = false;
        await video.play();
        startBtn.style.display = 'none';
        return;
      } catch (e2) {
        console.error('Retry play failed', e2);
      }
    }
  }
});

if (typeof signalR === 'undefined') {
  console.error('signalR is not loaded');
}

let connection = new signalR.HubConnectionBuilder().withUrl('/sync').withAutomaticReconnect().build();
let isLeader = roleSelect.value === 'leader';
let lastLeaderTime = 0;

roleSelect.addEventListener('change', () => {
  isLeader = roleSelect.value === 'leader';
});

connection.on('Sync', (action, time) => {
  if (action === 'play') video.play();
  if (action === 'pause') video.pause();
  if (action === 'seek') video.currentTime = time;
  if (action === 'heartbeat') {
    // follower receives leader time
    if (!isLeader) {
      lastLeaderTime = time;
      const diff = Math.abs(video.currentTime - lastLeaderTime);
      if (diff > 0.7) {
        video.currentTime = lastLeaderTime;
      }
    }
  }
});

connection.start().then(() => {
  console.log('SignalR connected');

  // Send events if leader
  video.addEventListener('play', () => {
    if (!isLeader || connection.state !== signalR.HubConnectionState.Connected) return;
    connection.invoke('PlaybackEvent', 'play', video.currentTime).catch(console.error);
  });

  video.addEventListener('pause', () => {
    if (!isLeader || connection.state !== signalR.HubConnectionState.Connected) return;
    connection.invoke('PlaybackEvent', 'pause', video.currentTime).catch(console.error);
  });

  video.addEventListener('seeking', () => {
    if (!isLeader || connection.state !== signalR.HubConnectionState.Connected) return;
    connection.invoke('PlaybackEvent', 'seek', video.currentTime).catch(console.error);
  });

  // Leader heartbeat
  setInterval(() => {
    if (!isLeader || connection.state !== signalR.HubConnectionState.Connected) return;
    connection.invoke('PlaybackEvent', 'heartbeat', video.currentTime).catch(console.error);
  }, 3000);

}).catch(err => console.error('SignalR failed to start', err));
