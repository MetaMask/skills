/**
 * tiny-video-renderer: render a Videowright-style project to MP4. One file, zero npm dependencies.
 *
 *   node vw.ts render <timeline.ts> [--output out.mp4] [--fps N] [--chrome PATH] [--no-sandbox] [--dry-run] [--verbose]
 *
 * Needs: Node 22.18+ (built-in TypeScript type stripping), Chrome/Chromium, ffmpeg. See README.md.
 *
 * How it is organised: everything above the NODE-ONLY marker is browser-safe. The server sends that part to
 * Chrome as the module `"videowright"` (what segments import), and Node loads this same file for the same
 * name when reading a project's config and timeline. Everything below it runs only in Node.
 *
 * Derived from videowright 0.1.1, https://github.com/scosman/videowright (MIT):
 *
 *   Copyright (c) 2026 Videowright Contributors
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 *   associated documentation files (the "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 *   following conditions: The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
 *   ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 *   FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 *   LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 *   ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Changes and additions: Copyright (c) 2026 Prithpal Sooriya, under the same MIT terms.
 *
 * The virtual-time shim (TIME_SHIM) is upstream's, verbatim. The Chrome switch list and font-family tables
 * come from Playwright 1.63 (Apache-2.0, Copyright (c) Microsoft Corporation) so pixels match upstream's.
 */

// ===================================================================================================
// Browser-safe part
// ===================================================================================================

/** Declare a segment. `advances` are segment-relative seconds: one per `waitForNext()` plus the total length. */
export function defineSegment(spec: any): any {
	if (!spec.id) throw new TypeError("defineSegment: id is required");
	if (!spec.play) throw new TypeError("defineSegment: play is required");
	const a = spec.advances;
	if (!Array.isArray(a) || a.length === 0) {
		throw new TypeError(`defineSegment: advances is required and must be a non-empty array (segment "${spec.id}")`);
	}
	a.forEach((v: any, i: number) => {
		if (typeof v !== "number" || v <= 0 || !Number.isFinite(v)) {
			throw new TypeError(`defineSegment: advances[${i}] must be a positive number (segment "${spec.id}", got ${v})`);
		}
		if (i > 0 && v <= a[i - 1]) {
			throw new TypeError(`defineSegment: advances must be strictly increasing (segment "${spec.id}", advances[${i}]=${v} <= ${a[i - 1]})`);
		}
	});
	return Object.freeze({ ...spec });
}

export const defineConfig = (config: any): any => config;

class AbortError extends DOMException {
	constructor() {
		super("Segment aborted", "AbortError");
	}
}
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** One mounted segment: beat counter, pending `waitForNext()` resolvers, abort signal, and the `ctx` it receives. */
class SegmentRunner {
	segment: any;
	playPromise: Promise<void> | null = null;
	private resolvers: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
	private abort = new AbortController();
	private mountedAt = 0;
	private state = "created";

	constructor(segment: any) {
		this.segment = segment;
	}

	async mount(el: HTMLElement) {
		this.mountedAt = performance.now();
		if (this.segment.mount) await this.segment.mount(el, this.ctx());
		this.state = "mounted";
	}

	startPlay(): Promise<void> {
		this.state = "playing";
		this.playPromise = this.segment
			.play(this.ctx())
			.catch((e: unknown) => {
				if (!isAbort(e)) throw e; // unmount aborts play(); anything else is a real error
			})
			.finally(() => {
				if (this.state !== "unmounted") this.state = "done";
			});
		return this.playPromise!;
	}

	/** Release the next pending `waitForNext()`. False if none was waiting. */
	triggerNext(): boolean {
		if (this.segment.next) {
			const consumed = this.segment.next();
			if (consumed === true) return true;
			if (consumed === false) return false;
		}
		const r = this.resolvers.shift();
		if (!r) return false;
		r.resolve();
		return true;
	}

	unmount() {
		if (this.state === "unmounted") return;
		this.abort.abort();
		try {
			this.segment.unmount?.();
		} catch (e) {
			console.error("unmount() threw", e);
		}
		while (this.resolvers.length) this.resolvers.shift()!.reject(new AbortError());
		this.state = "unmounted";
	}

	private ctx() {
		return {
			waitForNext: () =>
				new Promise<void>((resolve, reject) => {
					if (this.state === "unmounted") return reject(new AbortError());
					this.resolvers.push({ resolve, reject });
				}),
			// setTimeout and performance.now() are virtualized by TIME_SHIM, so these follow the frame clock.
			hold: (ms: number) =>
				new Promise<void>((resolve, reject) => {
					if (this.abort.signal.aborted) return reject(new AbortError());
					const onAbort = () => (clearTimeout(t), reject(new AbortError()));
					const t = setTimeout(() => {
						this.abort.signal.removeEventListener("abort", onAbort);
						resolve();
					}, ms);
					this.abort.signal.addEventListener("abort", onAbort, { once: true });
				}),
			signal: this.abort.signal,
			mode: "render",
			clock: () => performance.now() - this.mountedAt,
		};
	}
}

/** Built-in transitions. A transition animates two slot elements and resolves when it finishes. */
export const cut = async (out: HTMLElement, inc: HTMLElement) => {
	out.style.visibility = "hidden";
	inc.style.visibility = "visible";
};
export const fade = async (out: HTMLElement, inc: HTMLElement, ctx: any) => {
	const duration = ctx.duration ?? 400;
	const a = out.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: "forwards" });
	const b = inc.animate([{ opacity: 0 }, { opacity: 1 }], { duration, fill: "forwards" });
	await Promise.all([a.finished, b.finished]);
};

/** timeline.meta > config.defaults > 1920x1080 @ 60 fps. */
export function applyMetaDefaults(timeline: any, config: any): any {
	const d = config.defaults ?? {};
	const m = timeline.meta;
	return { ...timeline, meta: { ...m, resolution: m.resolution ?? d.resolution ?? [1920, 1080], fps: m.fps ?? d.fps ?? 60, aspectRatio: m.aspectRatio ?? d.aspectRatio ?? "16:9" } };
}

const SLOT = "position:absolute;inset:0;overflow:hidden;";
const SLOT_CONTENT = "width:100%;height:100%;position:relative;";

function makeSlot(label: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "vw-slot";
	el.dataset.slot = label;
	el.setAttribute("style", SLOT);
	const content = document.createElement("div");
	content.className = "vw-slot-content";
	content.setAttribute("style", SLOT_CONTENT);
	el.appendChild(content);
	return el;
}
const slotContent = (slot: HTMLElement) => slot.querySelector(".vw-slot-content") as HTMLElement;
/** Transitions use fill:"forwards"; cancel before a slot is reused so stale transforms do not linger. */
const clearAnimations = (slot: HTMLElement) => slot.getAnimations?.().forEach((a) => a.cancel());

/** Two slots, one visible. Segment N+1 mounts in the idle slot and the transition crosses over to it. */
class Player {
	private slots: Array<{ el: HTMLDivElement; runner: SegmentRunner | null; index: number }>;
	private cur = 0;
	private transitioning = false;
	private state = "idle";
	private timeline: any;
	private loaders: Map<string, () => Promise<any>>;
	private transitions: Map<string, () => Promise<any>>;

