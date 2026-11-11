import { defineSegment } from "videowright";
import { foxMark } from "../../styles/metamask/fox";
import { wordmark } from "../../styles/metamask/wordmark";

export default defineSegment({
	id: "bad-bounds",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = `<div class="vw-stage">
			<div class="vw-lockup">${foxMark(48)}${wordmark(44)}</div>
			<div class="vw-safe">
				<div data-wide class="vw-pill" style="font-size:40px">packages/assets-controllers/src/TokenBalancesController/TokenBalancesController.ts</div>
				<div data-clip class="vw-card" style="height:120px"><div class="vw-card-title">Clipped</div><div class="vw-body">This card is too short for its text, so the second and third lines are cut off by overflow hidden and nobody can read them.</div></div>
			</div>
			<img data-img src="/c/image.svg" style="position:absolute;left:1500px;top:600px;width:600px;height:340px">
			<div data-cap class="vw-captions" style="opacity:1">The path runs off the edge of the frame.</div>
		</div>`;
	},
	async play() {},
});
