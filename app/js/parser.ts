// Parsing of MPD's text replies ("Key: value" lines) into typed records.

export type Struct = Record<string, string | string[]>;

export interface SongData {
	file: string;
	Id?: string;
	Track?: string;
	Title?: string;
	Name?: string; // internet radio streams
	Artist?: string;
	AlbumArtist?: string;
	Album?: string;
	duration?: string;
	"Last-Modified"?: string;
}

export interface PathData {
	file?: string;
	directory?: string;
	playlist?: string;
	"Last-Modified"?: string;
}

export interface PathContents {
	file: PathData[];
	directory: PathData[];
	playlist: PathData[];
}

export interface StatusData {
	random?: string;
	repeat?: string;
	volume?: string;
	state?: string;
	elapsed?: string;
	duration?: string;
}

// The one place that trusts MPD's reply shape: each record is read as T by the caller
export function linesToStruct<T = Struct>(lines: string[]): T {
	const result: Struct = {};

	for (const line of lines) {
		const cindex = line.indexOf(":");
		if (cindex == -1) { throw new Error(`Malformed line "${line}"`); }
		const key = line.substring(0, cindex);
		const value = line.substring(cindex+2);

		const old = result[key];
		if (old === undefined) {
			result[key] = value;
		} else if (Array.isArray(old)) {
			old.push(value);
		} else {
			result[key] = [old, value];
		}
	}
	return result as T;
}

export function songList(lines: string[]): SongData[] {
	const songs: SongData[] = [];
	let batch: string[] = [];

	for (const line of lines) {
		if (line.startsWith("file:") && batch.length) {
			songs.push(linesToStruct<SongData>(batch));
			batch = [];
		}
		batch.push(line);
	}

	if (batch.length) { songs.push(linesToStruct<SongData>(batch)); }
	return songs;
}

type PathKind = keyof PathContents;

function pathKind(prefix: string): PathKind | null {
	switch (prefix) {
		case "file": return "file";
		case "directory": return "directory";
		case "playlist": return "playlist";
		default: return null;
	}
}

export function pathContents(lines: string[]): PathContents {
	const result: PathContents = { file: [], directory: [], playlist: [] };
	let batch: string[] = [];
	let batchKind: PathKind | null = null;

	const flush = () => {
		if (batch.length && batchKind) { result[batchKind].push(linesToStruct<PathData>(batch)); }
	};

	for (const line of lines) {
		const kind = pathKind(line.split(":")[0] ?? "");
		if (kind) { // begin of a new batch
			flush();
			batchKind = kind;
			batch = [];
		}
		batch.push(line);
	}

	flush();
	return result;
}
