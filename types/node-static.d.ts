// node-static (static file server) has no type definitions: this declares the parts cyp uses
declare module "node-static" {
	import type { IncomingMessage, ServerResponse } from "http";

	export class Server {
		constructor(root: string, options?: Record<string, unknown>);
		serve(request: IncomingMessage, response: ServerResponse): unknown;
	}
}
