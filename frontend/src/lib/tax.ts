// ============================================
// TAX RESOLUTION (client mirror of InvoiceTaxResolver)
// ============================================
// Sums active, non-included rules of type vat/sales_tax/tourism_levy/city_tax
// whose validity window covers the given date and whose applicableTo list is
// empty or matches the line category (case-insensitive). service_charge rules
// are never added into the tax subtotal — the backend resolver treats them the
// same way. The combined rate is capped at 100%. When no rule applies, the
// caller's fallback rate (the per-line rate sent to the API) is used, which is
// exactly the backend's client-rate fallback.
//
// Store TaxConfig.rate is a PERCENT (15 = 15%); the API stores a fraction and
// the mapper converts on the way in.

import type { TaxConfig } from '../store/useAppStore';

const TAXABLE_TYPES = new Set<TaxConfig['type']>([
  'vat',
  'sales_tax',
  'tourism_levy',
  'city_tax',
]);

function coversDate(config: TaxConfig, date: string): boolean {
  if (date < config.validFrom) return false;
  if (config.validTo && date > config.validTo) return false;
  return true;
}

function appliesToCategory(config: TaxConfig, category: string): boolean {
  if (config.applicableTo.length === 0) return true;
  const needle = category.trim().toLowerCase();
  return config.applicableTo.some((c) => c.trim().toLowerCase() === needle);
}

/**
 * Combined tax rate (percent) for a line, or `fallbackRate` when no rule
 * applies — mirroring the server resolver so checkout previews agree with the
 * invoice the API eventually computes.
 */
export function resolveTaxRatePercent(
  configs: TaxConfig[],
  category: string,
  date: string,
  fallbackRate: number,
): number {
  let combined = 0;
  for (const config of configs) {
    if (!config.active || config.included) continue;
    if (!TAXABLE_TYPES.has(config.type)) continue;
    if (!coversDate(config, date)) continue;
    if (!appliesToCategory(config, category)) continue;
    combined += config.rate;
  }
  if (combined <= 0) return fallbackRate;
  return Math.min(combined, 100);
}

/** Tax amount for a subtotal, rounded to 2 decimal places (currency-safe). */
export function resolveTaxAmount(
  configs: TaxConfig[],
  subtotal: number,
  category: string,
  date: string,
  fallbackRate: number,
): number {
  const rate = resolveTaxRatePercent(configs, category, date, fallbackRate);
  return Math.round(subtotal * rate) / 100;
}
