import { defineSegment } from "videowright";
import { foxMark } from "../../styles/metamask/fox";
import { wordmark } from "../../styles/metamask/wordmark";

export default defineSegment({
	id: "bad-overlap",
	advances: [1, 2],
	mount(el: HTMLElement) {
		el.innerHTML = `<div class="vw-stage">
			<div class="vw-lockup">${foxMark(48)}${wordmark(44)}</div>
			<h1 data-title style="position:absolute;left:120px;top:90px;font-size:96px;margin:0">Badge overlaps the token icon</h1>
			<div data-a class="vw-card" style="position:absolute;left:200px;top:340px;width:700px;height:300px"><div class="vw-card-title">Before</div><div class="vw-body">Badge sits on top of the avatar.</div></div>
			<div data-b class="vw-card" style="position:absolute;left:760px;top:420px;width:700px;height:300px"><div class="vw-card-title">After</div><div class="vw-body">Badge moves to the corner.</div></div>
			<div data-cap class="vw-captions" style="opacity:1">The network badge used to cover the token icon.</div>
		</div>`;
	},
	async play(ctx: any) {
		await ctx.waitForNext();
	},
});
