import * as html from "./html.js";


export default class Item extends HTMLElement {
	addButton(icon: string, cb: Function) {
		html.button({icon}, "", this).addEventListener("click", e => {
			e.stopPropagation(); // do not select/activate/whatever
			cb();
		});
	}

	protected buildTitle(title: string) {
		return html.node("span", {className:"title"}, title, this);
	}

	matchPrefix(prefix: string) {
		// split on whitespace and ASCII punctuation only, so non-latin words (é, ü, cyrillic…) stay intact
		const words = (this.textContent || "").toLowerCase().split(/[\s!-\/:-@\[-`{-~·]+/);
		return words.some(word => word.startsWith(prefix));
	}
}
