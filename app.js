// World Capitals (formerly Capital Atlas; the folder and saved-progress id stay capital-atlas): learn the capital of every country on a 3D globe or a flat map.
// Built like Bone Atlas: Study, Practice and Test, by region, with two kinds of question
// (click the country for a capital, or type the capital of a highlighted country).
// The map is drawn on two canvases: `map` (land and sea, redrawn when the view moves) and
// `fx` (highlights, capital dots, flashes; cheap to redraw every frame).
import {
	geoOrthographic, geoNaturalEarth1, geoPath, geoGraticule10, geoContains, geoBounds, geoCentroid, geoDistance, geoArea, feature,
} from './geo.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SPHERE = { type: 'Sphere' };
const GRAT = geoGraticule10();

/* ---------------- storage (per-browser, optional) ---------------- */
const store = window.SiteProgress ? window.SiteProgress.tool('capital-atlas') : { get: (k, d) => d, set() {} };

/* ---------------- regions and places to zoom to ---------------- */
const REGIONS = [
	{ key: 'world', label: 'World' },
	{ key: 'europe', label: 'Europe' },
	{ key: 'asia', label: 'Asia' },
	{ key: 'north-america', label: 'North America' },
	{ key: 'south-america', label: 'South America' },
	{ key: 'africa', label: 'Africa' },
	{ key: 'oceania', label: 'Oceania' },
];
// Subregions: each big continent split into a few groups of neighbouring countries (South America
// stays whole). box = what the map frames for it, same format as AREAS below.
const SUBREGIONS = [
	{ key: 'north-central-america', parent: 'north-america', label: 'North & Central America', box: [-170, 7, -52, 72],
		ids: ['CAN', 'USA', 'MEX', 'GTM', 'BLZ', 'HND', 'SLV', 'NIC', 'CRI', 'PAN'] },
	{ key: 'caribbean', parent: 'north-america', label: 'Caribbean', box: [-86, 10, -59, 27],
		ids: ['CUB', 'JAM', 'HTI', 'DOM', 'BHS', 'KNA', 'ATG', 'DMA', 'LCA', 'VCT', 'BRB', 'GRD', 'TTO'] },
	{ key: 'northern-europe', parent: 'europe', label: 'Northern Europe', box: [-25, 50, 32, 71],
		ids: ['GBR', 'IRL', 'ISL', 'NOR', 'SWE', 'FIN', 'DNK', 'EST', 'LVA', 'LTU'] },
	{ key: 'western-europe', parent: 'europe', label: 'Western Europe', box: [-6, 41, 18, 56],
		ids: ['FRA', 'BEL', 'NLD', 'LUX', 'MCO', 'DEU', 'CHE', 'LIE', 'AUT'] },
	{ key: 'southern-europe', parent: 'europe', label: 'Southern Europe', box: [-10, 34, 35, 47.5],
		ids: ['PRT', 'ESP', 'AND', 'ITA', 'SMR', 'VAT', 'MLT', 'SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'KOS', 'ALB', 'MKD', 'GRC', 'CYP'] },
	{ key: 'eastern-europe', parent: 'europe', label: 'Eastern Europe', box: [12, 41, 50, 61],
		ids: ['POL', 'CZE', 'SVK', 'HUN', 'ROU', 'BGR', 'MDA', 'UKR', 'BLR', 'RUS'] },
	{ key: 'east-asia', parent: 'asia', label: 'East Asia', box: [73, 18, 146, 54],
		ids: ['CHN', 'JPN', 'PRK', 'KOR', 'MNG', 'TWN'] },
	{ key: 'southeast-asia', parent: 'asia', label: 'Southeast Asia', box: [92, -11, 141, 28],
		ids: ['MMR', 'THA', 'LAO', 'KHM', 'VNM', 'MYS', 'SGP', 'IDN', 'BRN', 'PHL', 'TLS'] },
	{ key: 'south-central-asia', parent: 'asia', label: 'South & Central Asia', box: [46, -1, 98, 56],
		ids: ['IND', 'PAK', 'AFG', 'BGD', 'NPL', 'BTN', 'LKA', 'MDV', 'KAZ', 'UZB', 'TKM', 'KGZ', 'TJK'] },
	{ key: 'middle-east', parent: 'asia', label: 'Middle East', box: [25, 12, 64, 44],
		ids: ['TUR', 'GEO', 'ARM', 'AZE', 'IRN', 'IRQ', 'SYR', 'LBN', 'ISR', 'PSX', 'JOR', 'SAU', 'YEM', 'OMN', 'ARE', 'QAT', 'BHR', 'KWT'] },
	{ key: 'north-africa', parent: 'africa', label: 'North Africa', box: [-18, 7, 39, 38],
		ids: ['MAR', 'DZA', 'TUN', 'LBY', 'EGY', 'SDN', 'TCD'] },
	{ key: 'west-africa', parent: 'africa', label: 'West Africa', box: [-26, -4, 17, 27.5],
		ids: ['MRT', 'SEN', 'GMB', 'GNB', 'GIN', 'SLE', 'LBR', 'CPV', 'MLI', 'BFA', 'NER', 'CIV', 'GHA', 'TGO', 'BEN', 'NGA', 'CMR', 'GNQ', 'GAB', 'STP'] },
	{ key: 'east-africa', parent: 'africa', label: 'East Africa', box: [14, -26, 58, 18.5],
		ids: ['ERI', 'DJI', 'ETH', 'SOM', 'SDS', 'CAF', 'KEN', 'UGA', 'RWA', 'BDI', 'TZA', 'MDG', 'COM', 'MUS', 'SYC'] },
	{ key: 'southern-africa', parent: 'africa', label: 'Southern Africa', box: [11, -35, 41, 5.5],
		ids: ['COG', 'COD', 'AGO', 'ZMB', 'MWI', 'MOZ', 'ZWE', 'NAM', 'BWA', 'ZAF', 'LSO', 'SWZ'] },
	{ key: 'australia-melanesia', parent: 'oceania', label: 'Australia & Melanesia', box: [112, -48, 183, 0],
		ids: ['AUS', 'NZL', 'PNG', 'SLB', 'VUT', 'FJI'] },
	{ key: 'micronesia-polynesia', parent: 'oceania', label: 'Micronesia & Polynesia', box: [130, -23, 192, 15],
		ids: ['PLW', 'FSM', 'MHL', 'NRU', 'KIR', 'WSM', 'TON', 'TUV'] },
];
const REGION = Object.fromEntries([...REGIONS, ...SUBREGIONS].map((r) => [r.key, r]));
const SUB_IDS = new Map(SUBREGIONS.map((s) => [s.key, new Set(s.ids)]));
// [west, south, east, north] in degrees; east goes past 180 for areas that cross the date line
const AREAS = {
	world: { label: 'World', box: null },
	europe: { label: 'Europe', box: [-25, 34, 45, 71] },
	asia: { label: 'Asia', box: [25, -11, 150, 55] },
	'north-america': { label: 'North America', box: [-170, 7, -52, 72] },
	'south-america': { label: 'South America', box: [-82, -56, -34, 13] },
	africa: { label: 'Africa', box: [-26, -36, 58, 38] },
	oceania: { label: 'Oceania', box: [110, -48, 200, 20] },
	caribbean: { label: 'Caribbean', box: [-86, 10, -59, 27] },
	'middle-east': { label: 'Middle East', box: [25, 12, 63, 42] },
	pacific: { label: 'Pacific islands', box: [130, -25, 200, 15] },
	'central-america': { label: 'Central America', box: [-93, 7, -77, 19] },
	'lesser-antilles': { label: 'Lesser Antilles', box: [-64, 11, -59, 19] },
	'southeast-asia': { label: 'Southeast Asia', box: [92, -11, 141, 28] },
	'east-asia': { label: 'East Asia', box: [100, 18, 146, 53] },
	'south-asia': { label: 'South Asia', box: [60, 5, 98, 37] },
	'central-asia': { label: 'Central Asia', box: [46, 35, 88, 56] },
	'persian-gulf': { label: 'Persian Gulf', box: [46, 22, 58, 31] },
	balkans: { label: 'Balkans', box: [13, 39, 30, 47] },
	scandinavia: { label: 'Scandinavia', box: [4, 54, 32, 71] },
	'western-europe': { label: 'Western Europe', box: [-11, 36, 17, 56] },
	'eastern-europe': { label: 'Eastern Europe', box: [14, 41, 41, 60] },
	'north-africa': { label: 'North Africa', box: [-18, 15, 36, 38] },
	'west-africa': { label: 'West Africa', box: [-18, 3, 16, 25] },
	'central-africa': { label: 'Central Africa', box: [8, -14, 32, 12] },
	'east-africa': { label: 'East Africa', box: [28, -12, 52, 16] },
	'southern-africa': { label: 'Southern Africa', box: [11, -35, 41, -8] },
	polynesia: { label: 'Polynesia', box: [170, -25, 200, -7] },
	melanesia: { label: 'Melanesia', box: [140, -23, 180, 0] },
	'micronesia-region': { label: 'Micronesia (region)', box: [130, -2, 175, 15] },
};
// every subregion is also a place to zoom to (this replaces the older boxes of the same name)
for (const s of SUBREGIONS) AREAS[s.key] = { label: s.label, box: s.box };
const ZOOM_KEYS = ['world', 'europe', 'asia', 'north-america', 'south-america', 'africa', 'oceania', 'caribbean', 'middle-east', 'pacific'];

/* ---------------- state ---------------- */
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const state = {
	mode: oneOf(store.get('mode', 'study'), ['study', 'practice', 'test'], 'study'),
	format: oneOf(store.get('format', 'click'), ['click', 'type'], 'click'),
	region: oneOf(store.get('region', 'world'), Object.keys(REGION), 'world'),
	view: oneOf(store.get('view', 'globe'), ['globe', 'map'], 'globe'),
	level: oneOf(store.get('level', 'easy'), ['easy', 'hard'], 'easy'),
	clean: false,
	zoomArea: null, // the zoom chip the view was last set to (cleared by moving the map by hand)
};

let COUNTRIES = [];
const BY_ID = new Map();
const CAPITAL_INDEX = new Map(); // normalised capital -> country
const LOD = { xlow: null, low: null, mid: null, high: null }; // GeoJSON features at four levels of detail (same order)
let META = []; // per feature: { i, id, country, name, of, c, r, area, box }

const inRegion = (c, key) => key === 'world' || c.region === key || (SUB_IDS.has(key) && SUB_IDS.get(key).has(c.id));
const inScope = (c) => inRegion(c, state.region);
const scopeCountries = () => COUNTRIES.filter(inScope);
const regionLabel = (k = state.region) => REGION[k].label;

/* ---------------- typed answers ---------------- */
const norm = (s) =>
	String(s)
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/\bst\b\.?/g, 'saint')
		.replace(/[^a-z]/g, '');
function editDistance(a, b) {
	const m = a.length, n = b.length;
	const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
	for (let j = 1; j <= n; j++) d[0][j] = j;
	for (let i = 1; i <= m; i++)
		for (let j = 1; j <= n; j++) {
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
		}
	return d[m][n];
}
// -> { ok, note } or { ok: false, msg }. strict: spelling must be exact (accents, capitals and
// punctuation still don't matter). keepSecret: a wrong answer's message doesn't give the answer away.
function checkAnswer(c, typed, { strict = false, keepSecret = false } = {}) {
	const t = norm(typed);
	const forms = [c.capital, ...(c.alts || [])].map(norm);
	if (forms.includes(t)) return { ok: true };
	const tell = keepSecret ? ' Try again.' : ` ${c.name}’s capital is ${c.capital}.`;
	if ((c.formerly || []).map(norm).includes(t)) return { ok: false, msg: `${typed.trim()} used to be the capital.${tell}` };
	const other = CAPITAL_INDEX.get(t);
	if (other && other !== c) return { ok: false, msg: `${other.capital} is the capital of ${other.name}.${tell}` };
	const slack = strict ? 0 : t.length >= 8 ? 2 : t.length >= 5 ? 1 : 0;
	if (slack && forms.some((f) => editDistance(t, f) <= slack)) return { ok: true, note: `Close enough: it’s spelled ${c.capital}.` };
	if (keepSecret) return { ok: false, msg: 'Not quite. Try again, skip it, or give up.' };
	const near = strict && forms.some((f) => editDistance(t, f) <= (t.length >= 8 ? 2 : 1));
	return { ok: false, msg: near ? `So close, but Hard needs the exact spelling: ${c.capital}.` : `${c.name}: ${c.capital}.` };
}

/* ---------------- layout: the area the panels leave free ---------------- */
const layout = { w: 1, h: 1, left: 0, right: 0, top: 0, bottom: 0 };
const narrow = () => window.innerWidth <= 900;
function measureInsets() {
	const w = window.innerWidth, h = window.innerHeight, wide = w > 900;
	const vis = (el) => el && !el.hidden && el.offsetParent !== null;
	let top = 0, bottom = 0, left = 0, right = 0;
	for (const id of ['prompt', 'stats'].concat(wide ? [] : ['rail'])) {
		const el = $(id);
		if (vis(el)) top = Math.max(top, el.getBoundingClientRect().bottom + 6);
	}
	// the dock row: the same space whichever buttons it shows, so the map doesn't move between modes
	if (!state.clean) bottom = h - document.querySelector('.dock').getBoundingClientRect().bottom + 44;
	if (wide && !state.clean) {
		if (vis($('panel'))) right = w - $('panel').getBoundingClientRect().left + 8;
		for (const id of ['rail', 'viewCard']) if (vis($(id))) left = Math.max(left, $(id).getBoundingClientRect().right + 8);
	}
	return { w, h, top: Math.min(top, h * 0.45), bottom: Math.min(bottom, h * 0.3), left: Math.min(left, w * 0.3), right: Math.min(right, w * 0.35) };
}
function free() {
	const x0 = layout.left, x1 = layout.w - layout.right, y0 = layout.top, y1 = layout.h - layout.bottom;
	return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, fw: Math.max(1, x1 - x0), fh: Math.max(1, y1 - y0) };
}

