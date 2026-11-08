import * as parser from "./parser.js";
import type { PathContents, SongData, StatusData, Struct } from "./parser.js";


// One reply line is text; the binary part of "albumart" arrives as an array of bytes
type ReplyItem = string | number[];

interface Command {
	cmd: string;
	resolve: (lines: ReplyItem[]) => void;
	reject: (reason: string | CloseEvent) => void;
	quiet?: boolean; // an expected error (e.g. a song without cover art) is not logged
}

export type TagFilter = Record<string, string>;

function isTicket(data: unknown): data is { ticket: string } {
	return typeof data == "object" && data !== null && "ticket" in data && typeof data.ticket == "string";
}

function isReply(data: unknown): data is ReplyItem[] {
	return Array.isArray(data) && data.every(item => typeof item == "string" || Array.isArray(item));
}

function toArray(value: string | string[] | undefined): string[] {
	if (value === undefined) { return []; }
	return Array.isArray(value) ? value : [value];
}

function textLines(lines: ReplyItem[]): string[] {
	return lines.map(line => {
		if (typeof line != "string") { throw new Error("unexpected binary data in reply"); }
		return line;
	});
}

export default class MPD {
	protected queue: Command[] = [];
	protected current?: Command;
	protected canTerminateIdle = false;

	// set by the app: called when the connection closes, and with the names of subsystems that changed
	onClose: (e: CloseEvent) => void = () => {};
	onChange: (changed: string[]) => void = () => {};

	static async connect(): Promise<MPD> {
		const response = await fetch("ticket", {method:"POST"});
		const data: unknown = await response.json();
		if (!isTicket(data)) { throw new Error("no ticket from the server"); }

		const ws = new WebSocket(createURL(data.ticket).href);

		return new Promise<MPD>((resolve, reject) => {
			const mpd: MPD = new this(ws, {cmd: "", resolve: () => resolve(mpd), reject});
		});
	}

	constructor(protected ws: WebSocket, initialCommand: Command) {
		this.current = initialCommand;

		ws.addEventListener("message", e => this._onMessage(e));
		ws.addEventListener("close", e => this._onClose(e));
	}

	command(cmds: string | string[]): Promise<string[]> {
		return this.send(cmds).then(textLines);
	}

	status() {
		return this.command("status").then(lines => parser.linesToStruct<StatusData>(lines));
	}

	async currentSong() {
		const lines = await this.command("currentsong");
		return parser.linesToStruct<SongData>(lines);
	}

	async listQueue() {
		const lines = await this.command("playlistinfo");
		return parser.songList(lines);
	}

	async listPlaylists() {
		interface Result {
			playlist?: string | string[];
		}
		const lines = await this.command("listplaylists");
		return toArray(parser.linesToStruct<Result>(lines).playlist);
	}

	async listPlaylistItems(name: string) {
		const lines = await this.command(`listplaylistinfo "${escape(name)}"`);
		return parser.songList(lines);
	}

	async listPath(path: string): Promise<PathContents> {
		const lines = await this.command(`lsinfo "${escape(path)}"`);
		return parser.pathContents(lines);
	}

	async listTags(tag: string, filter: TagFilter = {}) {
		const tokens = ["list", tag];
		const fakeGroup = Object.keys(filter)[0]; // FIXME hack for MPD < 0.21.6
		if (fakeGroup !== undefined) {
			tokens.push(serializeFilter(filter));
			tokens.push("group", fakeGroup);
		}
		const lines = await this.command(tokens.join(" "));
		const parsed: Struct = parser.linesToStruct(lines);
		return toArray(parsed[tag]);
	}

	async listSongs(filter: TagFilter, window?: number[]) {
		const tokens = ["find", serializeFilter(filter)];
		if (window) { tokens.push("window", window.join(":")); }
		const lines = await this.command(tokens.join(" "));
		return parser.songList(lines);
	}

	async searchSongs(filter: TagFilter) {
		const tokens = ["search", serializeFilter(filter, "contains")];
		const lines = await this.command(tokens.join(" "));
		return parser.songList(lines);
	}

