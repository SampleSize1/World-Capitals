// Build the map files for Capital Atlas (public/tools/capital-atlas/data/map-*.json)
// from Natural Earth's 1:10m country shapes (public domain, naturalearthdata.com).
//
// The site doesn't depend on these packages, so run it from a scratch folder:
//   mkdir /tmp/ca && cd /tmp/ca && npm i topojson-server@3 topojson-simplify@3 topojson-client@3
//   curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
//   node /path/to/website/scripts/build-capital-atlas-map.mjs ne_10m_admin_0_countries.geojson /path/to/website/public/tools/capital-atlas/data
//
// It writes four levels of detail so the map stays fast: map-xlow and map-low (whole
// world), map-mid (a continent) and map-high (zoomed in: every island, full 10m detail).
// Countries in the quiz (data/countries.json) get their capital's id; everything
// else (territories like Greenland, Antarctica) is drawn but not quizzed.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(process.cwd() + '/');
const { topology } = require('topojson-server');
const { presimplify, simplify, sphericalTriangleArea, quantile } = require('topojson-simplify');
const { quantize } = require('topojson-client');

const [src, outDir] = process.argv.slice(2);
const ne = JSON.parse(fs.readFileSync(src, 'utf8'));
const countries = JSON.parse(fs.readFileSync(`${outDir}/countries.json`, 'utf8'));
const quiz = new Set(countries.map((c) => c.id));
const extraShapes = new Map(); // e.g. Somaliland is drawn as part of Somalia
for (const c of countries) for (const s of c.shapes ?? []) extraShapes.set(s, c.id);

// Overseas parts of France and the Netherlands are their own (not quizzed) areas,
// so clicking French Guiana doesn't count as clicking France.
const overseas = [
	{ of: 'FRA', name: 'French Guiana', box: [-55, 2, -51, 6.5] },
	{ of: 'FRA', name: 'Guadeloupe', box: [-62, 15.8, -60.9, 16.6] },
	{ of: 'FRA', name: 'Martinique', box: [-61.3, 14.3, -60.7, 15] },
	{ of: 'FRA', name: 'Réunion', box: [55, -21.5, 56, -20.8] },
	{ of: 'FRA', name: 'Mayotte', box: [44.9, -13.1, 45.4, -12.5] },
	{ of: 'NLD', name: 'Caribbean Netherlands', box: [-69, 11.9, -62.8, 17.8] },
];

const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const centre = (p) => {
	const r = p[0];
	const xs = r.map((q) => q[0]);
	const ys = r.map((q) => q[1]);
	return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};
const inBox = ([x, y], [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const groups = new Map(); // id -> { props, polygons }
const add = (id, props, ps) => {
	if (!groups.has(id)) groups.set(id, { props, polygons: [] });
	groups.get(id).polygons.push(...ps);
};
for (const f of ne.features) {
	const p = f.properties;
	const a3 = p.ADM0_A3;
	const id = quiz.has(a3) ? a3 : extraShapes.get(a3);
	let ps = polys(f.geometry);
	if (id) {
		for (const o of overseas.filter((o) => o.of === id)) {
			const away = ps.filter((q) => inBox(centre(q), o.box));
			ps = ps.filter((q) => !inBox(centre(q), o.box));
			if (away.length) add(`${id}-${o.name}`, { name: o.name, of: p.SOVEREIGNT }, away);
		}
		add(id, { id }, ps);
	} else {
		add(a3, { name: p.NAME_EN || p.NAME, of: p.TYPE === 'Sovereign country' ? null : p.SOVEREIGNT }, ps);
	}
}

// Seams in the source data, cleaned up so they don't show as stray lines:
// - Holes no other country fills: two slivers where Egypt meets the Hala'ib Triangle. Filled.
// - A hole the same country fills with a piece of its own: Baikonur (leased to Russia) in
//   Kazakhstan. Hole and piece merged, so no ring is drawn round it.
// - A hairline spike in Egypt's coastline along the old Hala'ib line. Removed.
// Holes another country fills (Lesotho, the Vatican, San Marino...) stay.
const ringBox = (r) => {
	const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]);
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const sameBox = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 0.05);
for (const [key, g] of groups) {
	const own = g.polygons.map((p) => ringBox(p[0]));
	const merged = new Set();
	g.polygons = g.polygons.map((p) => {
		const keep = p.slice(1).filter((hole) => {
			const b = ringBox(hole);
			const mine = own.findIndex((ob) => sameBox(b, ob));
			if (mine >= 0) {
				merged.add(mine);
				console.log(`merged a piece of ${key} into the shape round it at ${b.map((v) => v.toFixed(2)).join(', ')}`);
				return false;
			}
			const other = [...groups].some(([k, og]) => k !== key && og.polygons.some((q) => sameBox(b, ringBox(q[0]))));
			if (!other) console.log(`filled a gap in ${key} at ${b.map((v) => v.toFixed(2)).join(', ')}`);
			return other;
		});
		return [p[0], ...keep];
	});
	g.polygons = g.polygons.filter((p, i) => !merged.has(i));
}
const HALAIB_SEAM = [34.9, 22.4, 35.8, 23.3];
for (const p of groups.get('EGY').polygons) {
	const r = p[0];
	for (let k = 1; k < r.length - 1; ) {
		const [a, b, c] = [r[k - 1], r[k], r[k + 1]];
		const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
		const n = Math.hypot(...v1) * Math.hypot(...v2);
		const inSeam = b[0] > HALAIB_SEAM[0] && b[0] < HALAIB_SEAM[2] && b[1] > HALAIB_SEAM[1] && b[1] < HALAIB_SEAM[3];
		if (inSeam && n && (v1[0] * v2[0] + v1[1] * v2[1]) / n > 0.999) {
			r.splice(k, 1); // the tip of the spike; look again from the point before
			k = Math.max(1, k - 1);
		} else k++;
	}
}

const fc = {
	type: 'FeatureCollection',
	features: [...groups].map(([key, g]) => ({
		type: 'Feature',
		properties: g.props,
		geometry: { type: 'MultiPolygon', coordinates: g.polygons },
	})),
};
const missing = [...quiz].filter((id) => !groups.has(id));
if (missing.length) throw new Error(`No shape for ${missing.join(', ')}`);

// Topology (shared borders stored once), then simplify to three levels of detail
const topo = presimplify(topology({ land: fc }), sphericalTriangleArea);
const levels = [
	{ name: 'xlow', keep: 0.02, q: 5e4 },
	{ name: 'low', keep: 0.07, q: 1e5 },
	{ name: 'mid', keep: 0.25, q: 3e5 },
	{ name: 'high', keep: 1, q: 1e6 },
];
for (const l of levels) {
	// quantile() ranks weights from high to low, so quantile(topo, 0.06) keeps the top 6% of points
	const t = l.keep < 1 ? simplify(topo, quantile(topo, l.keep)) : simplify(topo, 0);
	t.arcs = t.arcs.map((arc) => arc.map((pt) => [pt[0], pt[1]])); // drop the simplify weights (copies)
	const out = quantize(t, l.q);
	const file = `${outDir}/map-${l.name}.json`;
	fs.writeFileSync(file, JSON.stringify(out));
	const pts = out.arcs.reduce((n, a) => n + a.length, 0);
	console.log(`${file}: ${pts} points, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
}