/* ---------------- camera and projections ---------------- */
// One camera for both views: the point in the middle of the free area, and a zoom (1 = whole world).
const cam = { lon: 10, lat: 15, zoom: 1 };
let mapBase = 100;
const baseScale = (view = state.view) => (view === 'globe' ? Math.min(free().fw, free().fh) * 0.46 : mapBase);
function computeMapBase() {
	const f = free();
	mapBase = geoNaturalEarth1().fitSize([f.fw, f.fh], SPHERE).scale() * 0.97;
}
function projFor(c = cam, view = state.view) {
	const f = free();
	if (view === 'globe') {
		return geoOrthographic().rotate([-c.lon, -c.lat]).translate([f.cx, f.cy]).scale(baseScale('globe') * c.zoom).clipAngle(90).precision(0);
	}
	const p = geoNaturalEarth1().rotate([-c.lon, 0]).scale(mapBase * c.zoom).translate([0, 0]).precision(0);
	const [x, y] = p([c.lon, c.lat]);
	return p.translate([f.cx - x, f.cy - y]);
}
const ZOOM_LIMITS = { globe: [0.7, 90], map: [1, 140] };
function constrain(c = cam, view = state.view) {
	const [z0, z1] = ZOOM_LIMITS[view];
	c.zoom = Math.min(z1, Math.max(z0, c.zoom));
	c.lon = ((((c.lon + 180) % 360) + 360) % 360) - 180;
	c.lat = Math.max(-85, Math.min(85, c.lat));
	if (view === 'map') {
		// keep the flat map covering the view top to bottom (or centred when it all fits)
		const p = projFor(c, 'map'), f = free();
		const [[, y0], [, y1]] = geoPath(p).bounds(SPHERE);
		let dy = 0;
		if (y1 - y0 <= f.fh) dy = f.cy - (y0 + y1) / 2;
		else if (y0 > f.y0) dy = f.y0 - y0;
		else if (y1 < f.y1) dy = f.y1 - y1;
		if (Math.abs(dy) > 0.5) {
			const ll = p.invert([f.cx, f.cy - dy]);
			if (ll && isFinite(ll[1])) c.lat = ll[1];
		}
	}
	return c;
}
let proj = null;
function updateProj() {
	proj = projFor();
}
function boxPoints([w, s, e, n]) {
	const pts = [];
	for (let i = 0; i <= 16; i++) {
		const t = i / 16;
		pts.push([w + (e - w) * t, s], [w + (e - w) * t, n], [w, s + (n - s) * t], [e, s + (n - s) * t]);
	}
	return { type: 'MultiPoint', coordinates: pts };
}
// The camera that fits a [w, s, e, n] box into the free area
function camForBox(box, view = state.view, pad = 18) {
	if (!box) return constrain(view === 'globe' ? { lon: cam.lon, lat: 15, zoom: 1 } : { lon: 10, lat: 0, zoom: 1 }, view);
	const [w, s, e, n] = box;
	const lon = (w + e) / 2, lat = (s + n) / 2;
	const f = free();
	const ext = [[f.x0 + pad, f.y0 + pad], [f.x1 - pad, f.y1 - pad]];
	const geo = boxPoints(box);
	if (view === 'globe') {
		const p = geoOrthographic().rotate([-lon, -lat]).clipAngle(90).fitExtent(ext, geo);
		return constrain({ lon, lat, zoom: p.scale() / baseScale('globe') }, 'globe');
	}
	const p = geoNaturalEarth1().rotate([-lon, 0]).fitExtent(ext, geo);
	const ll = p.invert([f.cx, f.cy]);
	return constrain({ lon: ll[0], lat: ll[1], zoom: p.scale() / mapBase }, 'map');
}
// Frame a country with some of its surroundings (tiny countries get at least ~14° of context)
function camForCountry(c, view = state.view) {
	const [[w, s], [e, n]] = META[c.fi].box;
	const E = e < w ? e + 360 : e;
	const cx = (w + E) / 2, cy = (s + n) / 2;
	const hw = Math.max((E - w) / 2, 7), hh = Math.max((n - s) / 2, 4.5);
	return camForBox([cx - hw, cy - hh, cx + hw, cy + hh], view, 48);
}

/* ---------------- moving the camera ---------------- */
let fly = null, moving = false, settleTimer = 0;
function interacting() {
	moving = true;
	clearTimeout(settleTimer);
}
function settle() {
	clearTimeout(settleTimer);
	settleTimer = setTimeout(() => {
		moving = false;
		invalidate();
	}, 150);
}
function flyTo(target, ms = 700) {
	const to = constrain({ ...target });
	const from = { ...cam };
	const dl = ((((to.lon - from.lon + 180) % 360) + 360) % 360) - 180;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 0;
	// straight there: turn and zoom together, no zooming out on the way
	fly = { from, to, dl, t0: performance.now(), ms };
	interacting();
	invalidate();
}
function stepFly(now) {
	if (!fly) return;
	const k = fly.ms ? Math.min(1, (now - fly.t0) / fly.ms) : 1;
	const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
	cam.lon = fly.from.lon + fly.dl * e;
	cam.lat = fly.from.lat + (fly.to.lat - fly.from.lat) * e;
	cam.zoom = Math.exp(Math.log(fly.from.zoom) + (Math.log(fly.to.zoom) - Math.log(fly.from.zoom)) * e);
	constrain();
	updateProj();
	baseDirty = true;
	if (k >= 1) {
		fly = null;
		settle();
	}
}
function cancelFly() {
	if (fly) {
		fly = null;
		settle();
	}
}
function zoomAround(x, y, factor) {
	cancelFly();
	const before = proj.invert([x, y]);
	cam.zoom *= factor;
	constrain();
	updateProj();
	const after = proj.invert([x, y]);
	const okPt = (ll) => ll && isFinite(ll[0]) && isFinite(ll[1]);
	if (okPt(before) && okPt(after) && (state.view === 'map' || geoDistance(before, [cam.lon, cam.lat]) < Math.PI / 2)) {
		cam.lon += before[0] - after[0];
		cam.lat += before[1] - after[1];
		constrain();
		updateProj();
	}
	state.zoomArea = null;
	renderZoom();
	interacting();
	settle();
	invalidate();
}
function frameArea(key, ms) {
	state.zoomArea = key;
	renderZoom();
	flyTo(camForBox(AREAS[key].box), ms);
}
const frameRegion = (ms) => frameArea(state.region, ms);

