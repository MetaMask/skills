import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

export default defineSegment({
	id: "notes-tight",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = stage(
			`<h2 class="text-display-md text-default">Two cards, too close</h2>
			<div class="grid grid-cols-2 gap-2">
				<div class="flex flex-col gap-4 rounded-md border border-muted bg-section p-8"><div class="text-heading-sm text-default">Before</div><p class="text-body-md text-alternative">The badge sat on the avatar.</p></div>
				<div class="flex flex-col gap-4 rounded-md border border-muted bg-section p-1"><div class="text-heading-sm text-default">After</div><p class="text-body-md text-alternative">Both icons are visible.</p></div>
			</div>`,
			lockup(),
		);
	},
	async play() {},
});
