import "./styles/metamask/style.css";
import "./kit/kit.css";
import "./kit/tailwind.css";

export default {
	meta: { title: "Layout check: notes that do not fail", style: "metamask" },
	segments: [{ id: "notes-tight" }, { id: "notes-sparse", transition: "fade" }, { id: "notes-measure", transition: "fade" }],
};
