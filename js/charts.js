// Minimal accessible SVG charts: single-series bars with an optional target band,
// two-series grouped bars, and a simple line chart. Hover shows a tooltip;
// every chart also has a table view.
import { esc } from './util.js';

const W = 340, H = 150, PAD = { l: 34, r: 8, t: 10, b: 22 };

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function axis(max) {
  const fmt = v => Number.isInteger(v) ? String(v) : v.toFixed(1);
  const ticks = [0, max / 2, max];
  const ih = H - PAD.t - PAD.b;
  return ticks.map(t => {
    const y = PAD.t + ih - (t / max) * ih;
    return `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}"/><text class="tick" x="${PAD.l - 4}" y="${y + 3}" text-anchor="end">${esc(fmt(t))}</text>`;
  }).join('');
}

function xLabels(labels, x, bw) {
  const every = Math.ceil(labels.length / 8);
  return labels.map((l, i) => (i % every === 0 || i === labels.length - 1)
    ? `<text class="tick" x="${x(i) + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>` : '').join('');
}

function table(rows, headers) {
  return `<details class="tbl"><summary>Table view</summary><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
}

export function barChart({ title, data, unit = '', fmt = v => String(Math.round(v * 10) / 10), target, series = 1 }) {
  const values = data.map(d => d.value);
  const max = niceMax(Math.max(...values, target ? target[1] : 0, 1));
  const empty = values.every(v => !v);
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const step = iw / data.length, bw = Math.max(3, Math.min(22, step - 2));
  const x = i => PAD.l + i * step + (step - bw) / 2;
  const y = v => PAD.t + ih - (v / max) * ih;
  let band = '';
  if (target) {
    const [lo, hi] = target;
    band = `<rect class="band" x="${PAD.l}" width="${iw}" y="${y(Math.min(hi, max))}" height="${Math.max(0, y(lo) - y(Math.min(hi, max)))}"/>`;
  }
  const bars = data.map((d, i) => {
    const h = ih - (y(d.value) - PAD.t);
    const tip = `${d.label}: ${fmt(d.value)}${unit}`;
    return `<g class="hit" data-tip="${esc(tip)}"><rect class="hitbox" x="${PAD.l + i * step}" y="${PAD.t}" width="${step}" height="${ih}"/>` +
      (d.value > 0 ? `<path class="bar s${series}" d="M${x(i)},${PAD.t + ih} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(0, h - 4)} z"/>` : '') + `</g>`;
  }).join('');
  return `<figure class="chart"><figcaption>${esc(title)}${target ? ` <span class="muted">· shaded = recommended ${fmt(target[0])}–${fmt(target[1])}${unit}</span>` : ''}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${axis(max)}${band}${bars}${xLabels(data.map(d => d.label), x, bw)}</svg>
    ${empty ? '<p class="muted small">Nothing logged in this period.</p>' : ''}<div class="tooltip" hidden></div>${table(data.map(d => [d.label, fmt(d.value) + unit]), ['Day', title])}</figure>`;
}

export function pairChart({ title, data, names }) {
  // data: [{label, a, b}] — two series side by side
  const max = niceMax(Math.max(...data.flatMap(d => [d.a, d.b]), 2));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const step = iw / data.length, bw = Math.max(2, Math.min(10, (step - 4) / 2));
  const y = v => PAD.t + ih - (v / max) * ih;
  const bar = (x0, v, s) => v > 0 ? `<rect class="bar s${s}" x="${x0}" y="${y(v)}" width="${bw}" height="${ih - (y(v) - PAD.t)}" rx="2"/>` : '';
  const g = data.map((d, i) => {
    const cx = PAD.l + i * step + step / 2;
    return `<g class="hit" data-tip="${esc(`${d.label}: ${names[0]} ${d.a}, ${names[1]} ${d.b}`)}"><rect class="hitbox" x="${PAD.l + i * step}" y="${PAD.t}" width="${step}" height="${ih}"/>${bar(cx - bw - 1, d.a, 1)}${bar(cx + 1, d.b, 2)}</g>`;
  }).join('');
  const x = i => PAD.l + i * step + step / 2 - bw;
  return `<figure class="chart"><figcaption>${esc(title)}</figcaption>
    <div class="legend"><span><i class="sw s1"></i>${esc(names[0])}</span><span><i class="sw s2"></i>${esc(names[1])}</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${axis(max)}${g}${xLabels(data.map(d => d.label), x, bw * 2)}</svg>
    <div class="tooltip" hidden></div>${table(data.map(d => [d.label, d.a, d.b]), ['Day', ...names])}</figure>`;
}

export function lineChart({ title, points, unit = '' }) {
  // points: [{label, x (number), value}]
  if (points.length < 1) return `<figure class="chart"><figcaption>${esc(title)}</figcaption><p class="muted">No measurements yet.</p></figure>`;
  const xs = points.map(p => p.x), vs = points.map(p => p.value);
  const xmin = Math.min(...xs), xmax = Math.max(...xs, xmin + 1);
  const vmin = Math.min(...vs), vmax = Math.max(...vs);
  const lo = Math.max(0, vmin - (vmax - vmin || 1) * 0.2), hi = vmax + (vmax - vmin || 1) * 0.2;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = v => PAD.l + ((v - xmin) / (xmax - xmin)) * iw;
  const y = v => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [lo, (lo + hi) / 2, hi].map(t => `<line class="grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${PAD.l - 4}" y="${y(t) + 3}" text-anchor="end">${t.toFixed(1)}</text>`).join('');
  const dots = points.map(p => `<g class="hit" data-tip="${esc(`${p.label}: ${p.value}${unit}`)}"><circle class="hitbox" cx="${x(p.x)}" cy="${y(p.value)}" r="12"/><circle class="dot" cx="${x(p.x)}" cy="${y(p.value)}" r="4"/></g>`).join('');
  const first = points[0], last = points[points.length - 1];
  return `<figure class="chart"><figcaption>${esc(title)}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${ticks}<path class="line" d="${path}"/>${dots}
    <text class="tick" x="${x(first.x)}" y="${H - 6}" text-anchor="start">${esc(first.label)}</text>${points.length > 1 ? `<text class="tick" x="${x(last.x)}" y="${H - 6}" text-anchor="end">${esc(last.label)}</text>` : ''}</svg>
    <div class="tooltip" hidden></div>${table(points.map(p => [p.label, p.value + unit]), ['Date', title])}</figure>`;
}

// One delegated hover handler for all charts
export function wireTooltips(root) {
  root.addEventListener('pointermove', e => {
    const g = e.target.closest?.('.hit');
    const fig = e.target.closest?.('figure.chart');
    root.querySelectorAll('.tooltip').forEach(t => { if (!fig || !fig.contains(t)) t.hidden = true; });
    if (!fig) return;
    const tip = fig.querySelector('.tooltip');
    if (!g) { tip.hidden = true; return; }
    const r = fig.getBoundingClientRect();
    tip.textContent = g.dataset.tip;
    tip.hidden = false;
    const left = Math.min(Math.max(8, e.clientX - r.left + 10), r.width - tip.offsetWidth - 8);
    tip.style.left = left + 'px';
    tip.style.top = (e.clientY - r.top - 34) + 'px';
  });
  root.addEventListener('pointerleave', () => root.querySelectorAll('.tooltip').forEach(t => { t.hidden = true; }));
}

// WHO growth chart: shaded healthy band (−2 to +2 SD), lighter outer band (−3 to +3 SD),
// median line, and the child's own measurements as a line with dots.
export function growthChart({ title, unit, xs, lo3, lo2, med, hi2, hi3, pts, xLabel }) {
  const W2 = 340, H2 = 190, P = { l: 34, r: 10, t: 10, b: 24 };
  const all = [...lo3, ...hi3, ...pts.map(p => p.v)].filter(v => v != null);
  const ymin = Math.floor(Math.min(...all)), ymax = Math.ceil(Math.max(...all));
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const iw = W2 - P.l - P.r, ih = H2 - P.t - P.b;
  const X = v => P.l + ((v - x0) / (x1 - x0 || 1)) * iw;
  const Y = v => P.t + ih - ((v - ymin) / (ymax - ymin || 1)) * ih;
  const area = (a, b) => `M${xs.map((x, i) => `${X(x).toFixed(1)},${Y(a[i]).toFixed(1)}`).join(' L')} L${xs.map((x, i) => `${X(x).toFixed(1)},${Y(b[i]).toFixed(1)}`).reverse().join(' L')} Z`;
  const line = a => `M${xs.map((x, i) => `${X(x).toFixed(1)},${Y(a[i]).toFixed(1)}`).join(' L')}`;
  const ticksY = [ymin, (ymin + ymax) / 2, ymax].map(t => `<line class="grid" x1="${P.l}" x2="${W2 - P.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${P.l - 4}" y="${Y(t) + 3}" text-anchor="end">${Math.round(t * 10) / 10}</text>`).join('');
  const nX = 5, ticksX = Array.from({ length: nX }, (_, i) => x0 + (x1 - x0) * i / (nX - 1)).map(t => `<text class="tick" x="${X(t)}" y="${H2 - 8}" text-anchor="middle">${esc(xLabel(t))}</text>`).join('');
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  const child = sorted.length > 1 ? `<path class="kid-line" d="M${sorted.map(p => `${X(p.x).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' L')}"/>` : '';
  const dots = sorted.map(p => `<g class="hit" data-tip="${esc(`${p.label}: ${p.v} ${unit}`)}"><circle class="hitbox" cx="${X(p.x)}" cy="${Y(p.v)}" r="12"/><circle class="kid-dot" cx="${X(p.x)}" cy="${Y(p.v)}" r="5"/></g>`).join('');
  return `<figure class="chart"><figcaption>${esc(title)}</figcaption>
    <div class="legend"><span><i class="sw band3"></i>WHO −3 to +3 SD</span><span><i class="sw band2"></i>Healthy range (−2 to +2 SD)</span><span><i class="sw med"></i>WHO median</span><span><i class="sw kid"></i>Your child</span></div>
    <svg viewBox="0 0 ${W2} ${H2}" role="img" aria-label="${esc(title)}">${ticksY}<path class="who-band3" d="${area(lo3, hi3)}"/><path class="who-band2" d="${area(lo2, hi2)}"/><path class="who-med" d="${line(med)}"/>${child}${dots}${ticksX}</svg>
    <div class="tooltip" hidden></div>
    ${table(sorted.map(p => [p.label, `${p.v} ${unit}`]), ['Date', title])}</figure>`;
}
