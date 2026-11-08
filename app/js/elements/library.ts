import * as html from "../html.js";
import Component from "../component.js";
import Tag, { type TagType } from "./tag.js";
import Path from "./path.js";
import Back from "./back.js";
import Song from "./song.js";
import Search from "./search.js";
import Filter from "./filter.js";
import FileTools, { type SortOrder } from "./file-tools.js";
import { escape, serializeFilter, type TagFilter } from "../mpd.js";
import type { PathData, SongData } from "../parser.js";
import * as format from "../format.js";


type OurNode = Song | Path | Tag;

type State = {
	type: "tags";
	tag: TagType;
	filter?: TagFilter;
} | {
	type: "songs";
	filter: TagFilter;
} | {
	type: "path";
	path: string;
	query?: string;
} | {
	type: "search";
	query?: string;
}

const MIN_PATH_QUERY = 2;
const MAX_PATH_RESULTS = 500;
const collator = new Intl.Collator(undefined, {numeric:true, sensitivity:"base"});

interface PathEntry {
	data: PathData;
	isDirectory: boolean;
	name: string;
	modified: number; // ms since epoch, 0 when unknown
	parent?: string; // shown for search results only
}

const TAGS: Record<TagType, string> = {
	"Album": "Albums",
	"AlbumArtist": "Artists",
	"Genre": "Genres"
};

function songsOf(items: HTMLElement[]): OurNode[] {
	return items.filter((item): item is OurNode => item instanceof Song || item instanceof Path || item instanceof Tag);
}

class Library extends Component {
	protected search = new Search();
	protected filter = new Filter();
	protected fileTools = new FileTools();
	protected stateStack: State[] = [];
	protected pathEntries: PathEntry[] = [];
	protected pathNodes: HTMLElement[] = [];
	protected pathToken = 0;

	constructor() {
		super();

		this.search.onSubmit = () => {
			const query = this.search.value;
			if (query.length < 3) { return; }
			this.doSearch(query);
		};

		this.fileTools.onSearch = query => this.searchPath(query);
		this.fileTools.onSort = () => this.renderPathEntries();
	}

	// the state on top of the stack, the one shown; undefined when nothing was pushed
	protected topState(depth = 0): State | undefined {
		return this.stateStack[this.stateStack.length - 1 - depth];
	}

	protected popState() {
		this.selection.clear();
		this.stateStack.pop();

		const state = this.topState();
		if (state) {
			this.showState(state);
		} else {
			this.showRoot();
		}
	}

	protected override onAppLoad() {
		this.showRoot();
	}

	protected override onComponentChange(_c: string, isThis: boolean) {
		const wasHidden = this.hidden;
		this.hidden = !isThis;

		if (!wasHidden && isThis) { this.showRoot(); }
	}

	protected showRoot() {
		this.stateStack = [];
		html.clear(this);

		const nav = html.node("nav", {}, "", this);

		html.button({icon:"artist"}, "Artists and albums", nav)
			.addEventListener("click", _ => this.pushState({type:"tags", tag:"AlbumArtist"}));

		html.button({icon:"music"}, "Genres", nav)
			.addEventListener("click", _ => this.pushState({type:"tags", tag:"Genre"}));

		html.button({icon:"folder"}, "Files and directories", nav)
			.addEventListener("click", _ => this.pushState({type:"path", path:""}));

		html.button({icon:"magnify"}, "Search", nav)
			.addEventListener("click", _ => this.pushState({type:"search"}));
	}

	protected pushState(state: State) {
		this.selection.clear();
		this.stateStack.push(state);

		this.showState(state);
	}

	protected showState(state: State) {
		switch (state.type) {
			case "tags": this.listTags(state.tag, state.filter); break;
			case "songs": this.listSongs(state.filter); break;
			case "path": this.listPath(state.path, state.query); break;
			case "search": this.showSearch(state.query); break;
		}
	}

	protected async listTags(tag: TagType, filter: TagFilter = {}) {
		const values = (await this.mpd.listTags(tag, filter)).filter(nonempty);
		html.clear(this);

		if ("AlbumArtist" in filter || "Genre" in filter) { this.buildBack(); }
		if (values.length > 0) { this.addFilter(); }

		const nodes = values.map(value => this.buildTag(tag, value, filter));
		this.append(...nodes);

		const albumNodes = nodes.filter(node => node.type == "Album");
		this.configureSelection(albumNodes);
	}

	protected async listPath(path: string, query = "") {
		const token = ++this.pathToken;
		const entries = await this.loadPathEntries(path, query);
		if (token != this.pathToken) { return; }

		html.clear(this);
		if (path) { this.buildBack(); }
		this.append(this.fileTools);
		this.fileTools.value = query;
		this.fileTools.pending(false);

		this.pathEntries = entries;
		this.pathNodes = [];
		this.renderPathEntries();
	}

