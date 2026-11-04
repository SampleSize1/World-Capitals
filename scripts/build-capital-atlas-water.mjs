// Build the rivers and lakes for World Capitals (public/tools/capital-atlas/data/water-*.json)
// from Natural Earth's 1:10m lakes and rivers (public domain, naturalearthdata.com).
//
// The site doesn't depend on these packages, so run it from a scratch folder:
//   mkdir /tmp/cw && cd /tmp/cw && npm i topojson-server@3 topojson-simplify@3 topojson-client@3 polylabel@1
//   curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson
//   curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson
//   node /path/to/website/scripts/build-capital-atlas-water.mjs . /path/to/website/public/tools/capital-atlas/data
//
// Keeps the big lakes and major rivers, plus smaller ones that are worth knowing for a capital
// (the Thames, the Tiber, Lake Managua...). Each shape carries:
//   n  = English name for labels and clicks (absent: drawn, but no label)
//   mz = zoom it appears at, ml = zoom its label appears at (Natural Earth's web-map zoom levels)
//   r  = size class, 0 = biggest (Natural Earth's scalerank)
//   lp = where to put the label: one point inside a lake, a few points along a river
// Two files: water-low (world and continents) and water-high (zoomed in).
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(process.cwd() + '/');
const { topology } = require('topojson-server');
const { presimplify, simplify, sphericalTriangleArea, quantile } = require('topojson-simplify');
const { quantize } = require('topojson-client');
const polylabelPkg = require('polylabel');
const polylabel = polylabelPkg.default || polylabelPkg;

const [srcDir, outDir] = process.argv.slice(2);
const read = (f) => JSON.parse(fs.readFileSync(`${srcDir}/${f}`, 'utf8'));
const round = (v) => Math.round(v * 1000) / 1000;

/* ---------- lakes ---------- */
// smaller lakes kept anyway: next to a capital, or famous
const KEEP_LAKES = new Set([
	'Lake Managua', 'Lake Kariba', 'Lake Nasser', 'Lake Volta', 'Lake Kyoga', 'Lake Constance', 'Lake Balaton', 'Lake Sevan',
	'Lake Skadar', 'Lake Assal', 'Lake Toba', 'Gatun Lake', 'Itaipu Reservoir', 'Lake Como', 'Lake Garda', 'Lake Poopó', 'Lake Biwa',
	'Dongting Lake', 'Lake Enriquillo', 'Lake Kivu', 'Lake Geneva', 'Tonlé Sap',
]);
const BIG_RESERVOIRS = new Set(['Lake Nasser', 'Lake Volta', 'Lake Kariba']);
const LAKE_NAMES = {
	'Lago de Nicaragua': 'Lake Nicaragua', 'Lago Titicaca': 'Lake Titicaca', 'Lago de Managua': 'Lake Managua',
	Bodensee: 'Lake Constance', 'Danau Toba': 'Lake Toba', 'Biwa Ko': 'Lake Biwa', 'Lago di Como': 'Lake Como',
	'Lago di Garda': 'Lake Garda', 'Lago Gatun': 'Gatun Lake', 'Represa Itaipu': 'Itaipu Reservoir', 'Lago Enriquillo': 'Lake Enriquillo',
	'Lago Poopó': 'Lake Poopó', 'Qinghai Hu': 'Qinghai Lake', 'Poyang Hu': 'Poyang Lake', 'Tai Hu': 'Lake Tai', 'Dongting Hu': 'Dongting Lake',
	'Khövsgöl Nuur': 'Lake Khövsgöl', "Lake Il'Men'": 'Lake Ilmen', Inarijrvi: 'Inarijärvi', 'Lake Moeru': 'Lake Mweru',
	'Represa de Sobradinho': 'Sobradinho Reservoir', 'Réservoir Manicouagan': 'Manicouagan Reservoir',
	'Réservoir de La Grande 2': 'La Grande 2 Reservoir', 'Réservoir de La Grande 3': 'La Grande 3 Reservoir',
	'Buhayrat ath Tharthar': 'Lake Tharthar', 'Sarygamysh Köli': 'Lake Sarygamysh',
};
// parts of a bigger lake: drawn, but the big lake's label covers them
const NO_LABEL = /\b(Bay|Channel)$/;
function lakeName(p) {
	let n = (p.label || p.name || '').trim();
	if (!n) return null;
	n = LAKE_NAMES[n] || n;
	if (/^(Lago de |Lago di |Lago |Lac |Ozero )/.test(n)) n = 'Lake ' + n.replace(/^(Lago de |Lago di |Lago |Lac |Ozero )/, '');
	else if (/ (Hu|Nuur)$/.test(n)) n = 'Lake ' + n.replace(/ (Hu|Nuur)$/, '');
	return LAKE_NAMES[n] || n;
}
const lakes = [];
for (const f of read('ne_10m_lakes.geojson').features) {
	const p = f.properties, n = lakeName(p);
	const keep = p.scalerank <= 4 || (n && KEEP_LAKES.has(n));
	if (!keep || !f.geometry) continue;
	const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
	// label inside the biggest part, away from its shores (lon squeezed by latitude so it's roughly true distance)
	let best = null, bestA = -1;
	for (const poly of polys) {
		const r = poly[0];
		let a = 0;
		for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
		if (Math.abs(a) > bestA) {
			bestA = Math.abs(a);
			best = poly;
		}
	}
	const k = Math.cos((best[0].reduce((s, q) => s + q[1], 0) / best[0].length) * (Math.PI / 180));
	const lp = polylabel(best.map((ring) => ring.map(([x, y]) => [x * k, y])), 0.005);
	const props = { mz: p.min_zoom, ml: p.min_label, r: p.scalerank, lp: [round(lp[0] / k), round(lp[1])] };
	if (n && !NO_LABEL.test(n)) props.n = n;
	if (n && KEEP_LAKES.has(n)) {
		// the big reservoirs show from continent zoom, the rest when zoomed in on a region
		const big = BIG_RESERVOIRS.has(n);
		props.mz = Math.min(props.mz, big ? 3.5 : 4.5);
		props.ml = Math.min(props.ml, big ? 4.2 : 5.5);
	}
	lakes.push({ type: 'Feature', properties: props, geometry: f.geometry });
}

