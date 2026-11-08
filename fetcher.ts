// App sync: pulls audio files from the device app (RSS Downloader / car app) and adds them to the MPD music folder.
// Settings live in fetch.json (created on first save). Enable, URL, key, folder and interval are configurable.
// Compiled to fetcher.js by the Makefile (esbuild); index.js loads the compiled file.
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";
import { execFile } from "child_process";
import type { FetchProgress, FetchSettings, LibraryStatus, SyncResult } from "./api.js";

type Settings = FetchSettings;
type Progress = FetchProgress;

const AUDIO_EXTS = [".mp3", ".flac", ".wav", ".ogg", ".m4a"];
const MIN_KEY_LENGTH = 16;
const TICK_MS = 60 * 1000;
const FALLBACK_MUSIC_DIR = "/var/lib/mpd/music";

interface RemoteFile {
	name: string;
	size: number;
}

type RunCommand = (cmd: string, args: string[]) => Promise<string>;
type Log = (message: string) => void;

export class SyncError extends Error {
	retryable: boolean;
	stopped = false;

	constructor(message: string, retryable: boolean) {
		super(message);
		this.retryable = retryable;
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

// How long the MPD update may take before it gives up. A huge library must not block the queue
// forever: the next refresh or sync then runs normally.
const UPDATE_TIMEOUT_MS = 20 * 60 * 1000;

// Replaceable for tests
let runCommand: RunCommand = (cmd, args) => new Promise((resolve, reject) => {
	execFile(cmd, args, { timeout: 60 * 60 * 1000 }, (error, stdout, stderr) => {
		if (error) { reject(new Error(`${cmd} failed: ${(stderr || error.message).trim()}`)); }
		else { resolve(stdout); }
	});
});

export function setRunCommand(fn: RunCommand): void { runCommand = fn; }

// Runs a command and gives up after ms, even if the command itself is stuck (e.g. in an uninterruptible mount)
function runWithTimeout(cmd: string, args: string[], ms: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`${cmd} did not finish within ${Math.round(ms / 1000)} s`)), ms);
		runCommand(cmd, args).then(
			out => { clearTimeout(timer); resolve(out); },
			error => { clearTimeout(timer); reject(error); },
		);
	});
}

function settingsFile(): string {
	return process.env.FETCH_SETTINGS || path.join(__dirname, "fetch.json");
}

// The default music folder: music_directory from the MPD config
export function mpdMusicDir(): string {
	const conf = process.env.MPD_CONF || "/etc/mpd.conf";
	try {
		const text = fs.readFileSync(conf, "utf8");
		const match = text.match(/^\s*music_directory\s+"?([^"\r\n]+?)"?\s*$/m);
		if (match?.[1]) { return match[1]; }
	} catch (e) {
		// no readable MPD config: use the usual Debian location
	}
	return FALLBACK_MUSIC_DIR;
}

// YouTube downloads go into the MPD music folder (MPD only sees files there).
// rel is for MPD "update" (relative to the music folder), abs is where files are written
export function youtubeDirs(): { rel: string; abs: string } {
	const setting = process.env.YOUTUBE_DIR || "_youtube";
	const music = mpdMusicDir();
	if (path.isAbsolute(setting)) {
		const rel = path.relative(music, setting);
		return { rel: rel.startsWith("..") ? setting : rel, abs: setting };
	}
	return { rel: setting, abs: path.join(music, setting) };
}

function defaults(): Settings {
	return { enabled: false, url: "", key: "", dir: "", intervalMinutes: 60, rsgain: false };
}

function effectiveDir(settings: Settings): string {
	return settings.dir || mpdMusicDir();
}

