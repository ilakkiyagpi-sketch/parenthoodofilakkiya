// WHO growth helpers: standard values and z-scores from the LMS tables.
import { WHO_LMS } from './who-data.js';

export const INDICATORS = {
  wfa: { label: 'Weight', unit: 'kg', key: 'weight', maxMonth: 120 },
  hfa: { label: 'Height / length', unit: 'cm', key: 'height', maxMonth: 228 },
  hca: { label: 'Head circumference', unit: 'cm', key: 'head', maxMonth: 60 },
};

function lms(ind, sex, months) {
  const arr = WHO_LMS[ind]?.[sex === 'girl' ? 'g' : 'b'];
  if (!arr) return null;
  const lo = Math.floor(months), hi = Math.ceil(months);
  const a = arr[lo], b = arr[hi];
  if (!a || !b) return null;
  const f = months - lo;
  return a.map((v, i) => v + (b[i] - v) * f);
}

export function whoValue(ind, sex, months, z) {
  const p = lms(ind, sex, months);
  if (!p) return null;
  const [L, M, S] = p;
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

export function zScore(ind, sex, months, value) {
  const p = lms(ind, sex, months);
  if (!p || !value) return null;
  const [L, M, S] = p;
  return L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
}

// Percentile from z (normal CDF approximation)
export function percentile(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.round((z > 0 ? 1 - p : p) * 100);
}

export function zLabel(z) {
  if (z == null) return ['', ''];
  if (z < -3) return ['high', 'Much below the WHO range — please consult your paediatrician'];
  if (z < -2) return ['low', 'Below the usual range — discuss at the next check-up'];
  if (z > 3) return ['high', 'Much above the WHO range — please consult your paediatrician'];
  if (z > 2) return ['low', 'Above the usual range — discuss at the next check-up'];
  return ['ok', 'Within the healthy WHO range'];
}
