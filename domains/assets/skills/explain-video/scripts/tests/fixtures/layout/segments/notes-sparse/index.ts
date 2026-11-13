import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

export default defineSegment({
	id: "notes-sparse",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = stage(`<div class="flex flex-col gap-4 self-start"><h2 class="text-heading-md text-default">One small heading</h2><p class="text-body-md text-alternative">And a line.</p></div>`, lockup());
	},
	async play() {},
});
