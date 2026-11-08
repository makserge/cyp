import * as html from "../html.js";
import Item from "../item.js";


const SELECTOR = ["cyp-tag", "cyp-path", "cyp-song"].join(", ");

export default class Filter extends HTMLElement {
	constructor() {
		super();

		html.node("input", {type:"text"}, "", this);
		html.icon("filter-variant", this);

		this.input.addEventListener("input", _ => this.apply());
	}

	get value() { return this.input.value.trim(); }
	set value(value: string) { this.input.value = value; }
	protected get input() { return html.query(this, "input", HTMLInputElement); }

	protected apply() {
		const value = this.value.toLowerCase();
		const parent = this.parentNode;
		if (!parent) { return; }
		[...parent.querySelectorAll(SELECTOR)].forEach(item => {
			if (item instanceof Item) { item.hidden = !item.matchPrefix(value); }
		});
	}
}

customElements.define("cyp-filter", Filter);
