import MPD from "../mpd.js";
import * as html from "../html.js";
import Selection from "../selection.js";
import * as conf from "../conf.js";


// Set by the System shutdown button (index.html) before the request is sent
function isShuttingDown(): boolean {
	return conf.shuttingDown;
}

function initIcons() {
	document.querySelectorAll<HTMLElement>("[data-icon]").forEach(node => {
		(node.dataset["icon"] ?? "").split(" ").forEach(name => {
			node.prepend(html.icon(name));
		});
	});
}

interface YoutubeSettings {
	youtubeDir: string;
}

function isYoutubeSettings(data: unknown): data is YoutubeSettings {
	return typeof data == "object" && data !== null && "youtubeDir" in data && typeof data.youtubeDir == "string";
}

export default class App extends HTMLElement {
	protected _mpd?: MPD;

	static get observedAttributes() { return ["component"]; }

	constructor() {
		super();
		initIcons();
	}

	// Available once the app has connected (components use it after the "load" event)
	get mpd(): MPD {
		if (!this._mpd) { throw new Error("not connected to MPD yet"); }
		return this._mpd;
	}

	async connectedCallback() {
		await waitForChildren(this);

		window.addEventListener("hashchange", _ => this.onHashChange());
		this.onHashChange();

		await loadSettings();

		await this.connect();
		this.dispatchEvent(new CustomEvent("load"));

		this.initMediaHandler();
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		switch (name) {
			case "component":
				location.hash = newValue ?? "";
				this.dispatchEvent(new CustomEvent("component-change"));
			break;
		}
	}

	get component() { return this.getAttribute("component") || ""; }
	set component(component: string) { this.setAttribute("component", component); }

	createSelection() {
		const selection = new Selection();
		html.query(this, "footer", HTMLElement).append(selection.commands);
		return selection;
	}

	protected onHashChange() {
		const component = location.hash.substring(1) || "queue";
		if (component != this.component) { this.component = component; }
	}

	protected onChange(changed: string[]) {
		this.dispatchEvent(new CustomEvent("idle-change", {detail: changed}));
	}

	protected async onClose(_e: CloseEvent) {
		// A shutdown was requested: the connection closing is expected, so do not reconnect
		if (isShuttingDown()) { return; }
		await sleep(3000);
		this.connect();
	}

	protected async connect() {
		const attempts = 3;
		for (let i=0;i<attempts;i++) {
			try {
				const mpd = await MPD.connect();
				mpd.onChange = changed => this.onChange(changed);
				mpd.onClose = e => this.onClose(e);
				this._mpd = mpd;
				return;
			} catch (e) {
				await sleep(500);
			}
		}
		if (isShuttingDown()) { return; }
		alert(`Failed to connect to MPD after ${attempts} attempts. Please reload the page to try again.`);
	}

	protected initMediaHandler() {
		// check support mediaSession
		if (!('mediaSession' in navigator)) {
			console.log('mediaSession is not supported');
			return;
		}

		// DOM (using media session controls are allowed only if there is audio/video tag)
		const audio = html.node("audio", {loop: true}, "", this);
		html.node("source", {src: 'https://raw.githubusercontent.com/anars/blank-audio/master/10-seconds-of-silence.mp3'}, '', audio);

		// Init event session (play audio) on click (because restrictions by web browsers)
		window.addEventListener("click", () => {
			audio.play();
		}, {once: true});

		// mediaSession define metadata
		navigator.mediaSession.metadata = new MediaMetadata({
			title: 'Control Your Player'
		});

		// mediaSession define action handlers
		navigator.mediaSession.setActionHandler('play', () => {
			this.mpd.command("play");
			audio.play();
		});
		navigator.mediaSession.setActionHandler('pause', () => {
			this.mpd.command("pause 1");
			audio.pause();
		});
		navigator.mediaSession.setActionHandler('previoustrack', () => {
			this.mpd.command("previous");
			audio.play();
		});
		navigator.mediaSession.setActionHandler('nexttrack', () => {
			this.mpd.command("next");
			audio.play();
		});
	}
}

customElements.define("cyp-app", App);

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

function waitForChildren(app: App) {
	const children = [...app.querySelectorAll("*")];
	const names = children.map(node => node.nodeName.toLowerCase())
		.filter(name => name.startsWith("cyp-"));
	const unique = new Set(names);

	const promises = [...unique].map(name => customElements.whenDefined(name));
	return Promise.all(promises);
}

async function loadSettings() {
	const response = await fetch("settings");
	const settings: unknown = await response.json();
	if (isYoutubeSettings(settings)) { conf.setYtPath(settings.youtubeDir); }
}
