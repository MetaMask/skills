import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "tw-title",
	advances: [1.2, 2.4],
	mount(el: HTMLElement) {
		host = el;
		el.innerHTML = stage(
			`<div class="flex flex-col gap-6">
				<span class="self-start rounded-full bg-accent01-normal px-5 py-2 text-body-sm-medium text-primary-inverse">PR WALKTHROUGH</span>
				<h1 class="text-display-md text-default">Badge no longer covers the token icon</h1>
				<p class="text-body-lg text-alternative" data-sub>Mobile · token list · <span class="text-accent01-light">one file</span></p>
			</div>`,
			lockup(),
		);
	},
	async play(ctx: any) {
		host!.querySelector("[data-sub]")!.animate([{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }], { duration: 420, fill: "both", easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
		await ctx.waitForNext();
	},
	unmount() {
		host = null;
	},
});
