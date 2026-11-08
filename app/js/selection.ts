import * as html from "./html.js";


type Mode = "single" | "multi";

export interface Command {
	// gets the selected items; each caller narrows them to the kind it configured
	cb: (items: HTMLElement[]) => unknown;
	label: string;
	icon: string;
	className?: string;
}

export default class Selection {
	readonly commands = new Commands();
	protected items: HTMLElement[] = [];
	protected mode: Mode = "multi";

	constructor() {
		this.hide();
	}

	configure(items: HTMLElement[], mode: Mode, commands: Command[]) {
		this.mode = mode;

		const allCommands: Command[] = [];

		if (mode == "multi") {
			allCommands.push({
				cb: () => items.forEach(item => this.add(item)),
				label:"Select all",
				icon:"checkbox-marked-outline"
			});
		}

		allCommands.push(...commands);

		allCommands.push({
			cb: () => this.clear(),
			icon: "cancel",
			label: "Cancel",
			className: "last"
		});

		const buttons = allCommands.map(command => {
			const button = buildButton(command);
			button.addEventListener("click", _ => {
				command.cb([...this.items]);
			});
			return button;
		});

		this.commands.innerHTML = "";
		this.commands.append(...buttons);

		items.forEach(item => {
			item.onclick = () => this.toggle(item);
		});

		this.clear();
	}

	clear() {
		for (const item of [...this.items]) { this.remove(item); }
	}

	protected toggle(node: HTMLElement) {
		if (this.items.includes(node)) {
			this.remove(node);
		} else {
			this.add(node);
		}
	}

	protected add(node: HTMLElement) {
		if (this.items.includes(node)) { return; }
		const length = this.items.length;
		this.items.push(node);
		node.classList.add("selected");

		const first = this.items[0];
		if (this.mode == "single" && length > 0 && first) { this.remove(first); }

		if (length == 0) { this.show(); }
	}

	protected remove(node: HTMLElement) {
		const index = this.items.indexOf(node);
		if (index < 0) { return; }
		this.items.splice(index, 1);
		node.classList.remove("selected");
		if (this.items.length == 0) { this.hide(); }
	}

	protected show() { this.commands.hidden = false; }
	protected hide() { this.commands.hidden = true; }
}

function buildButton(command: Command) {
	const button = html.button({icon:command.icon});
	if (command.className) { button.className = command.className; }
	html.node("span", {}, command.label, button);
	return button;
}

class Commands extends HTMLElement {}
customElements.define("cyp-commands", Commands);
