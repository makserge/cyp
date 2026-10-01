import * as html from "../html.js";


export type SortKey = "name" | "modified";
export interface SortOrder {
	key: SortKey;
	desc: boolean;
}

const STORAGE_KEY = "cyp-library-sort";
const DEBOUNCE = 400;
const LABELS: Record<SortKey, string> = {
	name: "Name",
	modified: "Date"
};

function loadSort(): SortOrder {
	try {
		const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
		if (data && (data.key == "name" || data.key == "modified") && typeof data.desc == "boolean") {
			return {key:data.key, desc:data.desc};
		}
	} catch (e) {}
	return {key:"name", desc:false};
}

function saveSort(order: SortOrder) {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch (e) {}
}

function describe(order: SortOrder) {
	if (order.key == "name") { return (order.desc ? "Name, Z to A" : "Name, A to Z"); }
	return (order.desc ? "Modified, newest first" : "Modified, oldest first");
}


/** Search box + sort switches for the "Files and directories" library view. */
export default class FileTools extends HTMLElement {
	protected form: HTMLFormElement;
	protected input: HTMLInputElement;
	protected buttons: Record<SortKey, HTMLButtonElement>;
	protected order = loadSort();
	protected timeout?: number;
	protected lastQuery = "";

	constructor() {
		super();

		this.form = html.node("form", {}, "", this);
		html.icon("magnify", this.form);
		this.input = html.node("input", {
			type: "search",
			placeholder: "Search files and folders",
			autocomplete: "off",
			spellcheck: false
		}, "", this.form);

		this.form.addEventListener("submit", e => {
			e.preventDefault();
			this.input.blur(); // hide mobile keyboard
			this.submit();
		});
		this.input.addEventListener("input", _ => {
			clearTimeout(this.timeout);
			this.timeout = window.setTimeout(() => this.submit(), DEBOUNCE);
		});

		const sort = html.node("div", {className:"sort"}, "", this);
		this.buttons = {
			name: html.button({type:"button"}, "", sort),
			modified: html.button({type:"button"}, "", sort)
		};
		(Object.keys(this.buttons) as SortKey[]).forEach(key => {
			this.buttons[key].addEventListener("click", _ => this.toggleSort(key));
		});
		this.syncButtons();
	}

	get value() { return this.input.value.trim(); }
	set value(value) {
		clearTimeout(this.timeout);
		this.input.value = value;
		this.lastQuery = this.value;
	}

	get sort(): SortOrder { return {...this.order}; }

	onSearch(query: string) {}
	onSort(order: SortOrder) {}

	pending(pending: boolean) { this.classList.toggle("pending", pending); }

	protected submit() {
		clearTimeout(this.timeout);
		const query = this.value;
		if (query == this.lastQuery) { return; }
		this.lastQuery = query;
		this.onSearch(query);
	}

	protected toggleSort(key: SortKey) {
		if (this.order.key == key) {
			this.order.desc = !this.order.desc;
		} else {
			// names start A to Z, dates start with the newest
			this.order = {key, desc:(key == "modified")};
		}
		saveSort(this.order);
		this.syncButtons();
		this.onSort(this.sort);
	}

	protected syncButtons() {
		(Object.keys(this.buttons) as SortKey[]).forEach(key => {
			const button = this.buttons[key];
			const active = (this.order.key == key);
			html.clear(button);
			html.text(LABELS[key], button);
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", String(active));

			if (active) {
				html.icon(this.order.desc ? "arrow-down-bold" : "arrow-up-bold", button);
				const next = {key, desc:!this.order.desc};
				button.title = `Sorted by ${describe(this.order)}. Click for ${describe(next)}.`;
			} else {
				button.title = `Sort by ${describe({key, desc:(key == "modified")})}`;
			}
		});
	}
}

customElements.define("cyp-file-tools", FileTools);
