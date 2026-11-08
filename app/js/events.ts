import type { SongData } from "./parser.js";


// The events cyp dispatches on its elements, typed for addEventListener
declare global {
	interface HTMLElementEventMap {
		"component-change": Event;
		"idle-change": CustomEvent<string[]>;
		"song-change": CustomEvent<SongData>;
		"queue-length-change": CustomEvent<number>;
	}
}

export {};
