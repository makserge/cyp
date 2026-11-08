import icons from "./icons.js";


// Properties of an element of type K that may be set when creating it
export type Props<K extends keyof HTMLElementTagNameMap> = Partial<HTMLElementTagNameMap[K]>;

// The element with this id; throws if it is missing or of another type
export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
	const element = document.getElementById(id);
	if (!(element instanceof type)) { throw new Error(`missing element #${id}`); }
	return element;
}

// The first descendant matching selector; throws if it is missing or of another type
export function query<T extends Element>(root: ParentNode, selector: string, type: new () => T): T {
	const found = root.querySelector(selector);
	if (!(found instanceof type)) { throw new Error(`missing element "${selector}"`); }
	return found;
}

export function node<K extends keyof HTMLElementTagNameMap>(name: K, props: Props<K> = {}, content = "", parent?: ParentNode): HTMLElementTagNameMap[K] {
	const element = document.createElement(name);
	Object.assign(element, props);

	if (element.title) { element.setAttribute("aria-label", element.title); }

	if (content) { element.append(content); }
	parent?.append(element);
	return element;
}

export function icon(type: string, parent?: ParentNode): Element {
	const source = icons[type];
	if (!source) {
		console.error("Bad icon type '%s'", type);
		return node("span", {}, "‽");
	}

	const holder = node("div");
	holder.innerHTML = source;
	const svg = holder.querySelector("svg");
	if (!svg) { throw new Error(`Bad icon source for type '${type}'`); }

	svg.classList.add("icon");
	svg.classList.add(`icon-${type}`);

	parent?.append(svg);
	return svg;
}

export interface ButtonProps extends Props<"button"> {
	icon?: string;
}

export function button(props: ButtonProps = {}, content = "", parent?: ParentNode): HTMLButtonElement {
	const { icon: iconType, ...rest } = props;
	const result = node("button", rest, content, parent);
	if (iconType) { result.insertBefore(icon(iconType), result.firstChild); }
	return result;
}

export function clear<T extends Node>(target: T): T {
	while (target.firstChild) { target.firstChild.remove(); }
	return target;
}

export function text(txt: string, parent?: ParentNode): Text {
	const textNode = document.createTextNode(txt);
	parent?.append(textNode);
	return textNode;
}

export function fragment(): DocumentFragment {
	return document.createDocumentFragment();
}
