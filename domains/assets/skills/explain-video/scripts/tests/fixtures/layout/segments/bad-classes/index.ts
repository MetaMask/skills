import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

export default defineSegment({
	id: "bad-classes",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = stage(
			`<div class="flex flex-col gap-6">
				<h1 class="text-4xl text-default">What changed</h1>
				<p class="text-body-md text-gray-500">Generic palette grey.</p>
				<p class="text-[13px] text-default">Arbitrary size.</p>
				<div class="bg-[#111] p-8 rounded-md"><span class="text-body-md text-white">Arbitrary colour.</span><span class="text-body-md text-error-muted">Fill as text.</span></div>
				<div class="flex gap-13 hover:bg-section"><span class="text-body-md text-alternative">Off scale gap.</span></div>
			</div>`,
			lockup(),
		);
	},
	async play() {},
});
