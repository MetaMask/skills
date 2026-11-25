import "./styles/metamask-developer/style.css";
import "./kit/kit.css";
import "./kit/tailwind.css";

export default {
	meta: { title: "Layout check: clean (metamask-developer + tailwind)", style: "metamask-developer" },
	segments: [{ id: "tw-title" }, { id: "tw-flow", transition: "fade" }, { id: "tw-code", transition: "fade" }, { id: "tw-stat", transition: "fade" }],
};
