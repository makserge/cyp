import * as art from "../art.js";
import * as html from "../html.js";
import * as format from "../format.js";
import Component from "../component.js";
import { isXRange, type XRange } from "../range.js";
import type { SongData, StatusData } from "../parser.js";


const ELAPSED_PERIOD = 500;

// The parts of the player the page updates, looked up once
interface PlayerDOM {
	art: HTMLElement;
	title: HTMLElement;
	subtitle: HTMLElement;
	elapsed: HTMLElement;
	duration: HTMLElement;
	progress: XRange;
	volume: XRange;
	mute: HTMLButtonElement;
	play: HTMLButtonElement;
	pause: HTMLButtonElement;
	prev: HTMLButtonElement;
	next: HTMLButtonElement;
	random: HTMLButtonElement;
	repeat: HTMLButtonElement;
}

function slider(root: ParentNode, selector: string): XRange {
	const element = html.query(root, selector, HTMLElement);
	if (!isXRange(element)) { throw new Error(`"${selector}" is not a slider`); }
	return element;
}

function lookUpDOM(root: HTMLElement): PlayerDOM {
	return {
		art: html.query(root, ".art", HTMLElement),
		title: html.query(root, ".info .title", HTMLElement),
		subtitle: html.query(root, ".info .subtitle", HTMLElement),
		elapsed: html.query(root, ".elapsed", HTMLElement),
		duration: html.query(root, ".duration", HTMLElement),
		progress: slider(root, ".timeline x-range"),
		volume: slider(root, ".controls .volume x-range"),
		mute: html.query(root, ".mute", HTMLButtonElement),
		play: html.query(root, ".play", HTMLButtonElement),
		pause: html.query(root, ".pause", HTMLButtonElement),
		prev: html.query(root, ".prev", HTMLButtonElement),
		next: html.query(root, ".next", HTMLButtonElement),
		random: html.query(root, ".random", HTMLButtonElement),
		repeat: html.query(root, ".repeat", HTMLButtonElement),
	};
}

class Player extends Component {
	protected current: { song: Partial<SongData>; elapsed: number; at: number; volume: number } = {
		song: {},
		elapsed: 0,
		at: 0,
		volume: 0
	};
	protected toggleVolume = 0;
	protected DOM: PlayerDOM;

	constructor() {
		super();
		this.DOM = lookUpDOM(this);
	}

	protected override onAppLoad() {
		this.addEvents();
		this.updateStatus();
		this.updateCurrent();
		this.app.addEventListener("idle-change", e => this.onIdle(e.detail));

		setInterval(() => this.updateElapsed(), ELAPSED_PERIOD);
	}

	protected onIdle(changed: string[]) {
		const hasOptions = changed.includes("options");
		const hasPlayer = changed.includes("player");
		const hasMixer = changed.includes("mixer");
		if (hasOptions || hasPlayer || hasMixer) { this.updateStatus(); }
		if (hasPlayer) { this.updateCurrent(); }
	}

	protected async updateStatus() {
		const { current, mpd } = this;
		const data = await mpd.status();

		this.updateFlags(data);
		this.updateVolume(data);

		// rebase the time sync
		current.elapsed = Number(data.elapsed || 0);
		current.at = performance.now();
	}