// Reads the settings fields that are present; a field of the wrong type is an error for the settings page
function readSettings(data: unknown): Partial<Settings> {
	if (typeof data != "object" || data === null || Array.isArray(data)) { throw new Error("the settings must be an object"); }

	const expect = <T>(name: string, value: unknown, type: string, check: (v: unknown) => v is T): T | undefined => {
		if (value === undefined) { return undefined; }
		if (!check(value)) { throw new Error(`${name} must be ${type}`); }
		return value;
	};
	const isBool = (v: unknown): v is boolean => typeof v == "boolean";
	const isString = (v: unknown): v is string => typeof v == "string";
	const isNumber = (v: unknown): v is number => typeof v == "number";

	const result: Partial<Settings> = {};
	const enabled = expect("enabled", "enabled" in data ? data.enabled : undefined, "true or false", isBool);
	const url = expect("url", "url" in data ? data.url : undefined, "text", isString);
	const key = expect("key", "key" in data ? data.key : undefined, "text", isString);
	const dir = expect("dir", "dir" in data ? data.dir : undefined, "text", isString);
	const intervalMinutes = expect("intervalMinutes", "intervalMinutes" in data ? data.intervalMinutes : undefined, "a number", isNumber);
	const rsgain = expect("rsgain", "rsgain" in data ? data.rsgain : undefined, "true or false", isBool);

	if (enabled !== undefined) { result.enabled = enabled; }
	if (url !== undefined) { result.url = url; }
	if (key !== undefined) { result.key = key; }
	if (dir !== undefined) { result.dir = dir; }
	if (intervalMinutes !== undefined) { result.intervalMinutes = intervalMinutes; }
	if (rsgain !== undefined) { result.rsgain = rsgain; }
	return result;
}

export function loadSettings(): Settings {
	let saved: Partial<Settings> = {};
	try {
		saved = readSettings(JSON.parse(fs.readFileSync(settingsFile(), "utf8")));
	} catch (e) {
		// no settings saved yet, or the file is not readable: the defaults apply
	}
	return { ...defaults(), ...saved };
}

// Validates and stores settings. Throws an Error with a message for the settings page.
export function saveSettings(input: unknown): Settings {
	const given = readSettings(input);
	const s: Settings = { ...defaults(), ...given };
	s.enabled = Boolean(s.enabled);
	s.rsgain = Boolean(s.rsgain);
	s.url = String(s.url || "").trim().replace(/\/+$/, "");
	s.key = String(s.key || "").trim();
	s.dir = String(s.dir || "").trim();
	s.intervalMinutes = Number(s.intervalMinutes);

	if (s.enabled) {
		if (!/^https?:\/\/[^\s]+$/.test(s.url)) { throw new Error("The phone address must start with http:// or https://"); }
		if (s.key.length < MIN_KEY_LENGTH) { throw new Error(`The key must be at least ${MIN_KEY_LENGTH} characters`); }
	}
	if (s.dir && !path.isAbsolute(s.dir)) { throw new Error("The folder must be an absolute path"); }
	if (!Number.isInteger(s.intervalMinutes) || s.intervalMinutes < 5 || s.intervalMinutes > 1440) {
		throw new Error("The interval must be between 5 and 1440 minutes");
	}
	fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), { mode: 0o600 });
	return s;
}

function stoppedError(): SyncError {
	const error = new SyncError("stopped", false);
	error.stopped = true;
	return error;
}

// Opens a GET request to the device app. Status codes become SyncErrors
function openResponse(url: string, key: string): Promise<http.IncomingMessage> {
	return new Promise((resolve, reject) => {
		const lib = url.startsWith("https:") ? https : http;
		const req = lib.get(url, { headers: { Authorization: `Bearer ${key}` }, timeout: 30000 }, res => {
			if (res.statusCode === 401) {
				res.resume();
				return reject(new SyncError("the phone app rejected the key", false));
			}
			if (res.statusCode !== 200) {
				res.resume();
				return reject(new SyncError(`the phone app answered ${res.statusCode}`, (res.statusCode ?? 0) >= 500));
			}
			resolve(res);
		});
		req.on("timeout", () => req.destroy(new SyncError("the phone app did not answer in time", true)));
		req.on("error", error => reject(new SyncError(`cannot reach the phone app: ${error.message}`, true)));
	});
}

// Text of a response, e.g. the file list
async function fetchText(url: string, key: string): Promise<string> {
	const res = await openResponse(url, key);
	return new Promise((resolve, reject) => {
		let body = "";
		res.setEncoding("utf8");
		res.on("data", (chunk: string) => { body += chunk; });
		res.on("end", () => resolve(body));
		res.on("error", reject);
	});
}