	constructor(host: HTMLElement, timeline: any, loaders: Map<string, () => Promise<any>>, transitions: Map<string, () => Promise<any>>) {
		this.timeline = timeline;
		this.loaders = loaders;
		this.transitions = transitions;
		const wrapper = document.createElement("div");
		wrapper.className = "vw-host";
		wrapper.setAttribute("style", "position:relative;width:100%;height:100%;overflow:hidden;");
		this.slots = [makeSlot("a"), makeSlot("b")].map((el) => ({ el, runner: null, index: -1 }));
		this.slots[1].el.style.visibility = "hidden";
		this.slots.forEach((s) => wrapper.appendChild(s.el));
		host.appendChild(wrapper);
	}

	async start() {
		try {
			await this.mountAt(0);
			this.setState("playing");
		} catch (e) {
			this.fail(this.timeline.segments[0]?.id ?? "unknown", e);
		}
	}

	/**
	 * Fire one scheduled beat. A non-last beat releases a pending waitForNext(). The last beat of a segment
	 * starts the transition to the next one WITHOUT awaiting it: transitions only finish when the driver steps
	 * the virtual clock, so awaiting here would deadlock. Returns false once the timeline has ended.
	 */
	async renderAdvance(isLast: boolean): Promise<boolean> {
		if (this.state === "ended" || this.state === "errored") return false;
		const slot = this.slots[this.cur];
		if (!slot.runner) return false;
		const released = slot.runner.triggerNext();
		if (!isLast) {
			if (!released) {
				const id = this.timeline.segments[slot.index]?.id ?? "unknown";
				const w = window as any;
				(w.__VW_WARNINGS__ ??= []).push(`segment "${id}": a scheduled beat had no pending waitForNext() (advances has more entries than waitForNext() calls)`);
			}
			return true;
		}
		const next = slot.index + 1;
		if (next >= this.timeline.segments.length) {
			this.setState("ended");
			return false;
		}
		this.transitionTo(next).catch((e) => this.fail(this.timeline.segments[next]?.id ?? "unknown", e));
		return true;
	}

	private async mountAt(index: number) {
		const entry = this.timeline.segments[index];
		const segment = (await this.loaders.get(entry.id)!()).default;
		const runner = new SegmentRunner(segment);
		const slot = this.slots[this.cur];
		slot.runner = runner;
		slot.index = index;
		const content = slotContent(slot.el);
		content.innerHTML = "";
		slot.el.style.visibility = "visible";
		await runner.mount(content);
		runner.startPlay().catch((e) => this.fail(entry.id, e));
	}

	private async transitionTo(target: number) {
		if (this.transitioning) return;
		this.transitioning = true;
		this.setState("transitioning");
		const out = this.slots[this.cur];
		const inc = this.slots[1 - this.cur];
		const entry = this.timeline.segments[target];
		// The same segment module twice in a row: unmount the outgoing first, or its unmount() would clobber
		// module-level state (e.g. `host = el`) that the incoming mount() just set.
		const same = out.runner != null && this.timeline.segments[out.index]?.id === entry.id;
		try {
			const segment = (await this.loaders.get(entry.id)!()).default;
			const outRunner = out.runner;
			const retire = async () => {
				if (!outRunner) return;
				outRunner.unmount();
				out.runner = null;
				if (outRunner.playPromise) await outRunner.playPromise;
			};
			if (same) await retire();

			const runner = new SegmentRunner(segment);
			inc.runner = runner;
			inc.index = target;
			clearAnimations(inc.el);
			const content = slotContent(inc.el);
			content.innerHTML = "";
			inc.el.style.visibility = "visible";
			await runner.mount(content);
			const playing = runner.startPlay();

			if (!same) {
				await retire(); // different segments: unmount the outgoing AFTER mounting the incoming
				const t = entry.transition;
				const name = t ? (typeof t === "string" ? t : t.type) : "cut";
				const load = this.transitions.get(name) ?? this.transitions.get("cut")!;
				if (outRunner) await (await load()).default(out.el, inc.el, { direction: "forward", duration: typeof t === "object" ? t.duration : undefined });
			}

			clearAnimations(out.el);
			clearAnimations(inc.el);
			out.el.style.visibility = "hidden";
			slotContent(out.el).innerHTML = "";
			this.cur = 1 - this.cur;
			this.transitioning = false;
			this.setState("playing");
			playing.catch((e) => this.fail(entry.id, e));
		} catch (e) {
			this.transitioning = false;
			this.fail(entry.id, e);
		}
	}

	/** A segment threw. Record it where the driver looks, so the render stops instead of finishing a broken video. */
	private fail(id: string, e: unknown) {
		const err = e instanceof Error ? e : new Error(String(e));
		console.error(`Player: segment "${id}" errored:`, err);
		(window as any).__VW_RENDER_ERROR__ = `segment "${id}": ${err.message}`;
		this.setState("errored");
		this.transitioning = false;
	}

	/** The driver reads body[data-vw-segment] to check that beats and transitions line up. */
	private setState(state: string) {
		this.state = state;
		document.body.dataset.vwState = state;
		document.body.dataset.vwSegment = this.slots[this.cur].runner?.segment.id ?? "";
	}
}

/** Runs in the page (render.html calls it): load config, timeline and segments, start the player, expose the driver's hooks. */
export async function boot() {
	const w = window as any;
	w.__VW_RENDER_READY__ = false;
	w.__VW_RENDER_ERROR__ = null;
	w.__VW_SEGMENT_ADVANCES__ = {};
	try {
		const v = await import("/__vw/virtual.js");
		const loaders = new Map<string, () => Promise<any>>(Object.entries(v.segmentLoaders as Record<string, () => Promise<any>>));
		const timeline = (await import(v.timelineUrl)).default;
		const config = (await import(v.configUrl)).default;
		const transitions = new Map<string, () => Promise<any>>([
			["cut", async () => ({ default: cut })],
			["fade", async () => ({ default: fade })],
			...Object.entries((config.transitions ?? {}) as Record<string, () => Promise<any>>),
		]);
		const final = applyMetaDefaults(timeline, config);

		const errors: string[] = [];
		if (!final.meta.title?.trim()) errors.push("Timeline is missing a title");
		for (const e of final.segments) {
			if (!loaders.has(e.id)) errors.push(`Missing segment "${e.id}" in timeline "${final.meta.title}" (expected segments/${e.id}/index.ts)`);
			const t = e.transition && (typeof e.transition === "string" ? e.transition : e.transition.type);
			if (t && !transitions.has(t)) errors.push(`Missing transition "${t}" on segment "${e.id}"`);
		}
		if (errors.length) throw new Error(`Timeline validation failed:\n${errors.join("\n")}`);

		// The driver needs every segment's own `advances` before it can build the frame schedule.
		for (const e of final.segments) {
			const seg = (await loaders.get(e.id)!()).default;
			if (seg && Array.isArray(seg.advances)) w.__VW_SEGMENT_ADVANCES__[e.id] = seg.advances;
		}

		const player = new Player(document.getElementById("player-host")!, final, loaders, transitions);
		await player.start();

		// Hand over from real to virtual time now, in the same task as start(). Animations started during boot are
		// frozen at their real elapsed time, so waiting for the driver to notice (a poll plus a round trip) would
		// start the first segment a run-dependent amount of time late.
		w.__VW_ENGAGE_VIRTUAL_TIME__();

		w.__VW_RENDER_ADVANCE__ = async (isLast: boolean) => {
			try {
				return await player.renderAdvance(isLast);
			} catch (e) {
				w.__VW_RENDER_ERROR__ = e instanceof Error ? e.message : String(e);
				return false;
			}
		};
	} catch (e) {
		console.error("Render boot error:", e);
		w.__VW_RENDER_ERROR__ = e instanceof Error ? e.message : String(e);
	}
	w.__VW_RENDER_READY__ = true; // also on failure, so the driver can read the error
}

