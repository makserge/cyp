"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var http = __toESM(require("http"));
var crypto = __toESM(require("crypto"));
var import_child_process = require("child_process");
var import_node_static = require("node-static");
var import_ws2mpd = require("ws2mpd");
var fetcher = __toESM(require("./fetcher.js"));
const app = new import_node_static.Server("./app");
const port = Number(process.argv[2] || process.env.PORT || 8080);
const youtube = fetcher.youtubeDirs();
const cmd = process.env.YOUTUBE || "yt-dlp";
const tickets = [];
function escape(arg) {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}
function isUrl(str) {
  return str.startsWith("https:");
}
function searchYoutube(q, limit, response) {
  response.setHeader("Content-Type", "text/plain");
  let query;
  if (isUrl(q)) {
    console.log("YouTube searching url", q, limit);
    query = escape(q);
  } else {
    console.log("YouTube searching query", q, limit);
    query = escape(`ytsearch${limit}:${q}`);
  }
  const command = `set -o pipefail; ${cmd} -j ${query} | jq "{id,title}" | jq -s .`;
  (0, import_child_process.exec)(command, { shell: "bash" }, (error, stdout, stderr) => {
    if (error) {
      const message = (stderr || error.message).trim();
      console.log("YouTube search failed:", message);
      response.writeHead(500);
      response.end(message);
    } else {
      response.end(stdout);
    }
  });
}
function downloadYoutube(id, response) {
  response.setHeader("Content-Type", "text/plain");
  console.log("YouTube downloading", id);
  const args = [
    "-f",
    "bestaudio",
    "-o",
    `${youtube.abs}/%(title)s-%(id)s.%(ext)s`,
    "--",
    id
  ];
  fs.mkdirSync(youtube.abs, { recursive: true });
  const child = (0, import_child_process.spawn)(cmd, args);
  child.stdout.setEncoding("utf8").on("data", (chunk) => response.write(chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    console.log(chunk.trimEnd());
    response.write(chunk);
  });
  child.on("error", (error) => {
    console.log("YouTube download failed to start:", error.message);
    if (!response.headersSent) {
      response.writeHead(500);
    }
    response.end(`
[cyp] FAILED: ${error.message}
`);
  });
  child.on("close", (code) => {
    response.end(code == 0 ? "\n[cyp] done\n" : `
[cyp] FAILED: yt-dlp exited with code ${code}
`);
  });
}
function handleSettings(response) {
  response.setHeader("Content-Type", "application/json");
  const settings = { youtubeDir: youtube.rel };
  response.end(JSON.stringify(settings));
}
function handleYoutubeSearch(url, response) {
  const q = url.searchParams.get("q");
  const limit = url.searchParams.get("limit") || "";
  if (q) {
    searchYoutube(q, limit, response);
  } else {
    response.writeHead(404);
    response.end();
  }
}
function handleYoutubeDownload(request, response) {
  let str = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => str += chunk);
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
function handleTicket(request, response) {
  request.resume().on("end", () => {
    const ticket = crypto.randomBytes(16).toString("hex");
    tickets.push(ticket);
    if (tickets.length > 10) {
      tickets.shift();
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ticket }));
  });
}
function handleShutdown(response) {
  console.log("System shutdown requested");
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ ok: true }));
  (0, import_child_process.exec)("sudo /usr/sbin/shutdown -h now", (error, _stdout, stderr) => {
    if (error) {
      console.log("Shutdown error", error, stderr);
    }
  });
}
function handleRefresh(response) {
  console.log("Refresh requested: updating MPD database");
  response.setHeader("Content-Type", "application/json");
  fetcher.updateLibrary("refresh").then((result) => {
    if (!result.ok) {
      console.log("Refresh error", result.error);
    }
  });
  response.end(JSON.stringify({ ok: true }));
}
function onRequest(request, response) {
  var _a;
  const url = new URL((_a = request.url) != null ? _a : "/", "http://localhost");
  if (fetcher.handle(request, response, url)) {
    return;
  }
  const method = request.method;
  const pathname = url.pathname;
  if (method == "GET" && pathname == "/youtube") {
    return handleYoutubeSearch(url, response);
  }
  if (method == "POST" && pathname == "/youtube") {
    return handleYoutubeDownload(request, response);
  }
  if (method == "GET" && pathname == "/settings") {
    return handleSettings(response);
  }
  if (method == "POST" && pathname == "/ticket") {
    return handleTicket(request, response);
  }
  if (method == "POST" && pathname == "/shutdown") {
    return handleShutdown(response);
  }
  if (method == "POST" && pathname == "/refresh") {
    return handleRefresh(response);
  }
  request.on("end", () => app.serve(request, response)).resume();
}
function requestValidator(request) {
  const ticket = request.resourceURL.query["ticket"];
  const index = tickets.indexOf(ticket != null ? ticket : "");
  if (index > -1) {
    tickets.splice(index, 1);
    return true;
  }
  return false;
}
function loadPasswords() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "passwords.json"), "utf8"));
    if (typeof data == "object" && data !== null && !Array.isArray(data)) {
      const passwords2 = {};
      for (const [server, password] of Object.entries(data)) {
        if (typeof password == "string") {
          passwords2[server] = password;
        }
      }
      console.log("loaded passwords.json file");
      return passwords2;
    }
  } catch (e) {
  }
  console.log("no passwords.json found");
  return {};
}
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const lag = now - lastTick - 1e3;
  lastTick = now;
  if (lag > 500) {
    console.log(`server was busy for ${lag} ms`);
  }
}, 1e3).unref();
const httpServer = http.createServer(onRequest).listen(port, "0.0.0.0");
const passwords = loadPasswords();
console.log("youtube download dir:", youtube.abs);
(0, import_ws2mpd.ws2mpd)(httpServer, requestValidator, passwords);
(0, import_ws2mpd.logging)(false);
fetcher.startTimer();
