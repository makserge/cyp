import * as html from "../html.js";
import Component from "../component.js";
import Song from "./song.js";
import { escape } from "../mpd.js";
import type { SongData } from "../parser.js";


function songsOf(items: HTMLElement[]): Song[] {
	return items.filter((item): item is Song => item instanceof Song);
}

function generateMoveCommands(items: Song[], diff: number, parent: HTMLElement): string[] {
	const all = [...parent.children].filter((node): node is Song => node instanceof Song);
	const compare = (a: Song, b: Song) => all.indexOf(a) - all.indexOf(b);

	const commands: string[] = [];
	for (const item of [...items].sort(compare)) {
		const index = all.indexOf(item) + diff;
		if (index < 0 || index >= all.length) { continue; } // this does not move
		commands.push(`moveid ${item.songId} ${index}`);
	}
	return commands;
}

class Queue extends Component {
	protected currentId?: string;

	protected override onAppLoad() {
		const { app } = this;
		app.addEventListener("idle-change", e => {
			if (e.detail.includes("playlist")) { this.sync(); }
		});
		app.addEventListener("song-change", e => {
			this.currentId = e.detail.Id;
			this.updateCurrent();
		});
		this.sync();
	}

	protected override onComponentChange(_c: string, isThis: boolean) {
		this.hidden = !isThis;
	}

	protected async sync() {
		const songs = await this.mpd.listQueue();
		this.buildSongs(songs);

		this.app.dispatchEvent(new CustomEvent("queue-length-change", {detail:songs.length}));
	}

	protected updateCurrent() {
		const songs = [...this.children].filter((node): node is Song => node instanceof Song);
		songs.forEach(node => {
			node.playing = (node.songId == this.currentId);
		});
	}

	protected buildSongs(songs: SongData[]) {
		html.clear(this);

		const nodes = songs.map(song => {
			const node = new Song(song);
			node.addButton("play", async () => {
				await this.mpd.command(`playid ${node.songId}`);
			});
			return node;
		});
		this.append(...nodes);

		this.configureSelection(nodes);
		this.updateCurrent();
	}

	protected configureSelection(nodes: Song[]) {
		const { mpd, selection } = this;

		const commands = [{
			cb: (items: HTMLElement[]) => {
				const moves = generateMoveCommands(songsOf(items), -1, this);
				mpd.command(moves);
			},
			label:"Up",
			icon:"arrow-up-bold"
		}, {
			cb: (items: HTMLElement[]) => {
				const moves = generateMoveCommands(songsOf(items), +1, this);
				mpd.command(moves.reverse()); // move last first
			},
			label:"Down",
			icon:"arrow-down-bold"
		}, {
			cb: async (items: HTMLElement[]) => {
				let name = prompt("Save selected songs as a playlist?", "name");
				if (name === null) { return; }

				name = escape(name);
				try { // might not exist
					await mpd.command(`rm "${name}"`);
				} catch (e) {}

				const commands = songsOf(items).map(item => {
					return `playlistadd "${name}" "${escape(item.file)}"`;
				});
				await mpd.command(commands);

				selection.clear();
			},
			label:"Save",
			icon:"content-save"
		}, {
			cb: async (items: HTMLElement[]) => {
				const selected = songsOf(items);
				if (!confirm(`Remove these ${selected.length} songs from the queue?`)) { return; }

				const commands = selected.map(item => `deleteid ${item.songId}`);
				mpd.command(commands);
			},
			label:"Remove",
			icon:"delete"
		}];

		selection.configure(nodes, "multi", commands);
	}
}

customElements.define("cyp-queue", Queue);