// @@NODE_ONLY@@ (the server sends Chrome only what is above this line)

// ===================================================================================================
// Node-only part
// ===================================================================================================

import { execFileSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { register, stripTypeScriptTypes } from "node:module";
import { homedir, platform, tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF = fileURLToPath(import.meta.url);

/** An error with an actionable hint; printed without a stack trace. */
export class UserError extends Error {
	hint?: string;
	constructor(message: string, hint?: string) {
		super(message);
		this.hint = hint;
	}
}

// ---------------------------------------------------------------------------------------------------
// Timing: advances -> frame schedule
// ---------------------------------------------------------------------------------------------------

/** Every timeline segment needs a non-empty, positive, strictly increasing `advances` array. */
export function validateSegmentAdvances(timeline: any, advances: Record<string, number[]>): string[] {
	const errors: string[] = [];
	for (const { id } of timeline.segments) {
		const a = advances[id];
		if (!Array.isArray(a) || a.length === 0) {
			errors.push(`Segment "${id}": missing or empty 'advances' array. Every segment must declare advances for render timing.`);
			continue;
		}
		a.forEach((v, i) => {
			if (typeof v !== "number" || v <= 0 || !Number.isFinite(v)) errors.push(`Segment "${id}": advances[${i}] must be a positive number (got ${v})`);
			if (i > 0 && v <= a[i - 1]) errors.push(`Segment "${id}": advances must be strictly increasing (advances[${i}]=${v} <= advances[${i - 1}]=${a[i - 1]})`);
		});
	}
	return errors;
}

/** Active advances per segment: the audio track's `timing.perSegment` overrides each segment's own `advances`. */
export function resolveTiming(segments: Array<{ id: string; advances: number[] }>, audioTrack?: any): Record<string, number[]> {
	const out: Record<string, number[]> = {};
	for (const s of segments) out[s.id] = s.advances;
	for (const [id, a] of Object.entries<number[] | undefined>(audioTrack?.timing?.perSegment ?? {})) if (a) out[id] = a;
	return out;
}

/** The global frame at which each beat fires; segments follow each other, each as long as its last advance. */
export function buildFrameSchedule(timeline: any, advances: Record<string, number[]>, fps: number) {
	const schedule: Array<{ globalFrame: number; segmentId: string; advanceIndex: number; isLast: boolean }> = [];
	let base = 0;
	for (const { id } of timeline.segments) {
		const a = advances[id];
		if (!a) continue;
		a.forEach((v, i) => schedule.push({ globalFrame: base + Math.round(v * fps), segmentId: id, advanceIndex: i, isLast: i === a.length - 1 }));
		base += Math.round(a[a.length - 1] * fps);
	}
	return schedule;
}

// ---------------------------------------------------------------------------------------------------
// ffmpeg
// ---------------------------------------------------------------------------------------------------

export function findFfmpeg(): string {
	try {
		const found = execFileSync(platform() === "win32" ? "where" : "which", ["ffmpeg"], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim().split("\n")[0].trim();
		if (found) return found;
	} catch {
		// not found
	}
	throw new UserError("ffmpeg not found on PATH", platform() === "darwin" ? "Install it with: brew install ffmpeg" : "Install ffmpeg with your package manager");
}

/** PNG frames on stdin, optional audio file. Video length is canonical: `apad` extends the audio, `-shortest` clips at the video end. */
export function buildFfmpegArgs(fps: number, outputPath: string, audioFilePath?: string): string[] {
	const args = ["-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0"];
	if (audioFilePath) args.push("-i", audioFilePath);
	args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast", "-crf", "18");
	if (audioFilePath) args.push("-c:a", "aac", "-b:a", "192k", "-map", "0:v:0", "-map", "1:a:0", "-af", "apad", "-shortest");
	args.push("-r", String(fps), outputPath);
	return args;
}

/** Write to a stream, waiting for 'drain' when the pipe is full. */
const write = (stream: NodeJS.WritableStream, data: Buffer) =>
	new Promise<void>((resolve, reject) => {
		if (stream.write(data)) return resolve();
		const onDrain = () => (stream.off("error", onError), resolve());
		const onError = (e: Error) => (stream.off("drain", onDrain), reject(e));
		stream.once("drain", onDrain);
		stream.once("error", onError);
	});

// ---------------------------------------------------------------------------------------------------
// Chrome over the DevTools protocol (replaces Playwright)
// ---------------------------------------------------------------------------------------------------

/** --chrome / $CHROME_BIN, then Playwright's cached headless shell, then system Chrome. */
export function findChrome(explicit?: string): string {
	const given = explicit ?? process.env.CHROME_BIN;
	if (given) {
		if (!existsSync(given)) throw new UserError(`Chrome binary not found: ${given}`);
		return given;
	}
	const candidates: string[] = [];
	for (const root of [join(homedir(), "Library", "Caches", "ms-playwright"), join(homedir(), ".cache", "ms-playwright")]) {
		if (!existsSync(root)) continue;
		for (const shell of readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse()) {
			for (const sub of readdirSync(join(root, shell))) candidates.push(join(root, shell, sub, "chrome-headless-shell"));
		}
	}
	if (platform() === "darwin") {
		candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium");
	} else if (platform() === "win32") {
		for (const base of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) if (base) candidates.push(join(base, "Google", "Chrome", "Application", "chrome.exe"));
	} else {
		for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
			try {
				candidates.push(execFileSync("which", [name], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim());
			} catch {
				// not on PATH
			}
		}
	}
	const found = candidates.find((c) => c && existsSync(c));
	if (!found) throw new UserError("No Chrome or Chromium found", "Install Google Chrome, or pass --chrome <path> / set CHROME_BIN.");
	return found;
}

/** A DevTools connection. After attachNewPage(), commands go to that page's session. */
class Cdp {
	private nextId = 0;
	private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
	private listeners = new Map<string, Array<(params: any) => void>>();
	private session: string | undefined;

	private ws: WebSocket;

	private constructor(ws: WebSocket) {
		this.ws = ws;
	}

	static async connect(url: string): Promise<Cdp> {
		const ws = new WebSocket(url);
		await new Promise<void>((resolve, reject) => {
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error("Could not connect to Chrome DevTools"));
		});
		const cdp = new Cdp(ws);
		ws.onmessage = (event: MessageEvent) => {
			const msg = JSON.parse(String(event.data));
			if (msg.id !== undefined) {
				const p = cdp.pending.get(msg.id);
				cdp.pending.delete(msg.id);
				if (msg.error) p?.reject(new Error(`${msg.error.message} (${msg.error.code})`));
				else p?.resolve(msg.result);
			} else if (msg.method && (cdp.session === undefined || msg.sessionId === undefined || msg.sessionId === cdp.session)) {
				for (const l of cdp.listeners.get(msg.method) ?? []) l(msg.params);
			}
		};
		ws.onclose = () => {
			for (const p of cdp.pending.values()) p.reject(new Error("Chrome connection closed"));
			cdp.pending.clear();
		};
		return cdp;
	}

	send(method: string, params: object = {}, browserLevel = false): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = ++this.nextId;
			this.pending.set(id, { resolve, reject });
			this.ws.send(JSON.stringify({ id, method, params, ...(this.session && !browserLevel ? { sessionId: this.session } : {}) }));
		});
	}

	on(method: string, listener: (params: any) => void) {
		this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
	}

	/** A fresh browser context with one blank page, like Playwright's; part of what makes the pixels match. */
	async attachNewPage() {
		const { browserContextId } = await this.send("Target.createBrowserContext", {}, true);
		const { targetId } = await this.send("Target.createTarget", { url: "about:blank", browserContextId }, true);
		this.session = (await this.send("Target.attachToTarget", { targetId, flatten: true }, true)).sessionId;
	}

	async evaluate<T = any>(expression: string): Promise<T> {
		const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? "page evaluation failed");
		return r.result.value;
	}

	async waitFor(expression: string, timeoutMs: number) {
		for (const end = Date.now() + timeoutMs; Date.now() < end; await new Promise((r) => setTimeout(r, 50))) {
			if (await this.evaluate(`!!(${expression})`)) return;
		}
		throw new UserError(`Timed out after ${timeoutMs / 1000}s waiting for: ${expression}`);
	}

	/** PNG of the viewport. Like Playwright, wait for web fonts first: flushing layout makes Chrome request the fonts this frame needs, and fonts.ready resolves when they have loaded. Without it embedded fonts can render as a fallback in early frames. */
	async screenshot(): Promise<Buffer> {
		await this.evaluate("(document.body.offsetHeight, document.fonts.ready.then(() => true))");
		return Buffer.from((await this.send("Page.captureScreenshot", { format: "png" })).data, "base64");
	}

	close() {
		try {
			this.ws.close();
		} catch {
			// already closed
		}
	}
}