	protected async updateCurrent() {
		const { current, mpd, DOM } = this;
		const data = await mpd.currentSong();

		if (data.file) { // is there a song at all?
			DOM.title.textContent = data.Title || data.Name || format.fileName(data.file);
			DOM.subtitle.textContent = format.subtitle(data, {duration:false});

			const duration = Number(data.duration);
			if (duration) {
				DOM.duration.textContent = format.time(duration);
				DOM.progress.max = String(duration);
				DOM.progress.disabled = false;
			} else {
				DOM.duration.textContent = "";
				DOM.progress.max = "0";
				DOM.progress.disabled = true;
			}
		} else {
			DOM.title.textContent = "";
			DOM.subtitle.textContent = "";
			DOM.duration.textContent = "";
			DOM.progress.max = "0";
			DOM.progress.value = "0";
			DOM.progress.disabled = true;
		}
		if (data.file != current.song.file) { // changed song
			this.dispatchSongChange(data);
		}

		const artistNew = data.Artist || data.AlbumArtist || "";
		const artistOld = current.song.Artist || current.song.AlbumArtist;
		const albumNew = data.Album;
		const albumOld = current.song.Album;

		Object.assign(current.song, data);

		if (artistNew != artistOld || albumNew != albumOld) { // changed album (art)
			html.clear(DOM.art);
			const src = await art.get(mpd, artistNew, data.Album || "", data.file);
			if (src) {
				html.node("img", {src}, "", DOM.art);
			} else {
				html.icon("music", DOM.art);
			}
		}
	}

	protected updateElapsed() {
		const { current, DOM } = this;

		let elapsed = 0;
		if (current.song.file) {
			elapsed = current.elapsed;
			if (this.dataset["state"] == "play") { elapsed += (performance.now() - current.at)/1000; }
		}

		DOM.progress.value = String(elapsed);
		DOM.elapsed.textContent = format.time(elapsed);
		this.app.style.setProperty("--progress", String(elapsed/Number(DOM.progress.max)));
	}

	protected updateFlags(data: StatusData) {
		const flags: string[] = [];
		if (data.random == "1") { flags.push("random"); }
		if (data.repeat == "1") { flags.push("repeat"); }
		if (data.volume === "0") { flags.push("mute"); } // strict, because volume might be missing
		this.dataset["flags"] = flags.join(" ");
		this.dataset["state"] = data.state ?? "";
	}

	protected updateVolume(data: StatusData) {
		const { current, DOM } = this;

		if (data.volume !== undefined) {
			const volume = Number(data.volume);

			DOM.mute.disabled = false;
			DOM.volume.disabled = false;
			DOM.volume.value = String(volume);

			if (volume == 0 && current.volume > 0) { this.toggleVolume = current.volume; } // muted
			if (volume > 0 && current.volume == 0) { this.toggleVolume = 0; } // restored
			current.volume = volume;
		} else {
			DOM.mute.disabled = true;
			DOM.volume.disabled = true;
			DOM.volume.value = String(50);
		}
	}

	protected addEvents() {
		const { current, mpd, DOM } = this;

		DOM.play.addEventListener("click", _ => mpd.command("play"));
		DOM.pause.addEventListener("click", _ => mpd.command("pause 1"));
		DOM.prev.addEventListener("click", _ => mpd.command("previous"));
		DOM.next.addEventListener("click", _ => mpd.command("next"));

		DOM.random.addEventListener("click", _ => {
			const isRandom = this.flags.includes("random");
			mpd.command(`random ${isRandom ? "0" : "1"}`);
		});
		DOM.repeat.addEventListener("click", _ => {
			const isRepeat = this.flags.includes("repeat");
			mpd.command(`repeat ${isRepeat ? "0" : "1"}`);
		});

		DOM.progress.addEventListener("input", _ => {
			const elapsed = DOM.progress.valueAsNumber;
			current.elapsed = elapsed;
			current.at = performance.now();
			mpd.command(`seekcur ${elapsed}`);
		});

		DOM.volume.addEventListener("input", _ => mpd.command(`setvol ${DOM.volume.valueAsNumber}`));
		DOM.mute.addEventListener("click", () => mpd.command(`setvol ${this.toggleVolume}`));
	}

	// the flags the server reported, e.g. "random repeat"
	protected get flags(): string[] {
		return (this.dataset["flags"] ?? "").split(" ");
	}

	protected dispatchSongChange(detail: SongData) {
		const e = new CustomEvent("song-change", {detail});
		this.app.dispatchEvent(e);
	}
}

customElements.define("cyp-player", Player);
