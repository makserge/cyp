import App from "./elements/app.js";
import type Selection from "./selection.js";


export default abstract class Component extends HTMLElement {
	private _selection?: Selection;

	connectedCallback() {
		const { app } = this;

		app.addEventListener("load", _ => this.onAppLoad());
		app.addEventListener("component-change", _ => {
			const component = app.component;
			const isThis = (this.nodeName.toLowerCase() == `cyp-${component}`);
			this.onComponentChange(component, isThis);
		});
	}

	protected get app(): App {
		const app = this.closest("cyp-app");
		if (!(app instanceof App)) { throw new Error(`${this.nodeName} is not inside cyp-app`); }
		return app;
	}

	protected get mpd() { return this.app.mpd; }

	// The selection bar of the footer, created on first use
	protected get selection(): Selection {
		return this._selection ??= this.app.createSelection();
	}

	protected onAppLoad(): void {}
	protected onComponentChange(_component: string, _isThis: boolean): void {}
}