// Chrome switches and generic font families as Playwright 1.63 sets them (Apache-2.0): the same switches give
// the same pixels. Notably there is no --disable-gpu, and `monospace`/`sans-serif` are pinned per platform,
// which decides the fallback glyphs for characters a page's own fonts lack (arrows, check marks).
const FEATURES_OFF = ["AvoidUnnecessaryBeforeUnloadCheckSync", "DestroyProfileOnBrowserClose", "DialMediaRouteProvider", "GlobalMediaControls", "HttpsUpgrades", "LensOverlay", "MediaRouter", "PaintHolding", "ThirdPartyStoragePartitioning", "BlockOriginHeaderModificationOnRedirect", "Translate", "AutoDeElevate", "OptimizationHints", "msForceBrowserSignIn", "msEdgeUpdateLaunchServicesPreferredVersion"];
const CHROME_FLAGS = [
	"--disable-field-trial-config", "--disable-background-networking", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
	"--disable-back-forward-cache", "--disable-breakpad", "--disable-client-side-phishing-detection", "--disable-component-extensions-with-background-pages",
	"--disable-component-update", "--no-default-browser-check", "--disable-default-apps", "--disable-dev-shm-usage", "--disable-edgeupdater", "--disable-extensions",
	`--disable-features=${FEATURES_OFF.join(",")}`, "--enable-features=CDPScreenshotNewSurface", "--allow-pre-commit-input", "--disable-hang-monitor",
	"--disable-ipc-flooding-protection", "--disable-popup-blocking", "--disable-prompt-on-repost", "--disable-renderer-backgrounding", "--disable-updater-scheduler",
	"--force-color-profile=srgb", "--metrics-recording-only", "--no-first-run", "--password-store=basic", "--use-mock-keychain", "--no-service-autorun",
	"--export-tagged-pdf", "--disable-search-engine-choice-screen", "--unsafely-disable-devtools-self-xss-warnings", "--disable-infobars", "--disable-sync",
	"--enable-unsafe-swiftshader", "--headless", "--hide-scrollbars", "--mute-audio",
	"--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4", "--no-startup-window",
];
const FONT_FAMILIES: Record<string, object> = {
	darwin: {
		fontFamilies: { standard: "Times", fixed: "Courier", serif: "Times", sansSerif: "Helvetica", cursive: "Apple Chancery", fantasy: "Papyrus" },
		forScripts: [
			{ script: "jpan", fontFamilies: { standard: "Hiragino Kaku Gothic ProN", fixed: "Osaka-Mono", serif: "Hiragino Mincho ProN", sansSerif: "Hiragino Kaku Gothic ProN" } },
			{ script: "hang", fontFamilies: { standard: "Apple SD Gothic Neo", serif: "AppleMyungjo", sansSerif: "Apple SD Gothic Neo" } },
			{ script: "hans", fontFamilies: { standard: ",PingFang SC,STHeiti", serif: "Songti SC", sansSerif: ",PingFang SC,STHeiti", cursive: "Kaiti SC" } },
			{ script: "hant", fontFamilies: { standard: ",PingFang TC,Heiti TC", serif: "Songti TC", sansSerif: ",PingFang TC,Heiti TC", cursive: "Kaiti TC" } },
		],
	},
	linux: { fontFamilies: { standard: "Times New Roman", fixed: "Monospace", serif: "Times New Roman", sansSerif: "Arial", cursive: "Comic Sans MS", fantasy: "Impact" } },
};

/** Start Chrome with a throwaway profile and attach a fresh page. Chrome's sandbox stays on unless it cannot start (nested sandbox, containers), then retry once without it. */
async function launchChrome(chrome: string, noSandbox: boolean): Promise<{ cdp: Cdp; version: string; close(): void }> {
	if (noSandbox || (typeof process.getuid === "function" && process.getuid() === 0)) return launchOnce(chrome, true);
	try {
		return await launchOnce(chrome, false);
	} catch (e) {
		console.warn(`Warning: Chrome would not start with its sandbox (${e instanceof Error ? e.message : e}); retrying with --no-sandbox. This tool only loads its own localhost page. Pass --no-sandbox to skip this check.`);
		return launchOnce(chrome, true);
	}
}

async function launchOnce(chrome: string, noSandbox: boolean) {
	const profile = mkdtempSync(join(tmpdir(), "vw-chrome-"));
	const proc: ChildProcess = spawn(chrome, [...CHROME_FLAGS, "--remote-debugging-port=0", `--user-data-dir=${profile}`, ...(noSandbox ? ["--no-sandbox"] : [])], { stdio: ["ignore", "ignore", "pipe"] });
	const cleanup = () => {
		proc.kill("SIGKILL");
		try {
			// Chrome's helper processes can still be writing here as it dies; a leftover temp dir must never fail a finished render.
			rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
		} catch {}
	};
	try {
		const ws = await new Promise<string>((resolve, reject) => {
			let log = "";
			const timer = setTimeout(() => reject(new Error("Chrome did not start within 20s")), 20000);
			const settle = (fn: () => void) => (clearTimeout(timer), fn());
			proc.stderr?.on("data", (d: Buffer) => {
				log += d;
				const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
				if (m) settle(() => resolve(m[1]));
			});
			proc.on("error", (e) => settle(() => reject(e)));
			proc.on("exit", (code) => settle(() => reject(new Error(`Chrome exited early (code ${code}): ${log.slice(-300)}`))));
		});
		const cdp = await Cdp.connect(ws);
		await cdp.attachNewPage();
		await cdp.evaluate("1"); // the page's renderer must come up; this fails if the sandbox killed it
		const version = ((await (await fetch(`http://127.0.0.1:${new URL(ws).port}/json/version`)).json()) as any).Browser ?? "chrome";
		return { cdp, version, close: () => (cdp.close(), cleanup()) };
	} catch (e) {
		cleanup();
		throw e;
	}
}

