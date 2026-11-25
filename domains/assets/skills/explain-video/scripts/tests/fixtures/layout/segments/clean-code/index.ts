import { defineSegment } from "videowright";
import { card, code, row, stack, stage } from "../../kit/kit";
import { lockup } from "../lockup";

export default defineSegment({
	id: "clean-code",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = stage(
			`<div class="vw-title">The fix</div>
			${row(
				code("app/components/Tokens/TokenListItem.tsx", `<span class="vw-muted">  const badge = (</span>\n<span style="color:var(--mm-red)">-   &lt;Badge position="top" /&gt;</span>\n<span style="color:var(--mm-lime)">+   &lt;Badge position="bottomRight" /&gt;</span>\n<span class="vw-muted">  );</span>`),
				stack(card("Why", "The top anchor collided with the avatar."), card("Effect", "The badge clears the icon.", { level: 2 })),
			)}`,
			lockup(),
		);
	},
	async play() {},
});
