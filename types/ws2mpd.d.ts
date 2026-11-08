// ws2mpd (WebSocket bridge to MPD) has no type definitions: this declares the parts cyp uses
declare module "ws2mpd" {
	import type { Server } from "http";

	// what ws2mpd passes to requestValidator for each WebSocket connection
	export interface WebSocketRequest {
		resourceURL: { query: Record<string, string | undefined> };
	}

	export function ws2mpd(
		httpServer: Server,
		requestValidator: (request: WebSocketRequest) => boolean,
		passwords: Record<string, string>,
	): void;

	export function logging(enabled: boolean): void;
}
