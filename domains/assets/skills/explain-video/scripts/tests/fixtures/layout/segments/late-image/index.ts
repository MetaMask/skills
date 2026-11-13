import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

let host: HTMLElement | null = null;

export default defineSegment({
	id: "late-image",
	advances: [1],
	mount(el: HTMLElement) {
		host = el;
		el.innerHTML = stage(
			`<div class="pt-1 text-display-md text-default">Screenshot, then caption</div>
			<div class="flex min-h-0 flex-1 flex-row gap-8">
				<div class="vw-frame h-full min-h-0 flex-1"><img data-late alt="Token row after the fix"></div>
				<div class="flex flex-col gap-4 rounded-md border border-muted bg-section p-8"><div class="text-heading-sm text-default">Caption</div><div class="text-body-xs text-alternative" data-reveal>Revealed once the screenshot has decoded.</div></div>
			</div>`,
			lockup(),
		);
	},
	async play(ctx: any) {
		const el = host!;
		const img = el.querySelector<HTMLImageElement>("[data-late]")!;
		await ctx.hold(950);
		img.src = "/c/image.svg?late";
		await img.decode();
		el.querySelector("[data-reveal]")!.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 500, fill: "both", easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
	},
	unmount() {
		host = null;
	},
});
