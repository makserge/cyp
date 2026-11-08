import * as html from "./html.js";
import * as conf from "./conf.js";
import type MPD from "./mpd.js";


// Every album is looked up once: the cache holds the promise of its cover (a data URL, or null)
const cache = new Map<string, Promise<string | null>>();
const MIME = "image/jpeg";
const STORAGE_PREFIX = `art-${conf.artSize}`;

function store(key: string, data: string) {
	localStorage.setItem(`${STORAGE_PREFIX}-${key}`, data);
}

function load(key: string) {
	return localStorage.getItem(`${STORAGE_PREFIX}-${key}`);
}

function bytesToImage(bytes: Uint8Array<ArrayBuffer>) {
	const blob = new Blob([bytes], {type: MIME});
	const src = URL.createObjectURL(blob);
	const image = html.node("img", {src});
	return new Promise<HTMLImageElement>((resolve, reject) => {
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("cover is not a valid image"));
	});
}

function resize(image: HTMLImageElement | HTMLCanvasElement) {
	while (Math.min(image.width, image.height) >= 2*conf.artSize) {
		const tmp = html.node("canvas", {width:image.width/2, height:image.height/2});
		tmp.getContext("2d")?.drawImage(image, 0, 0, tmp.width, tmp.height);
		image = tmp;
	}
	const canvas = html.node("canvas", {width:conf.artSize, height:conf.artSize});
	canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
	return canvas;
}

async function fetchCover(mpd: MPD, songUrl: string): Promise<string | null> {
	const data = await mpd.albumArt(songUrl);
	if (!data) { return null; }

	const image = await bytesToImage(new Uint8Array(data));
	return resize(image).toDataURL(MIME);
}

export function get(mpd: MPD, artist: string, album: string, songUrl?: string): Promise<string | null> {
	const key = `${artist}-${album}`;
	const cached = cache.get(key);
	if (cached) { return cached; }

	const loaded = load(key);
	if (loaded) {
		const promise = Promise.resolve(loaded);
		cache.set(key, promise);
		return promise;
	}

	if (!songUrl) { return Promise.resolve(null); }

	// one request per album, shared by everyone who asks for it meanwhile
	const promise = fetchCover(mpd, songUrl).then(url => {
		if (url) { store(key, url); }
		return url;
	}).catch(() => null);
	cache.set(key, promise);
	return promise;
}