/* ---------------- map data ---------------- */
function eachPoint(geom, fn) {
	const walk = (a) => (typeof a[0] === 'number' ? fn(a) : a.forEach(walk));
	walk(geom.coordinates);
}
function useTopology(topo) {
	return feature(topo, topo.objects.land).features;
}
const SCATTERED = new Set(['KIR', 'FSM', 'MHL', 'CPV']); // island groups spread over a lot of ocean
function buildMeta(feats) {
	META = feats.map((f, i) => {
		const p = f.properties;
		const country = p.id ? BY_ID.get(p.id) : null;
		if (country) country.fi = i;
		const c = geoCentroid(f);
		let r = 0;
		eachPoint(f.geometry, (pt) => {
			r = Math.max(r, geoDistance(c, pt));
		});
		const area = geoArea(f);
		// microstates and small island nations get a ring you can click while they're too small to see
		const small = !!country && (area * 6371 ** 2 < 3000 || SCATTERED.has(p.id));
		return { i, id: p.id || null, country, name: country ? country.name : p.name, of: p.of || null, c, r: r + 0.03, area, small, box: geoBounds(f) };
	});
}
function inBox(box, [lon, lat]) {
	const [[w, s], [e, n]] = box;
	if (lat < s - 0.01 || lat > n + 0.01) return false;
	return w <= e ? lon >= w - 0.01 && lon <= e + 0.01 : lon >= w - 0.01 || lon <= e + 0.01;
}
let highRequested = false;
function requestHigh() {
	if (highRequested) return;
	highRequested = true;
	fetch('data/map-high.json')
		.then((r) => r.json())
		.then((t) => {
			LOD.high = useTopology(t);
			refreshMeta(LOD.high);
			invalidate();
		})
		.catch(() => {
			highRequested = false;
		});
}
const LEVELS = ['xlow', 'low', 'mid', 'high'];
function lodName(p) {
	const ppd = p.scale() * DEG;
	let want = ppd < 5 ? 0 : ppd < 14 ? 1 : ppd < 70 ? 2 : 3;
	// on slow devices, one level less while the map moves (except very close in, where few shapes are on screen)
	if (moving && slowDevice && want > 0 && !(want === 3 && ppd > 120)) want--;
	if (want === 3 && !LOD.high) requestHigh();
	while (want > 0 && !LOD[LEVELS[want]]) want--;
	return LEVELS[want];
}
const bestFeats = () => LOD.high || LOD.mid || LOD.low || LOD.xlow;
// Better shapes have arrived: refresh the outlines used for picking and for spotting tiny countries
function refreshMeta(feats) {
	for (const m of META) {
		const f = feats[m.i];
		m.area = geoArea(f);
		m.small = !!m.country && (m.area * 6371 ** 2 < 3000 || SCATTERED.has(m.id));
		m.box = geoBounds(f);
	}
}

/* ---------------- drawing ---------------- */
const mapCv = $('map'), fxCv = $('fx');
const bctx = mapCv.getContext('2d'), fctx = fxCv.getContext('2d');
// slowDevice: drawing the map while it moves took too long, so moving frames use less detail
let dpr = 1, baseDirty = true, raf = 0, drawnFeats = null, slowDevice = false;
const COL = {
	inScope: '#c6bba2',
	outScope: '#4b585f',
	territory: '#384449',
	okTint: '#86c39a',
	badTint: '#d08a7c',
	border: 'rgba(9, 14, 19, 0.9)',
	grat: 'rgba(111, 208, 232, 0.08)',
	target: '#6fd0e8',
	ok: '#5fd39a',
	bad: '#ff7a6b',
	hover: 'rgba(255, 250, 238, 0.32)',
	dot: '#101b24',
	ring: '#ecdec2',
};
function sizeCanvases() {
	dpr = Math.min(2, window.devicePixelRatio || 1);
	for (const cv of [mapCv, fxCv]) {
		cv.width = Math.round(layout.w * dpr);
		cv.height = Math.round(layout.h * dpr);
	}
}
function invalidate(base = true) {
	if (base) baseDirty = true;
	if (!raf) raf = requestAnimationFrame(frame);
}
function frame(now) {
	raf = 0;
	stepFly(now);
	if (baseDirty && proj) {
		baseDirty = false;
		drawBase();
	}
	const busy = proj ? drawFx(now) : false;
	if (fly || busy) raf = requestAnimationFrame(frame);
}
function viewCap(p) {
	const f = free();
	const half = Math.max(...[[0, 0], [layout.w, 0], [0, layout.h], [layout.w, layout.h]].map(([x, y]) => Math.hypot(x - f.cx, y - f.cy)));
	const s = p.scale();
	if (state.view === 'globe') return half >= s ? Math.PI / 2 : Math.asin(half / s);
	return s * DEG < 8 ? Math.PI * 2 : Math.min(Math.PI, (half / s) * 1.7);
}
function visibleIndices(p) {
	const R = viewCap(p) + 0.02, ctr = [cam.lon, cam.lat];
	if (R >= Math.PI) return META.map((m) => m.i);
	return META.filter((m) => geoDistance(m.c, ctr) - m.r < R).map((m) => m.i);
}
function statusOf(id) {
	if (review) return review.status.get(id) || null;
	if (session && state.mode !== 'study' && state.level === 'easy') return session.result.get(id) || null;
	return null; // Hard: no colours until the end, so each question stands on its own
}
const quiet = () => state.level === 'hard' && state.format === 'click';
const typeEasy = () => state.format === 'type' && state.level === 'easy' && state.mode !== 'study';
function landColor(m) {
	if (!m.country) return COL.territory;
	if (!inScope(m.country)) return COL.outScope;
	const st = statusOf(m.id);
	return st === 'ok' ? COL.okTint : st === 'bad' ? COL.badTint : COL.inScope;
}
function drawBase() {
	const t0 = performance.now(), p = proj, ctx = bctx;
	const path = geoPath(p, ctx);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, layout.w, layout.h);
	const globe = state.view === 'globe';
	const [cx, cy] = p.translate(), R = p.scale();
	// The sea's edge and the grid are a few long curves (a meridian is only 3 points), so let d3
	// add points along them; the land is already dense and stays fast with resampling off.
	p.precision(0.5);
	// sea
	ctx.beginPath();
	path(SPHERE);
	if (globe) {
		const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
		g.addColorStop(0, '#1a3142');
		g.addColorStop(1, '#0b1820');
		ctx.fillStyle = g;
	} else ctx.fillStyle = '#10202b';
	ctx.fill();
	if (globe) {
		// a thin atmosphere around the globe
		const g = ctx.createRadialGradient(cx, cy, R * 0.985, cx, cy, R * 1.07);
		g.addColorStop(0, 'rgba(111, 208, 232, 0.28)');
		g.addColorStop(1, 'rgba(111, 208, 232, 0)');
		ctx.beginPath();
		ctx.arc(cx, cy, R * 1.07, 0, TAU);
		ctx.arc(cx, cy, R * 0.985, 0, TAU, true);
		ctx.fillStyle = g;
		ctx.fill();
	}
	ctx.beginPath();
	path(GRAT);
	ctx.strokeStyle = COL.grat;
	ctx.lineWidth = 0.6;
	ctx.stroke();
	p.precision(0);
	// land: each country filled on its own (one big combined path is several times slower to fill
	// on the flat map); the dark outline doubles as the borders
	const feats = LOD[lodName(p)];
	drawnFeats = feats;
	ctx.lineJoin = 'round';
	ctx.lineWidth = Math.min(1.2, 0.45 + p.scale() * DEG * 0.01);
	ctx.strokeStyle = COL.border;
	for (const i of visibleIndices(p)) {
		ctx.beginPath();
		path(feats[i]);
		ctx.fillStyle = landColor(META[i]);
		ctx.fill();
		ctx.stroke();
	}
	if (globe) {
		// shade toward the rim so it reads as a ball
		const g = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.35, cx, cy, R);
		g.addColorStop(0, 'rgba(4, 8, 12, 0)');
		g.addColorStop(1, 'rgba(4, 8, 12, 0.5)');
		ctx.beginPath();
		ctx.arc(cx, cy, R, 0, TAU);
		ctx.fillStyle = g;
		ctx.fill();
	}
	if (moving) {
		const ms = performance.now() - t0;
		if (ms > 24) slowDevice = true;
		else if (ms < 8) slowDevice = false;
	}
}

/* ---------- overlay: capital dots, small-country rings, highlights ---------- */
const RING = 8;
const screen = new Map(); // id -> { x, y, tiny } for in-scope countries on screen, rebuilt each overlay draw
let hoverId = null, hoverIdx = null;
let flashes = []; // { id, kind: 'ok' | 'bad' | 'reveal', t0 }
let callout = null; // { id, title, sub }
const canHover = window.matchMedia('(hover: hover)').matches;
function projectPoint(p, ll) {
	if (state.view === 'globe' && geoDistance(ll, [cam.lon, cam.lat]) > Math.PI / 2 - 0.004) return null;
	const pt = p(ll);
	return pt && isFinite(pt[0]) ? pt : null;
}
const isTiny = (m, p) => m.small && m.area * p.scale() * p.scale() < 250;
function targetId() {
	if (state.mode === 'study') return study && study.items.length ? study.items[study.index].id : null;
	if (!session || !session.current || review) return null;
	if (session.phase === 'reveal' || state.format === 'type') return session.current.id;
	return null;
}
function fillCountry(ctx, path, id, fill, alpha, stroke) {
	const c = BY_ID.get(id);
	if (!c) return;
	const s = screen.get(id);
	ctx.globalAlpha = alpha;
	ctx.fillStyle = fill;
	if (s && s.tiny) {
		ctx.beginPath();
		ctx.arc(s.x, s.y, RING, 0, TAU);
		ctx.fill();
	} else {
		ctx.beginPath();
		path((moving && drawnFeats ? drawnFeats : bestFeats())[c.fi]);
		ctx.fill();
		if (stroke) {
			ctx.globalAlpha = 1;
			ctx.lineWidth = 1.6;
			ctx.strokeStyle = stroke;
			ctx.stroke();
		}
	}
	ctx.globalAlpha = 1;
}
function drawFx(now) {
	const ctx = fctx, p = proj, path = geoPath(p, ctx);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, layout.w, layout.h);
	let busy = false;
	// where each in-scope capital is on screen, and which countries are too small to click
	screen.clear();
	for (const c of COUNTRIES) {
		if (!inScope(c) || c.fi == null) continue;
		const pt = projectPoint(p, [c.lon, c.lat]);
		if (pt) screen.set(c.id, { x: pt[0], y: pt[1], tiny: isTiny(META[c.fi], p) });
	}
	// hover
	if (hoverIdx != null && canHover && !moving) {
		ctx.beginPath();
		const s = hoverId && screen.get(hoverId);
		if (s && s.tiny) ctx.arc(s.x, s.y, RING, 0, TAU);
		else path(bestFeats()[hoverIdx]);
		ctx.fillStyle = COL.hover;
		ctx.fill();
	}
	// answer flashes fade out
	flashes = flashes.filter((fl) => now - fl.t0 < 900);
	for (const fl of flashes) {
		busy = true;
		const a = 1 - (now - fl.t0) / 900;
		fillCountry(ctx, path, fl.id, fl.kind === 'reveal' ? COL.target : COL[fl.kind], 0.85 * a);
	}
	// the country being studied or asked about
	const tid = targetId();
	if (tid) {
		const pulse = session && (session.phase === 'reveal' || state.format === 'type') && state.mode !== 'study';
		const a = pulse ? 0.55 + 0.3 * Math.sin(now / 260) : 0.78;
		if (pulse) busy = true;
		ctx.shadowColor = 'rgba(111, 208, 232, 0.8)';
		ctx.shadowBlur = 14;
		fillCountry(ctx, path, tid, COL.target, a, '#bff0fb');
		ctx.shadowBlur = 0;
	}
	// rings around countries too small to see, then every capital
	for (const [id, s] of screen) {
		if (!s.tiny) continue;
		ctx.beginPath();
		ctx.arc(s.x, s.y, RING, 0, TAU);
		ctx.fillStyle = 'rgba(236, 222, 194, 0.16)';
		ctx.fill();
		ctx.lineWidth = 1.3;
		ctx.strokeStyle = statusRingColor(id);
		ctx.stroke();
	}
	const r = Math.min(3.6, 2.2 + p.scale() * DEG * 0.004);
	for (const [, s] of screen) {
		ctx.beginPath();
		ctx.arc(s.x, s.y, r, 0, TAU);
		ctx.fillStyle = COL.dot;
		ctx.fill();
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = COL.ring;
		ctx.stroke();
	}
	placeCallout(p);
	return busy;
}
function statusRingColor(id) {
	const st = statusOf(id);
	return st === 'ok' ? COL.ok : st === 'bad' ? COL.bad : COL.ring;
}
function flash(id, kind) {
	// Hard clicking: a click still flashes green or red and fades back, but a missed country's
	// location stays hidden, and nothing stays coloured until the end
	if (quiet() && !review && kind === 'reveal') return;
	flashes.push({ id, kind, t0: performance.now() });
	invalidate(false);
}