	protected async searchPath(query: string) {
		const state = this.topState();
		if (!state || state.type != "path") { return; }
		state.query = query;

		const token = ++this.pathToken;
		this.fileTools.pending(true);
		const entries = await this.loadPathEntries(state.path, query);
		if (token != this.pathToken) { return; }
		this.fileTools.pending(false);

		this.pathEntries = entries;
		this.renderPathEntries();
	}

	protected async loadPathEntries(path: string, query: string): Promise<PathEntry[]> {
		try {
			if (!query) { return await this.readPath(path); }
			if (query.length < MIN_PATH_QUERY) { return []; }
			return await this.findInPath(path, query);
		} catch (e) {
			console.warn("Cannot list path", path, query, e);
			return [];
		}
	}

	/** Contents of one directory (lsinfo). */
	protected async readPath(path: string) {
		const paths = await this.mpd.listPath(path);
		return [...paths.directory, ...paths.file].map(data => createPathEntry(data));
	}

	/**
	 * Search the MPD database below `base`: folders and files whose name contains the query,
	 * plus songs whose Title tag contains it.
	 */
	protected async findInPath(base: string, query: string): Promise<PathEntry[]> {
		const [byFile, byTitle] = await Promise.all([
			this.mpd.searchTag("file", query, base),
			this.mpd.searchTag("Title", query, base)
		]);

		const needle = query.toLowerCase();
		const prefix = (base ? `${base}/` : "");
		const dirs = new Map<string, number>(); // directory -> newest song inside
		const files = new Map<string, PathEntry>();

		byFile.forEach(song => {
			if (!song.file.startsWith(prefix)) { return; }
			const modified = parseDate(song["Last-Modified"]);
			const segments = song.file.substring(prefix.length).split("/");
			const name = segments.pop() ?? "";

			let dir = base;
			segments.forEach(segment => {
				dir = (dir ? `${dir}/${segment}` : segment);
				if (segment.toLowerCase().includes(needle)) {
					dirs.set(dir, Math.max(dirs.get(dir) || 0, modified));
				}
			});

			if (name.toLowerCase().includes(needle)) { files.set(song.file, createSearchEntry(song, base)); }
		});

		byTitle.forEach(song => {
			if (!files.has(song.file)) { files.set(song.file, createSearchEntry(song, base)); }
		});

		const dirEntries: PathEntry[] = [];
		dirs.forEach((modified, directory) => {
			const entry = createPathEntry({directory}, base);
			entry.modified = modified;
			dirEntries.push(entry);
		});

		return [...dirEntries, ...files.values()];
	}

	protected renderPathEntries() {
		const state = this.topState();
		if (!state || state.type != "path") { return; }

		this.selection.clear();
		this.pathNodes.forEach(node => node.remove());

		const query = state.query || "";
		const order = this.fileTools.sort;
		const sorted = sortPathEntries(this.pathEntries, order);
		const shown = sorted.slice(0, MAX_PATH_RESULTS);

		const nodes = shown.map(entry => {
			const tokens: string[] = [];
			if (entry.parent !== undefined) { tokens.push(entry.parent || "/"); }
			if (order.key == "modified" && entry.modified) { tokens.push(formatDate(entry.modified)); }

			const node = new Path(entry.data, tokens.join(format.SEPARATOR));
			if (entry.isDirectory) {
				const path = entry.data.directory ?? "";
				node.addButton("chevron-double-right", () => this.pushState({type:"path", path}));
			}
			return node;
		});

		let message = "";
		if (query && query.length < MIN_PATH_QUERY) {
			message = `Type at least ${MIN_PATH_QUERY} characters to search`;
		} else if (query && sorted.length == 0) {
			message = `Nothing found for “${query}”`;
		} else if (sorted.length > shown.length) {
			message = `Showing ${shown.length} of ${sorted.length} results, refine your search`;
		}

		this.pathNodes = [...nodes];
		if (message) { this.pathNodes.push(html.node("p", {className:"path-message"}, message)); }

		this.append(...this.pathNodes);
		this.configureSelection(nodes);
	}

	protected async listSongs(filter: TagFilter) {
		const songs = await this.mpd.listSongs(filter);
		html.clear(this);
		this.buildBack();
		if (songs.length > 0) { this.addFilter(); }

		const nodes = songs.map(song => new Song(song));
		this.append(...nodes);

		this.configureSelection(nodes);
	}

	protected showSearch(query = "") {
		html.clear(this);

		this.append(this.search);
		this.search.value = query;
		this.search.focus();

		if (query) { this.search.onSubmit(); }
	}

	protected async doSearch(query: string) {
		const index = this.stateStack.length - 1;
		if (index >= 0) { this.stateStack[index] = { type: "search", query }; }

		html.clear(this);
		this.append(this.search);
		this.search.pending(true);

		const songs1 = await this.mpd.searchSongs({"AlbumArtist": query});
		const songs2 = await this.mpd.searchSongs({"Album": query});
		const songs3 = await this.mpd.searchSongs({"Title": query});

		this.search.pending(false);

		const nodes1 = this.aggregateSearch(songs1, "AlbumArtist");
		const nodes2 = this.aggregateSearch(songs2, "Album");
		const nodes3 = songs3.map(song => new Song(song));
		this.append(...nodes1, ...nodes2, ...nodes3);

		const selectableNodes = [...nodes2, ...nodes3];
		this.configureSelection(selectableNodes);
	}

