import { defineSegment } from "videowright";
import { foxMark } from "../../styles/metamask/fox";
import { wordmark } from "../../styles/metamask/wordmark";

export default defineSegment({
	id: "bad-contrast",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = `<div class="vw-stage">
			<div class="vw-lockup">${foxMark(48)}${wordmark(44)}</div>
			<div class="vw-safe">
				<div class="vw-title" style="color:#000">What changed</div>
				<div class="vw-row">
					<div class="vw-card"><div class="vw-card-title" style="color:#111">Network badge</div><div class="vw-body" style="color:#333">Moved to the lower right.</div></div>
					<div class="vw-card"><div class="vw-card-title">Token icon</div><div class="vw-body" style="color:#66676a;font-size:20px">Now fully visible.</div></div>
				</div>
				<span class="vw-pill" style="background:#fa4b00;color:#fff;font-size:20px">ASSETS-4283</span>
			</div>
			<div data-cap class="vw-captions" style="opacity:1">Black text on a black card cannot be read.</div>
		</div>`;
	},
	async play() {},
});