/* ---------- name callout pinned to a capital ---------- */
function setCallout(id, title, sub) {
	callout = id ? { id, title, sub } : null;
	const el = $('callout');
	if (!callout) {
		el.hidden = true;
		$('leader').style.display = 'none';
		return;
	}
	el.replaceChildren(document.createTextNode(title));
	if (sub) {
		const s = document.createElement('small');
		s.textContent = sub;
		el.append(s);
	}
	invalidate(false);
}
function placeCallout(p) {
	const el = $('callout'), line = $('leaderLine');
	if (!callout) return;
	const c = BY_ID.get(callout.id);
	const pt = c && projectPoint(p, [c.lon, c.lat]);
	if (!pt) {
		el.hidden = true;
		$('leader').style.display = 'none';
		return;
	}
	el.hidden = false;
	$('leader').style.display = '';
	const f = free(), bw = el.offsetWidth, bh = el.offsetHeight;
	let x = pt[0] + 22, y = pt[1] - bh - 18;
	if (x + bw > f.x1 - 6) x = pt[0] - 22 - bw;
	if (y < f.y0 + 4) y = pt[1] + 18;
	el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
	const ex = x > pt[0] ? x : x + bw, ey = y > pt[1] ? y : y + bh;
	line.setAttribute('x1', pt[0]);
	line.setAttribute('y1', pt[1]);
	line.setAttribute('x2', ex);
	line.setAttribute('y2', ey);
}

/* ---------------- picking ---------------- */
function pickAt(x, y) {
	let best = null, bd = Infinity;
	// 1. right on a capital dot: that capital's country (Jerusalem sits on the West Bank border, Rome next to the Vatican)
	for (const [id, s] of screen) {
		const d = Math.hypot(s.x - x, s.y - y);
		if (d <= 5 && d < bd) {
			bd = d;
			best = id;
		}
	}
	if (best) return { id: best, i: BY_ID.get(best).fi };
	// 2. a ring around a small country
	for (const [id, s] of screen) {
		if (!s.tiny) continue;
		const d = Math.hypot(s.x - x, s.y - y);
		if (d <= RING + 4 && d < bd) {
			bd = d;
			best = id;
		}
	}
	if (best) return { id: best, i: BY_ID.get(best).fi };
	// 3. the land under the pointer
	const ll = proj.invert([x, y]);
	if (ll && isFinite(ll[0]) && isFinite(ll[1]) && (state.view === 'map' || geoDistance(ll, [cam.lon, cam.lat]) < Math.PI / 2)) {
		const feats = bestFeats();
		for (const m of META) if (inBox(m.box, ll) && geoContains(feats[m.i], ll)) return { id: m.id, i: m.i };
	}
	// 4. close to a capital dot (islands too small to hit, but not small enough for a ring)
	for (const [id, s] of screen) {
		const d = Math.hypot(s.x - x, s.y - y);
		if (d <= 10 && d < bd) {
			bd = d;
			best = id;
		}
	}
	return best ? { id: best, i: BY_ID.get(best).fi } : null;
}

/* ---------------- pointer and wheel ---------------- */
const pointers = new Map();
let drag = null;
function localXY(e) {
	const r = mapCv.getBoundingClientRect();
	return [e.clientX - r.left, e.clientY - r.top];
}
mapCv.addEventListener('pointerdown', (e) => {
	mapCv.setPointerCapture(e.pointerId);
	const [x, y] = localXY(e);
	pointers.set(e.pointerId, { x, y });
	if (pointers.size === 1) drag = { x0: x, y0: y, x, y, moved: false };
	else drag && (drag.moved = true);
	cancelFly();
});
mapCv.addEventListener('pointermove', (e) => {
	const [x, y] = localXY(e);
	const prev = pointers.get(e.pointerId);
	if (!prev) {
		hoverAt(x, y);
		return;
	}
	if (pointers.size >= 2) {
		// pinch: zoom around the midpoint and pan with it
		const pts = [...pointers.values()];
		const other = pts.find((q) => q !== prev);
		const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(x - other.x, y - other.y);
		prev.x = x;
		prev.y = y;
		if (d0 > 0 && d1 > 0) zoomAround((x + other.x) / 2, (y + other.y) / 2, d1 / d0);
		return;
	}
	const dx = x - prev.x, dy = y - prev.y;
	prev.x = x;
	prev.y = y;
	if (!drag) return;
	if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < 5) return;
	drag.moved = true;
	$('stage').classList.add('dragging');
	panBy(dx, dy, x, y);
});
function panBy(dx, dy, x, y) {
	const s = proj.scale();
	if (state.view === 'globe') {
		cam.lon -= dx / (s * DEG);
		cam.lat += dy / (s * DEG);
	} else {
		const a = proj.invert([x - dx, y - dy]), b = proj.invert([x, y]);
		if (a && b && isFinite(a[0]) && isFinite(b[0])) {
			cam.lon += a[0] - b[0];
			cam.lat += a[1] - b[1];
		}
	}
	constrain();
	updateProj();
	state.zoomArea = null;
	renderZoom();
	interacting();
	settle();
	invalidate();
}
function endPointer(e) {
	const [x, y] = localXY(e);
	const wasDrag = drag && drag.moved;
	pointers.delete(e.pointerId);
	if (pointers.size === 0) {
		$('stage').classList.remove('dragging');
		if (drag && !wasDrag && e.type === 'pointerup') onMapClick(pickAt(x, y));
		drag = null;
	}
}
mapCv.addEventListener('pointerup', endPointer);
mapCv.addEventListener('pointercancel', endPointer);
mapCv.addEventListener('pointerleave', () => {
	if (!pointers.size) setHover(null);
});
mapCv.addEventListener(
	'wheel',
	(e) => {
		e.preventDefault();
		const [x, y] = localXY(e);
		const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
		zoomAround(x, y, Math.exp(-dy * 0.0016));
	},
	{ passive: false },
);
let hoverRaf = 0;
function hoverAt(x, y) {
	if (!canHover || !proj) return;
	cancelAnimationFrame(hoverRaf);
	hoverRaf = requestAnimationFrame(() => {
		const hit = pickAt(x, y);
		setHover(hit);
	});
}
function setHover(hit) {
	const idx = hit ? hit.i : null;
	if (idx === hoverIdx) return;
	hoverIdx = idx;
	hoverId = hit ? hit.id : null;
	$('stage').classList.toggle('hovering', idx != null);
	invalidate(false);
}

/* ---------------- study mode ---------------- */
let study = null;
function startStudy(selectId) {
	const items = scopeCountries().sort((a, b) => a.name.localeCompare(b.name));
	const at = items.findIndex((c) => c.id === selectId);
	study = { items, index: Math.max(0, at) };
	showStudyItem(false);
}
function showStudyItem(move) {
	if (!study || !study.items.length) {
		setCallout(null);
		renderPrompt();
		return;
	}
	const c = study.items[study.index];
	setCallout(c.id, c.capital, c.name);
	if (move) showCountry(c, false);
	renderPrompt();
	invalidate(false);
}
function studyStep(d) {
	if (state.mode !== 'study' || !study || !study.items.length) return;
	study.index = (study.index + d + study.items.length) % study.items.length;
	showStudyItem(true);
}
function studyPick(hit) {
	if (!hit) return;
	if (!hit.id) return toastPlace(hit.i);
	const c = BY_ID.get(hit.id);
	const at = study ? study.items.findIndex((x) => x.id === c.id) : -1;
	if (at < 0) {
		toast(`${c.name}: ${c.capital}. It’s outside ${regionLabel()}.`);
		return;
	}
	study.index = at;
	showStudyItem(false);
}
function toastPlace(i) {
	const m = META[i];
	toast(`${m.name}${m.of && m.of !== m.name ? ` (${m.of})` : ''} isn’t a country in this quiz.`);
}
// Bring a country into view if it isn't comfortably visible (always, for typed questions)
function showCountry(c, forTyping) {
	const m = META[c.fi], f = free();
	const pt = projectPoint(proj, [c.lon, c.lat]);
	const area = m.area * proj.scale() ** 2;
	const inside = pt && pt[0] > f.x0 + 40 && pt[0] < f.x1 - 40 && pt[1] > f.y0 + 40 && pt[1] < f.y1 - 40;
	if (inside && (!forTyping || (area > 500 && area < f.fw * f.fh * 0.6))) return;
	state.zoomArea = null;
	renderZoom();
	flyTo(camForCountry(c));
}

