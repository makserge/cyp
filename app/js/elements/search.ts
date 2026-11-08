import * as html from "../html.js";


export default class Search extends HTMLElement {
	onSubmit: () => void = () => {};

	constructor() {
		super();

		const form = html.node("form", {}, "", this);
		html.node("input", {type:"text"}, "", form);
		html.button({icon:"magnify"}, "", form);

		form.addEventListener("submit", e => {
			e.preventDefault();
			this.onSubmit();
		});
	}

	get value() { return this.input.value.trim(); }
	set value(value: string) { this.input.value = value; }
	protected get input() { return html.query(this, "input", HTMLInputElement); }

	override focus() { this.input.focus(); }
	pending(pending: boolean) { this.classList.toggle("pending", pending); }
}

customElements.define("cyp-search", Search);
