"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var fetcher_exports = {};
__export(fetcher_exports, {
  SyncError: () => SyncError,
  getLibraryStatus: () => getLibraryStatus,
  getProgress: () => getProgress,
  handle: () => handle,
  loadSettings: () => loadSettings,
  mpdMusicDir: () => mpdMusicDir,
  requestStop: () => requestStop,
  saveSettings: () => saveSettings,
  setRunCommand: () => setRunCommand,
  startTimer: () => startTimer,
  syncOnce: () => syncOnce,
  updateLibrary: () => updateLibrary,
  youtubeDirs: () => youtubeDirs
});
module.exports = __toCommonJS(fetcher_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var http = __toESM(require("http"));
var https = __toESM(require("https"));
var import_child_process = require("child_process");
const AUDIO_EXTS = [".mp3", ".flac", ".wav", ".ogg", ".m4a"];
const MIN_KEY_LENGTH = 16;
const TICK_MS = 60 * 1e3;
const FALLBACK_MUSIC_DIR = "/var/lib/mpd/music";
class SyncError extends Error {
  constructor(message, retryable) {
    super(message);
    this.stopped = false;
    this.retryable = retryable;
  }
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
const UPDATE_TIMEOUT_MS = 20 * 60 * 1e3;
let runCommand = (cmd, args) => new Promise((resolve, reject) => {
  (0, import_child_process.execFile)(cmd, args, { timeout: 60 * 60 * 1e3 }, (error, stdout, stderr) => {
    if (error) {
      reject(new Error(`${cmd} failed: ${(stderr || error.message).trim()}`));
    } else {
      resolve(stdout);
    }
  });
});
function setRunCommand(fn) {
  runCommand = fn;
}
function runWithTimeout(cmd, args, ms) {
  return new Promise((resolve, reject) => {
    const timer2 = setTimeout(() => reject(new Error(`${cmd} did not finish within ${Math.round(ms / 1e3)} s`)), ms);
    runCommand(cmd, args).then(
      (out) => {
        clearTimeout(timer2);
        resolve(out);
      },
      (error) => {
        clearTimeout(timer2);
        reject(error);
      }
    );
  });
}
function settingsFile() {
  return process.env.FETCH_SETTINGS || path.join(__dirname, "fetch.json");
}
function mpdMusicDir() {
  const conf = process.env.MPD_CONF || "/etc/mpd.conf";
  try {
    const text = fs.readFileSync(conf, "utf8");
    const match = text.match(/^\s*music_directory\s+"?([^"\r\n]+?)"?\s*$/m);
    if (match == null ? void 0 : match[1]) {
      return match[1];
    }
  } catch (e) {
  }
  return FALLBACK_MUSIC_DIR;
}
function youtubeDirs() {
  const setting = process.env.YOUTUBE_DIR || "_youtube";
  const music = mpdMusicDir();
  if (path.isAbsolute(setting)) {
    const rel = path.relative(music, setting);
    return { rel: rel.startsWith("..") ? setting : rel, abs: setting };
  }
  return { rel: setting, abs: path.join(music, setting) };
}
function defaults() {
  return { enabled: false, url: "", key: "", dir: "", intervalMinutes: 60, rsgain: false };
}
function effectiveDir(settings) {
  return settings.dir || mpdMusicDir();
}
function readSettings(data) {
  if (typeof data != "object" || data === null || Array.isArray(data)) {
    throw new Error("the settings must be an object");
  }
  const expect = (name, value, type, check) => {
    if (value === void 0) {
      return void 0;
    }
    if (!check(value)) {
      throw new Error(`${name} must be ${type}`);
    }
    return value;
  };
  const isBool = (v) => typeof v == "boolean";
  const isString = (v) => typeof v == "string";
  const isNumber = (v) => typeof v == "number";
  const result = {};
  const enabled = expect("enabled", "enabled" in data ? data.enabled : void 0, "true or false", isBool);
  const url = expect("url", "url" in data ? data.url : void 0, "text", isString);
  const key = expect("key", "key" in data ? data.key : void 0, "text", isString);
  const dir = expect("dir", "dir" in data ? data.dir : void 0, "text", isString);
  const intervalMinutes = expect("intervalMinutes", "intervalMinutes" in data ? data.intervalMinutes : void 0, "a number", isNumber);
  const rsgain = expect("rsgain", "rsgain" in data ? data.rsgain : void 0, "true or false", isBool);
  if (enabled !== void 0) {
    result.enabled = enabled;
  }
  if (url !== void 0) {
    result.url = url;
  }
  if (key !== void 0) {
    result.key = key;
  }
  if (dir !== void 0) {
    result.dir = dir;
  }
  if (intervalMinutes !== void 0) {
    result.intervalMinutes = intervalMinutes;
  }
  if (rsgain !== void 0) {
    result.rsgain = rsgain;
  }
  return result;
}
function loadSettings() {
  let saved = {};
  try {
    saved = readSettings(JSON.parse(fs.readFileSync(settingsFile(), "utf8")));
  } catch (e) {
  }
  return { ...defaults(), ...saved };
}
function saveSettings(input) {
  const given = readSettings(input);
  const s = { ...defaults(), ...given };
  s.enabled = Boolean(s.enabled);
  s.rsgain = Boolean(s.rsgain);
  s.url = String(s.url || "").trim().replace(/\/+$/, "");
  s.key = String(s.key || "").trim();
  s.dir = String(s.dir || "").trim();
  s.intervalMinutes = Number(s.intervalMinutes);
  if (s.enabled) {
    if (!/^https?:\/\/[^\s]+$/.test(s.url)) {
      throw new Error("The phone address must start with http:// or https://");
    }
    if (s.key.length < MIN_KEY_LENGTH) {
      throw new Error(`The key must be at least ${MIN_KEY_LENGTH} characters`);
    }
  }
  if (s.dir && !path.isAbsolute(s.dir)) {
    throw new Error("The folder must be an absolute path");
  }
  if (!Number.isInteger(s.intervalMinutes) || s.intervalMinutes < 5 || s.intervalMinutes > 1440) {
    throw new Error("The interval must be between 5 and 1440 minutes");
  }
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), { mode: 384 });
  return s;
}
function stoppedError() {
  const error = new SyncError("stopped", false);
  error.stopped = true;
  return error;
}
function openResponse(url, key) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { headers: { Authorization: `Bearer ${key}` }, timeout: 3e4 }, (res) => {
      var _a;
      if (res.statusCode === 401) {
        res.resume();
        return reject(new SyncError("the phone app rejected the key", false));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new SyncError(`the phone app answered ${res.statusCode}`, ((_a = res.statusCode) != null ? _a : 0) >= 500));
      }
      resolve(res);
    });
    req.on("timeout", () => req.destroy(new SyncError("the phone app did not answer in time", true)));
    req.on("error", (error) => reject(new SyncError(`cannot reach the phone app: ${error.message}`, true)));
  });
}
async function fetchText(url, key) {
  const res = await openResponse(url, key);
  return new Promise((resolve, reject) => {
    let body = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => resolve(body));
    res.on("error", reject);
  });
}
async function downloadTo(url, key, toFile, onBytes) {
  const res = await openResponse(url, key);
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const out = fs.createWriteStream(toFile);
    res.on("data", (chunk) => {
      bytes += chunk.length;
      onBytes(chunk.length);
      if (stopRequested) {
        res.destroy();
        out.destroy();
        reject(stoppedError());
      }
    });
    res.on("error", reject);
    out.on("error", reject);
    out.on("finish", () => resolve(bytes));
    res.pipe(out);
  });
}
function relativeParts(name) {
  if (name.length === 0 || /\\/.test(name)) {
    return null;
  }
  const parts = name.split("/");
  if (parts.some((p) => p === "" || p === "." || p === ".." || p.startsWith("."))) {
    return null;
  }
  return parts;
}
function isSafeAudioName(name) {
  return relativeParts(name) !== null && AUDIO_EXTS.includes(path.extname(name).toLowerCase());
}
function isRemoteFile(data) {
  return typeof data == "object" && data !== null && "name" in data && typeof data.name == "string" && "size" in data && typeof data.size == "number";
}
function localFiles(dir) {
  const files = /* @__PURE__ */ new Map();
  const walk = (current, prefix) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const full = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile()) {
        files.set(rel, fs.statSync(full).size);
      }
    }
  };
  walk(dir, "");
  return files;
}
function removePartFiles(dir) {
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".part")) {
        fs.unlinkSync(full);
      }
    }
  };
  walk(dir);
}
let running = false;
let lastRun = 0;
let stopRequested = false;
function freshProgress() {
  return {
    running: false,
    stopping: false,
    current: "",
    index: 0,
    total: 0,
    bytesDone: 0,
    bytesTotal: 0,
    downloaded: 0,
    alreadyThere: 0,
    conflicts: 0,
    failed: 0,
    libraryFiles: 0,
    librarySize: 0,
    reindexed: false,
    updatingLibrary: false,
    errors: [],
    result: null
  };
}
function emptyResult() {
  return {
    ok: true,
    downloaded: 0,
    alreadyThere: 0,
    conflicts: 0,
    failed: 0,
    reindexed: false,
    stopped: false,
    errors: []
  };
}
const progress = freshProgress();
function getProgress() {
  return { ...progress, errors: [...progress.errors] };
}
function requestStop() {
  if (!running) {
    return false;
  }
  stopRequested = true;
  progress.stopping = true;
  return true;
}
let libraryRunning = null;
let libraryPending = null;
let libraryTail = Promise.resolve();
let libraryLast = { ok: null, error: "" };
function getLibraryStatus() {
  var _a;
  const current = (_a = libraryRunning != null ? libraryRunning : libraryPending == null ? void 0 : libraryPending.request) != null ? _a : null;
  return {
    updating: current !== null,
    source: current ? current.source : null,
    ok: libraryLast.ok,
    error: libraryLast.error
  };
}
function updateLibrary(source, options = {}) {
  var _a;
  const rel = (_a = options.rel) != null ? _a : "";
  if (libraryPending) {
    const waiting = libraryPending.request;
    if (waiting.rel !== rel) {
      waiting.rel = "";
    }
    return libraryPending.done;
  }
  const request = { source, rel };
  const done = libraryTail.then(async () => {
    var _a2;
    libraryPending = null;
    libraryRunning = request;
    const started = Date.now();
    console.log(`library update (${request.source}) started`);
    let outcome;
    try {
      await runWithTimeout("mpc", request.rel ? ["update", "--wait", request.rel] : ["update", "--wait"], UPDATE_TIMEOUT_MS);
      outcome = { ok: true };
    } catch (error) {
      outcome = { ok: false, error: errorMessage(error) };
    }
    libraryRunning = null;
    libraryLast = { ok: outcome.ok, error: (_a2 = outcome.error) != null ? _a2 : "" };
    console.log(`library update (${request.source}) ${outcome.ok ? "finished" : `failed: ${outcome.error}`} after ${Math.round((Date.now() - started) / 1e3)} s`);
    return outcome;
  });
  libraryPending = { request, done };
  libraryTail = done;
  return done;
}
async function syncOnce(settings, log = console.log) {
  var _a, _b;
  if (running) {
    return { ...emptyResult(), ok: false, error: "a sync is already running" };
  }
  if (!settings.enabled) {
    return { ...emptyResult(), ok: false, error: "the app sync is switched off" };
  }
  running = true;
  stopRequested = false;
  lastRun = Date.now();
  Object.assign(progress, freshProgress(), { running: true });
  const result = emptyResult();
  try {
    const dir = effectiveDir(settings);
    if (!fs.existsSync(dir)) {
      throw new SyncError(`folder does not exist: ${dir}`, false);
    }
    try {
      fs.accessSync(dir, fs.constants.W_OK);
    } catch (e) {
      throw new SyncError(`cyp cannot write to ${dir}: give the user that runs cyp write access to this folder (see README, Folder permissions)`, false);
    }
    const remote = JSON.parse(await fetchText(`${settings.url}/api/v1/files`, settings.key));
    if (!Array.isArray(remote)) {
      throw new SyncError("unexpected answer from the phone app", false);
    }
    const remoteFiles = remote.filter(isRemoteFile);
    removePartFiles(dir);
    const local = localFiles(dir);
    for (const [name, size] of local) {
      if (isSafeAudioName(name)) {
        progress.libraryFiles++;
        progress.librarySize += size;
      }
    }
    const todo = [];
    for (const file of remoteFiles.filter((f) => isSafeAudioName(f.name))) {
      const localSize = local.get(file.name);
      if (localSize !== void 0 && (localSize === file.size || file.size <= 0)) {
        result.alreadyThere++;
      } else if (localSize !== void 0) {
        result.conflicts++;
      } else {
        todo.push(file);
      }
    }
    progress.alreadyThere = result.alreadyThere;
    progress.conflicts = result.conflicts;
    progress.total = todo.length;
    progress.bytesTotal = todo.reduce((sum, f) => sum + Math.max(0, f.size), 0);
    const added = [];
    for (const [i, file] of todo.entries()) {
      if (stopRequested) {
        result.stopped = true;
        break;
      }
      progress.index = i + 1;
      progress.current = file.name;
      const parts = (_a = relativeParts(file.name)) != null ? _a : [];
      const dest = path.join(dir, ...parts);
      const part = dest + ".part";
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const url = `${settings.url}/api/v1/files/${parts.map(encodeURIComponent).join("/")}`;
        const bytes = await downloadTo(url, settings.key, part, (n) => {
          progress.bytesDone += n;
        });
        if (file.size > 0 && bytes !== file.size) {
          throw new SyncError(`size mismatch for ${file.name}`, false);
        }
        if (fs.existsSync(dest)) {
          fs.unlinkSync(part);
          result.conflicts++;
          progress.conflicts = result.conflicts;
          continue;
        }
        fs.renameSync(part, dest);
        added.push(file.name);
        result.downloaded++;
        progress.downloaded = result.downloaded;
        progress.libraryFiles++;
        progress.librarySize += Math.max(0, file.size);
      } catch (error) {
        if (fs.existsSync(part)) {
          fs.unlinkSync(part);
        }
        if (error instanceof SyncError && error.stopped || stopRequested) {
          result.stopped = true;
          break;
        }
        if (error instanceof SyncError && error.retryable) {
          throw error;
        }
        result.failed++;
        progress.failed = result.failed;
        const message = `${file.name}: ${errorMessage(error)}`;
        result.errors.push(message);
        progress.errors.push(message);
        log(`sync: failed ${file.name}: ${errorMessage(error)}`);
      }
    }
    if (added.length > 0 && settings.rsgain) {
      await runCommand("rsgain", ["easy", dir]);
      await runCommand("mpc", ["replaygain", "track"]);
    }
    if (added.length > 0) {
      const music = mpdMusicDir();
      const rel = path.relative(music, dir);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        result.errors.push("folder is outside the MPD music folder: run 'mpc update' manually");
      } else {
        progress.updatingLibrary = true;
        const update = await updateLibrary("sync", { rel });
        progress.updatingLibrary = false;
        if (!update.ok) {
          throw new SyncError((_b = update.error) != null ? _b : "mpc update failed", false);
        }
        result.reindexed = true;
        progress.reindexed = true;
      }
    }
    log(`sync: downloaded ${result.downloaded}, already there ${result.alreadyThere}, conflicts ${result.conflicts}, failed ${result.failed}${result.stopped ? ", stopped" : ""}`);
  } catch (error) {
    result.ok = false;
    result.error = errorMessage(error);
    log(`sync: ${result.error}`);
  } finally {
    running = false;
    stopRequested = false;
    lastRun = Date.now();
    progress.running = false;
    progress.stopping = false;
    progress.updatingLibrary = false;
    progress.result = result;
  }
  return result;
}
let timer = null;
function startTimer() {
  if (timer) {
    return;
  }
  lastRun = Date.now();
  timer = setInterval(() => {
    const settings = loadSettings();
    if (!settings.enabled) {
      return;
    }
    if (Date.now() - lastRun < settings.intervalMinutes * 60 * 1e3) {
      return;
    }
    syncOnce(settings).catch(() => {
    });
  }, TICK_MS);
  timer.unref();
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65536) {
        reject(new Error("request too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}
function handle(request, response, url) {
  if (request.method == "GET" && url.pathname == "/fetch/settings") {
    const settings = loadSettings();
    sendJson(response, 200, { ...settings, effectiveDir: effectiveDir(settings), musicDir: mpdMusicDir() });
    return true;
  }
  if (request.method == "POST" && url.pathname == "/fetch/settings") {
    readBody(request).then((body) => {
      try {
        const saved = saveSettings(JSON.parse(body || "{}"));
        sendJson(response, 200, { ok: true, settings: saved });
      } catch (error) {
        sendJson(response, 400, { ok: false, error: errorMessage(error) });
      }
    }).catch((error) => sendJson(response, 400, { ok: false, error: errorMessage(error) }));
    return true;
  }
  if (request.method == "GET" && url.pathname == "/fetch/status") {
    sendJson(response, 200, getProgress());
    return true;
  }
  if (request.method == "GET" && url.pathname == "/library/status") {
    sendJson(response, 200, getLibraryStatus());
    return true;
  }
  if (request.method == "POST" && url.pathname == "/fetch/run") {
    const settings = loadSettings();
    if (!settings.enabled) {
      sendJson(response, 403, { ok: false, error: "the app sync is switched off" });
      return true;
    }
    if (running) {
      sendJson(response, 409, { ok: false, error: "a sync is already running" });
      return true;
    }
    syncOnce(settings).catch(() => {
    });
    sendJson(response, 202, { ok: true, started: true });
    return true;
  }
  if (request.method == "POST" && url.pathname == "/fetch/stop") {
    const stopped = requestStop();
    sendJson(response, stopped ? 200 : 409, stopped ? { ok: true } : { ok: false, error: "no sync is running" });
    return true;
  }
  return false;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SyncError,
  getLibraryStatus,
  getProgress,
  handle,
  loadSettings,
  mpdMusicDir,
  requestStop,
  saveSettings,
  setRunCommand,
  startTimer,
  syncOnce,
  updateLibrary,
  youtubeDirs
});
