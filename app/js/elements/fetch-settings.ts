// App sync (fetch from the device app): settings form, Sync now / Stop and live progress.
// Talks to the endpoints of fetcher.ts: /fetch/settings, /fetch/run, /fetch/status, /fetch/stop.
import * as html from "../html.js";
import type { ActionResult, FetchProgress, FetchSettingsView, SaveSettingsResult } from "../../../api.js";


// How many error lines the status box shows; the rest are counted
const MAX_ERROR_LINES = 3;

const enabledInput = html.byId("fetch-enabled", HTMLInputElement);
const urlInput = html.byId("fetch-url", HTMLInputElement);
const keyInput = html.byId("fetch-key", HTMLInputElement);
const keyToggle = html.byId("fetch-key-toggle", HTMLButtonElement);
const dirInput = html.byId("fetch-dir", HTMLInputElement);
const intervalInput = html.byId("fetch-interval", HTMLInputElement);
const rsgainInput = html.byId("fetch-rsgain", HTMLInputElement);
const saveButton = html.byId("fetch-save", HTMLButtonElement);
const runButton = html.byId("fetch-run", HTMLButtonElement);
const statusLine = html.byId("fetch-status", HTMLDivElement);
const resultBox = html.byId("fetch-result", HTMLDivElement);

let syncRunning = false;
let syncStopping = false;
let savedEnabled = false; // the switch as saved on the server; a sync can only start when it is on

function setStatus(text: string): void {
	statusLine.textContent = text;
}

const megabytes = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);
const gigabytes = (bytes: number): string => (bytes / (1024 * 1024 * 1024)).toFixed(2);

async function loadSettings(): Promise<void> {
	try {
		const res = await fetch("/fetch/settings", { cache: "no-store" });
		const s: FetchSettingsView = await res.json();
		enabledInput.checked = s.enabled;
		urlInput.value = s.url;
		keyInput.value = s.key;
		dirInput.value = s.dir;
		dirInput.placeholder = `Default: ${s.musicDir}`;
		intervalInput.value = String(s.intervalMinutes);
		rsgainInput.checked = s.rsgain;
		savedEnabled = s.enabled;
		updateRunButton();
	} catch (e) {
		setStatus(`Could not load the settings: ${e}`);
	}
}

keyToggle.addEventListener("click", () => {
	const hidden = keyInput.type == "password";
	keyInput.type = hidden ? "text" : "password";
	keyToggle.textContent = hidden ? "Hide" : "Show";
});

saveButton.addEventListener("click", async () => {
	const body = {
		enabled: enabledInput.checked,
		url: urlInput.value,
		key: keyInput.value,
		dir: dirInput.value,
		intervalMinutes: Number(intervalInput.value),
		rsgain: rsgainInput.checked,
	};
	const res = await fetch("/fetch/settings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	const data: SaveSettingsResult = await res.json();
	if (data.ok) { savedEnabled = data.settings.enabled; }
	updateRunButton();
	setStatus(data.ok ? "Saved." : `Not saved: ${data.error}`);
});

// One line per group of numbers, long names cut with an ellipsis (full text on hover)
function statusLineEl(text: string, className = "fetch-line"): HTMLDivElement {
	return html.node("div", {className, title: text}, text);
}

function countLines(p: FetchProgress): HTMLDivElement[] {
	return [
		statusLineEl(`Downloaded ${p.downloaded} · Already there ${p.alreadyThere} · Conflicts ${p.conflicts} · Failed ${p.failed}`),
		statusLineEl(`Copied ${megabytes(p.bytesDone)} MB of ${megabytes(p.bytesTotal)} MB · Library ${p.libraryFiles} files / ${gigabytes(p.librarySize)} GB`),
	];
}

// While a sync runs: what it is doing and the numbers. After it ends: only what happened.
// Nothing is shown on page load (see resumeIfRunning).
function renderProgress(p: FetchProgress): void {
	const lines: HTMLDivElement[] = [];

	if (p.running) {
		if (p.updatingLibrary) {
			lines.push(statusLineEl("Updating the library…"));
		} else {
			lines.push(statusLineEl(p.stopping
				? "Stopping after the current chunk…"
				: `Copying ${p.index} of ${p.total}: ${p.current}`));
		}
		lines.push(...countLines(p));
	} else if (p.result) {
		if (p.result.stopped) { lines.push(statusLineEl("Stopped by you. Copied files were kept.")); }
		if (p.reindexed) { lines.push(statusLineEl("Library updated.")); }
		if (p.downloaded > 0 || p.failed > 0 || p.conflicts > 0) { lines.push(...countLines(p)); }
		const shown = p.errors.slice(0, MAX_ERROR_LINES);
		for (const e of shown) { lines.push(statusLineEl(`Error: ${e}`, "fetch-line fetch-error")); }
		if (p.errors.length > shown.length) {
			lines.push(statusLineEl(`…and ${p.errors.length - shown.length} more errors`, "fetch-line fetch-error"));
		}
		if (!p.result.ok && p.result.error) { lines.push(statusLineEl(`Error: ${p.result.error}`, "fetch-line fetch-error")); }
	}

	resultBox.replaceChildren(...lines);
}

// The one button is "Sync now" when idle and "Stop" while a sync runs. Save is off during a sync.
// "Sync now" is off while app sync is switched off (as saved), and while a stop is being carried out.
function updateRunButton(): void {
	runButton.textContent = syncRunning ? "Stop" : "Sync now";
	runButton.disabled = syncStopping || (!syncRunning && !savedEnabled);
	saveButton.disabled = syncRunning;
}

function setRunning(running: boolean, stopping = false): void {
	syncRunning = running;
	syncStopping = running && stopping;
	updateRunButton();
}

let pollTimer: number | null = null;

async function pollProgress(): Promise<void> {
	try {
		const res = await fetch("/fetch/status", { cache: "no-store" });
		const p: FetchProgress = await res.json();
		renderProgress(p);
		if (p.running) {
			setRunning(true, p.stopping);
			setStatus(p.updatingLibrary ? "Updating library..." : (p.stopping ? "Stopping..." : "Syncing..."));
			return;
		}
		if (pollTimer !== null) { clearInterval(pollTimer); }
		pollTimer = null;
		setRunning(false);
		setStatus(p.result?.stopped ? "Stopped" : (p.result?.ok ? "Sync finished" : "Sync failed"));
	} catch (e) {
		setStatus(`Could not read the sync progress: ${e}`);
	}
}

function startPolling(): void {
	if (pollTimer === null) { pollTimer = window.setInterval(pollProgress, 1000); }
	pollProgress();
}

runButton.addEventListener("click", async () => {
	if (syncRunning) {
		setRunning(true, true);
		setStatus("Stopping...");
		await fetch("/fetch/stop", { method: "POST" });
		return;
	}

	resultBox.replaceChildren();
	const res = await fetch("/fetch/run", { method: "POST" });
	const data: ActionResult = await res.json();
	if (!data.ok) {
		setStatus("Not started");
		resultBox.replaceChildren(statusLineEl(data.error, "fetch-line fetch-error"));
		return;
	}
	setStatus("Syncing...");
	setRunning(true);
	startPolling();
});

// A sync that was started before the page was reloaded keeps showing its progress;
// otherwise the panel stays empty until the user starts a sync
async function resumeIfRunning(): Promise<void> {
	const res = await fetch("/fetch/status", { cache: "no-store" });
	const p: FetchProgress = await res.json();
	if (p.running) { setRunning(true, p.stopping); startPolling(); }
}

updateRunButton();
loadSettings();
resumeIfRunning();
