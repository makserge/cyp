// the slider element used by the player (x-range), from the custom-range package
import "custom-range/range.js";


// The parts of x-range that cyp uses
export interface XRange extends HTMLElement {
	value: string;
	max: string;
	disabled: boolean;
	readonly valueAsNumber: number;
}

// custom-range defines valueAsNumber on its class, so the check is on that property
export function isXRange(element: Element): element is XRange {
	return "valueAsNumber" in element;
}
