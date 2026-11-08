import type { SongData } from "./parser.js";


export const SEPARATOR = " · ";

export function time(sec: number) {
	sec = Math.round(sec);
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function subtitle(data: SongData, options: { duration?: boolean } = { duration: true }) {
	const tokens: string[] = [];

	if (data.Name) { tokens.push(data.Name); }

	if (data.Artist) {
		tokens.push(data.Artist);
	} else if (data.AlbumArtist) {
		tokens.push(data.AlbumArtist);
	}

	if (data.Album) { tokens.push(data.Album); }
	if (options.duration && data.duration) { tokens.push(time(Number(data.duration))); }

	return tokens.join(SEPARATOR);
}

export function fileName(file: string) {
	return file.split("/").pop() || "";
}
