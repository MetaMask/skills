(function vwLayoutCheck(segmentId) {
	const lintClasses = (scope, describe, findings, plain) => {
		const known = new Set();
		const walk = (rules) => {
			for (const r of rules) {
				if (r.selectorText) for (const m of r.selectorText.matchAll(/\.((?:\\.|[\w-])+)/g)) known.add(m[1].replace(/\\(.)/g, "$1"));
				if (r.cssRules) walk(r.cssRules);
			}
		};
		for (const sheet of document.styleSheets) {
			try {
				walk(sheet.cssRules);
			} catch {}
		}
		const steps = (prefix) => [...known].filter((k) => k.startsWith(prefix + "-") && /^[\d.]+$/.test(k.slice(prefix.length + 1))).map((k) => +k.slice(prefix.length + 1));
		const nearest = (prefix, n) => {
			const all = steps(prefix);
			if (!all.length) return null;
			const best = all.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
			return `${prefix}-${best}`;
		};
		const SIZE = { xs: "text-body-xs", sm: "text-body-sm", base: "text-body-md", lg: "text-body-lg", xl: "text-heading-sm", "2xl": "text-heading-md", "3xl": "text-heading-lg", "4xl": "text-heading-lg", "5xl": "text-display-md", "6xl": "text-display-lg", "7xl": "text-display-xl", "8xl": "text-display-xl", "9xl": "text-display-xl" };
		const HUE = { red: "error-default", rose: "error-default", pink: "error-default", green: "success-default", lime: "success-default", emerald: "success-default", blue: "primary-default", indigo: "primary-default", sky: "accent04-normal", cyan: "accent04-normal", orange: "accent01-normal", amber: "warning-default", yellow: "warning-default", purple: "accent02-normal", violet: "accent02-normal", fuchsia: "accent02-normal" };
		const GREY = { text: "text-alternative", bg: "bg-section", border: "border-muted", fill: "fill-current", stroke: "stroke-current" };
		const hint = (c) => {
			const v = c.match(/^([a-z0-9-]+:)+(.+)$/);
			if (v) return known.has(v[2]) ? `use ${v[2]} (no variants: one static frame, dark only)` : `no variants (${v[1]}); ${hint(v[2])}`;
			let m;
			if ((m = c.match(/^text-\[.*\]$/))) return "use a type role: text-body-md, text-heading-sm, text-display-md…";
			if ((m = c.match(/^(bg|text|border|fill|stroke)-\[#.*\]$/))) return `use a design-system colour: ${GREY[m[1]]}, ${m[1]}-primary-default…`;
			if ((m = c.match(/^([a-z-]+)-\[.*\]$/))) return `no arbitrary values; use the scale (${m[1]}-8, ${m[1]}-1/2…) or flex-1`;
			if ((m = c.match(/^text-(xs|sm|base|lg|[2-9]?xl)$/))) return `use ${SIZE[m[1]]}`;
			if ((m = c.match(/^(text|bg|border|fill|stroke)-(white|black)$/))) {
				if (m[1] === "text") return m[2] === "white" ? "use text-default" : "dark text fails contrast; use text-default";
				if (m[1] === "bg") return m[2] === "black" ? "use bg-default" : "no white surfaces; use bg-section or bg-subsection";
				return `use ${GREY[m[1]]}`;
			}
			if ((m = c.match(/^(text|bg|border|fill|stroke)-(gray|grey|slate|zinc|neutral|stone)-\d+$/))) return `use ${GREY[m[1]]}`;
			if ((m = c.match(/^(text|bg|border|fill|stroke)-([a-z]+)-\d+$/)) && HUE[m[2]]) return `use ${m[1]}-${HUE[m[2]]}`;
			if (c === "text-muted") return "text-muted fails AA in the dark theme; use text-alternative";
			if ((m = c.match(/^text-(.+)$/)) && known.has(`bg-${m[1]}`)) return `${m[1]} is a fill, not readable as text; use bg-${m[1]} with text-default on it`;
			if ((m = c.match(/^text-text-(.+)$/))) return `use text-${m[1]}`;
			if ((m = c.match(/^bg-background-(.+)$/))) return `use bg-${m[1]}`;
			if ((m = c.match(/^border-border-(.+)$/))) return `use border-${m[1]}`;
			if ((m = c.match(/^text-[sl]-(.+)$/)) && known.has(`text-${m[1]}`)) return `use text-${m[1]} (video-scaled)`;
			if (c === "font-semibold") return "use font-bold (600 in the design system)";
			if (/^font-(thin|extralight|light|normal|extrabold|black)$/.test(c)) return "use font-regular, font-medium or font-bold";
			if ((m = c.match(/^space-([xy])-(.+)$/))) return `use gap-${m[2]} on a flex parent (flex ${m[1] === "x" ? "flex-row" : "flex-col"} gap-${m[2]})`;
			if (/^(leading|tracking)-/.test(c)) return "the type role sets line height and tracking; drop it";
			if (/^(animate|transition|duration|ease|delay)-?/.test(c)) return "animate with WAAPI element.animate() in play(); no CSS animation";
			if (/^(shadow|drop-shadow|blur|backdrop)/.test(c)) return "no shadows or blurs; use a bg-subsection surface or border";
			if ((m = c.match(/^(-?[a-z]+(?:-[a-z]+)?)-(\d+(?:\.\d+)?)$/))) {
				const n = nearest(m[1], +m[2]);
				if (n) return `not on the scale; use ${n}`;
			}
			return "not in kit/tailwind.css or kit.css; for a JS hook use a data- attribute";
		};
		const seen = new Set();
		for (const el of scope.querySelectorAll("*")) {
			for (const c of el.classList || []) {
				if (known.has(c) || seen.has(c)) continue;
				seen.add(c);
				findings.push({ kind: "unknown-class", key: `unknown-class|${c}`, msg: `unknown-class: ${c} -> ${hint(c)} (on ${describe(el)})`, rects: [plain(el.getBoundingClientRect())] });
			}
		}
	};
	const W = window.innerWidth;
	const H = window.innerHeight;
	const rootStyle = getComputedStyle(document.documentElement);
	const px = (name, fallback) => {
		const v = parseFloat(rootStyle.getPropertyValue(name));
		return Number.isFinite(v) ? v : fallback;
	};
	const safe = { left: px("--safe-left", 96), top: px("--safe-top", 152), right: W - px("--safe-right", 96), bottom: H - px("--safe-bottom", 176) };
	const CHROME = "[data-vw-chrome],.vw-lockup,.lockup,[data-fox],[data-wordmark],[data-fox-dev],[data-wordmark-dev],.vw-captions,.cap-pill,.cap,[data-cap]";
	const DECOR = "[data-vw-decor]";
	const ALLOW = "[data-vw-allow-overlap]";
	const TOL = 1.5;

	const hitStyle = document.createElement("style");
	hitStyle.textContent = "*{pointer-events:auto!important}";
	document.head.appendChild(hitStyle);
	const slot = Array.from(document.querySelectorAll(".vw-slot")).find((s) => s.dataset.vwSegment === segmentId && getComputedStyle(s).visibility !== "hidden");
	const scope = slot ? slot.querySelector(".vw-slot-content") || slot : document.body;

	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	const g = canvas.getContext("2d", { willReadFrequently: true });
	const colorCache = new Map();
	const parseColor = (s) => {
		if (!s) return null;
		if (colorCache.has(s)) return colorCache.get(s);
		const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/);
		if (m) {
			const a = m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4];
			const c = { r: +m[1], g: +m[2], b: +m[3], a };
			colorCache.set(s, c);
			return c;
		}
		g.clearRect(0, 0, 1, 1);
		g.fillStyle = "rgba(0,0,0,0)";
		g.fillStyle = s;
		g.fillRect(0, 0, 1, 1);
		const d = g.getImageData(0, 0, 1, 1).data;
		const a = d[3] / 255;
		const c = { r: d[0], g: d[1], b: d[2], a };
		colorCache.set(s, c);
		return c;
	};
	const gradientColor = (img) => {
		if (!img || img === "none") return null;
		if (/url\(/.test(img)) return "unknown";
		const stops = (img.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || []).map(parseColor).filter(Boolean);
		if (!stops.length) return null;
		const n = stops.length;
		const a = stops.reduce((s, c) => s + c.a, 0) / n;
		if (a === 0) return null;
		const avg = (k) => stops.reduce((s, c) => s + c[k] * c.a, 0) / n / a;
		return { r: avg("r"), g: avg("g"), b: avg("b"), a };
	};
	const lum = (c) => {
		const f = (v) => {
			v /= 255;
			return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		};
		return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
	};
	const ratio = (a, b) => {
		const [x, y] = [lum(a), lum(b)].sort((p, q) => p - q);
		return (y + 0.05) / (x + 0.05);
	};
	const over = (top, a, under) => ({ r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) });
	const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

	const opacityCache = new Map();
	const effOpacity = (el) => {
		if (!el || el === document.documentElement) return 1;
		if (opacityCache.has(el)) return opacityCache.get(el);
		const v = parseFloat(getComputedStyle(el).opacity) * effOpacity(el.parentElement);
		opacityCache.set(el, v);
		return v;
	};

	const describe = (el, text) => {
		let s = el.tagName.toLowerCase();
		if (el.id) s += "#" + el.id;
		const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
		if (cls.length) s += "." + cls.join(".");
		else {
			const data = Array.from(el.attributes).find((a) => a.name.startsWith("data-"));
			if (data) s += `[${data.name}]`;
		}
		const t = (text ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
		return t ? `${s} "${t.length > 32 ? t.slice(0, 31) + "…" : t}"` : s;
	};
	const union = (rects) => {
		const u = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
		for (const r of rects) {
			u.left = Math.min(u.left, r.left);
			u.top = Math.min(u.top, r.top);
			u.right = Math.max(u.right, r.right);
			u.bottom = Math.max(u.bottom, r.bottom);
		}
		return u;
	};
	const inter = (a, b) => ({ w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });
	const plain = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top });
	const r0 = (n) => Math.round(n);

	const findings = [];
	const add = (kind, el, msg, text, rects) => findings.push({ kind, key: `${kind}|${describe(el, text)}`, msg: `${kind}: ${describe(el, text)} ${msg}`, rects: rects || [plain(el.getBoundingClientRect())] });

	const leaves = [];
	const boxes = [];
	const chrome = [];
	const SHAPES = "path,rect,circle,ellipse,line,polyline,polygon,text,image,use";

	for (const el of scope.querySelectorAll("*")) {
		if (el.closest(DECOR)) continue;
		const inSvg = el.closest("svg");
		if (inSvg && inSvg !== el) continue;
		const cs = getComputedStyle(el);
		if (cs.display === "none" || cs.visibility === "hidden") continue;
		const op = effOpacity(el);
		if (op < 0.05) continue;
		const isChrome = !!el.closest(CHROME);
		const rect = el.getBoundingClientRect();
		if (isChrome) {
			if (el.matches(CHROME) && rect.width > 0 && rect.height > 0) chrome.push({ el, rect: plain(rect) });
		}
		const tag = el.tagName.toLowerCase();
		if (tag === "svg") {
			const shapes = Array.from(el.querySelectorAll(SHAPES)).slice(0, 80).map((s) => s.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0).map(plain);
			const rects = shapes.length ? shapes : rect.width > 0 ? [plain(rect)] : [];
			if (rects.length) leaves.push({ el, kind: "graphic", rects, box: union(rects), chrome: isChrome, op, cs });
			continue;
		}
		if (tag === "img" || tag === "video" || tag === "canvas") {
			if (rect.width > 0 && rect.height > 0) leaves.push({ el, kind: "graphic", rects: [plain(rect)], box: plain(rect), chrome: isChrome, op, cs });
			if (tag === "img" && el.complete && el.naturalWidth === 0) add("broken image", el, `src=${el.getAttribute("src")}`);
			continue;
		}
		const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim());
		if (textNodes.length) {
			const rects = [];
			for (const n of textNodes) {
				const range = document.createRange();
				range.selectNodeContents(n);
				for (const r of range.getClientRects()) if (r.width > 0.5 && r.height > 0.5) rects.push(plain(r));
			}
			if (rects.length) leaves.push({ el, kind: "text", rects, box: union(rects), chrome: isChrome, op, cs, text: textNodes.map((n) => n.textContent).join(" ") });
		}
		if (!isChrome && rect.width >= 24 && rect.height >= 24 && rect.width * rect.height < 0.75 * W * H) {
			const bg = parseColor(cs.backgroundColor);
			const bw = Math.max(...["Top", "Right", "Bottom", "Left"].map((s) => parseFloat(cs[`border${s}Width`]) || 0));
			const bc = parseColor(cs.borderTopColor);
			if ((bg && bg.a * op >= 0.5) || (bw >= 1 && bc && bc.a * op >= 0.3)) boxes.push({ el, kind: "box", rects: [plain(rect)], box: plain(rect), op, cs });
		}
	}

	const reported = new Set();
	const ancestorReported = (el) => {
		for (let p = el.parentElement; p && p !== scope; p = p.parentElement) if (reported.has(p)) return true;
		return false;
	};
	for (const item of [...leaves, ...boxes].filter((i) => !i.chrome).sort((a, b) => (a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1))) {
		const b = item.box;
		if (ancestorReported(item.el)) {
			reported.add(item.el);
			continue;
		}
		if (b.left < -TOL || b.top < -TOL || b.right > W + TOL || b.bottom > H + TOL) {
			add("off canvas", item.el, `box ${r0(b.left)},${r0(b.top)}→${r0(b.right)},${r0(b.bottom)} canvas ${W}x${H}`, item.text, [b]);
			reported.add(item.el);
			continue;
		}
		const out = [];
		if (b.left < safe.left - TOL) out.push(`left ${r0(b.left)} < ${r0(safe.left)}`);
		if (b.top < safe.top - TOL) out.push(`top ${r0(b.top)} < ${r0(safe.top)}`);
		if (b.right > safe.right + TOL) out.push(`right ${r0(b.right)} > ${r0(safe.right)}`);
		if (b.bottom > safe.bottom + TOL) out.push(`bottom ${r0(b.bottom)} > ${r0(safe.bottom)}`);
		if (out.length) {
			add("outside safe area", item.el, out.join(", "), item.text, [b]);
			reported.add(item.el);
		}
	}

	const chromeHit = new Set();
	for (const item of [...leaves, ...boxes].filter((i) => !i.chrome).sort((a, b) => (a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1))) {
		let anc = false;
		for (let p = item.el.parentElement; p && p !== scope; p = p.parentElement) if (chromeHit.has(p)) anc = true;
		if (anc) continue;
		for (const c of chrome) {
			if (c.el.contains(item.el) || item.el.contains(c.el)) continue;
			const hit = item.rects.find((r) => {
				const i = inter(r, c.rect);
				return i.w > 2 && i.h > 2;
			});
			if (hit) chromeHit.add(item.el);
			if (hit) add("covers chrome", item.el, `overlaps ${describe(c.el, "")}`, item.text, [hit, c.rect]);
		}
	}

	const depth = (el) => {
		let d = 0;
		for (let p = el; p && p !== scope; p = p.parentElement) d++;
		return d;
	};
	const cands = [...leaves, ...boxes].filter((i) => !i.chrome && !i.el.closest(ALLOW)).sort((a, b) => depth(a.el) - depth(b.el));
	const pairs = [];
	const covered = (a, b) => pairs.some(([p, q]) => (p.contains(a) && q.contains(b)) || (p.contains(b) && q.contains(a)));
	for (let i = 0; i < cands.length; i++) {
		for (let j = i + 1; j < cands.length; j++) {
			const a = cands[i];
			const b = cands[j];
			if (a.el.contains(b.el) || b.el.contains(a.el) || covered(a.el, b.el)) continue;
			const ab = inter(a.box, b.box);
			if (ab.w <= 2 || ab.h <= 2) continue;
			let best = null;
			let where = null;
			for (const ra of a.rects) {
				for (const rb of b.rects) {
					const x = inter(ra, rb);
					if (x.w <= 4 || x.h <= 2) continue;
					const textish = [a, b].filter((k) => k.kind === "text").map((k) => (k === a ? ra : rb).height);
					if (textish.length && x.h < (textish.length === 2 ? 0.45 : 0.3) * Math.min(...textish)) continue;
					if (!best || x.w * x.h > best.w * best.h) {
						best = x;
						where = [ra, rb];
					}
				}
			}
			if (best) {
				pairs.push([a.el, b.el]);
				findings.push({
					rects: where,
					kind: "overlap",
					key: `overlap|${describe(a.el, a.text)}|${describe(b.el, b.text)}`,
					msg: `overlap: ${describe(a.el, a.text)} × ${describe(b.el, b.text)} by ${r0(best.w)}x${r0(best.h)}px`,
				});
			}
		}
	}

	const clipped = new Set();
	for (const el of scope.querySelectorAll("*")) {
		if (el.closest(DECOR) || el.closest("svg")) continue;
		const cs = getComputedStyle(el);
		if (cs.display === "none" || cs.visibility === "hidden" || effOpacity(el) < 0.05) continue;
		const clipsX = cs.overflowX !== "visible";
		const clipsY = cs.overflowY !== "visible";
		const lineClamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
		if (!clipsX && !clipsY && !lineClamp) continue;
		if (!el.textContent.trim()) continue;
		const er = el.getBoundingClientRect();
		if (er.width * er.height >= 0.75 * W * H) continue;
		const dx = el.scrollWidth - el.clientWidth;
		const dy = el.scrollHeight - el.clientHeight;
		if ((clipsX && dx > 2) || ((clipsY || lineClamp) && dy > 2)) {
			clipped.add(el);
			add("clipped text", el, `content ${el.scrollWidth}x${el.scrollHeight} > box ${el.clientWidth}x${el.clientHeight}`);
		}
	}

	const boxOf = (el) => {
		for (let p = el.parentElement; p && p !== scope; p = p.parentElement) {
			const hit = boxes.find((b) => b.el === p);
			if (hit) return hit;
		}
		return null;
	};
	for (const leaf of leaves) {
		if (leaf.kind !== "text" || leaf.chrome || leaf.el.closest(ALLOW)) continue;
		const host = boxOf(leaf.el);
		if (!host || clipped.has(host.el)) continue;
		const a = leaf.box;
		const h = host.box;
		const spill = Math.max(h.left - a.left, h.top - a.top, a.right - h.right, a.bottom - h.bottom);
		if (spill > 2) add("text spills out of its box", leaf.el, `by ${r0(spill)}px past ${describe(host.el, "")}`, leaf.text, [a, h]);
	}

	let unknownBg = 0;
	for (const leaf of leaves) {
		if (leaf.kind !== "text") continue;
		const cs = leaf.cs;
		const clipText = cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text";
		let fg = clipText ? gradientColor(cs.backgroundImage) : parseColor(cs.color);
		if (!fg || fg === "unknown") continue;
		const r = leaf.rects[0];
		const x = Math.min(W - 1, Math.max(0, (r.left + r.right) / 2));
		const y = Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2));
		const stack = document.elementsFromPoint(x, y);
		let idx = stack.indexOf(leaf.el);
		let layers;
		if (idx >= 0) layers = stack.slice(clipText ? idx + 1 : idx);
		else {
			layers = [];
			for (let p = clipText ? leaf.el.parentElement : leaf.el; p; p = p.parentElement) layers.push(p);
		}
		const below = [];
		let unknown = false;
		for (const el of layers) {
			const lcs = getComputedStyle(el);
			const o = effOpacity(el);
			const grad = gradientColor(lcs.backgroundImage);
			if (grad === "unknown" || /^(img|video|canvas|svg|picture)$/i.test(el.tagName)) {
				unknown = true;
				break;
			}
			const bg = parseColor(lcs.backgroundColor);
			if (grad && grad.a * o > 0.01) below.push({ c: grad, a: grad.a * o });
			if (bg && bg.a * o > 0.01) below.push({ c: bg, a: bg.a * o });
			if (below.length && below[below.length - 1].a >= 0.99) break;
		}
		if (unknown) {
			unknownBg++;
			continue;
		}
		let bg = { r: 0, g: 0, b: 0 };
		for (let k = below.length - 1; k >= 0; k--) bg = over(below[k].c, Math.min(1, below[k].a), bg);
		const fgc = over(fg, Math.min(1, fg.a * leaf.op), bg);
		const size = parseFloat(cs.fontSize);
		const weight = parseInt(cs.fontWeight, 10) || 400;
		const large = size >= 24 || (size >= 18.66 && weight >= 700);
		const need = large ? 3 : 4.5;
		const got = ratio(fgc, bg);
		if (got < need) add("low contrast", leaf.el, `${got.toFixed(2)}:1 < ${need}:1 (${hex(fgc)} on ${hex(bg)}, ${r0(size)}px${large ? " large" : ""})`, leaf.text, [leaf.box]);
	}

	const tw = !!rootStyle.getPropertyValue("--vw-tailwind").trim();
	if (tw) lintClasses(scope, describe, findings, plain);

	const notes = [];
	const note = (key, msg) => notes.push({ key, msg });
	const isCard = (b) => b.box.width >= 160 && b.box.height >= 80;
	const cards = boxes.filter((b) => isCard(b) && !b.el.closest(ALLOW));
	for (let i = 0; i < cards.length; i++) {
		for (let j = i + 1; j < cards.length; j++) {
			const [a, b] = [cards[i], cards[j]];
			if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
			const x = inter(a.box, b.box);
			const sideBySide = x.w <= 0 && x.h > 0.5 * Math.min(a.box.height, b.box.height);
			const stacked = x.h <= 0 && x.w > 0.5 * Math.min(a.box.width, b.box.width);
			if (!sideBySide && !stacked) continue;
			const gap = -(sideBySide ? x.w : x.h);
			if (gap < 16) note(`gap|${describe(a.el, "")}|${describe(b.el, "")}`, `cards nearly touching (${r0(gap)}px gap) -> use ${tw ? "gap-6" : "a 24px gap"} or more (on ${describe(a.el)} × ${describe(b.el)})`);
		}
	}
	const textLeaves = leaves.filter((l) => l.kind === "text" && !l.chrome && !l.el.closest(ALLOW));
	for (const leaf of textLeaves) {
		const host = boxOf(leaf.el);
		if (!host || !isCard(host) || clipped.has(host.el)) continue;
		const a = leaf.box;
		const h = host.box;
		const inset = Math.min(a.left - h.left, a.top - h.top, h.right - a.right, h.bottom - a.bottom);
		if (inset >= -2 && inset < 16) note(`edge|${describe(leaf.el, leaf.text)}`, `text too close to its card's edge (${r0(Math.max(0, inset))}px) -> use ${tw ? "p-6" : "24px of padding"} or more (on ${describe(leaf.el, leaf.text)} in ${describe(host.el, "")})`);
	}
	for (const leaf of textLeaves) {
		if (/mono/i.test(leaf.cs.fontFamily) || /^pre/.test(leaf.cs.whiteSpace)) continue;
		const chars = leaf.text.replace(/\s+/g, " ").trim().length;
		const total = leaf.rects.reduce((s, r) => s + r.width, 0);
		const longest = total ? Math.max(...leaf.rects.map((r) => (chars * r.width) / total)) : 0;
		if (longest > 90) note(`measure|${describe(leaf.el, leaf.text)}`, `lines too long to read (~${r0(longest)} characters) -> keep lines under about 75 characters: ${tw ? "a narrower column (w-2/3, grid-cols-2)" : "a narrower column"} or a larger type role (on ${describe(leaf.el, leaf.text)})`);
	}
	const content = [...leaves, ...boxes].filter((i) => !i.chrome).map((i) => i.box);
	if (content.length) {
		const u = union(content);
		const sw = safe.right - safe.left;
		const sh = safe.bottom - safe.top;
		const w = Math.max(0, Math.min(u.right, safe.right) - Math.max(u.left, safe.left));
		const h = Math.max(0, Math.min(u.bottom, safe.bottom) - Math.max(u.top, safe.top));
		const covered = (w * h) / (sw * sh);
		if (covered < 0.25) note("empty", `large empty area (content covers ${r0(covered * 100)}% of the safe area) -> fill it: a larger type role, ${tw ? "flex-1" : ".vw-fill"} on the main block, or bigger cards`);
		const sides = [
			["left", "right", u.left - safe.left, safe.right - u.right, sw, "width"],
			["top", "bottom", u.top - safe.top, safe.bottom - u.bottom, sh, "height"],
		];
		for (const [lo, hi, before, after, size, dim] of sides) {
			const [near, far, empty] = before < after ? [lo, hi, after] : [hi, lo, before];
			if (empty / size > 0.5 && Math.min(before, after) / size < 0.1) note(`bunched|${dim}`, `content bunched on the ${near} (${r0((100 * empty) / size)}% of the ${dim} empty on the ${far}) -> spread it: ${tw ? "flex-1, grid-cols-2 or justify-center" : ".vw-row, .vw-grid or centre it"}`);
		}
	}

	hitStyle.remove();
	return { segment: segmentId, findings, notes, unknownBg, counted: { text: leaves.filter((l) => l.kind === "text").length, graphics: leaves.filter((l) => l.kind === "graphic").length, boxes: boxes.length } };
})