/* ---------------- quiz (practice / test) ---------------- */
let session = null, sessionSeq = 0, review = null;
const statKey = (id) => `${state.format}:${id}`;
function shuffle(a) {
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
function startSession(onlyIds) {
	clearReview();
	setCallout(null);
	flashes = [];
	if (state.mode === 'study') {
		session = null;
		closeInput();
		startStudy(study && study.items.length ? study.items[study.index].id : null);
		renderAll();
		return;
	}
	study = null;
	let items = scopeCountries();
	if (onlyIds) items = items.filter((c) => onlyIds.includes(c.id));
	shuffle(items);
	if (state.mode === 'practice') {
		const hist = store.get('stats', {});
		const weak = (c) => {
			const h = hist[statKey(c.id)];
			return h ? h[1] - h[0] * 0.5 : 0;
		};
		items = items.map((c, i) => [c, weak(c), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map((x) => x[0]);
	}
	session = {
		id: ++sessionSeq, items, queue: items.slice(), total: items.length, done: 0, attempts: 0, correct: 0, streak: 0,
		start: performance.now(), end: null, current: null, phase: 'ask', everMissed: new Set(), result: new Map(), busy: false,
		tried: new Set(),
	};
	renderAll();
	nextItem();
}
function later(ms) {
	const id = session && session.id;
	setTimeout(() => {
		if (session && session.id === id) nextItem();
	}, ms);
}
function nextItem() {
	if (!session) return;
	setCallout(null);
	session.busy = false;
	if (!session.queue.length) return finishSession();
	session.current = session.queue.shift();
	showQuestion();
}
// Easy typing: leave this country for later (dir 1) or go back to the last one skipped (dir -1)
function moveQuestion(dir) {
	if (!session || !session.current || session.busy || review || session.phase === 'reveal') return;
	if (!session.queue.length) {
		toast('This is the last one left.');
		return;
	}
	if (dir > 0) {
		session.queue.push(session.current);
		session.current = session.queue.shift();
	} else {
		session.queue.unshift(session.current);
		session.current = session.queue.pop();
	}
	$('answer').value = '';
	showQuestion();
}
function showQuestion() {
	session.phase = 'ask';
	if (state.format === 'type') {
		showCountry(session.current, true);
		openInput();
	} else closeInput();
	renderPrompt();
	invalidate();
}
function recordStat(id, ok) {
	const hist = store.get('stats', {});
	const h = hist[statKey(id)] || [0, 0];
	h[ok ? 0 : 1]++;
	hist[statKey(id)] = h;
	store.set('stats', hist);
}
function onMapClick(hit) {
	if (review) return reviewPick(hit);
	if (state.mode === 'study') return studyPick(hit);
	if (!session || !session.current || session.busy) return;
	if (state.format === 'type') {
		// typed questions: clicks only say what you clicked
		if (hit && !hit.id) toastPlace(hit.i);
		return;
	}
	if (!hit) return;
	if (!hit.id) return toastPlace(hit.i);
	const c = BY_ID.get(hit.id);
	if (!inScope(c)) {
		toast(`That’s ${c.name}, outside ${regionLabel()}.`, 'bad');
		return;
	}
	// Easy: a country already coloured green or red has been answered, so a click on it doesn't count
	if (c.id !== session.current.id && statusOf(c.id)) return;
	const cur = session.current, right = c.id === cur.id;
	if (session.phase === 'reveal') {
		if (right) {
			flash(c.id, 'ok');
			session.busy = true;
			later(350);
		} else {
			flash(c.id, 'bad');
			toast(quiet() ? 'Not that one. Click the glowing country.' : `That’s ${c.name}. Click the glowing country.`, 'bad');
		}
		return;
	}
	session.attempts++;
	if (right) gotIt(cur);
	else {
		flash(c.id, 'bad');
		// say only what the answer was, never the capital of the country you clicked
		toast(quiet() ? 'Not that one.' : `It was ${cur.name}.`, 'bad');
		missed(cur, true);
	}
	renderStats();
}
function submitAnswer(text) {
	if (!session || !session.current || session.busy || state.format !== 'type' || review) return;
	const cur = session.current;
	// Enter with nothing typed moves on: Easy skips this country for later, Hard gives up on it
	// (the same as the Skip / Show me button; after a reveal it goes to the next country)
	if (!text.trim()) {
		if (session.phase !== 'reveal' && typeEasy()) moveQuestion(1);
		else skip();
		return;
	}
	const res = checkAnswer(cur, text, { strict: state.level === 'hard', keepSecret: typeEasy() && session.phase !== 'reveal' });
	if (session.phase === 'reveal') {
		if (res.ok) {
			$('answer').value = '';
			flash(cur.id, 'ok');
			session.busy = true;
			later(350);
		} else {
			badInput();
			toast(`Type “${cur.capital}” to carry on.`, 'bad');
		}
		return;
	}
	session.attempts++;
	$('answer').value = '';
	if (res.ok) gotIt(cur, res.note);
	else if (typeEasy()) {
		// Easy: keep guessing; the first wrong guess counts against this country in practice history
		toast(res.msg, 'bad');
		badInput();
		session.streak = 0;
		pulsePrompt('bad');
		if (!session.tried.has(cur.id)) {
			session.tried.add(cur.id);
			recordStat(cur.id, false);
		}
	} else {
		toast(res.msg, 'bad');
		badInput();
		missed(cur, true);
	}
	renderStats();
}
function gotIt(cur, note) {
	session.correct++;
	session.streak++;
	session.done++;
	recordStat(cur.id, true);
	session.result.set(cur.id, session.everMissed.has(cur.id) ? 'bad' : 'ok');
	flash(cur.id, 'ok');
	pulsePrompt('ok');
	if (note) toast(note, 'ok');
	else if (quiet()) toast('Correct.', 'ok');
	else if (state.format === 'click') toast(`Correct, that’s ${cur.name}.`, 'ok');
	session.busy = true;
	renderPrompt();
	invalidate();
	later(state.mode === 'test' ? 300 : 480);
}
function missed(cur, answered) {
	session.streak = 0;
	recordStat(cur.id, false);
	pulsePrompt('bad');
	session.everMissed.add(cur.id);
	if (state.mode === 'test') {
		// tests move on, but show where it was
		session.result.set(cur.id, 'bad');
		flash(cur.id, 'reveal'); // (Hard clicking: flash() skips this, so the answer stays hidden)
		session.busy = true;
		renderPrompt();
		invalidate();
		later(answered ? 1100 : 700);
		return;
	}
	// practice: show it, make you answer it, and bring it back a few questions later
	session.queue.splice(Math.min(3, session.queue.length), 0, cur);
	session.phase = 'reveal';
	if (state.format === 'click') setCallout(cur.id, cur.capital, cur.name);
	showCountry(cur, state.format === 'type');
	renderPrompt();
	invalidate();
}
function skip() {
	if (state.mode === 'study' || !session || !session.current || session.busy || review) return;
	if (session.phase === 'reveal') {
		setCallout(null);
		nextItem();
		return;
	}
	session.attempts++;
	if (state.format === 'type') toast(`${session.current.name}: ${session.current.capital}.`);
	else if (state.mode === 'test' && !quiet()) toast(`It was ${session.current.name}.`);
	missed(session.current, false);
	renderStats();
}
function bestKey() {
	return `${state.mode}|${state.format}|${state.level}|${state.region}`;
}
function finishSession() {
	session.end = performance.now();
	session.current = null;
	closeInput();
	const ms = session.end - session.start;
	const firstTry = session.total - session.everMissed.size;
	const acc = session.attempts ? Math.round((100 * session.correct) / session.attempts) : 0;
	const scoreNow = state.mode === 'test' ? session.correct : firstTry;
	const all = store.get('best', {});
	const prev = all[bestKey()];
	if (!prev || scoreNow > prev.score || (scoreNow === prev.score && ms < prev.ms)) {
		all[bestKey()] = { score: scoreNow, total: session.total, ms };
		store.set('best', all);
	}
	const missedIds = session.items.filter((c) => session.everMissed.has(c.id)).map((c) => c.id);
	review = {
		status: new Map(session.items.map((c) => [c.id, session.everMissed.has(c.id) ? 'bad' : 'ok'])),
		ok: scoreNow, bad: session.total - scoreNow, acc, ms, best: all[bestKey()], missedIds,
	};
	$('rOk').textContent = review.ok;
	$('rBad').textContent = review.bad;
	$('rOkLabel').textContent = state.mode === 'test' || typeEasy() ? 'correct' : 'first try';
	$('rBadLabel').textContent = typeEasy() ? 'gave up' : state.mode === 'test' ? 'missed' : 'needed help';
	$('rPractice').hidden = !missedIds.length;
	renderAll();
	$('sTime').textContent = fmtTime(ms);
	frameRegion();
}
function clearReview() {
	if (!review) return;
	review = null;
	setCallout(null);
	$('review').hidden = true;
	$('pBarWrap').classList.remove('is-off');
	syncMore();
	invalidate();
}
function reviewPick(hit) {
	if (!hit) return;
	if (!hit.id) return toastPlace(hit.i);
	const c = BY_ID.get(hit.id);
	if (!review.status.get(c.id)) return toast(`${c.name}: ${c.capital}.`);
	// the map's green / red already says how it went
	setCallout(c.id, c.capital, c.name);
}
$('rAgain').addEventListener('click', () => startSession());
$('rPractice').addEventListener('click', () => {
	const ids = review ? review.missedIds.slice() : [];
	setMode('practice', false);
	startSession(ids);
});

/* ---------------- typed answer box ---------------- */
function openInput() {
	$('answerForm').hidden = false;
	$('answer').classList.remove('is-bad');
	$('answer').placeholder = session && session.phase === 'reveal' ? `Type ${session.current.capital}` : 'Type the capital';
	syncMore();
	if (!narrow() || document.activeElement === $('answer')) $('answer').focus({ preventScroll: true });
}
function closeInput() {
	const form = $('answerForm');
	if (form.hidden) return;
	form.hidden = true;
	$('answer').value = '';
	syncMore();
}
function badInput() {
	const el = $('answer');
	el.classList.add('is-bad');
	setTimeout(() => el.classList.remove('is-bad'), 700);
	if (session && session.phase === 'reveal') el.placeholder = `Type ${session.current.capital}`;
}
$('answerForm').addEventListener('submit', (e) => {
	e.preventDefault();
	submitAnswer($('answer').value);
	if (session && session.phase === 'reveal' && state.format === 'type') $('answer').placeholder = `Type ${session.current.capital}`;
});

/* ---------------- prompt, stats and panels ---------------- */
function fmtTime(ms) {
	const s = Math.floor(ms / 1000);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fitName() {
	const el = $('pName');
	el.style.fontSize = '';
	el.style.whiteSpace = 'nowrap';
	const base = parseFloat(getComputedStyle(el).fontSize) || 28;
	el.style.lineHeight = (base * 1.1).toFixed(1) + 'px';
	const avail = el.clientWidth;
	if (!avail) return;
	let size = base;
	for (let i = 0; i < 5 && el.scrollWidth > avail + 1 && size > base * 0.55; i++) {
		size = Math.max(base * 0.55, size * (avail / el.scrollWidth) * 0.98);
		el.style.fontSize = size.toFixed(1) + 'px';
	}
	if (el.scrollWidth > avail + 1) el.style.whiteSpace = 'normal';
}
function setTip(text) {
	const t = $('pTip');
	t.hidden = !text;
	t.textContent = text || '';
}
function renderPrompt() {
	renderPromptText();
	syncMore();
	fitName();
}
// Show the panel under the prompt card when it has something in it
function syncMore() {
	const any = !$('pTip').hidden || !$('answerForm').hidden || !$('review').hidden;
	$('pMore').hidden = !any;
	$('prompt').classList.toggle('has-more', any);
}
function renderPromptText() {
	const pr = $('prompt');
	pr.classList.toggle('is-reveal', !!session && session.phase === 'reveal' && !review);
	const reg = regionLabel();
	$('review').hidden = !review;
	$('pBarWrap').classList.toggle('is-off', !!review);
	renderDock();
	if (state.mode === 'study') {
		if (!study || !study.items.length) {
			$('pEyebrow').textContent = 'Study';
			$('pName').textContent = 'Nothing to study here';
			$('pMeta').textContent = reg;
			setTip('');
			return;
		}
		const c = study.items[study.index];
		$('pEyebrow').textContent = `Study · ${reg}`;
		$('pName').textContent = `${c.name}: ${c.capital}`;
		$('pMeta').textContent = `${study.index + 1} of ${study.items.length} · ← → to move, or click any country`;
		setTip(c.note || '');
		$('pBar').style.width = ((100 * (study.index + 1)) / study.items.length).toFixed(1) + '%';
		return;
	}
	setTip('');
	if (!session) return;
	if (!session.total) {
		$('pEyebrow').textContent = state.mode === 'test' ? 'Test' : 'Practice';
		$('pName').textContent = 'No countries in this selection';
		$('pMeta').textContent = reg;
		return;
	}
	if (review) {
		$('pEyebrow').textContent = `${state.mode === 'test' ? 'Test complete' : 'Set learned'} · ${reg}`;
		$('pName').textContent = `${review.ok} / ${session.total}`;
		$('pMeta').textContent = `${review.acc}% accuracy · ${fmtTime(review.ms)} · best ${review.best.score}/${review.best.total}`;
		return;
	}
	const cur = session.current;
	if (!cur) {
		$('pEyebrow').textContent = state.mode === 'test' ? 'Test finished' : 'Set learned';
		$('pName').textContent = `${session.total - session.everMissed.size} of ${session.total}`;
	} else if (state.format === 'click') {
		if (session.phase === 'reveal') {
			$('pEyebrow').textContent = 'Here it is. Click the glowing country';
			$('pName').textContent = cur.capital;
			setTip(`${cur.capital} is the capital of ${cur.name}.${cur.note ? ' ' + cur.note : ''}`);
		} else {
			$('pEyebrow').textContent = 'Click the country whose capital is';
			$('pName').textContent = cur.capital;
		}
	} else if (session.phase === 'reveal') {
		$('pEyebrow').textContent = `The capital of ${cur.name} is`;
		$('pName').textContent = cur.capital;
		setTip(`Type it to carry on.${cur.note ? ' ' + cur.note : ''}`);
	} else {
		$('pEyebrow').textContent = 'What’s the capital of';
		$('pName').textContent = cur.name;
	}
	const answered = session.total - session.queue.length - (cur ? 1 : 0);
	$('pMeta').textContent = `${reg} · ${state.mode === 'test' ? `${answered}/${session.total} answered` : `${session.done}/${session.total} learned`}`;
	const frac = state.mode === 'test' ? answered / session.total : session.done / session.total;
	$('pBar').style.width = (100 * frac).toFixed(1) + '%';
}
let promptTimer = 0;
function pulsePrompt(kind) {
	const pr = $('prompt');
	pr.classList.remove('is-ok', 'is-bad');
	pr.classList.add(kind === 'ok' ? 'is-ok' : 'is-bad');
	clearTimeout(promptTimer);
	promptTimer = setTimeout(() => pr.classList.remove('is-ok', 'is-bad'), 600);
}
function renderStats() {
	const s = session;
	$('sAcc').textContent = s && s.attempts ? Math.round((100 * s.correct) / s.attempts) + '%' : '–';
	$('sStreak').textContent = s ? s.streak : 0;
	if (!s) $('sTime').textContent = '0:00';
}
setInterval(() => {
	if (session && !session.end && !pendingConfirm) $('sTime').textContent = fmtTime(performance.now() - session.start);
}, 250);
function renderRail() {
	const title = document.createElement('div');
	title.className = 'rail-title';
	title.textContent = 'Study one region at a time';
	const kids = [title];
	const button = (r, sub) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.dataset.region = r.key;
		if (sub) b.className = 'sub';
		b.setAttribute('aria-pressed', String(state.region === r.key));
		const l = document.createElement('span');
		l.textContent = r.label;
		const n = document.createElement('em');
		n.textContent = COUNTRIES.filter((c) => inRegion(c, r.key)).length;
		b.append(l, n);
		return b;
	};
	// the chosen continent (or the continent of the chosen subregion) lists its subregions under it
	const open = REGION[state.region].parent || state.region;
	for (const r of REGIONS) {
		kids.push(button(r, false));
		if (r.key === open) for (const s of SUBREGIONS) if (s.parent === r.key) kids.push(button(s, true));
	}
	$('rail').replaceChildren(...kids);
	const rail = $('rail'), sel = rail.querySelector('[aria-pressed="true"]');
	if (sel && rail.scrollWidth > rail.clientWidth) rail.scrollLeft = Math.max(0, sel.offsetLeft - 24);
}
$('rail').addEventListener('click', (e) => {
	const b = e.target.closest('button[data-region]');
	if (!b) return;
	const key = b.dataset.region;
	guardTest(key === state.region ? 'Restarting' : `Switching to ${regionLabel(key)}`, () => {
		state.region = key;
		store.set('region', key);
		renderRail();
		frameRegion();
		startSession();
	});
});
function renderZoom() {
	const grid = $('zoomGrid');
	if (!grid.children.length) {
		ZOOM_KEYS.forEach((k, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'zchip';
			b.dataset.area = k;
			const l = document.createElement('span');
			l.textContent = AREAS[k].label;
			const kb = document.createElement('kbd');
			kb.textContent = String((i + 1) % 10);
			b.append(l, kb);
			grid.append(b);
		});
	}
	for (const b of grid.children) b.setAttribute('aria-pressed', String(state.zoomArea === b.dataset.area));
}
$('zoomGrid').addEventListener('click', (e) => {
	const b = e.target.closest('[data-area]');
	if (!b) return;
	frameArea(b.dataset.area);
	closeViewSheetOnPhone();
});
const MODE_HINT = {
	study: 'Step through each country with the arrows, or click any country to see its capital. No score.',
	practice: 'Misses come back until you get them right. Countries you’ve missed before come up first.',
	test: 'Every country in the region once, timed. Your best score is saved for each region.',
};
const FORMAT_HINT = {
	click: 'You get a capital; click its country. Small countries have a ring you can click.',
	type: 'A country lights up; type its capital. Accents don’t matter, and a small spelling slip still counts.',
};
function renderSegs() {
	for (const [id, v] of [['modeSeg', state.mode], ['formatSeg', state.format], ['viewSeg', state.view]]) {
		for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
	}
	$('modeHint').textContent = MODE_HINT[state.mode];
	$('formatHint').textContent = FORMAT_HINT[state.format];
	for (const b of $('levelSeg').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === state.level));
	$('levelHint').textContent = LEVEL_HINT[state.format][state.level];
	$('levelBox').hidden = state.mode === 'study';
	$('searchBox').hidden = state.mode !== 'study';
	renderDock();
	$('keysHint').innerHTML =
		'<kbd>←</kbd><kbd>→</kbd> previous / next · <kbd>1</kbd>–<kbd>0</kbd> zoom · <kbd>+</kbd><kbd>−</kbd> zoom in / out · <kbd>Esc</kbd> back to the region · <kbd>G</kbd> globe / flat map · <kbd>V</kbd> voice · <kbd>C</kbd> clean view';
}
const LEVEL_HINT = {
	click: {
		easy: 'Countries you’ve answered stay green or red, and a wrong click tells you which country it was.',
		hard: 'Clicks flash green or red, but nothing stays coloured until the end and wrong clicks aren’t named: each question stands on its own.',
	},
	type: {
		easy: 'Guess as often as you like, skip back and forth between countries (Enter with nothing typed skips), or give up to see the answer.',
		hard: 'One try per country, spelled right (accents and capitals don’t matter). Enter with nothing typed gives up.',
	},
};
// Bottom buttons: Previous / Next in Study; Back / Skip / Give up for Easy typing; Show me (or Skip) otherwise
function renderDock() {
	const study = state.mode === 'study', nav = typeEasy() && !review;
	$('prevBtn').hidden = !(study || nav);
	$('nextBtn').hidden = !(study || nav);
	$('prevBtn').textContent = nav ? '← Back' : '← Previous';
	$('nextBtn').textContent = nav ? 'Skip →' : 'Next →';
	$('giveUpBtn').hidden = !nav;
	$('skipBtn').hidden = study || nav || !!review;
	$('skipBtn').textContent = state.mode === 'test' ? 'Skip' : 'Show me';
}
function renderBest() {
	const el = $('best');
	if (state.mode === 'study') {
		el.textContent = '';
		return;
	}
	const b = store.get('best', {})[bestKey()];
	if (!b) {
		el.textContent = 'No saved result for this selection yet.';
		return;
	}
	el.innerHTML = `Best here: <b>${b.score}/${b.total}</b> in <b>${fmtTime(b.ms)}</b>`;
}
function renderAll() {
	renderSegs();
	renderBest();
	renderPrompt();
	renderStats();
	invalidate();
}
function setMode(m, restart = true) {
	state.mode = m;
	store.set('mode', m);
	renderSegs();
	renderBest();
	if (restart) startSession();
}
function setFormat(f) {
	state.format = f;
	store.set('format', f);
	renderSegs();
	renderBest();
	startSession();
}
function setView(v) {
	if (v === state.view) return;
	// keep the same spot and roughly the same scale when switching between globe and flat map
	cancelFly();
	cam.zoom *= baseScale(state.view) / baseScale(v);
	state.view = v;
	store.set('view', v);
	constrain();
	updateProj();
	renderSegs();
	invalidate();
}
$('modeSeg').addEventListener('click', (e) => {
	const b = e.target.closest('button[data-v]');
	if (!b || b.dataset.v === state.mode) return;
	guardTest('Changing mode', () => setMode(b.dataset.v));
});
$('formatSeg').addEventListener('click', (e) => {
	const b = e.target.closest('button[data-v]');
	if (!b || b.dataset.v === state.format) return;
	guardTest('Changing the question type', () => setFormat(b.dataset.v));
});
$('viewSeg').addEventListener('click', (e) => {
	const b = e.target.closest('button[data-v]');
	if (b) setView(b.dataset.v);
});
$('restartBtn').addEventListener('click', () => guardTest('Restarting', () => startSession()));
$('prevBtn').addEventListener('click', () => (state.mode === 'study' ? studyStep(-1) : moveQuestion(-1)));
$('nextBtn').addEventListener('click', () => (state.mode === 'study' ? studyStep(1) : moveQuestion(1)));
$('skipBtn').addEventListener('click', skip);
$('giveUpBtn').addEventListener('click', skip);
$('levelSeg').addEventListener('click', (e) => {
	const b = e.target.closest('button[data-v]');
	if (!b || b.dataset.v === state.level) return;
	guardTest('Changing the difficulty', () => {
		state.level = b.dataset.v;
		store.set('level', state.level);
		renderSegs();
		renderBest();
		startSession();
	});
});
$('zoomInBtn').addEventListener('click', () => {
	const f = free();
	zoomAround(f.cx, f.cy, 1.7);
});
$('zoomOutBtn').addEventListener('click', () => {
	const f = free();
	zoomAround(f.cx, f.cy, 1 / 1.7);
});
$('resetBtn').addEventListener('click', () => {
	frameRegion();
	closeViewSheetOnPhone();
});

/* ---------- search (study) ---------- */
$('search').addEventListener('input', () => {
	const q = norm($('search').value);
	const list = $('searchList');
	if (!q) {
		list.replaceChildren();
		return;
	}
	const hits = COUNTRIES.filter((c) => [c.name, c.capital, ...(c.alts || [])].some((s) => norm(s).includes(q)))
		.sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)) || a.name.localeCompare(b.name))
		.slice(0, 12);
	list.replaceChildren(
		...hits.map((c) => {
			const li = document.createElement('li');
			const b = document.createElement('button');
			b.type = 'button';
			const a = document.createElement('span');
			a.textContent = c.name;
			const d = document.createElement('span');
			d.textContent = c.capital;
			b.append(a, d);
			b.addEventListener('click', () => {
				if (!inScope(c)) {
					state.region = 'world';
					store.set('region', 'world');
					renderRail();
				}
				startStudy(c.id);
				showCountry(c, false);
				renderAll();
				setSheet(null);
			});
			li.append(b);
			return li;
		}),
	);
});

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg, kind) {
	const t = $('toast');
	t.textContent = msg;
	t.className = 'toast show' + (kind ? ' ' + kind : '');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
}