	/**
	 * Case-insensitive substring search of a single tag (or "file" for the song URI),
	 * optionally restricted to songs below the `base` directory.
	 */
	async searchTag(tag: string, query: string, base = ""): Promise<SongData[]> {
		const parts = [`(${tag} contains "${escape(query)}")`];
		if (base) { parts.push(`(base "${escape(base)}")`); }
		const filterStr = `(${parts.join(" AND ")})`;
		const lines = await this.command(`search "${escape(filterStr)}"`);
		return parser.songList(lines);
	}

	async albumArt(songUrl: string): Promise<number[] | null> {
		let data: number[] = [];
		let offset = 0;

		interface Metadata {
			size: string;
			binary: string;
		}

		for (;;) {
			const params = ["albumart", `"${escape(songUrl)}"`, String(offset)];
			try {
				const lines = await this.send(params.join(" "), true);
				const bytes = lines[2];
				if (!Array.isArray(bytes)) { return null; }
				data = data.concat(bytes);
				const metadata = parser.linesToStruct<Metadata>(textLines(lines.slice(0, 2)));
				if (data.length >= Number(metadata.size)) { return data; }
				offset += Number(metadata.binary);
			} catch (e) {
				return null;
			}
		}
	}

	_onMessage(e: MessageEvent) {
		if (!this.current) { return; }

		const { current } = this;
		this.current = undefined;

		const lines: unknown = JSON.parse(e.data);
		if (!isReply(lines) || lines.length == 0) {
			current.reject("malformed reply from the server");
		} else {
			const last = lines[lines.length - 1];
			if (typeof last == "string" && last.startsWith("OK")) {
				current.resolve(lines.slice(0, -1));
			} else {
				if (!current.quiet) { console.warn(last); }
				current.reject(String(last));
			}
		}

		if (this.queue.length > 0) {
			this.advanceQueue();
		} else {
			setTimeout(() => this.idle(), 0); // only after resolution callbacks
		}
	}

	_onClose(e: CloseEvent) {
		console.warn(e);
		this.current?.reject(e);
		this.onClose(e);
	}

	// Sends one command (or a command list) and resolves with the raw reply
	protected send(cmds: string | string[], quiet = false): Promise<ReplyItem[]> {
		const cmd = (Array.isArray(cmds) ? ["command_list_begin", ...cmds, "command_list_end"].join("\n") : cmds);

		return new Promise<ReplyItem[]>((resolve, reject) => {
			this.queue.push({cmd, resolve, reject, quiet});

			if (!this.current) {
				this.advanceQueue();
			} else if (this.canTerminateIdle) {
				this.ws.send("noidle");
				this.canTerminateIdle = false;
			}
		});
	}

	protected advanceQueue() {
		const next = this.queue.shift();
		if (!next) { return; }
		this.current = next;
		this.ws.send(next.cmd);
	}

	protected async idle() {
		if (this.current) { return; }

		interface Result {
			changed?: string | string[];
		}

		this.canTerminateIdle = true;
		const lines = await this.command("idle stored_playlist playlist player options mixer");
		this.canTerminateIdle = false;
		const changed = toArray(parser.linesToStruct<Result>(lines).changed);
		if (changed.length > 0) { this.onChange(changed); }
	}
}

export function escape(str: string) {
	return str.replace(/(['"\\])/g, "\\$1");
}

export function serializeFilter(filter: TagFilter, operator = "==") {
	const tokens = ["("];
	Object.entries(filter).forEach(([key, value], index) => {
		if (index) { tokens.push(" AND "); }
		tokens.push(`(${key} ${operator} "${escape(value)}")`);
	});
	tokens.push(")");

	const filterStr = tokens.join("");
	return `"${escape(filterStr)}"`;
}

function createURL(ticket: string) {
	const url = new URL(location.href);
	url.protocol = ( url.protocol == "https:" ? "wss" : "ws" );
	url.hash = "";
	url.searchParams.set("ticket", ticket);
	return url;
}
