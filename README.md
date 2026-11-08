# CYP: Control Your Player

CYP is a web-based frontend for [MPD](https://www.musicpd.org/), the Music Player Daemon. You can use it to control the playback without having to install native application(s). It works in modern web browsers, both desktop and mobile.

## Screenshots

![](misc/screen1.png) ![](misc/screen2.png)


## Features
  - Control the playback, queue, volume
  - Save and load playlists
  - Browse the library by artists/albums/directories
  - Display album art via native MPD calls (no need to access the library; requires MPD >= 0.21)
  - [Youtube-dl](https://ytdl-org.github.io/youtube-dl/index.html) integration
  - Dark/Light themes


## Development

The page (`app/js`) and the server (`index.ts`, `fetcher.ts`, shared types in `api.ts`) are TypeScript. `make` type-checks both and rebuilds the files that are committed as JavaScript: `app/cyp.js`, `index.js`, `fetcher.js` and `app/cyp.css`. Run it after changing any source, then commit the built files too, so `node .` keeps working without a build step.

## Installation

Make sure you have a working MPD setup first and Node version >= 10

```sh
git clone https://github.com/ondras/cyp.git && cd cyp
npm i
node .
```

Point your browser to http://localhost:8080 to open the interface. Specifying a custom MPD address can be done:
  1. using `MPD_HOST` and `MPD_PORT` environment variables, or
  1. via a `server` querystring argument (`?server=localhost:6655`).

### Other programs

Optional tools used by some features. Install them on the machine that runs cyp:

- `mpc` - the MPD command-line client. Needed for the second sync to refresh the library after new files arrive.
- `yt-dlp` - YouTube downloads (set `YOUTUBE` to another command if needed; `youtube-dl` is no longer maintained).
- `jq` - used by YouTube search.
- `rsgain` - optional, for auto gain: writes ReplayGain tags to the files the second sync copies (see below).

Example on Debian or Raspberry Pi OS: `sudo apt install mpc jq` and `pip install -U yt-dlp`. rsgain is in the package list of many distributions and at https://github.com/complexlogic/rsgain.

### Folder permissions

cyp runs as a normal user. The second sync writes new files into the MPD music folder, so that user needs write access there. Without it the sync stops at once with "cyp cannot write to ...".

On Debian, MPD's music folder is often owned by `mpd` and not writable by others. One way to fix it: add the cyp user to the `mpd` group and make the folder group-writable:

```sh
sudo usermod -aG mpd $USER          # log out and in afterwards
sudo chmod g+w /var/lib/mpd/music  # or your music_directory
```

Check with `test -w /var/lib/mpd/music && echo writable`. If you run cyp in Docker, mount the music folder read-write.

## Instalation - Docker

Alternatively, you can use Docker to run CYP.

```sh
git clone https://github.com/ondras/cyp.git && cd cyp
docker build -t cyp .
docker run --network=host cyp
```

## Installation - Apache ProxyPass

If you want to run CYP as a service and proxy it through Apache2, you will need to enable several modules.

    # a2enmod proxy
    # a2enmod proxy_http
    # a2enmod proxy_wstunnel
    # a2enmod proxypass


To present CYP in a virutal folder named "music" (https://example.com/music/) add the following to your site config.


    # MPD daemon
	RewriteEngine on						# Enable the RewriteEngine
	RewriteCond %{REQUEST_FILENAME} !-f		# If the requested file isn't a file
	RewriteCond %{REQUEST_FILENAME} !-d		# And if it isn't a directory
	RewriteCond %{REQUEST_URI} .*/music$	# And if they only requested /music instead of /music/
	RewriteRule ^(.+[^/])$ %{REQUEST_URI}/ [QSA,L,R=301] # Then append a trailing slash

	ProxyPass /music/ http://localhost:3366/	# Proxy all request to /music/ to the CYP server (running on the same server as apache)
	ProxyWebsocketFallbackToProxyHttp Off		# Don't fallback to http for WebSocket requests

	# Rewrite WebSocket requests to CYP WebSocket requets, (also converts wss to ws)
	RewriteEngine on
	RewriteCond %{HTTP:Upgrade} websocket [NC]
	RewriteCond %{HTTP:Connection} upgrade [NC]
	RewriteRule ^/music/?(.*) "ws://localhost:3366/$1" [P,L]

## Installation - nginx

    location /music/ {
      proxy_pass_header  Set-Cookie;
      proxy_set_header   Host               $host;
      proxy_set_header   X-Real-IP          $remote_addr;
      proxy_set_header   X-Forwarded-Proto  $scheme;
      proxy_set_header   X-Forwarded-For    $proxy_add_x_forwarded_for;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "Upgrade";
      proxy_set_header Host $host;
      proxy_pass http://localhost:8080/;
    }



## YouTube integration

You need a working [yt-dlp](https://github.com/yt-dlp/yt-dlp) installation (set `YOUTUBE` to another command if needed; the older youtube-dl is no longer maintained). Audio is downloaded into `_youtube` inside the MPD music folder (`music_directory` from `/etc/mpd.conf`), so MPD can play it right away. The name can be changed with `YOUTUBE_DIR`, which can be relative to the music folder or an absolute path inside it.

If you use Docker, mount the MPD music folder into the container.

## Second sync (fetcher)

The server part is written in TypeScript (`fetcher.ts`) and compiled to `fetcher.js` by `make`. Run `make` again after changing it.

Set it up in the Settings page, section **Second sync (from the device app)**: enable it, enter the car app's address and key, then **Save** and **Sync now**. The result appears in the read-only box below the buttons, one item per line.

cyp can pull audio files from the RSS Downloader phone app over the local network. It copies new files into the MPD music folder (the default, from `music_directory`, can be changed), keeping the folder structure of the device app (`Album/CD 1/01.mp3` lands in the same subfolders), tags them with ReplayGain when `rsgain` is enabled, and runs `mpc update` on the folder so MPD sees them. Settings are stored in `fetch.json` (created on first save; the key is kept there, readable only by the owner).

Endpoints: `GET /fetch/settings`, `POST /fetch/settings` (JSON: `enabled`, `url`, `key`, `dir`, `intervalMinutes`, `rsgain`), `POST /fetch/run`. Automatic runs check every minute and sync when the interval has passed.

`rsgain` needs the [rsgain](https://github.com/complexlogic/rsgain) command-line tool, and `mpc` must be installed. With auto gain on, cyp runs `rsgain easy <folder>` on the whole synced folder after each sync that added files. Check that your rsgain version skips files that already have ReplayGain tags; otherwise a large folder takes a long time on every sync.

## Changing the port

...is done via the `PORT` environment variable. If you use Docker, the `-e` switch does the trick:

```sh
docker run --network=host -e PORT=12345 cyp
```

## Password-protected MPD

Create a `passwords.json` file in CYPs home directory. Specify passwords for available MPD servers:

```json
{
  "localhost:6600": "my-pass-1",
  "some.other.server.or.ip:12345": "my-pass-2"
}
```

Make sure that hostnames and ports match those specified via the `server` querystring argument (defaults to `localhost:6600`).

## Technology
  - TypeScript
  - Connected to MPD via WebSockets (using the [ws2mpd](https://github.com/ondras/ws2mpd/) bridge)
  - Token-based access to the WebSocket endpoint (better than an `Origin` check)
  - Written using [*Custom Elements*](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements)
  - Responsive layout via Flexbox
  - CSS Custom Properties
  - SVG icons (Material Design)
  - Can spawn Youtube-dl to search/download audio files
  - Album art retrieved directly from MPD (and cached via localStorage)