/* ---------- phones: settings and view are bottom sheets ---------- */
function setSheet(which) {
	document.body.classList.toggle('sheet-open', which === 'settings');
	document.body.classList.toggle('view-open', which === 'view');
}
function closeViewSheetOnPhone() {
	if (narrow()) setSheet(null);
}
$('settingsBtn').addEventListener('click', () => setSheet(document.body.classList.contains('sheet-open') ? null : 'settings'));
$('viewBtn').addEventListener('click', () => setSheet(document.body.classList.contains('view-open') ? null : 'view'));
$('closeSheet').addEventListener('click', () => setSheet(null));
$('closeView').addEventListener('click', () => setSheet(null));

/* ---------- clean view (for recording) ---------- */
function setClean(on) {
	state.clean = on;
	document.body.classList.toggle('clean', on);
	setSheet(null);
	resize();
}
$('cleanBtn').addEventListener('click', () => setClean(true));
$('cleanExit').addEventListener('click', () => setClean(false));

/* ---------------- confirm before throwing away a test in progress ---------------- */
function testInProgress() {
	return state.mode === 'test' && !!session && !session.end && !!session.current && session.attempts > 0;
}
let pendingConfirm = null;
function guardTest(what, action) {
	if (!testInProgress()) {
		action();
		return;
	}
	const answered = session.total - session.queue.length - 1;
	$('confirmMsg').textContent = `You’ve answered ${answered} of ${session.total} (${regionLabel()}). ${what} ends this test, and it won’t count toward your best score.`;
	pendingConfirm = { action, t0: performance.now() };
	$('confirm').hidden = false;
	$('confirmNo').focus();
}
function closeConfirm(go) {
	const p = pendingConfirm;
	if (!p) return;
	pendingConfirm = null;
	$('confirm').hidden = true;
	if (go) {
		setSheet(null);
		p.action();
	} else if (session && !session.end) session.start += performance.now() - p.t0;
}
$('confirmYes').addEventListener('click', () => closeConfirm(true));
$('confirmNo').addEventListener('click', () => closeConfirm(false));
$('confirm').addEventListener('click', (e) => {
	if (e.target === $('confirm')) closeConfirm(false);
});
$('homeLink').addEventListener('click', (e) => {
	if (!testInProgress()) return;
	e.preventDefault();
	const href = e.currentTarget.href;
	guardTest('Leaving this page', () => {
		location.href = href;
	});
});

