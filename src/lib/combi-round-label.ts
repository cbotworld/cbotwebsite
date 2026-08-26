export function slotsForCombiFormat(fmt: string) {
  const u = String(fmt || 'SINGLES').toUpperCase();
  if (u.includes('QUADRUPLE') || u.includes('QUAD')) return 4;
  if (u.includes('TRIPLE')) return 3;
  if (u.includes('DOUBLE')) return 2;
  return 1;
}

export function combiRoundLabel(formats: string[], index: number) {
  let singles = 0;
  let doubles = 0;
  let triples = 0;
  let quadruples = 0;
  let other = 0;
  for (let i = 0; i <= index; i++) {
    const fmt = String(formats[i] || 'SINGLES').toUpperCase();
    if (fmt.includes('QUADRUPLE') || fmt.includes('QUAD')) quadruples += 1;
    else if (fmt.includes('TRIPLE')) triples += 1;
    else if (fmt.includes('DOUBLE')) doubles += 1;
    else if (fmt.includes('SINGLE')) singles += 1;
    else other += 1;
  }
  const fmt = String(formats[index] || 'SINGLES').toUpperCase();
  if (fmt.includes('QUADRUPLE') || fmt.includes('QUAD')) return `Quadruples ${quadruples}`;
  if (fmt.includes('TRIPLE')) return `Triples ${triples}`;
  if (fmt.includes('DOUBLE')) return `Doubles ${doubles}`;
  if (fmt.includes('SINGLE')) return `Singles ${singles}`;
  return `Match ${other}`;
}

/** Relabel stored "Match N" titles when the event is actually quadruples. */
export function displayCombiEventName(name: string, format?: string, slots?: number) {
  const raw = String(name || '').trim();
  const f = String(format || '').toUpperCase();
  const isQuads = f.includes('QUADRUPLE') || f.includes('QUAD') || Number(slots) === 4;
  if (!isQuads) return raw || name;
  if (/^match\s*\d+/i.test(raw)) return raw.replace(/^match/i, 'Quadruples');
  if (!raw || /^match$/i.test(raw)) return 'Quadruples';
  return raw;
}
