import { defineSegment } from "videowright";
import { stage } from "../../kit/kit";
import { lockup } from "../lockup";

const line = (text: string, kind: "ctx" | "add" | "del") => {
	const cls = { ctx: "text-alternative", add: "border-l-4 border-success-default bg-success-muted text-default", del: "border-l-4 border-error-default bg-error-muted text-default" }[kind];
	return `<div class="whitespace-pre px-4 ${cls}">${text}</div>`;
};

export default defineSegment({
	id: "tw-code",
	advances: [1],
	mount(el: HTMLElement) {
		el.innerHTML = stage(
			`<h2 class="text-display-md text-default">The fix</h2>
			<div class="grid grid-cols-5 gap-8">
				<div class="col-span-3 flex flex-col gap-3 overflow-hidden rounded-md border border-muted bg-subsection p-7 font-mono text-body-sm">
					<div class="text-body-xs text-primary-alternative">app/components/Tokens/TokenListItem.tsx</div>
					${line("  const badge = (", "ctx")}
					${line("-   &lt;Badge position=\"top\" /&gt;", "del")}
					${line("+   &lt;Badge position=\"bottomRight\" /&gt;", "add")}
					${line("  );", "ctx")}
				</div>
				<div class="col-span-2 flex flex-col gap-6">
					<div class="flex flex-col gap-3 rounded-md bg-section p-7"><div class="text-heading-sm text-default">Why</div><p class="text-body-md text-alternative">The top anchor collided with the avatar.</p></div>
					<div class="flex flex-col gap-3 rounded-md bg-subsection p-7"><div class="text-heading-sm text-default">Effect</div><p class="text-body-md text-alternative">The badge clears the icon.</p></div>
				</div>
			</div>`,
			lockup(),
		);
	},
	async play() {},
});