/* ---------------- keyboard ---------------- */
document.addEventListener('keydown', (e) => {
	if (pendingConfirm) {
		if (e.key === 'Escape') closeConfirm(false);
		return;
	}
	const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
	if (e.key === 'Escape') {
		if (document.body.classList.contains('sheet-open') || document.body.classList.contains('view-open')) setSheet(null);
		else if (state.clean) setClean(false);
		else if (!typing) frameRegion();
		return;
	}
	if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
	const f = free();
	if (e.key === 'ArrowRight') studyStep(1);
	else if (e.key === 'ArrowLeft') studyStep(-1);
	else if (/^[0-9]$/.test(e.key)) {
		const k = ZOOM_KEYS[(Number(e.key) + 9) % 10];
		if (k) frameArea(k);
	} else if (e.key === '+' || e.key === '=') zoomAround(f.cx, f.cy, 1.7);
	else if (e.key === '-' || e.key === '_') zoomAround(f.cx, f.cy, 1 / 1.7);
	else if (e.key === 'g' || e.key === 'G') setView(state.view === 'globe' ? 'map' : 'globe');
	else if (e.key === 'v' || e.key === 'V') setVoice(!voice.on);
	else if (e.key === 'c' || e.key === 'C') setClean(!state.clean);
	else if (e.key === 'r' || e.key === 'R') frameRegion();
	else return;
	e.preventDefault();
});

