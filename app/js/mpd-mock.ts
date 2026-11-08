// Fake MPD for working on the interface without a server. Same functions as mpd.ts, fixed data.
import type { PathContents, SongData, StatusData } from "./parser.js";


export function command(cmd: string) {
	console.warn(`mpd-mock does not know "${cmd}"`);
}

export function status(): StatusData {
	return { volume: "50", elapsed: "10", duration: "70", state: "play" };
}

export function currentSong(): SongData {
	return {
		duration: "70",
		file: "name.mp3",
		Title: "Title of song",
		Artist: "Artist of song",
		Album: "Album of song",
		Track: "6",
		Id: "2"
	};
}

export function listQueue(): SongData[] {
	return [
		{Id:"1", Track:"5", Title:"Title 1", Artist:"AAA", Album:"BBB", duration:"30", file:"a.mp3"},
		currentSong(),
		{Id:"3", Track:"7", Title:"Title 3", Artist:"CCC", Album:"DDD", duration:"230", file:"c.mp3"},
	];
}

export function listPlaylists(): string[] {
	return ["Playlist 1", "Playlist 2", "Playlist 3"];
}

export function listPath(_path: string): PathContents {
	return {
		directory: [{directory: "Dir 1"}, {directory: "Dir 2"}, {directory: "Dir 3"}],
		file: [{file: "File 1"}, {file: "File 2"}, {file: "File 3"}],
		playlist: [],
	};
}

export function listTags(tag: string, _filter: Record<string, string> = {}): string[] {
	switch (tag) {
		case "AlbumArtist": return ["Artist 1", "Artist 2", "Artist 3"];
		case "Album": return ["Album 1", "Album 2", "Album 3"];
		default: return [];
	}
}

export function listSongs(_filter: Record<string, string>, _window?: number[]): SongData[] {
	return listQueue();
}

export function searchSongs(_filter: Record<string, string>): SongData[] {
	return listQueue();
}

export function albumArt(_songUrl: string): Promise<number[] | null> {
	return new Promise(resolve => setTimeout(() => resolve(null), 1000));
}

export function init() {}