// Writes a file to toFile and returns the number of bytes. onBytes is called per chunk;
// a stop request ends the transfer between chunks
async function downloadTo(url: string, key: string, toFile: string, onBytes: (n: number) => void): Promise<number> {
	const res = await openResponse(url, key);
	return new Promise((resolve, reject) => {
		let bytes = 0;
		const out = fs.createWriteStream(toFile);
		res.on("data", (chunk: Buffer) => {
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

// Path parts of a relative name such as "Album/CD 1/01.mp3", or null if unsafe.
// Absolute paths, "..", and hidden names are refused, so nothing is written outside the music folder.
function relativeParts(name: string): string[] | null {
	if (name.length === 0 || /\\/.test(name)) { return null; }
	const parts = name.split("/");
	if (parts.some(p => p === "" || p === "." || p === ".." || p.startsWith("."))) { return null; }
	return parts;
}

function isSafeAudioName(name: string): boolean {
	return relativeParts(name) !== null && AUDIO_EXTS.includes(path.extname(name).toLowerCase());
}

function isRemoteFile(data: unknown): data is RemoteFile {
	return typeof data == "object" && data !== null
		&& "name" in data && typeof data.name == "string"
		&& "size" in data && typeof data.size == "number";
}

// Every file below dir, keyed by its relative path ("Album/CD 1/01.mp3"), with its size
function localFiles(dir: string): Map<string, number> {
	const files = new Map<string, number>();
	const walk = (current: string, prefix: string): void => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			if (entry.name.startsWith(".")) { continue; }
			const full = path.join(current, entry.name);
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) { walk(full, rel); }
			else if (entry.isFile()) { files.set(rel, fs.statSync(full).size); }
		}
	};
	walk(dir, "");
	return files;
}

// Leftovers of interrupted copies (.part) anywhere below dir
function removePartFiles(dir: string): void {
	const walk = (current: string): void => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) { walk(full); }
			else if (entry.name.endsWith(".part")) { fs.unlinkSync(full); }
		}
	};
	walk(dir);
}

let running = false;
let lastRun = 0;
let stopRequested = false;

function freshProgress(): Progress {
	return {
		running: false, stopping: false, current: "", index: 0, total: 0,
		bytesDone: 0, bytesTotal: 0, downloaded: 0, alreadyThere: 0, conflicts: 0, failed: 0,
		libraryFiles: 0, librarySize: 0, reindexed: false, updatingLibrary: false, errors: [], result: null,
	};
}

function emptyResult(): SyncResult {
	return {
		ok: true, downloaded: 0, alreadyThere: 0, conflicts: 0, failed: 0,
		reindexed: false, stopped: false, errors: [],
	};
}

// What the settings page shows while a sync runs
const progress: Progress = freshProgress();

export function getProgress(): Progress {
	return { ...progress, errors: [...progress.errors] };
}

// Asks the running sync to stop after the current chunk. Files already copied are kept and added to MPD
export function requestStop(): boolean {
	if (!running) { return false; }
	stopRequested = true;
	progress.stopping = true;
	return true;
}

// MPD library updates run one at a time. "Refresh content" (full update) and the app sync
// (update of its folder) both come through here. A request that arrives while an update runs waits
// for it and then runs its own update, so files copied after the running update are still added.
// Requests that are still waiting are merged into one run, so the same update never runs twice.
interface UpdateRequest {
	source: "refresh" | "sync";
	rel: string; // "" = the whole library
}

interface UpdateOutcome {
	ok: boolean;
	error?: string;
}

interface PendingUpdate {
	request: UpdateRequest;
	done: Promise<UpdateOutcome>;
}

let libraryRunning: UpdateRequest | null = null;
let libraryPending: PendingUpdate | null = null;
let libraryTail: Promise<unknown> = Promise.resolve();
let libraryLast: { ok: boolean | null; error: string } = { ok: null, error: "" };

