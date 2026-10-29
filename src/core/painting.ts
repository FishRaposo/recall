// Seeded painting titles. Pure and deterministic: the same run always gets the same title.

const ADJECTIVES = [
  'Quiet', 'Vermilion', 'Broken', 'Patient', 'Unfinished', 'Bitter', 'Bright', 'Small', 'Long', 'Last',
] as const;

const NOUNS = [
  'Massacre', 'Study', 'Composition', 'Garden', 'Chorus', 'Argument', 'Portrait', 'Field', 'Lesson', 'Weather',
] as const;

const COLORS = ['Vermilion', 'Ochre', 'Ultramarine', 'Black', 'Paper'] as const;

export function paintingTitle(seed: number, wave: number, kills: number, last?: string): string {
  let state = (seed ^ Math.imul(wave, 0x9e3779b1) ^ Math.imul(kills, 0x85ebca6b)) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const pattern = Math.floor(next() * 3);
    let title: string;
    if (pattern === 0) {
      title = `${ADJECTIVES[Math.floor(next() * ADJECTIVES.length)]} ${NOUNS[Math.floor(next() * NOUNS.length)]}`;
    } else if (pattern === 1) {
      title = `Study in ${COLORS[Math.floor(next() * COLORS.length)]}`;
    } else {
      title = `Composition No. ${1 + Math.floor(next() * 99)}`;
    }
    if (title !== last) return title;
  }
  return `Composition No. ${1 + Math.floor(next() * 99)}`;
}
