export const artSize = 96 * (window.devicePixelRatio || 1);
export let ytPath = "_youtube";
export let ytLimit = 3;

// Set when a shutdown was requested: the connection closing is then expected
export let shuttingDown = false;
export function beginShutdown() { shuttingDown = true; }

export function setYtLimit(limit: number) { ytLimit = limit; }
export function setYtPath(path: string) { ytPath = path; }
