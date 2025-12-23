# Watch Together - Minimal ASP.NET + SignalR HLS demo

This repository shows a tiny, no-framework web app to serve HLS media files
and sync playback between two browsers using SignalR.

Quick steps

1. Convert a local MP4 to HLS with ffmpeg (example):

```powershell
ffmpeg -i movie.mp4 -codec:v h264 -codec:a aac -hls_time 4 -hls_playlist_type vod -hls_segment_filename "segment%d.ts" index.m3u8
```

Put the generated `index.m3u8` and `segment*.ts` files into `wwwroot/media/movie1/`.

2. Run the app (requires .NET 8 SDK):

```powershell
dotnet run
```

3. Open http://localhost:5000 in your browser. Set one browser to `Leader` and the other to `Follower`.

4. To expose to the internet, use Cloudflare Tunnel (or other tunneling solution):

```powershell
cloudflared tunnel --url http://localhost:5000
```

Then share the provided cloudflared URL with your friend.

Notes

- Leader is hardcoded via the role dropdown; pick leader in one browser.
- The server only relays events — video is streamed directly from the server to each client.
- This is intentionally minimal. For production, add auth, reconnection strategies, and a reliable leader election.
