import { describe, it, expect } from 'vitest';
import { StandardTabParser } from '../parsers/StandardTabParser.js';
import * as fixtures from './fixtures.js';

const parser = new StandardTabParser();

/** Parse a fixture string into { sequences, annotations }. */
function parse(text) {
  return parser.parse(text.split('\n'));
}

/** Flatten every note event of the first sequence into [stringName, fret] pairs. */
function flatNotes(sequence) {
  return sequence.notes.flatMap(event => event.notes.map(n => [n.string, n.fret]));
}

describe('multi-digit frets', () => {
  it('parses 12 as a single note, never 12 then a phantom 2', () => {
    const { sequences } = parse(fixtures.multiDigitTest);
    const notes = flatNotes(sequences[0]);
    expect(notes).toContainEqual(['high E', 12]);
    expect(notes).toContainEqual(['low E', 10]);
    // No phantom notes from re-reading digits of 12 or 10
    const highEFrets = notes.filter(([s]) => s === 'high E').map(([, f]) => f);
    expect(highEFrets).toEqual([12]);
    const lowEFrets = notes.filter(([s]) => s === 'low E').map(([, f]) => f);
    expect(lowEFrets).toEqual([10]);
  });

  it('still parses genuinely separate digits (12 then 2)', () => {
    const { sequences } = parse(fixtures.multiDigitTest);
    const bFrets = flatNotes(sequences[0])
      .filter(([s]) => s === 'B')
      .map(([, f]) => f);
    expect(bFrets).toEqual([12, 2]);
  });

  it('keeps chord columns intact around multi-digit frets', () => {
    const { sequences } = parse(fixtures.measuresTest);
    const twelveEvent = sequences[0].notes.find(e =>
      e.notes.some(n => n.fret === 12)
    );
    expect(twelveEvent.isChord).toBe(true);
    expect(twelveEvent.notes).toHaveLength(3);
    expect(twelveEvent.notes.every(n => n.fret === 12)).toBe(true);
    // And no event exists holding a phantom chord of 2s
    const phantom = sequences[0].notes.find(
      e => e.notes.length > 1 && e.notes.every(n => n.fret === 2)
    );
    expect(phantom).toBeUndefined();
  });
});

describe('string labels', () => {
  it('parses all-lowercase labels (e b g d a e)', () => {
    const { sequences } = parse(fixtures.lowercaseLabelsTest);
    expect(sequences).toHaveLength(1);
    expect(sequences[0].stringCount).toBe(6);
    const names = new Set(
      sequences[0].notes.flatMap(e => e.notes.map(n => n.string))
    );
    expect(names.has('high E')).toBe(true);
    expect(names.has('B')).toBe(true);
  });

  it('keeps both D strings in drop-D, naming the lowest "low D"', () => {
    const { sequences } = parse(fixtures.dropDTest);
    expect(sequences[0].stringCount).toBe(6);
    const event = sequences[0].notes[0];
    expect(event.isChord).toBe(true);
    expect(event.notes).toHaveLength(6);
    const names = event.notes.map(n => n.string);
    expect(names).toContain('D');
    expect(names).toContain('low D');
  });

  it('keeps unknown labels like C instead of dropping the string', () => {
    const { sequences } = parse(fixtures.dropCTest);
    expect(sequences[0].stringCount).toBe(6);
    const notes = flatNotes(sequences[0]);
    expect(notes).toContainEqual(['C', 3]);
  });

  it('corrects inverted (low-to-high) string order', () => {
    const { sequences } = parse(fixtures.invertedOrderTest);
    const event = sequences[0].notes[0];
    const byName = Object.fromEntries(event.notes.map(n => [n.string, n]));
    // In the E major shape the A string carries fret 2 and high E is open
    expect(byName['A'].fret).toBe(2);
    expect(byName['high E'].fret).toBe(0);
    // high E must sort before low E (index 0 vs 5)
    expect(byName['high E'].stringIndex).toBe(0);
    expect(byName['low E'].stringIndex).toBe(5);
  });

  it('handles spaced label separators like "E :---"', () => {
    const { sequences } = parse(fixtures.spacedSeparatorTest);
    expect(sequences).toHaveLength(1);
    const notes = flatNotes(sequences[0]);
    expect(notes).toContainEqual(['high E', 15]);
    expect(notes).toContainEqual(['B', 18]);
  });

  it('aligns chords across mixed-width labels (e| vs F#|)', () => {
    const { sequences } = parse(fixtures.mixedWidthLabelsTest);
    expect(sequences[0].stringCount).toBe(7);
    const event = sequences[0].notes[0];
    expect(event.isChord).toBe(true);
    expect(event.notes).toHaveLength(7);
  });
});