/* ---------------- voice commands ---------------- */
// Say a place: a region ("Europe"), a subregion or area ("West Africa", "Caribbean"), any country ("Japan"),
// "globe" / "flat map", "zoom in" / "zoom out", or "world". A command only fires when the whole
// phrase is a command. Capitals aren't commands, so voice can't answer a question for you.
// Uses the browser's own speech recognition (Chrome, Edge, Safari; not Firefox).
const AREA_WORDS = {
	world: ['world', 'whole world', 'the world', 'earth', 'everything', 'whole map'],
	europe: ['europe'],
	asia: ['asia'],
	'north-america': ['north america'],
	'south-america': ['south america'],
	africa: ['africa'],
	oceania: ['oceania', 'australasia'],
	caribbean: ['caribbean', 'caribbean islands', 'west indies', 'carribean'],
	'middle-east': ['middle east', 'mideast', 'near east'],
	pacific: ['pacific', 'pacific islands', 'south pacific', 'pacific ocean'],
	'central-america': ['central america'],
	'north-central-america': ['north and central america', 'north central america', 'north america and central america'],
	'northern-europe': ['northern europe', 'north europe'],
	'southern-europe': ['southern europe', 'south europe'],
	'south-central-asia': ['south and central asia', 'south central asia', 'southern and central asia', 'central and south asia'],
	'australia-melanesia': ['australia and melanesia', 'australia melanesia'],
	'micronesia-polynesia': ['micronesia and polynesia', 'micronesia polynesia'],
	'lesser-antilles': ['lesser antilles', 'eastern caribbean', 'windward islands', 'leeward islands'],
	'southeast-asia': ['southeast asia', 'south east asia'],
	'east-asia': ['east asia', 'far east'],
	'south-asia': ['south asia', 'indian subcontinent'],
	'central-asia': ['central asia', 'the stans'],
	'persian-gulf': ['persian gulf', 'gulf', 'arabian gulf', 'gulf states'],
	balkans: ['balkans', 'balkan'],
	scandinavia: ['scandinavia', 'nordics', 'nordic countries'],
	'western-europe': ['western europe', 'west europe'],
	'eastern-europe': ['eastern europe', 'east europe'],
	'north-africa': ['north africa', 'northern africa'],
	'west-africa': ['west africa', 'western africa'],
	'central-africa': ['central africa'],
	'east-africa': ['east africa', 'eastern africa', 'horn of africa'],
	'southern-africa': ['southern africa'],
	polynesia: ['polynesia'],
	melanesia: ['melanesia'],
	'micronesia-region': ['micronesia region', 'micronesian islands'],
};
const COUNTRY_WORDS = {
	USA: ['usa', 'us', 'america', 'united states of america', 'the states'],
	GBR: ['uk', 'britain', 'great britain', 'england', 'scotland', 'wales', 'united kingdom'],
	CZE: ['czech republic'],
	CIV: ['ivory coast', 'cote divoire', 'cote d ivoire'],
	COD: ['democratic republic of the congo', 'drc', 'congo kinshasa', 'dr congo', 'democratic republic of congo'],
	COG: ['congo', 'republic of congo', 'congo brazzaville'],
	MMR: ['burma'],
	SWZ: ['swaziland'],
	TLS: ['east timor'],
	NLD: ['holland'],
	MKD: ['macedonia'],
	CPV: ['cape verde'],
	VAT: ['vatican', 'holy see'],
	FSM: ['federated states of micronesia'],
	ARE: ['uae', 'emirates'],
	KOR: ['korea'],
	RUS: ['russian federation'],
	TUR: ['turkiye'],
	BIH: ['bosnia'],
	TTO: ['trinidad'],
	ATG: ['antigua'],
	KNA: ['saint kitts', 'st kitts'],
	VCT: ['saint vincent', 'st vincent'],
	LCA: ['st lucia'],
	STP: ['sao tome'],
	PSX: ['palestinian territories', 'west bank'],
	CAF: ['central african republic', 'car'],
	SLB: ['solomons'],
	MHL: ['marshalls'],
	NZL: ['nz'],
	PNG: ['png'],
	DOM: ['dominican republic'],
	PHL: ['philippines'],
};
const voiceForm = (s) => norm(s).replace(/s$/, '');
const VOICE_LOOKUP = new Map();
function buildVoice() {
	for (const [k, list] of Object.entries(AREA_WORDS)) for (const w of list) VOICE_LOOKUP.set(voiceForm(w), { area: k });
	for (const c of COUNTRIES) VOICE_LOOKUP.set(voiceForm(c.name), { country: c.id });
	for (const [id, list] of Object.entries(COUNTRY_WORDS)) for (const w of list) VOICE_LOOKUP.set(voiceForm(w), { country: id });
	for (const w of ['globe', 'the globe', '3d', 'three d', 'globe view', 'sphere', 'ball']) VOICE_LOOKUP.set(voiceForm(w), { view: 'globe' });
	for (const w of ['map', 'flat map', 'flat', '2d', 'two d', 'map view', 'flat view']) VOICE_LOOKUP.set(voiceForm(w), { view: 'map' });
	for (const w of ['zoom out', 'back', 'reset view', 'reset']) VOICE_LOOKUP.set(voiceForm(w), { zoom: 'out' });
	for (const w of ['zoom in', 'closer', 'zoom closer']) VOICE_LOOKUP.set(voiceForm(w), { zoom: 'in' });
}
const VOICE_FILLER = new Set(['ok', 'okay', 'um', 'uh', 'so', 'now', 'and', 'hey', 'alright']);
const VOICE_PREFIX = new Set(['zoom', 'in', 'on', 'to', 'into', 'onto', 'show', 'me', 'go', 'view', 'look', 'at', 'focus', 'the', 'take', 'switch', 'fly', 'move']);
function parseVoice(raw) {
	const w = String(raw).toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
	while (w.length && VOICE_FILLER.has(w[0])) w.shift();
	while (w.length && (w[w.length - 1] === 'please' || w[w.length - 1] === 'thanks')) w.pop();
	if (!w.length) return null;
	const direct = VOICE_LOOKUP.get(voiceForm(w.join(' ')));
	if (direct) return direct;
	while (w.length > 1 && VOICE_PREFIX.has(w[0])) w.shift();
	if (w.length > 1 && w[w.length - 1] === 'view') w.pop();
	return VOICE_LOOKUP.get(voiceForm(w.join(' '))) || null;
}
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const VOICE_ONE_SHOT = /^((?!chrome|chromium|crios|android|edg|fxios).)*safari/i.test(navigator.userAgent);
const voice = { on: false, rec: null, startedAt: 0, gotResult: false, quickEnds: 0, fired: new Map(), steady: 0, restart: 0 };
function voiceStatus(text, kind) {
	const el = $('voiceHeard');
	el.textContent = text;
	el.className = 'voice-heard' + (kind ? ' ' + kind : '');
	el.hidden = !text;
}
function setVoice(on, reason) {
	if (on && !SpeechRec) {
		toast('Voice commands need Chrome, Edge or Safari. Firefox doesn’t support speech recognition.', 'bad');
		return;
	}
	voice.on = on;
	$('voiceBtn').setAttribute('aria-pressed', String(on));
	clearTimeout(voice.restart);
	clearTimeout(voice.steady);
	if (on) {
		voice.quickEnds = 0;
		voiceStatus('Listening… say “Caribbean”, “Japan”, “globe” or “map”');
		voiceStart();
	} else {
		const rec = voice.rec;
		voice.rec = null;
		if (rec) {
			try {
				rec.abort();
			} catch (e) {
				/* already stopped */
			}
		}
		voiceStatus(reason || '', reason ? 'bad' : '');
		if (reason && (state.clean || narrow())) toast(reason, 'bad');
	}
}
function voiceStart() {
	if (!voice.on || voice.rec || document.hidden) return;
	const rec = new SpeechRec();
	rec.lang = /^en\b/i.test(navigator.language || '') ? navigator.language : 'en-US';
	rec.continuous = !VOICE_ONE_SHOT;
	rec.interimResults = true;
	rec.maxAlternatives = 3;
	voice.rec = rec;
	voice.fired = new Map();
	voice.startedAt = performance.now();
	voice.gotResult = false;
	rec.onresult = (e) => {
		if (voice.rec === rec) onVoiceResult(e, rec);
	};
	rec.onerror = (e) => {
		if (voice.rec !== rec) return;
		const stop = {
			'not-allowed': 'Microphone blocked. Allow it from the icon in the address bar.',
			'service-not-allowed': 'Speech recognition isn’t allowed on this page.',
			'audio-capture': 'No microphone found. Plug one in, then turn Voice on again.',
			'language-not-supported': 'Speech recognition doesn’t support this browser’s language.',
		}[e.error];
		if (stop) {
			setVoice(false, stop);
			return;
		}
		if (e.error === 'network') voiceStatus('Can’t reach the speech service. Retrying…', 'bad');
	};
	rec.onend = () => {
		if (voice.rec !== rec) return;
		voice.rec = null;
		if (!voice.on) return;
		const quick = !voice.gotResult && performance.now() - voice.startedAt < 1500;
		voice.quickEnds = quick ? voice.quickEnds + 1 : 0;
		voice.restart = setTimeout(voiceStart, quick ? Math.min(8000, 250 * 2 ** voice.quickEnds) : 60);
	};
	try {
		rec.start();
	} catch (err) {
		voice.rec = null;
		voice.restart = setTimeout(voiceStart, 500);
	}
}
function onVoiceResult(e, rec) {
	voice.gotResult = true;
	for (let i = e.resultIndex; i < e.results.length; i++) {
		const r = e.results[i];
		const alts = [];
		for (let j = 0; j < r.length; j++) alts.push(String(r[j].transcript || '').trim());
		const text = alts[0] || '';
		if (!text) continue;
		let cmd = null;
		for (const a of alts) if ((cmd = parseVoice(a))) break;
		const prev = voice.fired.get(i);
		clearTimeout(voice.steady);
		const same = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);
		if (r.isFinal) {
			if (cmd && !same(prev, cmd)) voiceDo(cmd, text);
			else if (!cmd && !prev) voiceStatus(`“${text}” isn’t a command`);
			voice.fired.set(i, cmd || prev || { none: true });
		} else if (!prev) {
			voiceStatus(`“${text}”…`);
			if (cmd)
				voice.steady = setTimeout(() => {
					if (voice.rec === rec && !voice.fired.has(i)) {
						voice.fired.set(i, cmd);
						voiceDo(cmd, text);
					}
				}, 350);
		}
	}
}
function voiceDo(cmd, text) {
	if (pendingConfirm) return;
	let what;
	if (cmd.area) {
		frameArea(cmd.area);
		what = AREAS[cmd.area].label;
	} else if (cmd.country) {
		const c = BY_ID.get(cmd.country);
		state.zoomArea = null;
		renderZoom();
		flyTo(camForCountry(c));
		what = c.name;
	} else if (cmd.view) {
		setView(cmd.view);
		what = cmd.view === 'globe' ? 'Globe' : 'Flat map';
	} else if (cmd.zoom === 'in') {
		const f = free();
		zoomAround(f.cx, f.cy, 1.8);
		what = 'Zoom in';
	} else {
		frameRegion();
		what = regionLabel();
	}
	voiceStatus(`“${text}” → ${what}`, 'ok');
	if (state.clean || narrow()) toast(what);
}
$('voiceBtn').addEventListener('click', () => setVoice(!voice.on));
document.addEventListener('visibilitychange', () => {
	if (!document.hidden && voice.on && !voice.rec) voiceStart();
});

/* ---------------- sizing ---------------- */
function resize() {
	const ins = measureInsets();
	const sizeChanged = ins.w !== layout.w || ins.h !== layout.h;
	const sameArea = !sizeChanged && ['top', 'bottom', 'left', 'right'].every((k) => Math.abs(ins[k] - layout[k]) < 1);
	Object.assign(layout, ins);
	if (sizeChanged) sizeCanvases();
	fitName();
	if (sameArea) return;
	computeMapBase();
	constrain();
	updateProj();
	if (sizeChanged && COUNTRIES.length) {
		// setting a canvas's size wipes it: draw again straight away so nothing blinks
		baseDirty = false;
		drawBase();
		drawFx(performance.now());
	}
	invalidate();
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) {
	let r = 0;
	const ro = new ResizeObserver(() => {
		cancelAnimationFrame(r);
		r = requestAnimationFrame(resize);
	});
	['prompt', 'rail', 'viewCard', 'panel'].forEach((id) => ro.observe($(id)));
	ro.observe(document.querySelector('.dock'));
}

/* ---------------- boot ---------------- */
async function boot() {
	const bar = $('loadBar');
	const [countries, xlow] = await Promise.all([
		fetch('data/countries.json').then((r) => {
			if (!r.ok) throw new Error('HTTP ' + r.status);
			return r.json();
		}),
		fetch('data/map-xlow.json').then((r) => {
			if (!r.ok) throw new Error('HTTP ' + r.status);
			return r.json();
		}),
	]);
	bar.value = 0.8;
	COUNTRIES = countries;
	for (const c of COUNTRIES) {
		BY_ID.set(c.id, c);
		for (const s of [c.capital, ...(c.alts || [])]) if (!CAPITAL_INDEX.has(norm(s))) CAPITAL_INDEX.set(norm(s), c);
	}
	LOD.xlow = useTopology(xlow);
	buildMeta(LOD.xlow);
	buildVoice();
	renderRail();
	renderZoom();
	renderSegs();
	resize();
	Object.assign(cam, camForBox(AREAS[state.region].box));
	state.zoomArea = state.region;
	renderZoom();
	updateProj();
	$('loading').hidden = true;
	startSession();
	// more detail in the background
	const more = (name) =>
		fetch(`data/map-${name}.json`)
			.then((r) => r.json())
			.then((t) => {
				LOD[name] = useTopology(t);
				invalidate();
			});
	more('low')
		.then(() => more('mid'))
		.then(() => refreshMeta(LOD.mid))
		.catch(() => {});
	if (location.hash === '#selftest') {
		window.__capitalAtlas = {
			state, cam, COUNTRIES, BY_ID, META, LOD, pickAt, setView, setMode, setFormat, startSession, submitAnswer, onMapClick, frameArea,
			parseVoice, checkAnswer, free, getSession: () => session, getStudy: () => study, getReview: () => review, project: (ll) => projectPoint(proj, ll),
			camForCountry, screen, geoContains, bestFeats,
			prof: (c, fast) => {
				Object.assign(cam, c);
				constrain();
				updateProj();
				moving = !!fast;
				slowDevice = !!fast;
				const t0 = performance.now();
				drawBase();
				const t1 = performance.now();
				drawFx(performance.now());
				const t2 = performance.now();
				// path building alone, no pixels
				const nul = { beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {} };
				const pth = geoPath(proj, nul), feats = LOD[lodName(proj)];
				const vis = visibleIndices(proj);
				let pts = 0;
				for (const i of vis) eachPoint(feats[i].geometry, () => pts++);
				for (const i of vis) pth(feats[i]);
				const t3 = performance.now();
				const r = { base: t1 - t0, fx: t2 - t1, pathOnly: t3 - t2, lod: lodName(proj), vis: vis.length, pts };
				moving = false;
				return r;
			},
			setCam: (c) => {
				Object.assign(cam, c);
				constrain();
				updateProj();
				drawBase();
				drawFx(performance.now());
			},
			flyNow: () => {
				if (fly) {
					fly.t0 = -1e9;
					stepFly(performance.now());
				}
			},
		};
	}
}
boot().catch((err) => {
	console.error(err);
	$('loadMsg').textContent = 'The world map didn’t load. Check your connection and reload the page.';
});