/* ---------- rivers ---------- */
// smaller rivers kept anyway, mostly ones a capital sits on; a box where a name is shared
const KEEP_RIVERS = {
	Thames: [-2.5, 51, 1, 52.2], Tiber: [11, 41.5, 13.5, 43.5], Vltava: null, Sava: [13, 44, 21, 46.5], 'Chao Phraya': null,
	Red: [100, 20, 107, 24], Han: [126, 37, 128.6, 38], Yamuna: null, Chari: null, Logone: null, Potomac: [-79, 38, -76.5, 39.8],
	Ottawa: [-80, 45, -73.5, 48], Uruguay: null, Limpopo: null, Okavango: null, Gambia: null, Jordan: [35, 31, 36, 33.5],
	Dniester: null, Prut: null, Morava: null, Maritsa: null, 'Rhône': null, Pilcomayo: null, Kafue: null, Ruvuma: null, Atbara: null,
	Sobat: null, Rufiji: null, Cuanza: null, Helmand: null, Kura: null, Aras: null, Tana: [37, -3, 41, 1], Bermejo: null,
	'White Volta': null,
};
const RIVER_NAMES = {
	Rhein: 'Rhine', Dnepre: 'Dnieper', 'Bénoué': 'Benue', Tajo: 'Tagus', Firat: 'Euphrates', 'Al Furat': 'Euphrates', Dicle: 'Tigris',
	Amazonas: 'Amazon', Huang: 'Yellow', 'Sénégal': 'Senegal', Abay: 'Blue Nile',
};
// most of a line's points inside a [west, south, east, north] box
function inside(coords, b) {
	let n = 0, hit = 0;
	const walk = (c) => {
		if (typeof c[0] === 'number') {
			n++;
			if (c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3]) hit++;
		} else c.forEach(walk);
	};
	walk(coords);
	return hit > n / 2;
}
// points 30%, 50% and 70% along each part of a line, for labels
function alongPoints(geom) {
	const parts = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
	const out = [];
	for (const line of parts) {
		const seg = [];
		let total = 0;
		for (let i = 1; i < line.length; i++) {
			const k = Math.cos(((line[i][1] + line[i - 1][1]) / 2) * (Math.PI / 180));
			const d = Math.hypot((line[i][0] - line[i - 1][0]) * k, line[i][1] - line[i - 1][1]);
			seg.push(d);
			total += d;
		}
		if (total < 0.4) continue;
		for (const t of [0.5, 0.3, 0.7]) {
			let want = total * t, i = 0;
			while (i < seg.length - 1 && want > seg[i]) want -= seg[i++];
			const a = line[i], b = line[i + 1], f = seg[i] ? want / seg[i] : 0;
			out.push([round(a[0] + (b[0] - a[0]) * f), round(a[1] + (b[1] - a[1]) * f)]);
		}
	}
	return out;
}
const rivers = [];
for (const f of read('ne_10m_rivers_lake_centerlines.geojson').features) {
	const p = f.properties;
	if (p.featurecla !== 'River' || !f.geometry) continue;
	let n = (p.name_en || p.name || '').replace(/\s+/g, ' ').trim();
	n = RIVER_NAMES[n] || n;
	const kept = Object.prototype.hasOwnProperty.call(KEEP_RIVERS, n) && (!KEEP_RIVERS[n] || inside(f.geometry.coordinates, KEEP_RIVERS[n]));
	if (p.scalerank > 5 && !kept) continue;
	const props = { mz: p.min_zoom, ml: p.min_label, r: p.scalerank, lp: alongPoints(f.geometry) };
	if (n && n !== '?') props.n = n;
	if (kept) {
		props.mz = Math.min(props.mz, 5);
		props.ml = Math.min(props.ml, 6);
	}
	rivers.push({ type: 'Feature', properties: props, geometry: f.geometry });
}

/* ---------- two levels of detail ---------- */
const topo = presimplify(
	topology({ lakes: { type: 'FeatureCollection', features: lakes }, rivers: { type: 'FeatureCollection', features: rivers } }),
	sphericalTriangleArea,
);
for (const l of [{ name: 'low', keep: 0.12, q: 1e5 }, { name: 'high', keep: 0.6, q: 1e6 }]) {
	const t = simplify(topo, quantile(topo, l.keep));
	t.arcs = t.arcs.map((arc) => arc.map((pt) => [pt[0], pt[1]]));
	const out = quantize(t, l.q);
	const file = `${outDir}/water-${l.name}.json`;
	fs.writeFileSync(file, JSON.stringify(out));
	const pts = out.arcs.reduce((n, a) => n + a.length, 0);
	console.log(`${file}: ${pts} points, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
}
console.log(`${lakes.length} lakes (${lakes.filter((f) => f.properties.n).length} labelled), ${rivers.length} river pieces`);