describe('section grouping', () => {
  it('splits blocks separated by a blank line into separate sections', () => {
    const { sequences } = parse(fixtures.twoSectionsTest);
    expect(sequences).toHaveLength(2);
    expect(sequences[0].stringCount).toBe(6);
    expect(sequences[1].stringCount).toBe(6);
    const secondFrets = flatNotes(sequences[1]).map(([, f]) => f);
    expect(secondFrets).toContain(7);
    expect(secondFrets).toContain(8);
  });

  it('parses bare dash lines without labels or pipes', () => {
    const { sequences } = parse(fixtures.bareLinesTest);
    expect(sequences).toHaveLength(1);
    expect(sequences[0].stringCount).toBe(6);
    const frets = flatNotes(sequences[0]).map(([, f]) => f);
    expect(frets).toContain(0);
    expect(frets).toContain(3);
  });

  it('parses a 4-string bass tab with bass string names', () => {
    const { sequences } = parse(fixtures.bassTest);
    expect(sequences[0].stringCount).toBe(4);
    const notes = flatNotes(sequences[0]);
    expect(notes).toContainEqual(['A', 3]);
    expect(notes).toContainEqual(['A', 5]);
  });

  it('attaches a heading line above the block to the section', () => {
    const { sequences } = parse(fixtures.headingTest);
    expect(sequences[0].heading).toBe('Verse 1');
  });

  it('strips brackets from [Intro] headings', () => {
    const { sequences } = parse(fixtures.measuresTest);
    expect(sequences[0].heading).toBe('Intro');
  });

  it('ignores legend/key lines instead of parsing them as music', () => {
    const { sequences } = parse(fixtures.legendTest);
    expect(sequences).toHaveLength(1);
    const frets = flatNotes(sequences[0]).map(([, f]) => f);
    expect(frets).toEqual([5, 7]);
  });

  it('parses a 7-string tab', () => {
    const { sequences } = parse(fixtures.sevenStringTest);
    expect(sequences[0].stringCount).toBe(7);
    const names = new Set(flatNotes(sequences[0]).map(([s]) => s));
    expect(names.has('low B')).toBe(true);
  });

  it('parses an 8-string tab with F#', () => {
    const { sequences } = parse(fixtures.eightStringTest);
    expect(sequences[0].stringCount).toBe(8);
    const names = new Set(flatNotes(sequences[0]).map(([s]) => s));
    expect(names.has('F#')).toBe(true);
    expect(names.has('low B')).toBe(true);
  });
});

describe('notes and special notation', () => {
  it('reads x as muted and o as open', () => {
    const { sequences } = parse(fixtures.mutedNotesTest);
    const notes = flatNotes(sequences[0]);
    expect(notes).toContainEqual(['high E', 'mute']);
    expect(notes).toContainEqual(['high E', 0]);
    expect(notes).toContainEqual(['low E', 0]);
  });

  it('filters out impossible fret numbers like 99', () => {
    const { sequences } = parse(fixtures.invalidFretsTest);
    const frets = flatNotes(sequences[0]).map(([, f]) => f);
    expect(frets).not.toContain(99);
    // Neighbours on the same column survive
    expect(frets).toContain(1);
  });

  it('marks ghost notes and harmonics', () => {
    const { sequences } = parse(fixtures.advancedTechniquesTest);
    const all = sequences[0].notes.flatMap(e => e.notes);
    const ghost = all.find(n => n.techniques.includes('ghost note'));
    expect(ghost).toBeDefined();
    expect(ghost.fret).toBe(5);
    const harmonic = all.find(n => n.techniques.includes('harmonic'));
    expect(harmonic).toBeDefined();
    expect(harmonic.fret).toBe(12);
    const tap = all.find(n => n.techniques.includes('tap'));
    expect(tap).toBeDefined();
  });
});