/** The page setup Playwright applies to every page: viewport and screen metrics, window size, locale, media, generic fonts. */
async function setUpPage(cdp: Cdp, width: number, height: number) {
	await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
	try {
		const { windowId } = await cdp.send("Browser.getWindowForTarget");
		await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width, height } });
	} catch {
		// headless builds without window management: the metrics override below is what matters
	}
	await cdp.send("Emulation.setDeviceMetricsOverride", { mobile: false, width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, screenOrientation: { angle: 0, type: "landscapePrimary" } });
	await cdp.send("Emulation.setLocaleOverride", { locale: "en-US" });
	if (FONT_FAMILIES[platform()]) await cdp.send("Page.setFontFamilies", FONT_FAMILIES[platform()]);
	await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }, { name: "forced-colors", value: "none" }, { name: "prefers-contrast", value: "no-preference" }] });
}

// ---------------------------------------------------------------------------------------------------
// Static server for one project (replaces Vite) and the Node-side loader hook (replaces tsx)
// ---------------------------------------------------------------------------------------------------

const MIME: Record<string, string> = { ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4" };
const JS = "text/javascript; charset=utf-8";

const RENDER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Render</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
#player-host { width: 100vw; height: 100vh; }
</style>
<script type="importmap">{"imports":{"videowright":"/__vw/vw.ts"}}</script>
</head>
<body>
<div id="player-host"></div>
<script type="module">import { boot } from "/__vw/vw.ts"; boot();</script>
</body>
</html>
`;

/** Resolve a request under `root`, trying TS-style fallbacks. Containment is lexical, so `..` cannot climb out but a symlink the owner put in the project is followed. */
function resolveUnder(root: string, rel: string): string | null {
	const base = resolve(root, rel);
	for (const c of [base, ...(base.endsWith(".js") ? [`${base.slice(0, -3)}.ts`] : []), `${base}.ts`, join(base, "index.ts")]) {
		if (c !== root && !c.startsWith(root + sep)) continue;
		try {
			if (statSync(c).isFile()) return c;
		} catch {
			// try next
		}
	}
	return null;
}

export async function startServer(projectRoot: string, timelinePath: string, fps: number) {
	const url = (abs: string) => `/c/${relative(projectRoot, abs).split(sep).map(encodeURIComponent).join("/")}`;
	const segmentsDir = join(projectRoot, "segments");
	const ids = existsSync(segmentsDir) ? readdirSync(segmentsDir).filter((n) => existsSync(join(segmentsDir, n, "index.ts"))).sort() : [];
	const virtual = [
		`export const fps = ${fps};`,
		`export const timelineUrl = ${JSON.stringify(url(timelinePath))};`,
		`export const configUrl = ${JSON.stringify(url(join(projectRoot, "videowright.config.ts")))};`,
		`export const segmentLoaders = {\n${ids.map((id) => `  ${JSON.stringify(id)}: () => import(${JSON.stringify(url(join(segmentsDir, id, "index.ts")))})`).join(",\n")}\n};`,
	].join("\n");
	// Chrome gets only the browser-safe half of this file, as the module "videowright".
	const browserSource = stripTypeScriptTypes(readFileSync(SELF, "utf-8").split("// @@NODE_ONLY@@")[0], { mode: "strip" });

	const server = createServer((req, res) => {
		const send = (status: number, type: string, body: string | Buffer) => (res.writeHead(status, { "content-type": type, "cache-control": "no-store" }), res.end(body));
		try {
			if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host ?? "")) return send(403, "text/plain", "forbidden host");
			const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
			if (path === "/render.html") return send(200, "text/html; charset=utf-8", RENDER_HTML);
			if (path === "/__vw/vw.ts") return send(200, JS, browserSource);
			if (path === "/__vw/virtual.js") return send(200, JS, virtual);
			const file = path.startsWith("/c/") ? resolveUnder(projectRoot, path.slice(3)) : null;
			if (!file) return send(404, "text/plain", `not found: ${path}`);
			const ext = extname(file).toLowerCase();
			const data = readFileSync(file);
			if (ext === ".ts") send(200, JS, stripTypeScriptTypes(data.toString("utf-8"), { mode: "strip" }));
			else if (ext === ".js" || ext === ".mjs") send(200, JS, data);
			else if (ext === ".css") send(200, JS, `const css = ${JSON.stringify(data.toString("utf-8"))};\nconst el = document.createElement("style");\nel.textContent = css;\ndocument.head.appendChild(el);\nexport default css;\n`);
			else if (MIME[ext]) send(200, MIME[ext], data);
			else send(404, "text/plain", `unsupported file type: ${ext}`);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error(`[serve] ${req.url}: ${message}`); // the browser only sees "failed to fetch module"; say why here
			send(500, "text/plain", message);
		}
	});
	await new Promise<void>((resolve, reject) => (server.once("error", reject), server.listen(0, "127.0.0.1", () => resolve())));
	return { url: `http://127.0.0.1:${(server.address() as any).port}`, close: () => new Promise<void>((resolve) => (server.closeAllConnections?.(), server.close(() => resolve()))) };
}

/**
 * Import a project's TypeScript in Node (its config, timeline and audio track). Node strips the types; this resolve
 * hook adds `import "videowright"` (this file), extensionless and `.js`-for-`.ts` imports, and no-op CSS/asset imports.
 */
const HOOKS = `
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
let self;
export function initialize(data) { self = data.self; }
const ASSET = /\\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|avif|ico|woff2?|eot|ttf|otf|mp3|wav|mp4)(\\?.*)?$/i;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'videowright') return { url: self, shortCircuit: true };
  if (ASSET.test(specifier)) return { url: 'asset-noop:' + specifier, shortCircuit: true };
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL) {
      const p = fileURLToPath(new URL(specifier, context.parentURL));
      for (const c of [...(p.endsWith('.js') ? [p.slice(0, -3) + '.ts'] : []), p + '.ts', p + '/index.ts']) if (existsSync(c)) return nextResolve(pathToFileURL(c).href, context);
    }
    throw err;
  }
}
export async function load(url, context, nextLoad) {
  if (url.startsWith('asset-noop:')) return { format: 'module', source: 'export default {};', shortCircuit: true };
  return nextLoad(url, context);
}
`;
let hooked = false;
export async function loadModule(path: string): Promise<any> {
	if (!hooked) {
		register(`data:text/javascript,${encodeURIComponent(HOOKS)}`, { parentURL: import.meta.url, data: { self: import.meta.url } });
		hooked = true;
	}
	return import(pathToFileURL(path).href);
}

// ---------------------------------------------------------------------------------------------------
// The render: serve the project, step Chrome's virtual clock one frame at a time, pipe PNGs to ffmpeg
// ---------------------------------------------------------------------------------------------------

export interface RenderOptions {
	timeline: string;
	output?: string;
	fps?: number;
	chrome?: string;
	noSandbox?: boolean;
	dryRun?: boolean;
	verbose?: boolean;
}

