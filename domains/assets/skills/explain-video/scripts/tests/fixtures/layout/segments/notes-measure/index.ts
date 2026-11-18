import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

export default defineSegment({
	id: "notes-measure",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = stage(
			`<h2 class="text-display-md text-default">Why the badge moved</h2>
			<p class="text-body-xs text-alternative">The badge used to anchor to the top edge of the avatar, which meant that on small screens and in compact lists it sat directly on the token icon and hid it, so the anchor now follows the lower-right corner of the rendered avatar size instead, which keeps both the token icon and the network badge visible at every size.</p>`,
			lockup(),
		);
	},
	async play() {},
});
