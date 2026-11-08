import * as html from "../html.js";
import Component from "../component.js";
import Playlist from "./playlist.js";
import { escape } from "../mpd.js";
import Song from "./song.js";
import Back from "./back.js";
import type { SongData } from "../parser.js";


function songsOf(items: HTMLElement[]): Song[] {
	return items.filter((item): item is Song => item instanceof Song);
}

function playlistsOf(items: HTMLElement[]): Playlist[] {
	return items.filter((item): item is Playlist => item instanceof Playlist);
}

class Playlists extends Component {
	protected current?: string;

	protected override onAppLoad() {
		const { app } = this;
		app.addEventListener("idle-change", e => {
			if (e.detail.includes("stored_playlist")) { this.sync(); }
		});
		this.sync();
	}

	protected override onComponentChange(_c: string, isThis: boolean) {
		this.hidden = !isThis;
	}

	protected async sync() {
		if (this.current) {
			const songs = await this.mpd.listPlaylistItems(this.current);
			this.buildSongs(songs);
		} else {
			const lists = await this.mpd.listPlaylists();
			this.buildLists(lists);
		}
	}

	protected buildSongs(songs: SongData[]) {
		html.clear(this);
		this.buildBack();

		const nodes = songs.map(song => new Song(song));
		this.append(...nodes);

		this.configureSelectionSongs(nodes);
	}

	protected buildLists(lists: string[]) {
		html.clear(this);

		const playlists = lists.map(name => {
			const node = new Playlist(name);
			node.addButton("chevron-double-right", () => {
				this.current = name;
				this.sync();
			});
			return node;
		});
		this.append(...playlists);

		this.configureSelectionLists(playlists);
	}

	protected buildBack() {
		const node = new Back("Playlists");
		this.append(node);
		node.onclick = () => {
			this.current = undefined;
			this.sync();
		};
	}

	protected configureSelectionSongs(songs: Song[]) {
		const { selection, mpd } = this;

		const commands = [{
			cb: async (items: HTMLElement[]) => {
				await mpd.command(["clear", ...songsOf(items).map(createAddCommand), "play"]);
				selection.clear(); // fixme notification?
			},
			label:"Play",
			icon:"play"
		}, {
			cb: async (items: HTMLElement[]) => {
				await mpd.command(songsOf(items).map(createAddCommand));
				selection.clear(); // fixme notification?
			},
			label:"Enqueue",
			icon:"plus"
		}];

		selection.configure(songs, "multi", commands);
	}

	// Single selection: the callbacks act on the one selected playlist
	protected configureSelectionLists(lists: Playlist[]) {
		const { mpd, selection } = this;

		const commands = [{
			cb: async (items: HTMLElement[]) => {
				const item = playlistsOf(items)[0];
				if (!item) { return; }
				const commands = ["clear", `load "${escape(item.name)}"`, "play"];
				await mpd.command(commands);
				selection.clear(); // fixme notification?
			},
			label:"Play",
			icon:"play"
		}, {
			cb: async (items: HTMLElement[]) => {
				const item = playlistsOf(items)[0];
				if (!item) { return; }
				await mpd.command(`load "${escape(item.name)}"`);
				selection.clear(); // fixme notification?
			},
			label:"Enqueue",
			icon:"plus"
		}, {
			cb: async (items: HTMLElement[]) => {
				const item = playlistsOf(items)[0];
				if (!item) { return; }
				if (!confirm(`Really delete playlist '${item.name}'?`)) { return; }

				await mpd.command(`rm "${escape(item.name)}"`);
			},
			label:"Delete",
			icon:"delete"
		}];

		selection.configure(lists, "single", commands);
	}
}

customElements.define("cyp-playlists", Playlists);

function createAddCommand(node: Song) {
	return `add "${escape(node.file)}"`;
}
