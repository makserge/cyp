import Component from "../component.js";
import * as html from "../html.js";


class Menu extends Component {
	protected tabs = [...this.querySelectorAll<HTMLElement>("[data-for]")];

	override connectedCallback() {
		super.connectedCallback();

		this.tabs.forEach(tab => {
			tab.addEventListener("click", _ => this.app.setAttribute("component", tab.dataset["for"] ?? ""));
		});
	}

	protected override onAppLoad() {
		this.app.addEventListener("queue-length-change", e => {
			html.query(this, ".queue-length", HTMLElement).textContent = `(${e.detail})`;
		});
	}

	protected override onComponentChange(component: string) {
		this.tabs.forEach(tab => {
			tab.classList.toggle("active", tab.dataset["for"] == component);
		});
	}
}

customElements.define("cyp-menu", Menu);
