/**
 * MetaMask fox, as animatable facets.
 *
 * Artwork: the refreshed fox from MetaMask/metamask-mobile `app/images/fox.svg`
 * (palette #FA4B00 / #FF7A42 / #CC3D00 / #571A00 / #F5F5F5). `fox.svg` next to this
 * file is the untouched original. The MetaMask fox is a ConsenSys trademark: use it as
 * published (do not recolour, reshape, or add effects to the mark itself).
 *
 * Everything here is finite WAAPI, so it is safe under Videowright's frame-by-frame render.
 */

export const FOX_FACETS: { d: string; fill: string; eye: boolean }[] = [
 {
  "d": "M132.831 135.343L102.675 126.295L79.9333 139.994L64.0667 139.987L41.3117 126.295L11.169 135.343L2 104.154L11.169 69.5385L2 40.272L11.169 4L58.2695 32.355H85.7305L132.831 4L142 40.272L132.831 69.5385L142 104.154L132.831 135.343Z",
  "fill": "#FF5C16",
  "eye": false
 },
 {
  "d": "M11.1758 4L58.2762 32.375L56.403 51.8482L11.1758 4Z",
  "fill": "#FA4B00",
  "eye": false
 },
 {
  "d": "M41.3184 104.167L62.0423 120.074L41.3184 126.295V104.167Z",
  "fill": "#FA4B00",
  "eye": false
 },
 {
  "d": "M60.3866 77.8678L56.4035 51.8613L30.9077 69.5449L30.8945 69.5383V69.5516L30.9734 87.7541L41.3124 77.8678H41.3189H60.3866Z",
  "fill": "#FA4B00",
  "eye": false
 },
 {
  "d": "M132.831 4L85.7305 32.375L87.5971 51.8482L132.831 4Z",
  "fill": "#FA4B00",
  "eye": false
 },
 {
  "d": "M102.689 104.167L81.9648 120.074L102.689 126.295V104.167Z",
  "fill": "#FA4B00",
  "eye": false
 },
 {
  "d": "M113.107 69.5516H113.113H113.107V69.5383L113.1 69.5449L87.6042 51.8613L83.6211 77.8678H102.689L113.034 87.7541L113.107 69.5516Z",
  "fill": "#FA4B00",
  "eye": false
 },
 {
  "d": "M41.3117 126.295L11.169 135.343L2 104.167H41.3117V126.295Z",
  "fill": "#CC3D00",
  "eye": false
 },
 {
  "d": "M60.3787 77.8613L66.1365 115.457L58.1571 94.5537L30.959 87.7543L41.3045 77.8613H60.3721H60.3787Z",
  "fill": "#CC3D00",
  "eye": false
 },
 {
  "d": "M102.688 126.295L132.83 135.343L141.999 104.167H102.688V126.295Z",
  "fill": "#CC3D00",
  "eye": false
 },
 {
  "d": "M83.621 77.8613L77.8633 115.457L85.8426 94.5537L113.041 87.7543L102.689 77.8613H83.621Z",
  "fill": "#CC3D00",
  "eye": false
 },
 {
  "d": "M2 104.154L11.169 69.5391H30.8873L30.9596 87.7483L58.1577 94.5476L66.1371 115.451L62.0357 120.055L41.3117 104.148H2V104.154Z",
  "fill": "#FF7A42",
  "eye": false
 },
 {
  "d": "M142 104.154L132.831 69.5391H113.113L113.041 87.7483L85.8426 94.5476L77.8633 115.451L81.9647 120.055L102.689 104.148H142V104.154Z",
  "fill": "#FF7A42",
  "eye": false
 },
 {
  "d": "M85.73 32.3555H71.9995H58.269L56.4023 51.8287L66.1366 115.431H77.8624L87.6033 51.8287L85.73 32.3555Z",
  "fill": "#FF7A42",
  "eye": false
 },
 {
  "d": "M11.169 4L2 40.272L11.169 69.5385H30.8873L56.3963 51.8482L11.169 4Z",
  "fill": "#571A00",
  "eye": false
 },
 {
  "d": "M54.681 85.4119H45.7486L40.8848 90.2154L58.1646 94.5332L54.681 85.4053V85.4119Z",
  "fill": "#571A00",
  "eye": true
 },
 {
  "d": "M132.831 4L142 40.272L132.831 69.5385H113.112L87.6035 51.8482L132.831 4Z",
  "fill": "#571A00",
  "eye": false
 },
 {
  "d": "M89.3319 85.4119H98.2775L103.141 90.222L85.8418 94.5465L89.3319 85.4053V85.4119Z",
  "fill": "#571A00",
  "eye": true
 },
 {
  "d": "M79.927 127.586L81.9645 120.068L77.8631 115.464H66.1307L62.0293 120.068L64.0669 127.586",
  "fill": "#571A00",
  "eye": false
 },
 {
  "d": "M79.9265 127.586V140H64.0664V127.586H79.9265Z",
  "fill": "#C0C4CD",
  "eye": false
 },
 {
  "d": "M41.3184 126.282L64.0799 139.994V127.579L62.0423 120.062L41.3184 126.282Z",
  "fill": "#F5F5F5",
  "eye": false
 },
 {
  "d": "M102.689 126.282L79.9277 139.994V127.579L81.9653 120.062L102.689 126.282Z",
  "fill": "#F5F5F5",
  "eye": false
 }
];

