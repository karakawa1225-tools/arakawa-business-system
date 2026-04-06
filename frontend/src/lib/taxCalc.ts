/** 税抜ベースの消費税（端数は切り捨て。日本の請求・仕入の一般的な扱い） */
export function taxFromExclusiveNet(net: number, ratePercent: number): number {
  if (!Number.isFinite(net) || net < 0) return 0;
  if (!Number.isFinite(ratePercent) || ratePercent <= 0) return 0;
  return Math.floor((net * ratePercent) / 100);
}

export type LedgerTaxRateKey = '10' | '8' | '0';

export function ratePercentFromKey(key: LedgerTaxRateKey): number {
  if (key === '10') return 10;
  if (key === '8') return 8;
  return 0;
}