export function getLibraryStatus(): LibraryStatus {
	const current = libraryRunning ?? libraryPending?.request ?? null;
	return {
		updating: current !== null,
		source: current ? current.source : null,
		ok: libraryLast.ok,
		error: libraryLast.error,
	};
}

export function updateLibrary(source: "refresh" | "sync", options: { rel?: string } = {}): Promise<UpdateOutcome> {
	const rel = options.rel ?? "";

	if (libraryPending) {
		// not started yet: this request is covered by that run
		const waiting = libraryPending.request;
		if (waiting.rel !== rel) { waiting.rel = ""; } // different folders: update the whole library
		return libraryPending.done;
	}

	const request: UpdateRequest = { source, rel };
	const done = libraryTail.then(async (): Promise<UpdateOutcome> => {
		libraryPending = null;
		libraryRunning = request;
		const started = Date.now();
		console.log(`library update (${request.source}) started`);
		let outcome: UpdateOutcome;
		try {
			await runWithTimeout("mpc", request.rel ? ["update", "--wait", request.rel] : ["update", "--wait"], UPDATE_TIMEOUT_MS);
			outcome = { ok: true };
		} catch (error) {
			outcome = { ok: false, error: errorMessage(error) };
		}
		libraryRunning = null;
		libraryLast = { ok: outcome.ok, error: outcome.error ?? "" };
		console.log(`library update (${request.source}) ${outcome.ok ? "finished" : `failed: ${outcome.error}`} after ${Math.round((Date.now() - started) / 1000)} s`);
		return outcome;
	});
	libraryPending = { request, done };
	libraryTail = done;
	return done;
}