export async function runRender(opts: RenderOptions) {
	const log = (msg: string) => opts.verbose && console.log(msg);
	const timelinePath = resolve(opts.timeline);
	if (!existsSync(timelinePath)) throw new UserError(`Timeline not found: ${timelinePath}`);

	// The project root is the nearest folder at or above the timeline that holds videowright.config.ts.
	let root = dirname(timelinePath);
	while (!existsSync(join(root, "videowright.config.ts"))) {
		if (dirname(root) === root) throw new UserError(`No videowright.config.ts found at or above ${dirname(timelinePath)}`, "Create one: export default defineConfig({ projectStructure: 'v1' }), importing defineConfig from 'videowright'.");
		root = dirname(root);
	}

	const ffmpeg = opts.dryRun ? "" : findFfmpeg();
	const chrome = findChrome(opts.chrome);
	log(`chrome: ${chrome}`);

	// Node reads only settings and audio from the project; the segments themselves load in the browser.
	const config = (await loadModule(join(root, "videowright.config.ts"))).default;
	const timeline = (await loadModule(timelinePath)).default;
	if (!config || !timeline) throw new UserError("videowright.config.ts and timeline.ts must each have a default export");
	const meta = applyMetaDefaults(timeline, config).meta;
	const [width, height] = meta.resolution;
	const fps = opts.fps ?? meta.fps;

	const track = timeline.default_audio_track;
	const audioFile = track ? resolve(dirname(timelinePath), track.audio_file) : undefined;
	if (audioFile && !existsSync(audioFile)) throw new UserError(`Audio file not found: ${audioFile}`, "Check audio_file in default_audio_track.");
	log(`timeline: ${timelinePath} (${timeline.segments.length} segments), ${width}x${height} @ ${fps}fps`);

	const server = await startServer(root, timelinePath, fps);
	let browser: Awaited<ReturnType<typeof launchChrome>> | undefined;
	let encoder: ChildProcess | undefined;
	const cleanup = async () => {
		encoder?.kill();
		browser?.close();
		await server.close();
	};
	const onSignal = () => cleanup().finally(() => process.exit(1));
	process.on("SIGINT", onSignal);
	process.on("SIGTERM", onSignal);

	try {
		browser = await launchChrome(chrome, !!opts.noSandbox);
		log(`browser: ${browser.version}`);
		const cdp = browser.cdp;
		const pageErrors: string[] = [];
		await cdp.send("Page.enable");
		await cdp.send("Runtime.enable");
		cdp.on("Runtime.exceptionThrown", (p) => {
			const d = p.exceptionDetails;
			pageErrors.push(d?.exception?.description ?? d?.text ?? "unknown page error");
			if (opts.verbose) console.error(`[page error] ${pageErrors.at(-1)}`);
		});
		cdp.on("Runtime.consoleAPICalled", (p) => {
			if (p.type === "error") console.error(`[page console.error] ${(p.args ?? []).map((a: any) => a.value ?? a.description ?? "").join(" ")}`);
		});
		await setUpPage(cdp, width, height);
		await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: TIME_SHIM }); // must run before any page script
		await cdp.send("Page.navigate", { url: `${server.url}/render.html` });

		await cdp.waitFor("window.__VW_RENDER_READY__ === true", 30000);
		const bootError = await cdp.evaluate<string | null>("window.__VW_RENDER_ERROR__");
		if (bootError) throw new UserError(`Render boot failed: ${bootError}`);

		const own = await cdp.evaluate<Record<string, number[]>>("window.__VW_SEGMENT_ADVANCES__");
		const problems = validateSegmentAdvances(timeline, own ?? {});
		if (problems.length) throw new UserError(`Advances validation failed:\n${problems.join("\n")}`, "Every segment must declare a valid 'advances' array.");
		const advances = resolveTiming(timeline.segments.map((s: any) => ({ id: s.id, advances: own[s.id] })), track);
		const schedule = buildFrameSchedule(timeline, advances, fps);
		let total = 0;
		for (const s of timeline.segments) total += Math.round(advances[s.id].at(-1)! * fps);
		console.log(`total frames: ${total} (${(total / fps).toFixed(1)}s) at ${width}x${height} ${fps}fps`);
		if (opts.dryRun) return { frames: total, duration: total / fps };

		const output = resolve(opts.output ?? "output.mp4");
		const ff = spawn(ffmpeg, buildFfmpegArgs(fps, output, audioFile), { stdio: ["pipe", "pipe", "pipe"] });
		encoder = ff;
		let ffErr = "";
		ff.stderr.on("data", (d) => (ffErr += d));
		const ffDone = new Promise<number>((resolve, reject) => (ff.on("close", (c) => resolve(c ?? 1)), ff.on("error", reject)));
		const stdinErrors: Error[] = [];
		ff.stdin.on("error", (e) => stdinErrors.push(e));

		let frame = 0;
		let next = 0;
		let lastReport = 0;
		try {
			while (frame < total) {
				if (stdinErrors.length) throw new UserError(`ffmpeg stdin error: ${stdinErrors[0].message}`);
				if (pageErrors.length) throw new UserError(`Page error during rendering: ${pageErrors.at(-1)}`, "Check segment play() or mount() for runtime errors.");

				while (next < schedule.length && schedule[next].globalFrame <= frame) {
					const beat = schedule[next++];
					const more = await cdp.evaluate<boolean>(`window.__VW_RENDER_ADVANCE__(${beat.isLast})`);
					const err = await cdp.evaluate<string | null>("window.__VW_RENDER_ERROR__");
					if (err) throw new UserError(`Render error: ${err}`);
					const current = await cdp.evaluate<string>("document.body.dataset.vwSegment");
					if (!beat.isLast && current !== beat.segmentId) {
						throw new UserError(`Segment "${beat.segmentId}" transitioned at advance index ${beat.advanceIndex} but advances array has more entries. Remove unused entries from the advances array.`);
					}
					if (beat.isLast && !more && next < schedule.length) console.warn(`Warning: renderAdvance returned false at segment "${beat.segmentId}" advance ${beat.advanceIndex}`);
				}

				// One frame of virtual time: fires due timers and animation-frame callbacks, steps Web Animations.
				await cdp.evaluate(`window.__VW_ADVANCE_CLOCK__(${1000 / fps})`);
				if (!ff.stdin.writable) break;
				await write(ff.stdin, await cdp.screenshot());
				frame++;
				if (frame - lastReport >= Math.round(10 * fps)) {
					console.log(`Rendered ${(frame / fps).toFixed(1)}s / ${(total / fps).toFixed(1)}s`);
					lastReport = frame;
				}
			}
		} finally {
			ff.stdin.end();
		}

		for (const w of new Set((await cdp.evaluate<string[] | undefined>("window.__VW_WARNINGS__")) ?? [])) console.warn(`Warning: ${w}`);
		if ((await ffDone) !== 0) {
			if (opts.verbose) console.error(`ffmpeg stderr:\n${ffErr}`);
			throw new UserError("ffmpeg failed", "Run with --verbose to see ffmpeg's output.");
		}
		return { outputPath: output, frames: frame, duration: frame / fps };
	} finally {
		process.removeListener("SIGINT", onSignal);
		process.removeListener("SIGTERM", onSignal);
		await cleanup();
	}
}

// ---------------------------------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------------------------------

const USAGE = "Usage: node vw.ts render <timeline.ts> [--output out.mp4] [--fps N] [--chrome PATH] [--no-sandbox] [--dry-run] [--verbose]";

