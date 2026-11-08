import Component from "../component.js";
import * as conf from "../conf.js";
import * as html from "../html.js";


const prefix = "cyp";

function loadFromStorage(key: string) {
	return localStorage.getItem(`${prefix}-${key}`);
}

function saveToStorage(key: string, value: string | number) {
	localStorage.setItem(`${prefix}-${key}`, String(value));
}

class Settings extends Component {
	protected theme = html.query(this, "[name=theme]", HTMLSelectElement);
	protected ytLimit = html.query(this, "[name=yt-limit]", HTMLSelectElement);
	protected colors = [...this.querySelectorAll("[name=color]")]
		.filter((input): input is HTMLInputElement => input instanceof HTMLInputElement);

	protected override onAppLoad() {
		const mo = new MutationObserver(mrs => {
			mrs.forEach(mr => this.onAppAttributeChange(mr));
		});
		mo.observe(this.app, {attributes:true});

		this.theme.addEventListener("change", _ => this.setTheme(this.theme.value));
		this.ytLimit.addEventListener("change", _ => this.setYtLimit(Number(this.ytLimit.value)));
		this.colors.forEach(input => {
			input.addEventListener("click", _ => this.setColor(input.value));
		});

		const theme = loadFromStorage("theme");
		(theme ? this.app.setAttribute("theme", theme) : this.syncTheme());

		const color = loadFromStorage("color");
		(color ? this.app.setAttribute("color", color) : this.syncColor());

		const ytLimit = loadFromStorage("ytLimit") || conf.ytLimit;
		this.setYtLimit(Number(ytLimit));
	}

	protected onAppAttributeChange(mr: MutationRecord) {
		if (mr.attributeName == "theme") { this.syncTheme(); }
		if (mr.attributeName == "color") { this.syncColor(); }
	}

	protected syncTheme() {
		this.theme.value = this.app.getAttribute("theme") ?? "";
	}

	protected syncColor() {
		this.colors.forEach(input => {
			input.checked = (input.value == this.app.getAttribute("color"));
			if (input.parentElement) { input.parentElement.style.color = input.value; }
		});
	}

	protected setTheme(theme: string) {
		saveToStorage("theme", theme);
		this.app.setAttribute("theme", theme);
	}

	protected setColor(color: string) {
		saveToStorage("color", color);
		this.app.setAttribute("color", color);
	}

	protected setYtLimit(ytLimit: number) {
		saveToStorage("ytLimit", ytLimit);
		conf.setYtLimit(ytLimit);
	}

	protected override onComponentChange(_c: string, isThis: boolean) {
		this.hidden = !isThis;
	}
}

customElements.define("cyp-settings", Settings);