/** Static fox mark. Facets carry data-facet so assembleFox can animate them. */
export function foxMark(size: number, extraStyle = ""): string {
	const paths = FOX_FACETS.map(
		(f) => `<path data-facet${f.eye ? " data-eye" : ""} d="${f.d}" fill="${f.fill}"/>`,
	).join("");
	return `<svg data-fox viewBox="0 0 144 144" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;${extraStyle}">${paths}</svg>`;
}

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * Facets fly in from just outside the head and lock together, centre-out
 * (nose first, ears last), then the eyes blink once. Returns the ms until the blink ends.
 */
export function assembleFox(svg: Element | null | undefined, delay = 0): number {
	if (!svg) return 0;
	const facets = Array.from(svg.querySelectorAll<SVGGraphicsElement>("[data-facet]"));
	const cx = 72;
	const cy = 76;
	const info = facets.map((el) => {
		const b = el.getBBox();
		const mx = b.x + b.width / 2;
		const my = b.y + b.height / 2;
		return { el, dx: mx - cx, dy: my - cy, dist: Math.hypot(mx - cx, my - cy) };
	});
	const order = [...info].sort((a, b) => a.dist - b.dist);
	const STAGGER = 45;
	const DUR = 640;
	order.forEach((f, i) => {
		const len = Math.max(f.dist, 1);
		const out = 70;
		const tx = (f.dx / len) * out;
		const ty = (f.dy / len) * out;
		const rot = (i % 2 ? 1 : -1) * (14 + (i % 5) * 4);
		f.el.style.transformBox = "fill-box";
		f.el.style.transformOrigin = "center";
		f.el.style.opacity = "0";
		f.el.animate(
			[
				{ opacity: 0, transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(0.35)` },
				{ opacity: 1, transform: "translate(0px, 0px) rotate(0deg) scale(1)" },
			],
			{ duration: DUR, delay: delay + i * STAGGER, fill: "forwards", easing: EASE },
		);
	});
	const settled = delay + (order.length - 1) * STAGGER + DUR;
	const blinkAt = settled + 350;
	svg.querySelectorAll<SVGGraphicsElement>("[data-eye]").forEach((eye) => {
		eye.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0.1)" }, { transform: "scaleY(1)" }], {
			duration: 220,
			delay: blinkAt,
			easing: "ease-in-out",
		});
	});
	return blinkAt + 220;
}