function parseArgs(argv: string[]): RenderOptions {
	const [command, ...rest] = argv;
	if (command !== "render") throw new UserError(`Unknown command "${command ?? ""}"`, USAGE);
	const opts: RenderOptions = { timeline: "" };
	const positional: string[] = [];
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		const value = () => rest[++i] ?? (() => { throw new UserError(`${arg} needs a value`, USAGE); })();
		if (!arg.startsWith("-")) positional.push(arg);
		else if (arg === "--output" || arg === "-o") opts.output = value();
		else if (arg === "--fps") opts.fps = Number(value());
		else if (arg === "--chrome") opts.chrome = value();
		else if (arg === "--no-sandbox") opts.noSandbox = true;
		else if (arg === "--dry-run") opts.dryRun = true;
		else if (arg === "--verbose") opts.verbose = true;
		else throw new UserError(`Unknown option ${arg}`, USAGE);
	}
	if (positional.length !== 1) throw new UserError("Pass exactly one timeline path", USAGE);
	if (opts.fps !== undefined && !(opts.fps > 0)) throw new UserError("--fps must be a positive number");
	opts.timeline = positional[0];
	return opts;
}

if (import.meta.main) {
	// stripTypeScriptTypes prints an ExperimentalWarning on every run; keep any other warning.
	process.removeAllListeners("warning");
	process.on("warning", (w) => w.name !== "ExperimentalWarning" && console.error(`${w.name}: ${w.message}`));
	// Not awaited at top level: the project's config imports "videowright", which is this module, and a module
	// that is still evaluating (waiting on that import) would never finish.
	Promise.resolve()
		.then(() => runRender(parseArgs(process.argv.slice(2))))
		.then((r) => "outputPath" in r && console.log(`Rendered ${r.frames} frames (${r.duration.toFixed(1)}s) to ${r.outputPath}`))
		.catch((e) => {
			if (e instanceof UserError) console.error(`Error: ${e.message}${e.hint ? `\nHint: ${e.hint}` : ""}`);
			else console.error(`Error: ${e instanceof Error ? (e.stack ?? e.message) : e}`);
			process.exit(1);
		});
}

// ---------------------------------------------------------------------------------------------------
// Virtual-time shim, injected into the page before any script. Upstream's, verbatim (MIT, see header).
// Overrides Date, performance.now, setTimeout/setInterval, requestAnimationFrame and Element.animate so the
// driver can step time frame by frame. Boot runs on real timers ("passthrough"); __VW_ENGAGE_VIRTUAL_TIME__
// switches to driver-controlled time; __VW_ADVANCE_CLOCK__(ms) then advances it.
// ---------------------------------------------------------------------------------------------------

