import * as html from "../html.js";
import * as conf from "../conf.js";
import { escape } from "../mpd.js";
import Component from "../component.js";
import Search from "./search.js";
import Result from "./yt-result.js";


interface ResultData {
	title: string;
	id: string;
}

function isResultList(data: unknown): data is ResultData[] {
	return Array.isArray(data) && data.every((item: unknown) => {
		return typeof item == "object" && item !== null
			&& "title" in item && typeof item.title == "string"
			&& "id" in item && typeof item.id == "string";
	});
}

class YT extends Component {
	protected search = new Search();

	constructor() {
		super();

		this.search.onSubmit = () => {
			const query = this.search.value;
			if (query) { this.doSearch(query); }
		};

		this.clear();
	}

	protected clear() {
		html.clear(this);
		this.append(this.search);
	}

	protected async doSearch(query: string) {
		this.clear();
		this.search.pending(true);

		const url = `youtube?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(conf.ytLimit)}`;
		const response = await fetch(url);
		if (response.status == 200) {
			const results: unknown = await response.json();
			if (isResultList(results)) {
				results.forEach(result => {
					const node = new Result(result.title);
					this.append(node);
					node.addButton("download", () => this.download(result.id));
				});
			}
		} else {
			alert(await response.text());
		}

		this.search.pending(false);
	}

	protected async download(id: string) {
		this.clear();

		const pre = html.node("pre", {}, "", this);
		this.search.pending(true);

		const body = new URLSearchParams();
		body.set("id", id);
		const response = await fetch("youtube", {method:"POST", body});

		let output = "";
		if (response.body) {
			const reader = response.body.getReader();
			for (;;) {
				const chunk = await reader.read();
				if (chunk.done) { break; }
				const text = decoder.decode(chunk.value, {stream: true});
				output += text;
				pre.textContent += text;
				pre.scrollTop = pre.scrollHeight;
			}
			reader.releaseLock();
		}

		this.search.pending(false);

		// only a finished download is added to MPD; a failure stays visible in the output
		if (response.status == 200 && output.includes("[cyp] done")) {
			this.mpd.command(`update ${escape(conf.ytPath)}`);
		} else {
			pre.textContent += "\nDownload did not finish. Nothing was added to the library.\n";
		}
	}

	protected override onComponentChange(_c: string, isThis: boolean) {
		const wasHidden = this.hidden;
		this.hidden = !isThis;

		if (!wasHidden && isThis) { this.clear(); }
	}
}

customElements.define("cyp-yt", YT);

// one decoder for the whole stream: a character split across two chunks is decoded whole
const decoder = new TextDecoder("utf-8");
