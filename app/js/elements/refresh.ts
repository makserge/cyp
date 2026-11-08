// "Refresh content" button in the settings. It shows the library update that is running, whether
// the button started it or the app sync did, so the update is never run twice at the same time.
// Talks to /refresh (POST, starts or joins an update) and /library/status (GET).
import type { LibraryStatus, RefreshResult } from "../../../api.js";


const IDLE_LABEL = "Refresh content";
const FINISHED_MS = 2000;
const POLL_MS = 2000;

const button = document.getElementById("refresh-btn");

function setupRefreshButton(button: HTMLButtonElement): void {
	let wasUpdating = false;
	let resetTimer: number | null = null;

	function show(label: string, disabled: boolean): void {
		button.textContent = label;
		button.disabled = disabled;
	}

	// "Done!" or "Failed" for a moment, then back to the normal label
	function flashFinished(ok: boolean): void {
		if (resetTimer !== null) { clearTimeout(resetTimer); }
		show(ok ? "Done!" : "Failed", true);
		resetTimer = window.setTimeout(() => {
			resetTimer = null;
			show(IDLE_LABEL, false);
		}, FINISHED_MS);
	}

	function render(status: LibraryStatus): void {
		if (status.updating) {
			if (resetTimer !== null) { clearTimeout(resetTimer); resetTimer = null; }
			show(status.source == "sync" ? "Updating after sync…" : "Refreshing…", true);
			wasUpdating = true;
			return;
		}
		if (wasUpdating) {
			// the update ended while this page was open: show how it went
			wasUpdating = false;
			if (status.ok === false) { button.title = status.error; } else { button.title = ""; }
			flashFinished(status.ok !== false);
		}
	}

	async function poll(): Promise<void> {
		try {
			const res = await fetch("/library/status", { cache: "no-store" });
			const status: LibraryStatus = await res.json();
			render(status);
		} catch (e) {
			// the server may be restarting; the next poll tries again
		}
	}

	// The request only starts the update; the status polling below shows its progress and end
	button.addEventListener("click", async () => {
		show("Refreshing…", true);
		try {
			const res = await fetch("/refresh", { method: "POST" });
			const data: RefreshResult = await res.json();
			if (data.ok) {
				wasUpdating = true;
			} else {
				flashFinished(false);
				button.title = data.error;
			}
		} catch (e) {
			flashFinished(false);
		}
	});

	poll();
	window.setInterval(poll, POLL_MS);
}

if (button instanceof HTMLButtonElement) { setupRefreshButton(button); }
