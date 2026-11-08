// Shapes of the JSON exchanged between the page (app/) and the server (index.ts, fetcher.ts).
// Both sides import these types, so a change on one side that the other does not follow fails to compile.
// The page reads the server's JSON as these types without a runtime check: the server is ours, and it is
// the device app's answers (checked in fetcher.ts) that come from outside.


// Saved settings of the app sync (fetch.json)
export interface FetchSettings {
	enabled: boolean;
	url: string;
	key: string;
	dir: string;
	intervalMinutes: number;
	rsgain: boolean;
}

// GET /fetch/settings: the saved settings plus what the server resolved from them
export interface FetchSettingsView extends FetchSettings {
	effectiveDir: string;
	musicDir: string;
}

// POST /fetch/settings
export type SaveSettingsResult =
	| { ok: true; settings: FetchSettings }
	| { ok: false; error: string };

// POST /fetch/run and /fetch/stop
export type ActionResult =
	| { ok: true }
	| { ok: false; error: string };

export interface SyncResult {
	ok: boolean;
	downloaded: number;
	alreadyThere: number;
	conflicts: number;
	failed: number;
	reindexed: boolean;
	stopped: boolean;
	errors: string[];
	error?: string;
}

// GET /fetch/status: what the settings page shows while a sync runs
export interface FetchProgress {
	running: boolean;
	stopping: boolean;
	current: string;
	index: number;
	total: number;
	bytesDone: number;
	bytesTotal: number;
	downloaded: number;
	alreadyThere: number;
	conflicts: number;
	failed: number;
	libraryFiles: number;
	librarySize: number;
	reindexed: boolean;
	updatingLibrary: boolean;
	errors: string[];
	result: SyncResult | null;
}

// GET /library/status: the one MPD library update shared by "Refresh content" and the app sync
export interface LibraryStatus {
	updating: boolean;
	source: "refresh" | "sync" | null;
	ok: boolean | null;
	error: string;
}

// POST /refresh
export type RefreshResult =
	| { ok: true }
	| { ok: false; error: string };