// One sync: copy missing files, tag new ones (if enabled), then reindex MPD.
// Progress is kept in `progress` and can be stopped with requestStop().
export async function syncOnce(settings: Settings, log: Log = console.log): Promise<SyncResult> {
	if (running) { return { ...emptyResult(), ok: false, error: "a sync is already running" }; }
	if (!settings.enabled) { return { ...emptyResult(), ok: false, error: "the app sync is switched off" }; }
	running = true;
	stopRequested = false;
	lastRun = Date.now();
	Object.assign(progress, freshProgress(), { running: true });
	const result = emptyResult();
	try {
		const dir = effectiveDir(settings);
		if (!fs.existsSync(dir)) { throw new SyncError(`folder does not exist: ${dir}`, false); }
		try {
			fs.accessSync(dir, fs.constants.W_OK);
		} catch (e) {
			throw new SyncError(`cyp cannot write to ${dir}: give the user that runs cyp write access to this folder (see README, Folder permissions)`, false);
		}

		const remote: unknown = JSON.parse(await fetchText(`${settings.url}/api/v1/files`, settings.key));
		if (!Array.isArray(remote)) { throw new SyncError("unexpected answer from the phone app", false); }
		const remoteFiles = remote.filter(isRemoteFile);

		removePartFiles(dir);
		const local = localFiles(dir);
		for (const [name, size] of local) {
			if (isSafeAudioName(name)) { progress.libraryFiles++; progress.librarySize += size; }
		}

		// Plan first: what is already there, what conflicts, and what has to be copied
		const todo: RemoteFile[] = [];
		for (const file of remoteFiles.filter(f => isSafeAudioName(f.name))) {
			const localSize = local.get(file.name);
			if (localSize !== undefined && (localSize === file.size || file.size <= 0)) { result.alreadyThere++; }
			else if (localSize !== undefined) { result.conflicts++; }
			else { todo.push(file); }
		}
		progress.alreadyThere = result.alreadyThere;
		progress.conflicts = result.conflicts;
		progress.total = todo.length;
		progress.bytesTotal = todo.reduce((sum, f) => sum + Math.max(0, f.size), 0);

		const added: string[] = [];
		for (const [i, file] of todo.entries()) {
			if (stopRequested) { result.stopped = true; break; }
			progress.index = i + 1;
			progress.current = file.name;
			const parts = relativeParts(file.name) ?? [];
			const dest = path.join(dir, ...parts);
			const part = dest + ".part";
			try {
				fs.mkdirSync(path.dirname(dest), { recursive: true });
				const url = `${settings.url}/api/v1/files/${parts.map(encodeURIComponent).join("/")}`;
				const bytes = await downloadTo(url, settings.key, part, n => { progress.bytesDone += n; });
				if (file.size > 0 && bytes !== file.size) { throw new SyncError(`size mismatch for ${file.name}`, false); }
				if (fs.existsSync(dest)) { fs.unlinkSync(part); result.conflicts++; progress.conflicts = result.conflicts; continue; }
				fs.renameSync(part, dest);
				added.push(file.name);
				result.downloaded++;
				progress.downloaded = result.downloaded;
				progress.libraryFiles++;
				progress.librarySize += Math.max(0, file.size);
			} catch (error) {
				if (fs.existsSync(part)) { fs.unlinkSync(part); }
				if ((error instanceof SyncError && error.stopped) || stopRequested) { result.stopped = true; break; }
				if (error instanceof SyncError && error.retryable) { throw error; }
				result.failed++;
				progress.failed = result.failed;
				const message = `${file.name}: ${errorMessage(error)}`;
				result.errors.push(message);
				progress.errors.push(message);
				log(`sync: failed ${file.name}: ${errorMessage(error)}`);
			}
		}

		if (added.length > 0 && settings.rsgain) {
			// rsgain takes a folder, not single files
			await runCommand("rsgain", ["easy", dir]);
			await runCommand("mpc", ["replaygain", "track"]);
		}
		// Also after a stop: the files copied so far are added to MPD
		if (added.length > 0) {
			const music = mpdMusicDir();
			const rel = path.relative(music, dir);
			if (rel.startsWith("..") || path.isAbsolute(rel)) {
				result.errors.push("folder is outside the MPD music folder: run 'mpc update' manually");
			} else {
				progress.updatingLibrary = true;
				const update = await updateLibrary("sync", { rel }); // no path: whole library
				progress.updatingLibrary = false;
				if (!update.ok) { throw new SyncError(update.error ?? "mpc update failed", false); }
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

let timer: NodeJS.Timeout | null = null;

// Checks every minute whether an automatic sync is due
export function startTimer(): void {
	if (timer) { return; }
	// the first automatic check comes one interval after start, not at the first tick
	lastRun = Date.now();
	timer = setInterval(() => {
		const settings = loadSettings();
		if (!settings.enabled) { return; }
		if (Date.now() - lastRun < settings.intervalMinutes * 60 * 1000) { return; }
		syncOnce(settings).catch(() => {});
	}, TICK_MS);
	timer.unref();
}

function readBody(request: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		request.setEncoding("utf8");
		request.on("data", (chunk: string) => {
			body += chunk;
			if (body.length > 65536) { reject(new Error("request too large")); request.destroy(); }
		});
		request.on("end", () => resolve(body));
		request.on("error", reject);
	});
}

function sendJson(response: http.ServerResponse, status: number, data: unknown): void {
	response.writeHead(status, { "Content-Type": "application/json" });
	response.end(JSON.stringify(data));
}

// Answers the fetch endpoints. Returns true if the request was for one of them
export function handle(request: http.IncomingMessage, response: http.ServerResponse, url: URL): boolean {
	if (request.method == "GET" && url.pathname == "/fetch/settings") {
		const settings = loadSettings();
		sendJson(response, 200, { ...settings, effectiveDir: effectiveDir(settings), musicDir: mpdMusicDir() });
		return true;
	}
	if (request.method == "POST" && url.pathname == "/fetch/settings") {
		readBody(request).then(body => {
			try {
				const saved = saveSettings(JSON.parse(body || "{}"));
				sendJson(response, 200, { ok: true, settings: saved });
			} catch (error) {
				sendJson(response, 400, { ok: false, error: errorMessage(error) });
			}
		}).catch(error => sendJson(response, 400, { ok: false, error: errorMessage(error) }));
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
		if (!settings.enabled) { sendJson(response, 403, { ok: false, error: "the app sync is switched off" }); return true; }
		if (running) { sendJson(response, 409, { ok: false, error: "a sync is already running" }); return true; }
		syncOnce(settings).catch(() => {});  // progress is read from /fetch/status
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
