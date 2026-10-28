import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBest, saveBest, loadSave, saveRun, clearRunSave } from '../src/platform/storage.ts';
import type { RecallSave } from '../src/platform/storage.ts';
import { loadSettings, saveSettings, defaultSettings } from '../src/platform/settings.ts';

class MemoryStorage {
  data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as { localStorage: Storage }).localStorage = storage as unknown as Storage;
  return storage;
}

test('best score round-trips and rejects malformed data', () => {
  const storage = installStorage();
  saveBest({ score: 3200, wave: 9 });
  assert.deepEqual(loadBest(), { score: 3200, wave: 9 });
  storage.setItem('recall.best.v1', '{');
  assert.deepEqual(loadBest(), { score: 0, wave: 0 });
});

test('settings round-trip and fall back safely', () => {
  const storage = installStorage();
  saveSettings({ version: 1, volume: 0.2, muted: true, shake: 0.4, flashes: 0.6, reducedMotion: true });
  assert.deepEqual(loadSettings(), { version: 1, volume: 0.2, muted: true, shake: 0.4, flashes: 0.6, reducedMotion: true });
  storage.setItem('recall.settings.v1', '{');
  const fallback = loadSettings();
  assert.equal(fallback.version, 1);
  assert.equal(fallback.volume, defaultSettings().volume);
});

test('legacy mute preference migrates into settings', () => {
  const storage = installStorage();
  storage.setItem('recall.muted.v1', '1');
  assert.equal(loadSettings().muted, true);
});

test('a wave checkpoint round-trips and invalid saves are discarded', () => {
  const storage = installStorage();
  const save: RecallSave = {
    version: 1,
    seed: 42,
    rngState: 123456,
    wave: 3,
    score: 700,
    combo: 5,
    hp: 2,
    stats: { kills: 17, bestMult: 3, time: 61.5 },
  };
  saveRun(save);
  assert.deepEqual(loadSave(), save);
  clearRunSave();
  assert.equal(loadSave(), null);
  storage.setItem('recall.save.v1', JSON.stringify({ version: 2 }));
  assert.equal(loadSave(), null);
  storage.setItem('recall.save.v1', '{');
  assert.equal(loadSave(), null);
});