const TIME_SHIM = `
(function() {
  // Preserve real implementations
  var RealDate = Date;
  var realDateNow = Date.now.bind(Date);
  var realPerfNow = performance.now.bind(performance);
  var realSetTimeout = window.setTimeout.bind(window);
  var realClearTimeout = window.clearTimeout.bind(window);
  var realSetInterval = window.setInterval.bind(window);
  var realClearInterval = window.clearInterval.bind(window);
  var realRAF = window.requestAnimationFrame.bind(window);
  var realCAF = window.cancelAnimationFrame.bind(window);
  var realElementAnimate = Element.prototype.animate;

  // ----- Mode state -----
  // 'passthrough' = boot phase, real timers run normally
  // 'driver'      = render capture, driver controls time
  var mode = 'passthrough';

  // ----- Passthrough bookkeeping -----
  // Wall-clock reference captured at shim install time
  var shimInstallPerf = realPerfNow();
  var shimInstallDate = realDateNow();
  // Track real timer/RAF IDs with metadata so we can convert them at mode switch
  var realTimerMeta = new Map();      // real setTimeout ID -> { cb, args, fireAtRealMs }
  var realIntervalMeta = new Map();   // real setInterval ID -> { cb, args, intervalMs, nextFireRealMs }
  var realRafMeta = new Map();        // real RAF ID -> { cb }

  // ----- Driver-mode state -----
  var virtualMs = 0;
  var nextTimerId = 1;
  var timers = new Map();     // id -> { fireAt, cb, args, repeat? }
  var rafCallbacks = [];      // [{ id, cb }]
  var trackedAnimations = []; // [{ animation, startVirtualMs }]

  // ----- performance.now -----
  performance.now = function() {
    if (mode === 'passthrough') {
      return realPerfNow() - shimInstallPerf;
    }
    return virtualMs;
  };

  // ----- Date -----
  function VirtualDate() {
    if (arguments.length === 0) {
      if (mode === 'passthrough') {
        return new RealDate(realDateNow());
      }
      return new RealDate(shimInstallDate + virtualMs);
    }
    switch (arguments.length) {
      case 1: return new RealDate(arguments[0]);
      case 2: return new RealDate(arguments[0], arguments[1]);
      case 3: return new RealDate(arguments[0], arguments[1], arguments[2]);
      case 4: return new RealDate(arguments[0], arguments[1], arguments[2], arguments[3]);
      case 5: return new RealDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);
      case 6: return new RealDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5]);
      default: return new RealDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6]);
    }
  }
  VirtualDate.now = function() {
    if (mode === 'passthrough') {
      return realDateNow();
    }
    return Math.floor(shimInstallDate + virtualMs);
  };
  VirtualDate.parse = RealDate.parse;
  VirtualDate.UTC = RealDate.UTC;
  VirtualDate.prototype = RealDate.prototype;
  window.Date = VirtualDate;

  // ----- setTimeout / clearTimeout -----
  window.setTimeout = function(cb, ms) {
    if (typeof cb !== 'function') return 0;
    var delay = (ms || 0);
    var args = Array.prototype.slice.call(arguments, 2);
    if (mode === 'passthrough') {
      var fireAtRealMs = realPerfNow() + delay;
      // Wrap the callback so that if the real timer fires before engagement,
      // its metadata is removed -- preventing a double-fire at engagement.
      var realId = realSetTimeout(function() { realTimerMeta.delete(realId); cb.apply(null, args); }, delay);
      realTimerMeta.set(realId, { cb: cb, args: args, fireAtRealMs: fireAtRealMs });
      return realId;
    }
    var id = nextTimerId++;
    timers.set(id, { fireAt: virtualMs + delay, cb: cb, args: args });
    return id;
  };
  window.clearTimeout = function(id) {
    if (mode === 'passthrough') {
      realTimerMeta.delete(id);
      realClearTimeout(id);
      return;
    }
    timers.delete(id);
  };

  // ----- setInterval / clearInterval -----
  window.setInterval = function(cb, ms) {
    if (typeof cb !== 'function') return 0;
    if (mode === 'passthrough') {
      var intervalMs = Math.max(ms || 0, 1);
      var args = Array.prototype.slice.call(arguments, 2);
      var meta = { cb: cb, args: args, intervalMs: intervalMs, nextFireRealMs: realPerfNow() + intervalMs };
      // Wrap the callback to update nextFireRealMs each time the real interval
      // fires, so that at engagement we compute an accurate remaining time
      // instead of using the stale initial registration time.
      var realId = realSetInterval(function() { meta.nextFireRealMs = realPerfNow() + intervalMs; cb.apply(null, args); }, intervalMs);
      realIntervalMeta.set(realId, meta);
      return realId;
    }
    var interval = Math.max(ms || 0, 1);
    var id = nextTimerId++;
    var args = Array.prototype.slice.call(arguments, 2);
    timers.set(id, { fireAt: virtualMs + interval, cb: cb, args: args, repeat: interval });
    return id;
  };
  window.clearInterval = function(id) {
    if (mode === 'passthrough') {
      realIntervalMeta.delete(id);
      realClearInterval(id);
      return;
    }
    timers.delete(id);
  };

  // ----- requestAnimationFrame / cancelAnimationFrame -----
  window.requestAnimationFrame = function(cb) {
    if (mode === 'passthrough') {
      // Wrap the callback so that if the real rAF fires before engagement,
      // its metadata is removed -- preventing a double-fire at engagement.
      var realId = realRAF(function(timestamp) { realRafMeta.delete(realId); cb(timestamp); });
      realRafMeta.set(realId, { cb: cb });
      return realId;
    }
    var id = nextTimerId++;
    rafCallbacks.push({ id: id, cb: cb });
    return id;
  };
  window.cancelAnimationFrame = function(id) {
    if (mode === 'passthrough') {
      realRafMeta.delete(id);
      realCAF(id);
      return;
    }
    for (var i = 0; i < rafCallbacks.length; i++) {
      if (rafCallbacks[i].id === id) {
        rafCallbacks.splice(i, 1);
        break;
      }
    }
  };

  // ----- WAAPI: Element.prototype.animate -----
  Element.prototype.animate = function(keyframes, options) {
    var anim = realElementAnimate.call(this, keyframes, options);
    if (mode === 'passthrough') {
      // Let the animation run normally during boot; it will be captured
      // at mode-switch time if still running.
      return anim;
    }
    // Driver mode: pause and drive via currentTime
    return trackAnimation(anim, options);
  };

  function trackAnimation(anim, options) {
    anim.pause();
    anim.currentTime = 0;
    var entry = { animation: anim, startVirtualMs: virtualMs };
    trackedAnimations.push(entry);
    var duration = 0;
    if (typeof options === 'number') {
      duration = options;
    } else if (options && typeof options.duration === 'number') {
      duration = options.duration;
    }
    var delay = 0;
    if (options && typeof options === 'object' && typeof options.delay === 'number') {
      delay = options.delay;
    }
    var totalDuration = delay + duration;
    entry.totalDuration = totalDuration;
    entry.resolved = false;
    var finishedPromise = new Promise(function(resolve) {
      entry.resolve = resolve;
    });
    Object.defineProperty(anim, 'finished', {
      get: function() { return finishedPromise; },
      configurable: true
    });
    return anim;
  }

  // ----- Mode switch: passthrough -> driver -----
  window.__VW_ENGAGE_VIRTUAL_TIME__ = function() {
    if (mode === 'driver') return; // already engaged

    // Set virtual time to current real elapsed so animations don't jump
    var nowReal = realPerfNow();
    virtualMs = nowReal - shimInstallPerf;

    // Convert pending real setTimeouts to virtual timers instead of discarding
    realTimerMeta.forEach(function(meta, realId) {
      realClearTimeout(realId);
      var remaining = Math.max(0, meta.fireAtRealMs - nowReal);
      var id = nextTimerId++;
      timers.set(id, { fireAt: virtualMs + remaining, cb: meta.cb, args: meta.args });
    });
    realTimerMeta.clear();

    // Convert pending real setIntervals to virtual intervals
    realIntervalMeta.forEach(function(meta, realId) {
      realClearInterval(realId);
      var remaining = Math.max(0, meta.nextFireRealMs - nowReal);
      var id = nextTimerId++;
      timers.set(id, { fireAt: virtualMs + remaining, cb: meta.cb, args: meta.args, repeat: meta.intervalMs });
    });
    realIntervalMeta.clear();

    // Convert pending real rAF callbacks into virtual RAF queue
    realRafMeta.forEach(function(meta, realId) {
      realCAF(realId);
      var id = nextTimerId++;
      rafCallbacks.push({ id: id, cb: meta.cb });
    });
    realRafMeta.clear();

    // Capture any WAAPI animations still running from boot and pause+track them
    try {
      var liveAnims = document.getAnimations();
      for (var i = 0; i < liveAnims.length; i++) {
        var a = liveAnims[i];
        if (a.playState === 'running' || a.playState === 'paused') {
          var ct = a.currentTime || 0;
          a.pause();
          a.currentTime = ct;
          var entry = {
            animation: a,
            startVirtualMs: virtualMs - ct,
            totalDuration: undefined,
            resolved: false,
            resolve: undefined
          };
          // Try to read duration from the animation effect
          try {
            var timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
            if (timing) {
              var dur = typeof timing.duration === 'number' ? timing.duration : 0;
              var del = typeof timing.delay === 'number' ? timing.delay : 0;
              entry.totalDuration = del + dur;
            }
          } catch(e) {}
          var finishedPromise = new Promise(function(resolve) {
            entry.resolve = resolve;
          });
          Object.defineProperty(a, 'finished', {
            get: function() { return finishedPromise; },
            configurable: true
          });
          trackedAnimations.push(entry);
        }
      }
    } catch(e) {
      // document.getAnimations may not be available in all contexts
    }

    mode = 'driver';
  };

  // ----- Clock advance driver -----
  window.__VW_ADVANCE_CLOCK__ = async function(deltaMs) {
    if (mode === 'passthrough') return; // no-op during boot

    var target = virtualMs + deltaMs;

    // Fire timers in chronological order up to target.
    // The function is async so that microtasks (e.g. Promise resolutions from
    // ctx.hold) drain between timer fires. This ensures awaiting code resumes
    // at virtualMs = fireAt (the timer's actual scheduled time) rather than at
    // the frame boundary (target), eliminating per-hold rounding drift.
    var safety = 10000;
    while (safety-- > 0) {
      var earliestId = null;
      var earliestTimer = null;
      timers.forEach(function(t, id) {
        if (t.fireAt <= target && (earliestTimer === null || t.fireAt < earliestTimer.fireAt)) {
          earliestId = id;
          earliestTimer = t;
        }
      });
      if (!earliestTimer) break;

      virtualMs = earliestTimer.fireAt;
      if (earliestTimer.repeat !== undefined) {
        timers.set(earliestId, {
          fireAt: virtualMs + earliestTimer.repeat,
          cb: earliestTimer.cb,
          args: earliestTimer.args,
          repeat: earliestTimer.repeat
        });
      } else {
        timers.delete(earliestId);
      }
      try { earliestTimer.cb.apply(null, earliestTimer.args || []); } catch(e) { console.error('[VW shim] timer error:', e); }

      // Drain microtasks so awaiting code (e.g. ctx.hold Promise resolution)
      // resumes at virtualMs = fireAt and registers its next timer relative to
      // fireAt, not target. Multiple awaits handle chained async continuations.
      for (var d = 0; d < 8; d++) await Promise.resolve();
    }

    // Final advance to target
    virtualMs = target;

    // Fire all queued RAF callbacks
    var queued = rafCallbacks.splice(0);
    for (var i = 0; i < queued.length; i++) {
      try { queued[i].cb(virtualMs); } catch(e) { console.error('[VW shim] RAF error:', e); }
    }

    // Update WAAPI animations
    for (var j = trackedAnimations.length - 1; j >= 0; j--) {
      var entry = trackedAnimations[j];
      var anim = entry.animation;
      // Skip cancelled animations
      if (anim.playState === 'idle') {
        trackedAnimations.splice(j, 1);
        continue;
      }
      var elapsed = virtualMs - entry.startVirtualMs;
      try {
        anim.currentTime = elapsed;
      } catch(e) {
        trackedAnimations.splice(j, 1);
        continue;
      }
      // Check if animation is complete
      if (entry.totalDuration !== undefined && elapsed >= entry.totalDuration && !entry.resolved) {
        entry.resolved = true;
        if (entry.resolve) entry.resolve(anim);
        trackedAnimations.splice(j, 1);
      }
    }
  };
})();
`;
