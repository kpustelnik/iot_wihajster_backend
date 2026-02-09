/**
 * Fast Connect Token storage utilities.
 * 
 * Stores and retrieves fast connect tokens in localStorage, keyed by device MAC address.
 * Each entry contains:
 * - mac: device BLE MAC address (hex string, e.g. "AA:BB:CC:DD:EE:FF")
 * - tokenId: public token identifier (uint32) — used to verify token is still valid on device
 * - token: private 6-digit PIN (uint32) — used as fast connect PIN to skip server auth
 */

const STORAGE_KEY = 'fastConnectTokens';

export interface FastConnectEntry {
  mac: string;
  tokenId: number;
  token: number;
}

function getAllEntries(): FastConnectEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FastConnectEntry[];
  } catch {
    return [];
  }
}

function saveAllEntries(entries: FastConnectEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/**
 * Store or update a fast connect token for a device MAC.
 */
export function saveFastConnectToken(mac: string, tokenId: number, token: number): void {
  const entries = getAllEntries();
  const existing = entries.findIndex(e => e.mac === mac);
  const entry: FastConnectEntry = { mac, tokenId, token };
  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }
  saveAllEntries(entries);
}

/**
 * Get the stored fast connect token for a device MAC, or null if not found.
 */
export function getFastConnectToken(mac: string): FastConnectEntry | null {
  const entries = getAllEntries();
  return entries.find(e => e.mac === mac) ?? null;
}

/**
 * Remove the stored fast connect token for a device MAC.
 */
export function removeFastConnectToken(mac: string): void {
  const entries = getAllEntries().filter(e => e.mac !== mac);
  saveAllEntries(entries);
}

/**
 * Check if there are any stored fast connect tokens.
 */
export function hasFastConnectTokens(): boolean {
  return getAllEntries().length > 0;
}

/**
 * Remove all stored fast connect tokens.
 */
export function clearAllFastConnectTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get all stored fast connect entries (for display purposes).
 */
export function listFastConnectTokens(): FastConnectEntry[] {
  return getAllEntries();
}

/**
 * Convert a 6-byte Uint8Array MAC address to a hex string like "AA:BB:CC:DD:EE:FF".
 */
export function macBytesToString(macBytes: DataView): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(macBytes.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
  }
  return parts.join(':');
}
