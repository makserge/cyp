"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __objRest = (source, exclude) => {
    var target = {};
    for (var prop in source)
      if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
        target[prop] = source[prop];
    if (source != null && __getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(source)) {
        if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
          target[prop] = source[prop];
      }
    return target;
  };

  // node_modules/custom-range/range.js
  var Range = class extends HTMLElement {
    static get observedAttributes() {
      return ["min", "max", "value", "step", "disabled"];
    }
    constructor() {
      super();
      this._dom = {};
      this.addEventListener("mousedown", this);
      this.addEventListener("keydown", this);
    }
    get _valueAsNumber() {
      let raw = this.hasAttribute("value") ? Number(this.getAttribute("value")) : 50;
      return this._constrain(raw);
    }
    get _minAsNumber() {
      return this.hasAttribute("min") ? Number(this.getAttribute("min")) : 0;
    }
    get _maxAsNumber() {
      return this.hasAttribute("max") ? Number(this.getAttribute("max")) : 100;
    }
    get _stepAsNumber() {
      return this.hasAttribute("step") ? Number(this.getAttribute("step")) : 1;
    }
    get value() {
      return String(this._valueAsNumber);
    }
    get valueAsNumber() {
      return this._valueAsNumber;
    }
    get min() {
      return this.hasAttribute("min") ? this.getAttribute("min") : "";
    }
    get max() {
      return this.hasAttribute("max") ? this.getAttribute("max") : "";
    }
    get step() {
      return this.hasAttribute("step") ? this.getAttribute("step") : "";
    }
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set _valueAsNumber(value) {
      this.value = String(value);
    }
    set min(min) {
      this.setAttribute("min", min);
    }
    set max(max) {
      this.setAttribute("max", max);
    }
    set value(value) {
      this.setAttribute("value", value);
    }
    set step(step) {
      this.setAttribute("step", step);
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }
    connectedCallback() {
      if (this.firstChild) {
        return;
      }
      this.innerHTML = `
			<span class="-track"></span>
			<span class="-elapsed"></span>
			<span class="-remaining"></span>
			<div class="-inner">
				<button class="-thumb"></button>
			</div>
		`;
      Array.from(this.querySelectorAll("[class^='-']")).forEach((node2) => {
        let name = node2.className.substring(1);
        this._dom[name] = node2;
      });
      this._update();
    }
    attributeChangedCallback(name, oldValue, newValue) {
      if (!this.firstChild) {
        return;
      }
      switch (name) {
        case "min":
        case "max":
        case "value":
        case "step":
          this._update();
          break;
      }
    }
    handleEvent(e) {
      switch (e.type) {
        case "mousedown":
          if (this.disabled) {
            return;
          }
          document.addEventListener("mousemove", this);
          document.addEventListener("mouseup", this);
          this._setToMouse(e);
          break;
        case "mousemove":
          this._setToMouse(e);
          break;
        case "mouseup":
          document.removeEventListener("mousemove", this);
          document.removeEventListener("mouseup", this);
          this.dispatchEvent(new CustomEvent("change"));
          break;
        case "keydown":
          if (this.disabled) {
            return;
          }
          this._handleKey(e.code);
          this.dispatchEvent(new CustomEvent("input"));
          this.dispatchEvent(new CustomEvent("change"));
          break;
      }
    }
    _handleKey(code) {
      let min = this._minAsNumber;
      let max = this._maxAsNumber;
      let range = max - min;
      let step = this._stepAsNumber;
      switch (code) {
        case "ArrowLeft":
        case "ArrowDown":
          this._valueAsNumber = this._constrain(this._valueAsNumber - step);
          break;
        case "ArrowRight":
        case "ArrowUp":
          this._valueAsNumber = this._constrain(this._valueAsNumber + step);
          break;
        case "Home":
          this._valueAsNumber = this._constrain(min);
          break;
        case "End":
          this._valueAsNumber = this._constrain(max);
          break;
        case "PageUp":
          this._valueAsNumber = this._constrain(this._valueAsNumber + range / 10);
          break;
        case "PageDown":
          this._valueAsNumber = this._constrain(this._valueAsNumber - range / 10);
          break;
      }
    }
    _constrain(value) {
      const min = this._minAsNumber;
      const max = this._maxAsNumber;
      const step = this._stepAsNumber;
      value = Math.max(value, min);
      value = Math.min(value, max);
      value -= min;
      value = Math.round(value / step) * step;
      value += min;
      if (value > max) {
        value -= step;
      }
      return value;
    }
    _update() {
      let min = this._minAsNumber;
      let max = this._maxAsNumber;
      let frac = (this._valueAsNumber - min) / (max - min);
      this._dom.thumb.style.left = `${frac * 100}%`;
      this._dom.remaining.style.left = `${frac * 100}%`;
      this._dom.elapsed.style.width = `${frac * 100}%`;
    }
    _setToMouse(e) {
      let rect = this._dom.inner.getBoundingClientRect();
      let x = e.clientX;
      x = Math.max(x, rect.left);
      x = Math.min(x, rect.right);
      let min = this._minAsNumber;
      let max = this._maxAsNumber;
      let frac = (x - rect.left) / (rect.right - rect.left);
      let value = this._constrain(min + frac * (max - min));
      if (value == this._valueAsNumber) {
        return;
      }
      this._valueAsNumber = value;
      this.dispatchEvent(new CustomEvent("input"));
    }
  };
  customElements.define("x-range", Range);

  // app/js/range.ts
  function isXRange(element) {
    return "valueAsNumber" in element;
  }

  // app/js/parser.ts
  function linesToStruct(lines) {
    const result = {};
    for (const line of lines) {
      const cindex = line.indexOf(":");
      if (cindex == -1) {
        throw new Error(`Malformed line "${line}"`);
      }
      const key = line.substring(0, cindex);
      const value = line.substring(cindex + 2);
      const old = result[key];
      if (old === void 0) {
        result[key] = value;
      } else if (Array.isArray(old)) {
        old.push(value);
      } else {
        result[key] = [old, value];
      }
    }
    return result;
  }
  function songList(lines) {
    const songs = [];
    let batch = [];
    for (const line of lines) {
      if (line.startsWith("file:") && batch.length) {
        songs.push(linesToStruct(batch));
        batch = [];
      }
      batch.push(line);
    }
    if (batch.length) {
      songs.push(linesToStruct(batch));
    }
    return songs;
  }
  function pathKind(prefix2) {
    switch (prefix2) {
      case "file":
        return "file";
      case "directory":
        return "directory";
      case "playlist":
        return "playlist";
      default:
        return null;
    }
  }
  function pathContents(lines) {
    var _a;
    const result = { file: [], directory: [], playlist: [] };
    let batch = [];
    let batchKind = null;
    const flush = () => {
      if (batch.length && batchKind) {
        result[batchKind].push(linesToStruct(batch));
      }
    };
    for (const line of lines) {
      const kind = pathKind((_a = line.split(":")[0]) != null ? _a : "");
      if (kind) {
        flush();
        batchKind = kind;
        batch = [];
      }
      batch.push(line);
    }
    flush();
    return result;
  }

  // app/js/mpd.ts
  function isTicket(data) {
    return typeof data == "object" && data !== null && "ticket" in data && typeof data.ticket == "string";
  }
  function isReply(data) {
    return Array.isArray(data) && data.every((item) => typeof item == "string" || Array.isArray(item));
  }
  function toArray(value) {
    if (value === void 0) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }
  function textLines(lines) {
    return lines.map((line) => {
      if (typeof line != "string") {
        throw new Error("unexpected binary data in reply");
      }
      return line;
    });
  }
  var MPD = class {
    constructor(ws, initialCommand) {
      this.ws = ws;
      this.queue = [];
      this.canTerminateIdle = false;
      // set by the app: called when the connection closes, and with the names of subsystems that changed
      this.onClose = () => {
      };
      this.onChange = () => {
      };
      this.current = initialCommand;
      ws.addEventListener("message", (e) => this._onMessage(e));
      ws.addEventListener("close", (e) => this._onClose(e));
    }
    static async connect() {
      const response = await fetch("ticket", { method: "POST" });
      const data = await response.json();
      if (!isTicket(data)) {
        throw new Error("no ticket from the server");
      }
      const ws = new WebSocket(createURL(data.ticket).href);
      return new Promise((resolve, reject) => {
        const mpd = new this(ws, { cmd: "", resolve: () => resolve(mpd), reject });
      });
    }
    command(cmds) {
      return this.send(cmds).then(textLines);
    }
    status() {
      return this.command("status").then((lines) => linesToStruct(lines));
    }
    async currentSong() {
      const lines = await this.command("currentsong");
      return linesToStruct(lines);
    }
    async listQueue() {
      const lines = await this.command("playlistinfo");
      return songList(lines);
    }
    async listPlaylists() {
      const lines = await this.command("listplaylists");
      return toArray(linesToStruct(lines).playlist);
    }
    async listPlaylistItems(name) {
      const lines = await this.command(`listplaylistinfo "${escape(name)}"`);
      return songList(lines);
    }
    async listPath(path) {
      const lines = await this.command(`lsinfo "${escape(path)}"`);
      return pathContents(lines);
    }
    async listTags(tag, filter = {}) {
      const tokens = ["list", tag];
      const fakeGroup = Object.keys(filter)[0];
      if (fakeGroup !== void 0) {
        tokens.push(serializeFilter(filter));
        tokens.push("group", fakeGroup);
      }
      const lines = await this.command(tokens.join(" "));
      const parsed = linesToStruct(lines);
      return toArray(parsed[tag]);
    }
    async listSongs(filter, window2) {
      const tokens = ["find", serializeFilter(filter)];
      if (window2) {
        tokens.push("window", window2.join(":"));
      }
      const lines = await this.command(tokens.join(" "));
      return songList(lines);
    }
    async searchSongs(filter) {
      const tokens = ["search", serializeFilter(filter, "contains")];
      const lines = await this.command(tokens.join(" "));
      return songList(lines);
    }
    /**
     * Case-insensitive substring search of a single tag (or "file" for the song URI),
     * optionally restricted to songs below the `base` directory.
     */
    async searchTag(tag, query2, base = "") {
      const parts = [`(${tag} contains "${escape(query2)}")`];
      if (base) {
        parts.push(`(base "${escape(base)}")`);
      }
      const filterStr = `(${parts.join(" AND ")})`;
      const lines = await this.command(`search "${escape(filterStr)}"`);
      return songList(lines);
    }
    async albumArt(songUrl) {
      let data = [];
      let offset = 0;
      for (; ; ) {
        const params = ["albumart", `"${escape(songUrl)}"`, String(offset)];
        try {
          const lines = await this.send(params.join(" "), true);
          const bytes = lines[2];
          if (!Array.isArray(bytes)) {
            return null;
          }
          data = data.concat(bytes);
          const metadata = linesToStruct(textLines(lines.slice(0, 2)));
          if (data.length >= Number(metadata.size)) {
            return data;
          }
          offset += Number(metadata.binary);
        } catch (e) {
          return null;
        }
      }
    }
    _onMessage(e) {
      if (!this.current) {
        return;
      }
      const { current } = this;
      this.current = void 0;
      const lines = JSON.parse(e.data);
      if (!isReply(lines) || lines.length == 0) {
        current.reject("malformed reply from the server");
      } else {
        const last = lines[lines.length - 1];
        if (typeof last == "string" && last.startsWith("OK")) {
          current.resolve(lines.slice(0, -1));
        } else {
          if (!current.quiet) {
            console.warn(last);
          }
          current.reject(String(last));
        }
      }
      if (this.queue.length > 0) {
        this.advanceQueue();
      } else {
        setTimeout(() => this.idle(), 0);
      }
    }
    _onClose(e) {
      var _a;
      console.warn(e);
      (_a = this.current) == null ? void 0 : _a.reject(e);
      this.onClose(e);
    }
    // Sends one command (or a command list) and resolves with the raw reply
    send(cmds, quiet = false) {
      const cmd = Array.isArray(cmds) ? ["command_list_begin", ...cmds, "command_list_end"].join("\n") : cmds;
      return new Promise((resolve, reject) => {
        this.queue.push({ cmd, resolve, reject, quiet });
        if (!this.current) {
          this.advanceQueue();
        } else if (this.canTerminateIdle) {
          this.ws.send("noidle");
          this.canTerminateIdle = false;
        }
      });
    }
    advanceQueue() {
      const next = this.queue.shift();
      if (!next) {
        return;
      }
      this.current = next;
      this.ws.send(next.cmd);
    }
    async idle() {
      if (this.current) {
        return;
      }
      this.canTerminateIdle = true;
      const lines = await this.command("idle stored_playlist playlist player options mixer");
      this.canTerminateIdle = false;
      const changed = toArray(linesToStruct(lines).changed);
      if (changed.length > 0) {
        this.onChange(changed);
      }
    }
  };
  function escape(str) {
    return str.replace(/(['"\\])/g, "\\$1");
  }
  function serializeFilter(filter, operator = "==") {
    const tokens = ["("];
    Object.entries(filter).forEach(([key, value], index) => {
      if (index) {
        tokens.push(" AND ");
      }
      tokens.push(`(${key} ${operator} "${escape(value)}")`);
    });
    tokens.push(")");
    const filterStr = tokens.join("");
    return `"${escape(filterStr)}"`;
  }
  function createURL(ticket) {
    const url = new URL(location.href);
    url.protocol = url.protocol == "https:" ? "wss" : "ws";
    url.hash = "";
    url.searchParams.set("ticket", ticket);
    return url;
  }

  // app/js/icons.ts
  var ICONS = {};
  ICONS["playlist-music"] = `<svg viewBox="0 0 24 24">
  <path d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>
</svg>`;
  ICONS["folder"] = `<svg viewBox="0 0 24 24">
  <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
</svg>`;
  ICONS["shuffle"] = `<svg viewBox="0 0 24 24">
  <path d="M14.83,13.41L13.42,14.82L16.55,17.95L14.5,20H20V14.5L17.96,16.54L14.83,13.41M14.5,4L16.54,6.04L4,18.59L5.41,20L17.96,7.46L20,9.5V4M10.59,9.17L5.41,4L4,5.41L9.17,10.58L10.59,9.17Z"/>
</svg>`;
  ICONS["artist"] = `<svg viewBox="0 0 24 24">
  <path d="M11,14C12,14 13.05,14.16 14.2,14.44C13.39,15.31 13,16.33 13,17.5C13,18.39 13.25,19.23 13.78,20H3V18C3,16.81 3.91,15.85 5.74,15.12C7.57,14.38 9.33,14 11,14M11,12C9.92,12 9,11.61 8.18,10.83C7.38,10.05 7,9.11 7,8C7,6.92 7.38,6 8.18,5.18C9,4.38 9.92,4 11,4C12.11,4 13.05,4.38 13.83,5.18C14.61,6 15,6.92 15,8C15,9.11 14.61,10.05 13.83,10.83C13.05,11.61 12.11,12 11,12M18.5,10H20L22,10V12H20V17.5A2.5,2.5 0 0,1 17.5,20A2.5,2.5 0 0,1 15,17.5A2.5,2.5 0 0,1 17.5,15C17.86,15 18.19,15.07 18.5,15.21V10Z"/>
</svg>`;
  ICONS["download"] = `<svg viewBox="0 0 24 24">
  <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
</svg>`;
  ICONS["checkbox-marked-outline"] = `<svg viewBox="0 0 24 24">
  <path d="M19,19H5V5H15V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V11H19M7.91,10.08L6.5,11.5L11,16L21,6L19.59,4.58L11,13.17L7.91,10.08Z"/>
</svg>`;
  ICONS["magnify"] = `<svg viewBox="0 0 24 24">
  <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
</svg>`;
  ICONS["delete"] = `<svg viewBox="0 0 24 24">
  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
</svg>`;
  ICONS["rewind"] = `<svg viewBox="0 0 24 24">
  <path d="M11.5,12L20,18V6M11,18V6L2.5,12L11,18Z"/>
</svg>`;
  ICONS["cancel"] = `<svg viewBox="0 0 24 24">
  <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12C4,13.85 4.63,15.55 5.68,16.91L16.91,5.68C15.55,4.63 13.85,4 12,4M12,20A8,8 0 0,0 20,12C20,10.15 19.37,8.45 18.32,7.09L7.09,18.32C8.45,19.37 10.15,20 12,20Z"/>
</svg>`;
  ICONS["settings"] = `<svg viewBox="0 0 24 24">
  <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
</svg>`;
  ICONS["pause"] = `<svg viewBox="0 0 24 24">
  <path d="M14,19H18V5H14M6,19H10V5H6V19Z"/>
</svg>`;
  ICONS["arrow-down-bold"] = `<svg viewBox="0 0 24 24">
  <path d="M9,4H15V12H19.84L12,19.84L4.16,12H9V4Z"/>
</svg>`;
  ICONS["filter-variant"] = `<svg viewBox="0 0 24 24">
  <path d="M6,13H18V11H6M3,6V8H21V6M10,18H14V16H10V18Z"/>
</svg>`;
  ICONS["volume-off"] = `<svg viewBox="0 0 24 24">
  <path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"/>
</svg>`;
  ICONS["close"] = `<svg viewBox="0 0 24 24">
  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
</svg>`;
  ICONS["music"] = `<svg viewBox="0 0 24 24">
  <path d="M21,3V15.5A3.5,3.5 0 0,1 17.5,19A3.5,3.5 0 0,1 14,15.5A3.5,3.5 0 0,1 17.5,12C18.04,12 18.55,12.12 19,12.34V6.47L9,8.6V17.5A3.5,3.5 0 0,1 5.5,21A3.5,3.5 0 0,1 2,17.5A3.5,3.5 0 0,1 5.5,14C6.04,14 6.55,14.12 7,14.34V6L21,3Z"/>
</svg>`;
  ICONS["repeat"] = `<svg viewBox="0 0 24 24">
  <path d="M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z"/>
</svg>`;
  ICONS["arrow-up-bold"] = `<svg viewBox="0 0 24 24">
  <path d="M15,20H9V12H4.16L12,4.16L19.84,12H15V20Z"/>
</svg>`;
  ICONS["keyboard-backspace"] = `<svg viewBox="0 0 24 24">
  <path d="M21,11H6.83L10.41,7.41L9,6L3,12L9,18L10.41,16.58L6.83,13H21V11Z"/>
</svg>`;
  ICONS["play"] = `<svg viewBox="0 0 24 24">
  <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
</svg>`;
  ICONS["plus"] = `<svg viewBox="0 0 24 24">
  <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
</svg>`;
  ICONS["content-save"] = `<svg viewBox="0 0 24 24">
  <path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/>
</svg>`;
  ICONS["library-music"] = `<svg viewBox="0 0 24 24">
  <path d="M4,6H2V20A2,2 0 0,0 4,22H18V20H4M18,7H15V12.5A2.5,2.5 0 0,1 12.5,15A2.5,2.5 0 0,1 10,12.5A2.5,2.5 0 0,1 12.5,10C13.07,10 13.58,10.19 14,10.5V5H18M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2Z"/>
</svg>`;
  ICONS["fast-forward"] = `<svg viewBox="0 0 24 24">
  <path d="M13,6V18L21.5,12M4,18L12.5,12L4,6V18Z"/>
</svg>`;
  ICONS["volume-high"] = `<svg viewBox="0 0 24 24">
  <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
</svg>`;
  ICONS["chevron-double-right"] = `<svg viewBox="0 0 24 24">
  <path d="M5.59,7.41L7,6L13,12L7,18L5.59,16.59L10.17,12L5.59,7.41M11.59,7.41L13,6L19,12L13,18L11.59,16.59L16.17,12L11.59,7.41Z"/>
</svg>`;
  ICONS["album"] = `<svg viewBox="0 0 24 24">
  <path d="M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12,16.5C9.5,16.5 7.5,14.5 7.5,12C7.5,9.5 9.5,7.5 12,7.5C14.5,7.5 16.5,9.5 16.5,12C16.5,14.5 14.5,16.5 12,16.5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
</svg>`;
  ICONS["minus_unused"] = `<svg viewBox="0 0 24 24">
  <path d="M19,13H5V11H19V13Z"/>
</svg>`;
  var icons_default = ICONS;

  // app/js/html.ts
  function byId(id, type) {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
      throw new Error(`missing element #${id}`);
    }
    return element;
  }
  function query(root, selector, type) {
    const found = root.querySelector(selector);
    if (!(found instanceof type)) {
      throw new Error(`missing element "${selector}"`);
    }
    return found;
  }
  function node(name, props = {}, content = "", parent) {
    const element = document.createElement(name);
    Object.assign(element, props);
    if (element.title) {
      element.setAttribute("aria-label", element.title);
    }
    if (content) {
      element.append(content);
    }
    parent == null ? void 0 : parent.append(element);
    return element;
  }
  function icon(type, parent) {
    const source = icons_default[type];
    if (!source) {
      console.error("Bad icon type '%s'", type);
      return node("span", {}, "\u203D");
    }
    const holder = node("div");
    holder.innerHTML = source;
    const svg = holder.querySelector("svg");
    if (!svg) {
      throw new Error(`Bad icon source for type '${type}'`);
    }
    svg.classList.add("icon");
    svg.classList.add(`icon-${type}`);
    parent == null ? void 0 : parent.append(svg);
    return svg;
  }
  function button(props = {}, content = "", parent) {
    const _a = props, { icon: iconType } = _a, rest = __objRest(_a, ["icon"]);
    const result = node("button", rest, content, parent);
    if (iconType) {
      result.insertBefore(icon(iconType), result.firstChild);
    }
    return result;
  }
  function clear(target) {
    while (target.firstChild) {
      target.firstChild.remove();
    }
    return target;
  }
  function text(txt, parent) {
    const textNode = document.createTextNode(txt);
    parent == null ? void 0 : parent.append(textNode);
    return textNode;
  }

  // app/js/selection.ts
  var Selection = class {
    constructor() {
      this.commands = new Commands();
      this.items = [];
      this.mode = "multi";
      this.hide();
    }
    configure(items, mode, commands) {
      this.mode = mode;
      const allCommands = [];
      if (mode == "multi") {
        allCommands.push({
          cb: () => items.forEach((item) => this.add(item)),
          label: "Select all",
          icon: "checkbox-marked-outline"
        });
      }
      allCommands.push(...commands);
      allCommands.push({
        cb: () => this.clear(),
        icon: "cancel",
        label: "Cancel",
        className: "last"
      });
      const buttons = allCommands.map((command) => {
        const button3 = buildButton(command);
        button3.addEventListener("click", (_) => {
          command.cb([...this.items]);
        });
        return button3;
      });
      this.commands.innerHTML = "";
      this.commands.append(...buttons);
      items.forEach((item) => {
        item.onclick = () => this.toggle(item);
      });
      this.clear();
    }
    clear() {
      for (const item of [...this.items]) {
        this.remove(item);
      }
    }
    toggle(node2) {
      if (this.items.includes(node2)) {
        this.remove(node2);
      } else {
        this.add(node2);
      }
    }
    add(node2) {
      if (this.items.includes(node2)) {
        return;
      }
      const length = this.items.length;
      this.items.push(node2);
      node2.classList.add("selected");
      const first = this.items[0];
      if (this.mode == "single" && length > 0 && first) {
        this.remove(first);
      }
      if (length == 0) {
        this.show();
      }
    }
    remove(node2) {
      const index = this.items.indexOf(node2);
      if (index < 0) {
        return;
      }
      this.items.splice(index, 1);
      node2.classList.remove("selected");
      if (this.items.length == 0) {
        this.hide();
      }
    }
    show() {
      this.commands.hidden = false;
    }
    hide() {
      this.commands.hidden = true;
    }
  };
  function buildButton(command) {
    const button3 = button({ icon: command.icon });
    if (command.className) {
      button3.className = command.className;
    }
    node("span", {}, command.label, button3);
    return button3;
  }
  var Commands = class extends HTMLElement {
  };
  customElements.define("cyp-commands", Commands);

  // app/js/conf.ts
  var artSize = 96 * (window.devicePixelRatio || 1);
  var ytPath = "_youtube";
  var ytLimit = 3;
  var shuttingDown = false;
  function beginShutdown() {
    shuttingDown = true;
  }
  function setYtLimit(limit) {
    ytLimit = limit;
  }
  function setYtPath(path) {
    ytPath = path;
  }

  // app/js/elements/app.ts
  function isShuttingDown() {
    return shuttingDown;
  }
  function initIcons() {
    document.querySelectorAll("[data-icon]").forEach((node2) => {
      var _a;
      ((_a = node2.dataset["icon"]) != null ? _a : "").split(" ").forEach((name) => {
        node2.prepend(icon(name));
      });
    });
  }
  function isYoutubeSettings(data) {
    return typeof data == "object" && data !== null && "youtubeDir" in data && typeof data.youtubeDir == "string";
  }
  var App = class extends HTMLElement {
    static get observedAttributes() {
      return ["component"];
    }
    constructor() {
      super();
      initIcons();
    }
    // Available once the app has connected (components use it after the "load" event)
    get mpd() {
      if (!this._mpd) {
        throw new Error("not connected to MPD yet");
      }
      return this._mpd;
    }
    async connectedCallback() {
      await waitForChildren(this);
      window.addEventListener("hashchange", (_) => this.onHashChange());
      this.onHashChange();
      await loadSettings();
      await this.connect();
      this.dispatchEvent(new CustomEvent("load"));
      this.initMediaHandler();
    }
    attributeChangedCallback(name, _oldValue, newValue) {
      switch (name) {
        case "component":
          location.hash = newValue != null ? newValue : "";
          this.dispatchEvent(new CustomEvent("component-change"));
          break;
      }
    }
    get component() {
      return this.getAttribute("component") || "";
    }
    set component(component) {
      this.setAttribute("component", component);
    }
    createSelection() {
      const selection = new Selection();
      query(this, "footer", HTMLElement).append(selection.commands);
      return selection;
    }
    onHashChange() {
      const component = location.hash.substring(1) || "queue";
      if (component != this.component) {
        this.component = component;
      }
    }
    onChange(changed) {
      this.dispatchEvent(new CustomEvent("idle-change", { detail: changed }));
    }
    async onClose(_e) {
      if (isShuttingDown()) {
        return;
      }
      await sleep(3e3);
      this.connect();
    }
    async connect() {
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        try {
          const mpd = await MPD.connect();
          mpd.onChange = (changed) => this.onChange(changed);
          mpd.onClose = (e) => this.onClose(e);
          this._mpd = mpd;
          return;
        } catch (e) {
          await sleep(500);
        }
      }
      if (isShuttingDown()) {
        return;
      }
      alert(`Failed to connect to MPD after ${attempts} attempts. Please reload the page to try again.`);
    }
    initMediaHandler() {
      if (!("mediaSession" in navigator)) {
        console.log("mediaSession is not supported");
        return;
      }
      const audio = node("audio", { loop: true }, "", this);
      node("source", { src: "https://raw.githubusercontent.com/anars/blank-audio/master/10-seconds-of-silence.mp3" }, "", audio);
      window.addEventListener("click", () => {
        audio.play();
      }, { once: true });
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Control Your Player"
      });
      navigator.mediaSession.setActionHandler("play", () => {
        this.mpd.command("play");
        audio.play();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        this.mpd.command("pause 1");
        audio.pause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        this.mpd.command("previous");
        audio.play();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        this.mpd.command("next");
        audio.play();
      });
    }
  };
  customElements.define("cyp-app", App);
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function waitForChildren(app) {
    const children = [...app.querySelectorAll("*")];
    const names = children.map((node2) => node2.nodeName.toLowerCase()).filter((name) => name.startsWith("cyp-"));
    const unique = new Set(names);
    const promises = [...unique].map((name) => customElements.whenDefined(name));
    return Promise.all(promises);
  }
  async function loadSettings() {
    const response = await fetch("settings");
    const settings = await response.json();
    if (isYoutubeSettings(settings)) {
      setYtPath(settings.youtubeDir);
    }
  }

  // app/js/component.ts
  var Component = class extends HTMLElement {
    connectedCallback() {
      const { app } = this;
      app.addEventListener("load", (_) => this.onAppLoad());
      app.addEventListener("component-change", (_) => {
        const component = app.component;
        const isThis = this.nodeName.toLowerCase() == `cyp-${component}`;
        this.onComponentChange(component, isThis);
      });
    }
    get app() {
      const app = this.closest("cyp-app");
      if (!(app instanceof App)) {
        throw new Error(`${this.nodeName} is not inside cyp-app`);
      }
      return app;
    }
    get mpd() {
      return this.app.mpd;
    }
    // The selection bar of the footer, created on first use
    get selection() {
      var _a;
      return (_a = this._selection) != null ? _a : this._selection = this.app.createSelection();
    }
    onAppLoad() {
    }
    onComponentChange(_component, _isThis) {
    }
  };

  // app/js/elements/menu.ts
  var Menu = class extends Component {
    constructor() {
      super(...arguments);
      this.tabs = [...this.querySelectorAll("[data-for]")];
    }
    connectedCallback() {
      super.connectedCallback();
      this.tabs.forEach((tab) => {
        tab.addEventListener("click", (_) => {
          var _a;
          return this.app.setAttribute("component", (_a = tab.dataset["for"]) != null ? _a : "");
        });
      });
    }
    onAppLoad() {
      this.app.addEventListener("queue-length-change", (e) => {
        query(this, ".queue-length", HTMLElement).textContent = `(${e.detail})`;
      });
    }
    onComponentChange(component) {
      this.tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset["for"] == component);
      });
    }
  };
  customElements.define("cyp-menu", Menu);

  // app/js/art.ts
  var cache = /* @__PURE__ */ new Map();
  var MIME = "image/jpeg";
  var STORAGE_PREFIX = `art-${artSize}`;
  function store(key, data) {
    localStorage.setItem(`${STORAGE_PREFIX}-${key}`, data);
  }
  function load(key) {
    return localStorage.getItem(`${STORAGE_PREFIX}-${key}`);
  }
  function bytesToImage(bytes) {
    const blob = new Blob([bytes], { type: MIME });
    const src = URL.createObjectURL(blob);
    const image = node("img", { src });
    return new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("cover is not a valid image"));
    });
  }
  function resize(image) {
    var _a, _b;
    while (Math.min(image.width, image.height) >= 2 * artSize) {
      const tmp = node("canvas", { width: image.width / 2, height: image.height / 2 });
      (_a = tmp.getContext("2d")) == null ? void 0 : _a.drawImage(image, 0, 0, tmp.width, tmp.height);
      image = tmp;
    }
    const canvas = node("canvas", { width: artSize, height: artSize });
    (_b = canvas.getContext("2d")) == null ? void 0 : _b.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  async function fetchCover(mpd, songUrl) {
    const data = await mpd.albumArt(songUrl);
    if (!data) {
      return null;
    }
    const image = await bytesToImage(new Uint8Array(data));
    return resize(image).toDataURL(MIME);
  }
  function get(mpd, artist, album, songUrl) {
    const key = `${artist}-${album}`;
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }
    const loaded = load(key);
    if (loaded) {
      const promise2 = Promise.resolve(loaded);
      cache.set(key, promise2);
      return promise2;
    }
    if (!songUrl) {
      return Promise.resolve(null);
    }
    const promise = fetchCover(mpd, songUrl).then((url) => {
      if (url) {
        store(key, url);
      }
      return url;
    }).catch(() => null);
    cache.set(key, promise);
    return promise;
  }

  // app/js/format.ts
  var SEPARATOR = " \xB7 ";
  function time(sec) {
    sec = Math.round(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  function subtitle(data, options = { duration: true }) {
    const tokens = [];
    if (data.Name) {
      tokens.push(data.Name);
    }
    if (data.Artist) {
      tokens.push(data.Artist);
    } else if (data.AlbumArtist) {
      tokens.push(data.AlbumArtist);
    }
    if (data.Album) {
      tokens.push(data.Album);
    }
    if (options.duration && data.duration) {
      tokens.push(time(Number(data.duration)));
    }
    return tokens.join(SEPARATOR);
  }
  function fileName(file) {
    return file.split("/").pop() || "";
  }

  // app/js/elements/player.ts
  var ELAPSED_PERIOD = 500;
  function slider(root, selector) {
    const element = query(root, selector, HTMLElement);
    if (!isXRange(element)) {
      throw new Error(`"${selector}" is not a slider`);
    }
    return element;
  }
  function lookUpDOM(root) {
    return {
      art: query(root, ".art", HTMLElement),
      title: query(root, ".info .title", HTMLElement),
      subtitle: query(root, ".info .subtitle", HTMLElement),
      elapsed: query(root, ".elapsed", HTMLElement),
      duration: query(root, ".duration", HTMLElement),
      progress: slider(root, ".timeline x-range"),
      volume: slider(root, ".controls .volume x-range"),
      mute: query(root, ".mute", HTMLButtonElement),
      play: query(root, ".play", HTMLButtonElement),
      pause: query(root, ".pause", HTMLButtonElement),
      prev: query(root, ".prev", HTMLButtonElement),
      next: query(root, ".next", HTMLButtonElement),
      random: query(root, ".random", HTMLButtonElement),
      repeat: query(root, ".repeat", HTMLButtonElement)
    };
  }
  var Player = class extends Component {
    constructor() {
      super();
      this.current = {
        song: {},
        elapsed: 0,
        at: 0,
        volume: 0
      };
      this.toggleVolume = 0;
      this.DOM = lookUpDOM(this);
    }
    onAppLoad() {
      this.addEvents();
      this.updateStatus();
      this.updateCurrent();
      this.app.addEventListener("idle-change", (e) => this.onIdle(e.detail));
      setInterval(() => this.updateElapsed(), ELAPSED_PERIOD);
    }
    onIdle(changed) {
      const hasOptions = changed.includes("options");
      const hasPlayer = changed.includes("player");
      const hasMixer = changed.includes("mixer");
      if (hasOptions || hasPlayer || hasMixer) {
        this.updateStatus();
      }
      if (hasPlayer) {
        this.updateCurrent();
      }
    }
    async updateStatus() {
      const { current, mpd } = this;
      const data = await mpd.status();
      this.updateFlags(data);
      this.updateVolume(data);
      current.elapsed = Number(data.elapsed || 0);
      current.at = performance.now();
    }
    async updateCurrent() {
      const { current, mpd, DOM } = this;
      const data = await mpd.currentSong();
      if (data.file) {
        DOM.title.textContent = data.Title || data.Name || fileName(data.file);
        DOM.subtitle.textContent = subtitle(data, { duration: false });
        const duration = Number(data.duration);
        if (duration) {
          DOM.duration.textContent = time(duration);
          DOM.progress.max = String(duration);
          DOM.progress.disabled = false;
        } else {
          DOM.duration.textContent = "";
          DOM.progress.max = "0";
          DOM.progress.disabled = true;
        }
      } else {
        DOM.title.textContent = "";
        DOM.subtitle.textContent = "";
        DOM.duration.textContent = "";
        DOM.progress.max = "0";
        DOM.progress.value = "0";
        DOM.progress.disabled = true;
      }
      if (data.file != current.song.file) {
        this.dispatchSongChange(data);
      }
      const artistNew = data.Artist || data.AlbumArtist || "";
      const artistOld = current.song.Artist || current.song.AlbumArtist;
      const albumNew = data.Album;
      const albumOld = current.song.Album;
      Object.assign(current.song, data);
      if (artistNew != artistOld || albumNew != albumOld) {
        clear(DOM.art);
        const src = await get(mpd, artistNew, data.Album || "", data.file);
        if (src) {
          node("img", { src }, "", DOM.art);
        } else {
          icon("music", DOM.art);
        }
      }
    }
    updateElapsed() {
      const { current, DOM } = this;
      let elapsed = 0;
      if (current.song.file) {
        elapsed = current.elapsed;
        if (this.dataset["state"] == "play") {
          elapsed += (performance.now() - current.at) / 1e3;
        }
      }
      DOM.progress.value = String(elapsed);
      DOM.elapsed.textContent = time(elapsed);
      this.app.style.setProperty("--progress", String(elapsed / Number(DOM.progress.max)));
    }
    updateFlags(data) {
      var _a;
      const flags = [];
      if (data.random == "1") {
        flags.push("random");
      }
      if (data.repeat == "1") {
        flags.push("repeat");
      }
      if (data.volume === "0") {
        flags.push("mute");
      }
      this.dataset["flags"] = flags.join(" ");
      this.dataset["state"] = (_a = data.state) != null ? _a : "";
    }
    updateVolume(data) {
      const { current, DOM } = this;
      if (data.volume !== void 0) {
        const volume = Number(data.volume);
        DOM.mute.disabled = false;
        DOM.volume.disabled = false;
        DOM.volume.value = String(volume);
        if (volume == 0 && current.volume > 0) {
          this.toggleVolume = current.volume;
        }
        if (volume > 0 && current.volume == 0) {
          this.toggleVolume = 0;
        }
        current.volume = volume;
      } else {
        DOM.mute.disabled = true;
        DOM.volume.disabled = true;
        DOM.volume.value = String(50);
      }
    }
    addEvents() {
      const { current, mpd, DOM } = this;
      DOM.play.addEventListener("click", (_) => mpd.command("play"));
      DOM.pause.addEventListener("click", (_) => mpd.command("pause 1"));
      DOM.prev.addEventListener("click", (_) => mpd.command("previous"));
      DOM.next.addEventListener("click", (_) => mpd.command("next"));
      DOM.random.addEventListener("click", (_) => {
        const isRandom = this.flags.includes("random");
        mpd.command(`random ${isRandom ? "0" : "1"}`);
      });
      DOM.repeat.addEventListener("click", (_) => {
        const isRepeat = this.flags.includes("repeat");
        mpd.command(`repeat ${isRepeat ? "0" : "1"}`);
      });
      DOM.progress.addEventListener("input", (_) => {
        const elapsed = DOM.progress.valueAsNumber;
        current.elapsed = elapsed;
        current.at = performance.now();
        mpd.command(`seekcur ${elapsed}`);
      });
      DOM.volume.addEventListener("input", (_) => mpd.command(`setvol ${DOM.volume.valueAsNumber}`));
      DOM.mute.addEventListener("click", () => mpd.command(`setvol ${this.toggleVolume}`));
    }
    // the flags the server reported, e.g. "random repeat"
    get flags() {
      var _a;
      return ((_a = this.dataset["flags"]) != null ? _a : "").split(" ");
    }
    dispatchSongChange(detail) {
      const e = new CustomEvent("song-change", { detail });
      this.app.dispatchEvent(e);
    }
  };
  customElements.define("cyp-player", Player);

  // app/js/item.ts
  var Item = class extends HTMLElement {
    addButton(icon2, cb) {
      button({ icon: icon2 }, "", this).addEventListener("click", (e) => {
        e.stopPropagation();
        cb();
      });
    }
    buildTitle(title) {
      return node("span", { className: "title" }, title, this);
    }
    matchPrefix(prefix2) {
      var _a;
      const words = ((_a = this.textContent) != null ? _a : "").toLowerCase().split(/[\s!-\/:-@\[-`{-~·]+/);
      return words.some((word) => word.startsWith(prefix2));
    }
  };

  // app/js/elements/song.ts
  var Song = class extends Item {
    constructor(data) {
      super();
      this.data = data;
      icon("music", this);
      icon("play", this);
      const block = node("div", { className: "multiline" }, "", this);
      const title = this.buildSongTitle(data);
      block.append(title);
      if (data.Track) {
        const track = node("span", { className: "track" }, data.Track.padStart(2, "0"));
        title.insertBefore(text(" "), title.firstChild);
        title.insertBefore(track, title.firstChild);
      }
      if (data.Title) {
        const subtitle2 = subtitle(data);
        node("span", { className: "subtitle" }, subtitle2, block);
      }
      this.playing = false;
    }
    get file() {
      return this.data.file;
    }
    get songId() {
      var _a;
      return (_a = this.data.Id) != null ? _a : "";
    }
    set playing(playing) {
      this.classList.toggle("playing", playing);
    }
    buildSongTitle(data) {
      return super.buildTitle(data.Title || data.Name || fileName(this.file));
    }
  };
  customElements.define("cyp-song", Song);

  // app/js/elements/queue.ts
  function songsOf(items) {
    return items.filter((item) => item instanceof Song);
  }
  function generateMoveCommands(items, diff, parent) {
    const all = [...parent.children].filter((node2) => node2 instanceof Song);
    const compare = (a, b) => all.indexOf(a) - all.indexOf(b);
    const commands = [];
    for (const item of [...items].sort(compare)) {
      const index = all.indexOf(item) + diff;
      if (index < 0 || index >= all.length) {
        continue;
      }
      commands.push(`moveid ${item.songId} ${index}`);
    }
    return commands;
  }
  var Queue = class extends Component {
    onAppLoad() {
      const { app } = this;
      app.addEventListener("idle-change", (e) => {
        if (e.detail.includes("playlist")) {
          this.sync();
        }
      });
      app.addEventListener("song-change", (e) => {
        this.currentId = e.detail.Id;
        this.updateCurrent();
      });
      this.sync();
    }
    onComponentChange(_c, isThis) {
      this.hidden = !isThis;
    }
    async sync() {
      const songs = await this.mpd.listQueue();
      this.buildSongs(songs);
      this.app.dispatchEvent(new CustomEvent("queue-length-change", { detail: songs.length }));
    }
    updateCurrent() {
      const songs = [...this.children].filter((node2) => node2 instanceof Song);
      songs.forEach((node2) => {
        node2.playing = node2.songId == this.currentId;
      });
    }
    buildSongs(songs) {
      clear(this);
      const nodes = songs.map((song) => {
        const node2 = new Song(song);
        node2.addButton("play", async () => {
          await this.mpd.command(`playid ${node2.songId}`);
        });
        return node2;
      });
      this.append(...nodes);
      this.configureSelection(nodes);
      this.updateCurrent();
    }
    configureSelection(nodes) {
      const { mpd, selection } = this;
      const commands = [{
        cb: (items) => {
          const moves = generateMoveCommands(songsOf(items), -1, this);
          mpd.command(moves);
        },
        label: "Up",
        icon: "arrow-up-bold"
      }, {
        cb: (items) => {
          const moves = generateMoveCommands(songsOf(items), 1, this);
          mpd.command(moves.reverse());
        },
        label: "Down",
        icon: "arrow-down-bold"
      }, {
        cb: async (items) => {
          let name = prompt("Save selected songs as a playlist?", "name");
          if (name === null) {
            return;
          }
          name = escape(name);
          try {
            await mpd.command(`rm "${name}"`);
          } catch (e) {
          }
          const commands2 = songsOf(items).map((item) => {
            return `playlistadd "${name}" "${escape(item.file)}"`;
          });
          await mpd.command(commands2);
          selection.clear();
        },
        label: "Save",
        icon: "content-save"
      }, {
        cb: async (items) => {
          const selected = songsOf(items);
          if (!confirm(`Remove these ${selected.length} songs from the queue?`)) {
            return;
          }
          const commands2 = selected.map((item) => `deleteid ${item.songId}`);
          mpd.command(commands2);
        },
        label: "Remove",
        icon: "delete"
      }];
      selection.configure(nodes, "multi", commands);
    }
  };
  customElements.define("cyp-queue", Queue);

  // app/js/elements/playlist.ts
  var Playlist = class extends Item {
    constructor(name) {
      super();
      this.name = name;
      icon("playlist-music", this);
      this.buildTitle(name);
    }
  };
  customElements.define("cyp-playlist", Playlist);

  // app/js/elements/back.ts
  var Back = class extends Item {
    constructor(title) {
      super();
      this.append(icon("keyboard-backspace"));
      this.buildTitle(title);
    }
  };
  customElements.define("cyp-back", Back);

  // app/js/elements/playlists.ts
  function songsOf2(items) {
    return items.filter((item) => item instanceof Song);
  }
  function playlistsOf(items) {
    return items.filter((item) => item instanceof Playlist);
  }
  var Playlists = class extends Component {
    onAppLoad() {
      const { app } = this;
      app.addEventListener("idle-change", (e) => {
        if (e.detail.includes("stored_playlist")) {
          this.sync();
        }
      });
      this.sync();
    }
    onComponentChange(_c, isThis) {
      this.hidden = !isThis;
    }
    async sync() {
      if (this.current) {
        const songs = await this.mpd.listPlaylistItems(this.current);
        this.buildSongs(songs);
      } else {
        const lists = await this.mpd.listPlaylists();
        this.buildLists(lists);
      }
    }
    buildSongs(songs) {
      clear(this);
      this.buildBack();
      const nodes = songs.map((song) => new Song(song));
      this.append(...nodes);
      this.configureSelectionSongs(nodes);
    }
    buildLists(lists) {
      clear(this);
      const playlists = lists.map((name) => {
        const node2 = new Playlist(name);
        node2.addButton("chevron-double-right", () => {
          this.current = name;
          this.sync();
        });
        return node2;
      });
      this.append(...playlists);
      this.configureSelectionLists(playlists);
    }
    buildBack() {
      const node2 = new Back("Playlists");
      this.append(node2);
      node2.onclick = () => {
        this.current = void 0;
        this.sync();
      };
    }
    configureSelectionSongs(songs) {
      const { selection, mpd } = this;
      const commands = [{
        cb: async (items) => {
          await mpd.command(["clear", ...songsOf2(items).map(createAddCommand), "play"]);
          selection.clear();
        },
        label: "Play",
        icon: "play"
      }, {
        cb: async (items) => {
          await mpd.command(songsOf2(items).map(createAddCommand));
          selection.clear();
        },
        label: "Enqueue",
        icon: "plus"
      }];
      selection.configure(songs, "multi", commands);
    }
    // Single selection: the callbacks act on the one selected playlist
    configureSelectionLists(lists) {
      const { mpd, selection } = this;
      const commands = [{
        cb: async (items) => {
          const item = playlistsOf(items)[0];
          if (!item) {
            return;
          }
          const commands2 = ["clear", `load "${escape(item.name)}"`, "play"];
          await mpd.command(commands2);
          selection.clear();
        },
        label: "Play",
        icon: "play"
      }, {
        cb: async (items) => {
          const item = playlistsOf(items)[0];
          if (!item) {
            return;
          }
          await mpd.command(`load "${escape(item.name)}"`);
          selection.clear();
        },
        label: "Enqueue",
        icon: "plus"
      }, {
        cb: async (items) => {
          const item = playlistsOf(items)[0];
          if (!item) {
            return;
          }
          if (!confirm(`Really delete playlist '${item.name}'?`)) {
            return;
          }
          await mpd.command(`rm "${escape(item.name)}"`);
        },
        label: "Delete",
        icon: "delete"
      }];
      selection.configure(lists, "single", commands);
    }
  };
  customElements.define("cyp-playlists", Playlists);
  function createAddCommand(node2) {
    return `add "${escape(node2.file)}"`;
  }

  // app/js/elements/settings.ts
  var prefix = "cyp";
  function loadFromStorage(key) {
    return localStorage.getItem(`${prefix}-${key}`);
  }
  function saveToStorage(key, value) {
    localStorage.setItem(`${prefix}-${key}`, String(value));
  }
  var Settings = class extends Component {
    constructor() {
      super(...arguments);
      this.theme = query(this, "[name=theme]", HTMLSelectElement);
      this.ytLimit = query(this, "[name=yt-limit]", HTMLSelectElement);
      this.colors = [...this.querySelectorAll("[name=color]")].filter((input) => input instanceof HTMLInputElement);
    }
    onAppLoad() {
      const mo = new MutationObserver((mrs) => {
        mrs.forEach((mr) => this.onAppAttributeChange(mr));
      });
      mo.observe(this.app, { attributes: true });
      this.theme.addEventListener("change", (_) => this.setTheme(this.theme.value));
      this.ytLimit.addEventListener("change", (_) => this.setYtLimit(Number(this.ytLimit.value)));
      this.colors.forEach((input) => {
        input.addEventListener("click", (_) => this.setColor(input.value));
      });
      const theme = loadFromStorage("theme");
      theme ? this.app.setAttribute("theme", theme) : this.syncTheme();
      const color = loadFromStorage("color");
      color ? this.app.setAttribute("color", color) : this.syncColor();
      const ytLimit2 = loadFromStorage("ytLimit") || ytLimit;
      this.setYtLimit(Number(ytLimit2));
    }
    onAppAttributeChange(mr) {
      if (mr.attributeName == "theme") {
        this.syncTheme();
      }
      if (mr.attributeName == "color") {
        this.syncColor();
      }
    }
    syncTheme() {
      var _a;
      this.theme.value = (_a = this.app.getAttribute("theme")) != null ? _a : "";
    }
    syncColor() {
      this.colors.forEach((input) => {
        input.checked = input.value == this.app.getAttribute("color");
        if (input.parentElement) {
          input.parentElement.style.color = input.value;
        }
      });
    }
    setTheme(theme) {
      saveToStorage("theme", theme);
      this.app.setAttribute("theme", theme);
    }
    setColor(color) {
      saveToStorage("color", color);
      this.app.setAttribute("color", color);
    }
    setYtLimit(ytLimit2) {
      saveToStorage("ytLimit", ytLimit2);
      setYtLimit(ytLimit2);
    }
    onComponentChange(_c, isThis) {
      this.hidden = !isThis;
    }
  };
  customElements.define("cyp-settings", Settings);

  // app/js/elements/search.ts
  var Search = class extends HTMLElement {
    constructor() {
      super();
      this.onSubmit = () => {
      };
      const form = node("form", {}, "", this);
      node("input", { type: "text" }, "", form);
      button({ icon: "magnify" }, "", form);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.onSubmit();
      });
    }
    get value() {
      return this.input.value.trim();
    }
    set value(value) {
      this.input.value = value;
    }
    get input() {
      return query(this, "input", HTMLInputElement);
    }
    focus() {
      this.input.focus();
    }
    pending(pending) {
      this.classList.toggle("pending", pending);
    }
  };
  customElements.define("cyp-search", Search);

  // app/js/elements/yt-result.ts
  var YtResult = class extends Item {
    constructor(title) {
      super();
      this.append(icon("magnify"));
      this.buildTitle(title);
    }
  };
  customElements.define("cyp-yt-result", YtResult);

  // app/js/elements/yt.ts
  function isResultList(data) {
    return Array.isArray(data) && data.every((item) => {
      return typeof item == "object" && item !== null && "title" in item && typeof item.title == "string" && "id" in item && typeof item.id == "string";
    });
  }
  var YT = class extends Component {
    constructor() {
      super();
      this.search = new Search();
      this.search.onSubmit = () => {
        const query2 = this.search.value;
        if (query2) {
          this.doSearch(query2);
        }
      };
      this.clear();
    }
    clear() {
      clear(this);
      this.append(this.search);
    }
    async doSearch(query2) {
      this.clear();
      this.search.pending(true);
      const url = `youtube?q=${encodeURIComponent(query2)}&limit=${encodeURIComponent(ytLimit)}`;
      const response = await fetch(url);
      if (response.status == 200) {
        const results = await response.json();
        if (isResultList(results)) {
          results.forEach((result) => {
            const node2 = new YtResult(result.title);
            this.append(node2);
            node2.addButton("download", () => this.download(result.id));
          });
        }
      } else {
        alert(await response.text());
      }
      this.search.pending(false);
    }
    async download(id) {
      this.clear();
      const pre = node("pre", {}, "", this);
      this.search.pending(true);
      const body = new URLSearchParams();
      body.set("id", id);
      const response = await fetch("youtube", { method: "POST", body });
      let output = "";
      if (response.body) {
        const reader = response.body.getReader();
        for (; ; ) {
          const chunk = await reader.read();
          if (chunk.done) {
            break;
          }
          const text2 = decoder.decode(chunk.value, { stream: true });
          output += text2;
          pre.textContent += text2;
          pre.scrollTop = pre.scrollHeight;
        }
        reader.releaseLock();
      }
      this.search.pending(false);
      if (response.status == 200 && output.includes("[cyp] done")) {
        this.mpd.command(`update ${escape(ytPath)}`);
      } else {
        pre.textContent += "\nDownload did not finish. Nothing was added to the library.\n";
      }
    }
    onComponentChange(_c, isThis) {
      const wasHidden = this.hidden;
      this.hidden = !isThis;
      if (!wasHidden && isThis) {
        this.clear();
      }
    }
  };
  customElements.define("cyp-yt", YT);
  var decoder = new TextDecoder("utf-8");

  // app/js/elements/tag.ts
  var ICONS2 = {
    "AlbumArtist": "artist",
    "Album": "album",
    "Genre": "music"
  };
  var Tag = class extends Item {
    constructor(type, value, filter) {
      super();
      this.type = type;
      this.value = value;
      this.filter = filter;
      node("span", { className: "art" }, "", this);
      this.buildTitle(value);
    }
    createChildFilter() {
      return Object.assign({ [this.type]: this.value }, this.filter);
    }
    async fillArt(mpd) {
      const parent = this.firstElementChild;
      if (!(parent instanceof HTMLElement)) {
        return;
      }
      const filter = this.createChildFilter();
      const artist = filter["AlbumArtist"];
      const album = filter["Album"];
      let src = null;
      if (artist && album) {
        src = await get(mpd, artist, album);
        if (!src) {
          const songs = await mpd.listSongs(filter, [0, 1]);
          const first = songs[0];
          if (first) {
            src = await get(mpd, artist, album, first.file);
          }
        }
      }
      if (src) {
        node("img", { src }, "", parent);
      } else {
        icon(ICONS2[this.type], parent);
      }
    }
  };
  customElements.define("cyp-tag", Tag);

  // app/js/elements/path.ts
  var Path = class extends Item {
    constructor(data, subtitle2 = "") {
      super();
      this.data = data;
      this.isDirectory = "directory" in this.data;
      this.append(icon(this.isDirectory ? "folder" : "music"));
      if (subtitle2) {
        const block = node("div", { className: "multiline" }, "", this);
        block.append(this.buildTitle(fileName(this.file)));
        node("span", { className: "subtitle" }, subtitle2, block);
      } else {
        this.buildTitle(fileName(this.file));
      }
    }
    get file() {
      var _a;
      return (_a = this.isDirectory ? this.data.directory : this.data.file) != null ? _a : "";
    }
  };
  customElements.define("cyp-path", Path);

  // app/js/elements/filter.ts
  var SELECTOR = ["cyp-tag", "cyp-path", "cyp-song"].join(", ");
  var Filter = class extends HTMLElement {
    constructor() {
      super();
      node("input", { type: "text" }, "", this);
      icon("filter-variant", this);
      this.input.addEventListener("input", (_) => this.apply());
    }
    get value() {
      return this.input.value.trim();
    }
    set value(value) {
      this.input.value = value;
    }
    get input() {
      return query(this, "input", HTMLInputElement);
    }
    apply() {
      const value = this.value.toLowerCase();
      const parent = this.parentNode;
      if (!parent) {
        return;
      }
      [...parent.querySelectorAll(SELECTOR)].forEach((item) => {
        if (item instanceof Item) {
          item.hidden = !item.matchPrefix(value);
        }
      });
    }
  };
  customElements.define("cyp-filter", Filter);

  // app/js/elements/file-tools.ts
  var SORT_KEYS = ["name", "modified"];
  var STORAGE_KEY = "cyp-library-sort";
  var DEBOUNCE = 400;
  var LABELS = {
    name: "Name",
    modified: "Date"
  };
  function isSortOrder(data) {
    return typeof data == "object" && data !== null && "key" in data && (data.key == "name" || data.key == "modified") && "desc" in data && typeof data.desc == "boolean";
  }
  function loadSort() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (isSortOrder(data)) {
        return { key: data.key, desc: data.desc };
      }
    } catch (e) {
    }
    return { key: "name", desc: false };
  }
  function saveSort(order) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (e) {
    }
  }
  function describe(order) {
    if (order.key == "name") {
      return order.desc ? "Name, Z to A" : "Name, A to Z";
    }
    return order.desc ? "Modified, newest first" : "Modified, oldest first";
  }
  var FileTools = class extends HTMLElement {
    constructor() {
      super();
      this.order = loadSort();
      this.lastQuery = "";
      this.onSearch = () => {
      };
      this.onSort = () => {
      };
      this.form = node("form", {}, "", this);
      icon("magnify", this.form);
      this.input = node("input", {
        type: "search",
        placeholder: "Search files and folders",
        autocomplete: "off",
        spellcheck: false
      }, "", this.form);
      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.input.blur();
        this.submit();
      });
      this.input.addEventListener("input", (_) => {
        clearTimeout(this.timeout);
        this.timeout = window.setTimeout(() => this.submit(), DEBOUNCE);
      });
      const sort = node("div", { className: "sort" }, "", this);
      this.buttons = {
        name: button({ type: "button" }, "", sort),
        modified: button({ type: "button" }, "", sort)
      };
      for (const key of SORT_KEYS) {
        this.buttons[key].addEventListener("click", (_) => this.toggleSort(key));
      }
      this.syncButtons();
    }
    get value() {
      return this.input.value.trim();
    }
    set value(value) {
      clearTimeout(this.timeout);
      this.input.value = value;
      this.lastQuery = this.value;
    }
    get sort() {
      return __spreadValues({}, this.order);
    }
    pending(pending) {
      this.classList.toggle("pending", pending);
    }
    submit() {
      clearTimeout(this.timeout);
      const query2 = this.value;
      if (query2 == this.lastQuery) {
        return;
      }
      this.lastQuery = query2;
      this.onSearch(query2);
    }
    toggleSort(key) {
      if (this.order.key == key) {
        this.order.desc = !this.order.desc;
      } else {
        this.order = { key, desc: key == "modified" };
      }
      saveSort(this.order);
      this.syncButtons();
      this.onSort(this.sort);
    }
    syncButtons() {
      for (const key of SORT_KEYS) {
        const button3 = this.buttons[key];
        const active = this.order.key == key;
        clear(button3);
        text(LABELS[key], button3);
        button3.classList.toggle("active", active);
        button3.setAttribute("aria-pressed", String(active));
        if (active) {
          icon(this.order.desc ? "arrow-down-bold" : "arrow-up-bold", button3);
          const next = { key, desc: !this.order.desc };
          button3.title = `Sorted by ${describe(this.order)}. Click for ${describe(next)}.`;
        } else {
          button3.title = `Sort by ${describe({ key, desc: key == "modified" })}`;
        }
      }
    }
  };
  customElements.define("cyp-file-tools", FileTools);

  // app/js/elements/library.ts
  var MIN_PATH_QUERY = 2;
  var MAX_PATH_RESULTS = 500;
  var collator = new Intl.Collator(void 0, { numeric: true, sensitivity: "base" });
  var TAGS = {
    "Album": "Albums",
    "AlbumArtist": "Artists",
    "Genre": "Genres"
  };
  function songsOf3(items) {
    return items.filter((item) => item instanceof Song || item instanceof Path || item instanceof Tag);
  }
  var Library = class extends Component {
    constructor() {
      super();
      this.search = new Search();
      this.filter = new Filter();
      this.fileTools = new FileTools();
      this.stateStack = [];
      this.pathEntries = [];
      this.pathNodes = [];
      this.pathToken = 0;
      this.search.onSubmit = () => {
        const query2 = this.search.value;
        if (query2.length < 3) {
          return;
        }
        this.doSearch(query2);
      };
      this.fileTools.onSearch = (query2) => this.searchPath(query2);
      this.fileTools.onSort = () => this.renderPathEntries();
    }
    // the state on top of the stack, the one shown; undefined when nothing was pushed
    topState(depth = 0) {
      return this.stateStack[this.stateStack.length - 1 - depth];
    }
    popState() {
      this.selection.clear();
      this.stateStack.pop();
      const state = this.topState();
      if (state) {
        this.showState(state);
      } else {
        this.showRoot();
      }
    }
    onAppLoad() {
      this.showRoot();
    }
    onComponentChange(_c, isThis) {
      const wasHidden = this.hidden;
      this.hidden = !isThis;
      if (!wasHidden && isThis) {
        this.showRoot();
      }
    }
    showRoot() {
      this.stateStack = [];
      clear(this);
      const nav = node("nav", {}, "", this);
      button({ icon: "artist" }, "Artists and albums", nav).addEventListener("click", (_) => this.pushState({ type: "tags", tag: "AlbumArtist" }));
      button({ icon: "music" }, "Genres", nav).addEventListener("click", (_) => this.pushState({ type: "tags", tag: "Genre" }));
      button({ icon: "folder" }, "Files and directories", nav).addEventListener("click", (_) => this.pushState({ type: "path", path: "" }));
      button({ icon: "magnify" }, "Search", nav).addEventListener("click", (_) => this.pushState({ type: "search" }));
    }
    pushState(state) {
      this.selection.clear();
      this.stateStack.push(state);
      this.showState(state);
    }
    showState(state) {
      switch (state.type) {
        case "tags":
          this.listTags(state.tag, state.filter);
          break;
        case "songs":
          this.listSongs(state.filter);
          break;
        case "path":
          this.listPath(state.path, state.query);
          break;
        case "search":
          this.showSearch(state.query);
          break;
      }
    }
    async listTags(tag, filter = {}) {
      const values = (await this.mpd.listTags(tag, filter)).filter(nonempty);
      clear(this);
      if ("AlbumArtist" in filter || "Genre" in filter) {
        this.buildBack();
      }
      if (values.length > 0) {
        this.addFilter();
      }
      const nodes = values.map((value) => this.buildTag(tag, value, filter));
      this.append(...nodes);
      const albumNodes = nodes.filter((node2) => node2.type == "Album");
      this.configureSelection(albumNodes);
    }
    async listPath(path, query2 = "") {
      const token = ++this.pathToken;
      const entries = await this.loadPathEntries(path, query2);
      if (token != this.pathToken) {
        return;
      }
      clear(this);
      if (path) {
        this.buildBack();
      }
      this.append(this.fileTools);
      this.fileTools.value = query2;
      this.fileTools.pending(false);
      this.pathEntries = entries;
      this.pathNodes = [];
      this.renderPathEntries();
    }
    async searchPath(query2) {
      const state = this.topState();
      if (!state || state.type != "path") {
        return;
      }
      state.query = query2;
      const token = ++this.pathToken;
      this.fileTools.pending(true);
      const entries = await this.loadPathEntries(state.path, query2);
      if (token != this.pathToken) {
        return;
      }
      this.fileTools.pending(false);
      this.pathEntries = entries;
      this.renderPathEntries();
    }
    async loadPathEntries(path, query2) {
      try {
        if (!query2) {
          return await this.readPath(path);
        }
        if (query2.length < MIN_PATH_QUERY) {
          return [];
        }
        return await this.findInPath(path, query2);
      } catch (e) {
        console.warn("Cannot list path", path, query2, e);
        return [];
      }
    }
    /** Contents of one directory (lsinfo). */
    async readPath(path) {
      const paths = await this.mpd.listPath(path);
      return [...paths.directory, ...paths.file].map((data) => createPathEntry(data));
    }
    /**
     * Search the MPD database below `base`: folders and files whose name contains the query,
     * plus songs whose Title tag contains it.
     */
    async findInPath(base, query2) {
      const [byFile, byTitle] = await Promise.all([
        this.mpd.searchTag("file", query2, base),
        this.mpd.searchTag("Title", query2, base)
      ]);
      const needle = query2.toLowerCase();
      const prefix2 = base ? `${base}/` : "";
      const dirs = /* @__PURE__ */ new Map();
      const files = /* @__PURE__ */ new Map();
      byFile.forEach((song) => {
        var _a;
        if (!song.file.startsWith(prefix2)) {
          return;
        }
        const modified = parseDate(song["Last-Modified"]);
        const segments = song.file.substring(prefix2.length).split("/");
        const name = (_a = segments.pop()) != null ? _a : "";
        let dir = base;
        segments.forEach((segment) => {
          dir = dir ? `${dir}/${segment}` : segment;
          if (segment.toLowerCase().includes(needle)) {
            dirs.set(dir, Math.max(dirs.get(dir) || 0, modified));
          }
        });
        if (name.toLowerCase().includes(needle)) {
          files.set(song.file, createSearchEntry(song, base));
        }
      });
      byTitle.forEach((song) => {
        if (!files.has(song.file)) {
          files.set(song.file, createSearchEntry(song, base));
        }
      });
      const dirEntries = [];
      dirs.forEach((modified, directory) => {
        const entry = createPathEntry({ directory }, base);
        entry.modified = modified;
        dirEntries.push(entry);
      });
      return [...dirEntries, ...files.values()];
    }
    renderPathEntries() {
      const state = this.topState();
      if (!state || state.type != "path") {
        return;
      }
      this.selection.clear();
      this.pathNodes.forEach((node2) => node2.remove());
      const query2 = state.query || "";
      const order = this.fileTools.sort;
      const sorted = sortPathEntries(this.pathEntries, order);
      const shown = sorted.slice(0, MAX_PATH_RESULTS);
      const nodes = shown.map((entry) => {
        var _a;
        const tokens = [];
        if (entry.parent !== void 0) {
          tokens.push(entry.parent || "/");
        }
        if (order.key == "modified" && entry.modified) {
          tokens.push(formatDate(entry.modified));
        }
        const node2 = new Path(entry.data, tokens.join(SEPARATOR));
        if (entry.isDirectory) {
          const path = (_a = entry.data.directory) != null ? _a : "";
          node2.addButton("chevron-double-right", () => this.pushState({ type: "path", path }));
        }
        return node2;
      });
      let message = "";
      if (query2 && query2.length < MIN_PATH_QUERY) {
        message = `Type at least ${MIN_PATH_QUERY} characters to search`;
      } else if (query2 && sorted.length == 0) {
        message = `Nothing found for \u201C${query2}\u201D`;
      } else if (sorted.length > shown.length) {
        message = `Showing ${shown.length} of ${sorted.length} results, refine your search`;
      }
      this.pathNodes = [...nodes];
      if (message) {
        this.pathNodes.push(node("p", { className: "path-message" }, message));
      }
      this.append(...this.pathNodes);
      this.configureSelection(nodes);
    }
    async listSongs(filter) {
      const songs = await this.mpd.listSongs(filter);
      clear(this);
      this.buildBack();
      if (songs.length > 0) {
        this.addFilter();
      }
      const nodes = songs.map((song) => new Song(song));
      this.append(...nodes);
      this.configureSelection(nodes);
    }
    showSearch(query2 = "") {
      clear(this);
      this.append(this.search);
      this.search.value = query2;
      this.search.focus();
      if (query2) {
        this.search.onSubmit();
      }
    }
    async doSearch(query2) {
      const index = this.stateStack.length - 1;
      if (index >= 0) {
        this.stateStack[index] = { type: "search", query: query2 };
      }
      clear(this);
      this.append(this.search);
      this.search.pending(true);
      const songs1 = await this.mpd.searchSongs({ "AlbumArtist": query2 });
      const songs2 = await this.mpd.searchSongs({ "Album": query2 });
      const songs3 = await this.mpd.searchSongs({ "Title": query2 });
      this.search.pending(false);
      const nodes1 = this.aggregateSearch(songs1, "AlbumArtist");
      const nodes2 = this.aggregateSearch(songs2, "Album");
      const nodes3 = songs3.map((song) => new Song(song));
      this.append(...nodes1, ...nodes2, ...nodes3);
      const selectableNodes = [...nodes2, ...nodes3];
      this.configureSelection(selectableNodes);
    }
    aggregateSearch(songs, tag) {
      const results = /* @__PURE__ */ new Map();
      songs.forEach((song) => {
        const filter = {};
        const artist = song.AlbumArtist || song.Artist;
        let value;
        if (tag == "Album") {
          value = song.Album;
          if (artist) {
            filter["AlbumArtist"] = artist;
          }
        }
        if (tag == "AlbumArtist") {
          value = artist;
        }
        if (value !== void 0) {
          results.set(value, filter);
        }
      });
      const nodes = [];
      results.forEach((filter, value) => {
        const node2 = this.buildTag(tag, value, filter);
        nodes.push(node2);
      });
      return nodes;
    }
    buildTag(tag, value, filter) {
      const node2 = new Tag(tag, value, filter);
      node2.fillArt(this.mpd);
      switch (tag) {
        case "AlbumArtist":
        case "Genre":
          node2.onclick = () => this.pushState({ type: "tags", tag: "Album", filter: node2.createChildFilter() });
          break;
        case "Album":
          node2.addButton("chevron-double-right", () => this.pushState({ type: "songs", filter: node2.createChildFilter() }));
          break;
      }
      return node2;
    }
    buildBack() {
      const backState = this.topState(1);
      if (!backState) {
        return;
      }
      let title = "";
      switch (backState.type) {
        case "path":
          title = backState.query ? `Search: ${backState.query}` : "..";
          break;
        case "search":
          title = "Search";
          break;
        case "tags":
          title = TAGS[backState.tag];
          break;
      }
      const node2 = new Back(title);
      this.append(node2);
      node2.onclick = () => this.popState();
    }
    addFilter() {
      this.append(this.filter);
      this.filter.value = "";
    }
    configureSelection(items) {
      const { selection, mpd } = this;
      const commands = [{
        cb: async (items2) => {
          const commands2 = ["clear", ...songsOf3(items2).map(createEnqueueCommand), "play"];
          await mpd.command(commands2);
          selection.clear();
        },
        label: "Play",
        icon: "play"
      }, {
        cb: async (items2) => {
          const commands2 = songsOf3(items2).map(createEnqueueCommand);
          await mpd.command(commands2);
          selection.clear();
        },
        label: "Enqueue",
        icon: "plus"
      }];
      selection.configure(items, "multi", commands);
    }
  };
  customElements.define("cyp-library", Library);
  function nonempty(str) {
    return str.length > 0;
  }
  function parseDate(str) {
    const ms = str ? Date.parse(str) : NaN;
    return isNaN(ms) ? 0 : ms;
  }
  function formatDate(ms) {
    return new Date(ms).toLocaleString(void 0, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  function createPathEntry(data, searchBase) {
    const isDirectory = "directory" in data;
    const uri = (isDirectory ? data.directory : data.file) || "";
    const entry = {
      data,
      isDirectory,
      name: fileName(uri),
      modified: parseDate(data["Last-Modified"])
    };
    if (searchBase !== void 0) {
      const prefix2 = searchBase ? `${searchBase}/` : "";
      entry.parent = uri.substring(prefix2.length).split("/").slice(0, -1).join("/");
    }
    return entry;
  }
  function createSearchEntry(song, base) {
    return createPathEntry({ file: song.file, "Last-Modified": song["Last-Modified"] }, base);
  }
  function sortPathEntries(entries, order) {
    const sign = order.desc ? -1 : 1;
    const uri = (entry) => entry.data.directory || entry.data.file || "";
    return entries.slice().sort((a, b) => {
      if (a.isDirectory != b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      const diff = order.key == "modified" ? a.modified - b.modified : collator.compare(a.name, b.name);
      if (diff) {
        return diff * sign;
      }
      return collator.compare(a.name, b.name) || collator.compare(uri(a), uri(b));
    });
  }
  function createEnqueueCommand(node2) {
    if (node2 instanceof Song || node2 instanceof Path) {
      return `add "${escape(node2.file)}"`;
    } else {
      return [
        "findadd",
        serializeFilter(node2.createChildFilter())
        // `sort ${SORT}` // MPD >= 0.22, not yet released
      ].join(" ");
    }
  }

  // app/js/elements/fetch-settings.ts
  var MAX_ERROR_LINES = 3;
  var enabledInput = byId("fetch-enabled", HTMLInputElement);
  var urlInput = byId("fetch-url", HTMLInputElement);
  var keyInput = byId("fetch-key", HTMLInputElement);
  var keyToggle = byId("fetch-key-toggle", HTMLButtonElement);
  var dirInput = byId("fetch-dir", HTMLInputElement);
  var intervalInput = byId("fetch-interval", HTMLInputElement);
  var rsgainInput = byId("fetch-rsgain", HTMLInputElement);
  var saveButton = byId("fetch-save", HTMLButtonElement);
  var runButton = byId("fetch-run", HTMLButtonElement);
  var statusLine = byId("fetch-status", HTMLDivElement);
  var resultBox = byId("fetch-result", HTMLDivElement);
  var syncRunning = false;
  var syncStopping = false;
  var savedEnabled = false;
  function setStatus(text2) {
    statusLine.textContent = text2;
  }
  var megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
  var gigabytes = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(2);
  async function loadSettings2() {
    try {
      const res = await fetch("/fetch/settings", { cache: "no-store" });
      const s = await res.json();
      enabledInput.checked = s.enabled;
      urlInput.value = s.url;
      keyInput.value = s.key;
      dirInput.value = s.dir;
      dirInput.placeholder = `Default: ${s.musicDir}`;
      intervalInput.value = String(s.intervalMinutes);
      rsgainInput.checked = s.rsgain;
      savedEnabled = s.enabled;
      updateRunButton();
    } catch (e) {
      setStatus(`Could not load the settings: ${e}`);
    }
  }
  keyToggle.addEventListener("click", () => {
    const hidden = keyInput.type == "password";
    keyInput.type = hidden ? "text" : "password";
    keyToggle.textContent = hidden ? "Hide" : "Show";
  });
  saveButton.addEventListener("click", async () => {
    const body = {
      enabled: enabledInput.checked,
      url: urlInput.value,
      key: keyInput.value,
      dir: dirInput.value,
      intervalMinutes: Number(intervalInput.value),
      rsgain: rsgainInput.checked
    };
    const res = await fetch("/fetch/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok) {
      savedEnabled = data.settings.enabled;
    }
    updateRunButton();
    setStatus(data.ok ? "Saved." : `Not saved: ${data.error}`);
  });
  function statusLineEl(text2, className = "fetch-line") {
    return node("div", { className, title: text2 }, text2);
  }
  function countLines(p) {
    return [
      statusLineEl(`Downloaded ${p.downloaded} \xB7 Already there ${p.alreadyThere} \xB7 Conflicts ${p.conflicts} \xB7 Failed ${p.failed}`),
      statusLineEl(`Copied ${megabytes(p.bytesDone)} MB of ${megabytes(p.bytesTotal)} MB \xB7 Library ${p.libraryFiles} files / ${gigabytes(p.librarySize)} GB`)
    ];
  }
  function renderProgress(p) {
    const lines = [];
    if (p.running) {
      if (p.updatingLibrary) {
        lines.push(statusLineEl("Updating the library\u2026"));
      } else {
        lines.push(statusLineEl(p.stopping ? "Stopping after the current chunk\u2026" : `Copying ${p.index} of ${p.total}: ${p.current}`));
      }
      lines.push(...countLines(p));
    } else if (p.result) {
      if (p.result.stopped) {
        lines.push(statusLineEl("Stopped by you. Copied files were kept."));
      }
      if (p.reindexed) {
        lines.push(statusLineEl("Library updated."));
      }
      if (p.downloaded > 0 || p.failed > 0 || p.conflicts > 0) {
        lines.push(...countLines(p));
      }
      const shown = p.errors.slice(0, MAX_ERROR_LINES);
      for (const e of shown) {
        lines.push(statusLineEl(`Error: ${e}`, "fetch-line fetch-error"));
      }
      if (p.errors.length > shown.length) {
        lines.push(statusLineEl(`\u2026and ${p.errors.length - shown.length} more errors`, "fetch-line fetch-error"));
      }
      if (!p.result.ok && p.result.error) {
        lines.push(statusLineEl(`Error: ${p.result.error}`, "fetch-line fetch-error"));
      }
    }
    resultBox.replaceChildren(...lines);
  }
  function updateRunButton() {
    runButton.textContent = syncRunning ? "Stop" : "Sync now";
    runButton.disabled = syncStopping || !syncRunning && !savedEnabled;
    saveButton.disabled = syncRunning;
  }
  function setRunning(running, stopping = false) {
    syncRunning = running;
    syncStopping = running && stopping;
    updateRunButton();
  }
  var pollTimer = null;
  async function pollProgress() {
    var _a, _b;
    try {
      const res = await fetch("/fetch/status", { cache: "no-store" });
      const p = await res.json();
      renderProgress(p);
      if (p.running) {
        setRunning(true, p.stopping);
        setStatus(p.updatingLibrary ? "Updating library..." : p.stopping ? "Stopping..." : "Syncing...");
        return;
      }
      if (pollTimer !== null) {
        clearInterval(pollTimer);
      }
      pollTimer = null;
      setRunning(false);
      setStatus(((_a = p.result) == null ? void 0 : _a.stopped) ? "Stopped" : ((_b = p.result) == null ? void 0 : _b.ok) ? "Sync finished" : "Sync failed");
    } catch (e) {
      setStatus(`Could not read the sync progress: ${e}`);
    }
  }
  function startPolling() {
    if (pollTimer === null) {
      pollTimer = window.setInterval(pollProgress, 1e3);
    }
    pollProgress();
  }
  runButton.addEventListener("click", async () => {
    if (syncRunning) {
      setRunning(true, true);
      setStatus("Stopping...");
      await fetch("/fetch/stop", { method: "POST" });
      return;
    }
    resultBox.replaceChildren();
    const res = await fetch("/fetch/run", { method: "POST" });
    const data = await res.json();
    if (!data.ok) {
      setStatus("Not started");
      resultBox.replaceChildren(statusLineEl(data.error, "fetch-line fetch-error"));
      return;
    }
    setStatus("Syncing...");
    setRunning(true);
    startPolling();
  });
  async function resumeIfRunning() {
    const res = await fetch("/fetch/status", { cache: "no-store" });
    const p = await res.json();
    if (p.running) {
      setRunning(true, p.stopping);
      startPolling();
    }
  }
  updateRunButton();
  loadSettings2();
  resumeIfRunning();

  // app/js/elements/shutdown.ts
  var shutdownButton = document.getElementById("shutdown-btn");
  async function isHostAlive() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2e3);
    try {
      await fetch("/settings", { method: "GET", cache: "no-store", signal: controller.signal });
      return true;
    } catch (e) {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
  function watchForShutdown(button3) {
    const pingInterval = window.setInterval(async () => {
      const alive = await isHostAlive();
      if (!alive) {
        clearInterval(pingInterval);
        button3.textContent = "Switched off";
      }
    }, 2e3);
  }
  if (shutdownButton instanceof HTMLButtonElement) {
    const button3 = shutdownButton;
    button3.addEventListener("click", async () => {
      if (!confirm("Shut down the system now?")) {
        return;
      }
      beginShutdown();
      button3.disabled = true;
      button3.textContent = "Shutting down\u2026";
      await fetch("/shutdown", { method: "POST" });
      watchForShutdown(button3);
    });
  }

  // app/js/elements/refresh.ts
  var IDLE_LABEL = "Refresh content";
  var FINISHED_MS = 2e3;
  var POLL_MS = 2e3;
  var button2 = document.getElementById("refresh-btn");
  function setupRefreshButton(button3) {
    let wasUpdating = false;
    let resetTimer = null;
    function show(label, disabled) {
      button3.textContent = label;
      button3.disabled = disabled;
    }
    function flashFinished(ok) {
      if (resetTimer !== null) {
        clearTimeout(resetTimer);
      }
      show(ok ? "Done!" : "Failed", true);
      resetTimer = window.setTimeout(() => {
        resetTimer = null;
        show(IDLE_LABEL, false);
      }, FINISHED_MS);
    }
    function render(status) {
      if (status.updating) {
        if (resetTimer !== null) {
          clearTimeout(resetTimer);
          resetTimer = null;
        }
        show(status.source == "sync" ? "Updating after sync\u2026" : "Refreshing\u2026", true);
        wasUpdating = true;
        return;
      }
      if (wasUpdating) {
        wasUpdating = false;
        if (status.ok === false) {
          button3.title = status.error;
        } else {
          button3.title = "";
        }
        flashFinished(status.ok !== false);
      }
    }
    async function poll() {
      try {
        const res = await fetch("/library/status", { cache: "no-store" });
        const status = await res.json();
        render(status);
      } catch (e) {
      }
    }
    button3.addEventListener("click", async () => {
      show("Refreshing\u2026", true);
      try {
        const res = await fetch("/refresh", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
          wasUpdating = true;
        } else {
          flashFinished(false);
          button3.title = data.error;
        }
      } catch (e) {
        flashFinished(false);
      }
    });
    poll();
    window.setInterval(poll, POLL_MS);
  }
  if (button2 instanceof HTMLButtonElement) {
    setupRefreshButton(button2);
  }
})();
