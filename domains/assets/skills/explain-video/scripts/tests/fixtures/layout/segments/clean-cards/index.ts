import { defineSegment } from "videowright";
import { card, grid, pill, scheduleCaptions, clearTimers, stage } from "../../kit/kit";
import { lockup } from "../lockup";

let host: HTMLElement | null = null;
let timers: number[] = [];

export default defineSegment({
	id: "clean-cards",
	advances: [1.2, 2.4],
	mount(el: HTMLElement) {
		host = el;
		el.innerHTML = stage(
			`${pill("PR WALKTHROUGH", { accent: true })}
			<div class="vw-title">Badge no longer covers the token icon</div>
			${grid(3,
				card("Before", "The badge sat on the avatar and hid the token.", { attr: "data-c1" }),
				card("Change", `Anchor the badge to the lower-right corner.<span class="vw-pill vw-pill-accent" data-vw-allow-overlap style="position:absolute;right:-12px;top:-12px">NEW</span>`, { attr: 'data-c2 style="position:relative;overflow:visible"', focus: true }),
				card("After", "Both icons are visible at every size.", { attr: "data-c3", level: 2 }),
			)}
			<div class="vw-subtitle">Mobile · token list · <span class="vw-accent">one file</span></div>`,
			lockup(),
		);
	},
	async play(ctx: any) {
		const el = host!;
		timers = scheduleCaptions(el, [{ start: 0.1, end: 2.3, text: "Each card sits in the safe area, clear of the lockup and captions." }]);
		for (const k of ["c1", "c2", "c3"]) el.querySelector(`[data-${k}]`)!.animate([{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 400, fill: "both", easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
		await ctx.waitForNext();
	},
	unmount() {
		clearTimers(timers);
	},
});
