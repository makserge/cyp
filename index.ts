// The server: serves the page in app/, the MPD bridge (ws2mpd), YouTube search/download,
// the app sync (fetcher.ts) and the system actions. Compiled to index.js by the Makefile.
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as crypto from "crypto";
import { exec, spawn } from "child_process";
import { Server as StaticServer } from "node-static";
import { logging, ws2mpd, type WebSocketRequest } from "ws2mpd";
import * as fetcher from "./fetcher.js";

const app = new StaticServer("./app");
const port = Number(process.argv[2] || process.env.PORT || 8080);
const youtube = fetcher.youtubeDirs(); // rel: for MPD update, abs: where files are written
const cmd = process.env.YOUTUBE || "yt-dlp";

// one-time tickets for the WebSocket connections of the page
const tickets: string[] = [];

function escape(arg: string) {
	return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function isUrl(str: string) {
	return str.startsWith("https:");
}

function searchYoutube(q: string, limit: string, response: http.ServerResponse) {
	response.setHeader("Content-Type", "text/plain"); // necessary for firefox to read by chunks

	let query: string;
	if (isUrl(q)) {
		console.log("YouTube searching url", q, limit);
		query = escape(q);
	} else {
		console.log("YouTube searching query", q, limit);
		query = escape(`ytsearch${limit}:${q}`);
	}

	const command = `set -o pipefail; ${cmd} -j ${query} | jq "{id,title}" | jq -s .`;

	exec(command, {shell:"bash"}, (error, stdout, stderr) => {
		if (error) {
			// show yt-dlp's own message (stderr), not just "Command failed"
			const message = (stderr || error.message).trim();
			console.log("YouTube search failed:", message);
			response.writeHead(500);
			response.end(message);
		} else {
			response.end(stdout);
		}
	});
}

function downloadYoutube(id: string, response: http.ServerResponse) {
	response.setHeader("Content-Type", "text/plain"); // necessary for firefox to read by chunks

	console.log("YouTube downloading", id);
	const args = [
		"-f", "bestaudio",
		"-o", `${youtube.abs}/%(title)s-%(id)s.%(ext)s`,
		"--",
		id
	];
	fs.mkdirSync(youtube.abs, { recursive: true });
	const child = spawn(cmd, args);

	child.stdout.setEncoding("utf8").on("data", (chunk: string) => response.write(chunk));
	child.stderr.setEncoding("utf8").on("data", (chunk: string) => { console.log(chunk.trimEnd()); response.write(chunk); });

	child.on("error", error => {
		console.log("YouTube download failed to start:", error.message);
		if (!response.headersSent) { response.writeHead(500); }
		response.end(`\n[cyp] FAILED: ${error.message}\n`);
	});

	child.on("close", code => {
		// the page only triggers the MPD update when it sees the "done" line
		response.end(code == 0 ? "\n[cyp] done\n" : `\n[cyp] FAILED: yt-dlp exited with code ${code}\n`);
	});
}

function handleSettings(response: http.ServerResponse) {
	response.setHeader("Content-Type", "application/json");
	const settings = { youtubeDir: youtube.rel };
	response.end(JSON.stringify(settings));
}

function handleYoutubeSearch(url: URL, response: http.ServerResponse) {
	const q = url.searchParams.get("q");
	const limit = url.searchParams.get("limit") || "";
	if (q) {
		searchYoutube(q, limit, response);
	} else {
		response.writeHead(404);
		response.end();
	}
}

function handleYoutubeDownload(request: http.IncomingMessage, response: http.ServerResponse) {
	let str = "";
	request.setEncoding("utf8");
	request.on("data", (chunk: string) => str += chunk);
	request.on("end", () => {
		const id = new URLSearchParams(str).get("id");
		if (id) {
			downloadYoutube(id, response);
		} else {
			response.writeHead(404);
			response.end();
		}
	});
}

function handleTicket(request: http.IncomingMessage, response: http.ServerResponse) {
	request.resume().on("end", () => {
		const ticket = crypto.randomBytes(16).toString("hex");
		tickets.push(ticket);
		if (tickets.length > 10) { tickets.shift(); }

		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ticket}));
	});
}

function handleShutdown(response: http.ServerResponse) {
	console.log("System shutdown requested");
	response.setHeader("Content-Type", "application/json");
	response.end(JSON.stringify({ ok: true }));

	exec("sudo /usr/sbin/shutdown -h now", (error, _stdout, stderr) => {
		if (error) { console.log("Shutdown error", error, stderr); }
	});
}

function handleRefresh(response: http.ServerResponse) {
	console.log("Refresh requested: updating MPD database");
	response.setHeader("Content-Type", "application/json");

	// Answers at once: the update can take minutes, and the page follows it through /library/status.
	// Shares the update with the app sync: a refresh during a sync update waits for it, nothing runs twice
	fetcher.updateLibrary("refresh").then(result => {
		if (!result.ok) { console.log("Refresh error", result.error); }
	});
	response.end(JSON.stringify({ ok: true }));
}

function onRequest(request: http.IncomingMessage, response: http.ServerResponse) {
	const url = new URL(request.url ?? "/", "http://localhost");
	if (fetcher.handle(request, response, url)) { return; }

	const method = request.method;
	const pathname = url.pathname;

	if (method == "GET" && pathname == "/youtube") { return handleYoutubeSearch(url, response); }
	if (method == "POST" && pathname == "/youtube") { return handleYoutubeDownload(request, response); }
	if (method == "GET" && pathname == "/settings") { return handleSettings(response); }
	if (method == "POST" && pathname == "/ticket") { return handleTicket(request, response); }
	if (method == "POST" && pathname == "/shutdown") { return handleShutdown(response); }
	if (method == "POST" && pathname == "/refresh") { return handleRefresh(response); }

	request.on("end", () => app.serve(request, response)).resume();
}

// ws2mpd asks this for every WebSocket connection: each page gets its own ticket, used once
function requestValidator(request: WebSocketRequest): boolean {
	const ticket = request.resourceURL.query["ticket"];
	const index = tickets.indexOf(ticket ?? "");
	if (index > -1) {
		tickets.splice(index, 1);
		return true;
	}
	return false;
}

// MPD passwords by "host:port", from passwords.json next to this file (optional)
function loadPasswords(): Record<string, string> {
	try {
		const data: unknown = JSON.parse(fs.readFileSync(path.join(__dirname, "passwords.json"), "utf8"));
		if (typeof data == "object" && data !== null && !Array.isArray(data)) {
			const passwords: Record<string, string> = {};
			for (const [server, password] of Object.entries(data)) {
				if (typeof password == "string") { passwords[server] = password; }
			}
			console.log("loaded passwords.json file");
			return passwords;
		}
	} catch (e) {
		// no file
	}
	console.log("no passwords.json found");
	return {};
}

// Logs when this process stops answering for a moment, to tell a busy server from a busy device
let lastTick = Date.now();
setInterval(() => {
	const now = Date.now();
	const lag = now - lastTick - 1000;
	lastTick = now;
	if (lag > 500) { console.log(`server was busy for ${lag} ms`); }
}, 1000).unref();

const httpServer = http.createServer(onRequest).listen(port, "0.0.0.0");
const passwords = loadPasswords();
console.log("youtube download dir:", youtube.abs);
ws2mpd(httpServer, requestValidator, passwords);
logging(false);
fetcher.startTimer();
