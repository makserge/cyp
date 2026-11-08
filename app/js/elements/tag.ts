import * as html from "../html.js";
import * as art from "../art.js";
import Item from "../item.js";
import type MPD from "../mpd.js";
import type { TagFilter } from "../mpd.js";


export type TagType = "Album" | "AlbumArtist" | "Genre";

const ICONS: Record<TagType, string> = {
	"AlbumArtist": "artist",
	"Album": "album",
	"Genre": "music"
};


export default class Tag extends Item {
	constructor(readonly type: TagType, protected value: string, protected filter: TagFilter) {
		super();
		html.node("span", {className:"art"}, "", this);
		this.buildTitle(value);
	}

	createChildFilter(): TagFilter {
		return Object.assign({[this.type]:this.value}, this.filter);
	}

	async fillArt(mpd: MPD) {
		const parent = this.firstElementChild;
		if (!(parent instanceof HTMLElement)) { return; }
		const filter = this.createChildFilter();

		const artist = filter["AlbumArtist"];
		const album = filter["Album"];
		let src: string | null = null;

		if (artist && album) {
			src = await art.get(mpd, artist, album);
			if (!src) {
				const songs = await mpd.listSongs(filter, [0,1]);
				const first = songs[0];
				if (first) {
					src = await art.get(mpd, artist, album, first.file);
				}
			}
		}

		if (src) {
			html.node("img", {src}, "", parent);
		} else {
			html.icon(ICONS[this.type], parent);
		}
	}
}

customElements.define("cyp-tag", Tag);
