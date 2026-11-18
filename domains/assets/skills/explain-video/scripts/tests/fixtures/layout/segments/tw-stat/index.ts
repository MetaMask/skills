import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

export default defineSegment({
	id: "tw-stat",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = stage(
			`<div class="grid grid-cols-2 gap-12">
				<div class="flex flex-col gap-4 rounded-lg border border-muted bg-section p-10">
					<span class="self-start rounded-full bg-error-muted px-4 py-1 text-body-sm-medium text-error-default">Before</span>
					<div class="text-display-xl text-alternative line-through">3 of 5</div>
					<p class="text-body-md text-alternative">icons hidden by the badge</p>
				</div>
				<div class="flex flex-col gap-4 rounded-lg border-2 border-success-default bg-section p-10">
					<span class="self-start rounded-full bg-success-muted px-4 py-1 text-body-sm-medium text-success-default">After</span>
					<div class="text-display-xl text-default">0 of 5</div>
					<p class="text-body-md text-alternative">every icon fully visible</p>
				</div>
			</div>
			<p class="text-body-lg text-alternative">Checked on <span class="text-warning-default">small</span>, <span class="text-primary-default">medium</span> and <span class="text-accent02-light">large</span> avatars.</p>`,
			lockup(),
		);
	},
	async play() {},
});