describe('technique binding', () => {
  function highENotes(text) {
    const { sequences } = parse(text);
    return sequences[0].notes
      .flatMap(e => e.notes)
      .filter(n => n.string === 'high E');
  }

  it('binds 0h1p0 as hammer-on then pull-off between real notes', () => {
    const notes = highENotes(fixtures.techniquesTest);
    const frets = notes.map(n => n.fret);
    expect(frets.slice(0, 3)).toEqual([0, 1, 0]);
    const hammerTarget = notes[1];
    expect(hammerTarget.techniques).toContain('hammer-on');
    const pullTarget = notes[2];
    expect(pullTarget.techniques).toContain('pull-off');
  });

  it('treats 3b5r3 as one note with bend and release targets', () => {
    const notes = highENotes(fixtures.techniquesTest);
    const bendNote = notes.find(n => n.techniques.includes('bend'));
    expect(bendNote.fret).toBe(3);
    const bend = bendNote.techniqueDetails.find(d => d.type === 'bend');
    expect(bend.toFret).toBe(5);
    const release = bendNote.techniqueDetails.find(d => d.type === 'release');
    expect(release.toFret).toBe(3);
    // The bend target 5 must not appear as its own note
    expect(notes.map(n => n.fret)).not.toContain(5);
  });

  it('binds slides with their target and vibrato to its note', () => {
    const notes = highENotes(fixtures.techniquesTest);
    const vibratoNote = notes.find(n => n.techniques.includes('vibrato'));
    expect(vibratoNote.fret).toBe(0);
    const slideNote = notes.find(n =>
      n.techniqueDetails?.some(d => d.type === 'slide-up')
    );
    expect(slideNote).toBeDefined();
    const slide = slideNote.techniqueDetails.find(d => d.type === 'slide-up');
    expect(slide.toFret).toBe(3);
  });

  it('never turns a lowercase b string label into a bend', () => {
    const { sequences } = parse(fixtures.strayTechniqueTest);
    const all = sequences[0].notes.flatMap(e => e.notes);
    const bString = all.find(n => n.fret === 3);
    expect(bString.techniques).not.toContain('bend');
  });

  it('does not attach neighbouring-note digits as bends (3b5 stays one bend)', () => {
    const text = `
e|--3b5--7--|
B|----------|
G|----------|
D|----------|
A|----------|
E|----------|
`;
    const { sequences } = parse(text);
    const all = sequences[0].notes.flatMap(e => e.notes);
    const frets = all.map(n => n.fret);
    expect(frets).toEqual([3, 7]);
    const seven = all.find(n => n.fret === 7);
    expect(seven.techniques).toEqual([]);
  });
});

describe('measures', () => {
  it('assigns measure numbers from bar lines', () => {
    const { sequences } = parse(fixtures.measuresTest);
    expect(sequences[0].measureCount).toBe(2);
    const measures = sequences[0].notes.map(e => e.measure);
    expect(measures[0]).toBe(1);
    expect(measures[measures.length - 1]).toBe(2);
    // The fret-3 chord lives in measure 2
    const chord3 = sequences[0].notes.find(e =>
      e.notes.some(n => n.fret === 3 && n.string === 'high E')
    );
    expect(chord3.measure).toBe(2);
  });

  it('reports a single measure when there are no interior bar lines', () => {
    const { sequences } = parse(fixtures.lowercaseLabelsTest);
    expect(sequences[0].measureCount).toBeLessThanOrEqual(1);
  });
});

describe('error handling', () => {
  it('throws a single plain-language error for non-tab input', () => {
    expect(() => parse(fixtures.notATabTest)).toThrowError(
      /tab/i
    );
    try {
      parse(fixtures.notATabTest);
    } catch (error) {
      expect(error.message).not.toMatch(/Failed to parse tab:.*Failed to parse tab:/);
      expect(error.message).not.toMatch(/Error converting tab/);
    }
  });

  it('throws on empty and invalid input', () => {
    expect(() => parser.parse(null)).toThrow();
    expect(() => parser.parse([])).toThrow();
  });
});

describe('line endings', () => {
  it('produces identical results for \\n and \\r\\n input', () => {
    const unix = parse(fixtures.techniquesTest);
    const windows = parser.parse(
      fixtures.techniquesTest.replace(/\n/g, '\r\n').split('\n')
    );
    expect(JSON.stringify(windows.sequences)).toBe(
      JSON.stringify(unix.sequences)
    );
  });
});
