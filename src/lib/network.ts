// Connection-tier detection primitive (addendum T8.6).
//
// Used by connection-aware image loading (T10) to downgrade behaviour on 2G /
// Data-Saver. Pure read of navigator.connection; safe to call anywhere (returns
// 'unknown' when the API or window is absent).

export type ConnectionTier = 'fast' | 'slow' | 'unknown';

interface NetworkInformationLike {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  saveData?: boolean;
  downlink?: number;
}

export function detectConnectionTier(): ConnectionTier {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return 'unknown';
  if (conn.saveData) return 'slow';
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return 'slow';
  return 'fast';
}
