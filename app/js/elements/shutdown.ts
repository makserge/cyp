// System shutdown button in the settings. After a shutdown the MPD connection closes on purpose,
// so the app must not reconnect or show an alert (see app.ts, which reads conf.shuttingDown).
import * as conf from "../conf.js";


const shutdownButton = document.getElementById("shutdown-btn");

// Answers while the host is up; a failed or slow answer means it is off
async function isHostAlive(): Promise<boolean> {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), 2000);
	try {
		await fetch("/settings", { method: "GET", cache: "no-store", signal: controller.signal });
		return true;
	} catch (e) {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

function watchForShutdown(button: HTMLButtonElement): void {
	const pingInterval = window.setInterval(async () => {
		const alive = await isHostAlive();
		if (!alive) {
			clearInterval(pingInterval);
			button.textContent = "Switched off";
		}
	}, 2000);
}

if (shutdownButton instanceof HTMLButtonElement) {
	const button = shutdownButton;
	button.addEventListener("click", async () => {
		if (!confirm("Shut down the system now?")) { return; }
		conf.beginShutdown();
		button.disabled = true;
		button.textContent = "Shutting down…";
		await fetch("/shutdown", { method: "POST" });
		watchForShutdown(button);
	});
}