	protected aggregateSearch(songs: SongData[], tag: TagType): Tag[] {
		const results = new Map<string, TagFilter>();

		songs.forEach(song => {
			const filter: TagFilter = {};
			const artist = song.AlbumArtist || song.Artist;
			let value: string | undefined;

			if (tag == "Album") {
				value = song.Album;
				if (artist) { filter["AlbumArtist"] = artist; }
			}

			if (tag == "AlbumArtist") { value = artist; }

			// a song without the tag has nothing to group under
			if (value !== undefined) { results.set(value, filter); }
		});

		const nodes: Tag[] = [];
		results.forEach((filter, value) => {
			const node = this.buildTag(tag, value, filter);
			nodes.push(node);
		});

		return nodes;
	}

	protected buildTag(tag: TagType, value: string, filter: TagFilter) {
		const node = new Tag(tag, value, filter);
		node.fillArt(this.mpd);

		switch (tag) {
			case "AlbumArtist":
			case "Genre":
				node.onclick = () => this.pushState({type:"tags", tag:"Album", filter:node.createChildFilter()});
			break;

			case "Album":
				node.addButton("chevron-double-right", () => this.pushState({type:"songs", filter:node.createChildFilter()}));
			break;
		}

		return node;
	}

	protected buildBack() {
		const backState = this.topState(1);
		if (!backState) { return; }

		let title = "";
		switch (backState.type) {
			case "path": title = (backState.query ? `Search: ${backState.query}` : ".."); break;
			case "search": title = "Search"; break;
			case "tags": title = TAGS[backState.tag]; break;
		}

		const node = new Back(title);
		this.append(node);
		node.onclick = () => this.popState();
	}

	protected addFilter() {
		this.append(this.filter);
		this.filter.value = "";
	}

	configureSelection(items: OurNode[]) {
		const { selection, mpd } = this;

		const commands = [{
			cb: async (items: HTMLElement[]) => {
				const commands = ["clear", ...songsOf(items).map(createEnqueueCommand), "play"];
				await mpd.command(commands);
				selection.clear(); // fixme notification?
			},
			label:"Play",
			icon:"play"
		}, {
			cb: async (items: HTMLElement[]) => {
				const commands = songsOf(items).map(createEnqueueCommand);
				await mpd.command(commands);
				selection.clear(); // fixme notification?
			},
			label:"Enqueue",
			icon:"plus"
		}];

		selection.configure(items, "multi", commands);
	}
}

customElements.define("cyp-library", Library);

function nonempty(str: string) { return (str.length > 0); }

function parseDate(str?: string) {
	const ms = (str ? Date.parse(str) : NaN);
	return (isNaN(ms) ? 0 : ms);
}

function formatDate(ms: number) {
	return new Date(ms).toLocaleString(undefined, {
		year: "numeric", month: "short", day: "numeric",
		hour: "2-digit", minute: "2-digit"
	});
}

function createPathEntry(data: PathData, searchBase?: string): PathEntry {
	const isDirectory = ("directory" in data);
	const uri = (isDirectory ? data.directory : data.file) || "";
	const entry: PathEntry = {
		data,
		isDirectory,
		name: format.fileName(uri),
		modified: parseDate(data["Last-Modified"])
	};

	if (searchBase !== undefined) { // show where the result lives, relative to the searched folder
		const prefix = (searchBase ? `${searchBase}/` : "");
		entry.parent = uri.substring(prefix.length).split("/").slice(0, -1).join("/");
	}

	return entry;
}

function createSearchEntry(song: SongData, base: string) {
	return createPathEntry({file:song.file, "Last-Modified":song["Last-Modified"]}, base);
}

/** Folders always first, then by the selected key; ties fall back to name/path A to Z. */
function sortPathEntries(entries: PathEntry[], order: SortOrder) {
	const sign = (order.desc ? -1 : 1);
	const uri = (entry: PathEntry) => (entry.data.directory || entry.data.file || "");

	return entries.slice().sort((a, b) => {
		if (a.isDirectory != b.isDirectory) { return (a.isDirectory ? -1 : 1); }

		const diff = (order.key == "modified" ? a.modified - b.modified : collator.compare(a.name, b.name));
		if (diff) { return diff * sign; }

		return collator.compare(a.name, b.name) || collator.compare(uri(a), uri(b));
	});
}

function createEnqueueCommand(node: OurNode) {
	if (node instanceof Song || node instanceof Path) {
		return `add "${escape(node.file)}"`;
	} else {
		return [
			"findadd",
			serializeFilter(node.createChildFilter()),
			// `sort ${SORT}` // MPD >= 0.22, not yet released
		].join(" ");
	}
}
