import { describe, it, expect } from 'vitest';
import { OutputFormatter } from '../formatters/OutputFormatter.js';

const formatter = new OutputFormatter();
const defaults = {
  includeTiming: true,
  verboseMode: true,
  useStringNames: true,
  includeTechniqueDetails: true
};

function note(string, stringIndex, fret, extra = {}) {
  return {
    string,
    stringIndex,
    fret,
    techniques: [],
    techniqueDetails: [],
    position: 0,
    ...extra
  };
}

function tabData(events, overrides = {}) {
  return {
    sequences: [
      {
        section: 1,
        heading: null,
        measureCount: 0,
        stringCount: 6,
        notes: events,
        ...overrides
      }
    ],
    annotations: []
  };
}

describe('formatTablature', () => {
  it('renders open instead of 0th fret', () => {
    const out = formatter.formatTablature(
      tabData([{ position: 0, measure: 1, isChord: false, notes: [note('high E', 0, 0)] }]),
      defaults
    );
    expect(out).toContain('open');
    expect(out).not.toContain('0th fret');
  });

  it('renders muted notes', () => {
    const out = formatter.formatTablature(
      tabData([{ position: 0, measure: 1, isChord: false, notes: [note('A', 4, 'mute')] }]),
      defaults
    );
    expect(out).toContain('muted');
  });

  it('names 7th and 8th strings in chords in numbers mode', () => {
    const chord = {
      position: 0,
      measure: 1,
      isChord: true,
      notes: [note('low B', 6, 2), note('F#', 7, 0)]
    };
    const out = formatter.formatTablature(tabData([chord], { stringCount: 8 }), {
      ...defaults,
      useStringNames: false
    });
    expect(out).toContain('String 7');
    expect(out).toContain('String 8');
    expect(out).not.toContain('undefined');
  });

  it('emits measure headers only when the section has multiple measures', () => {
    const events = [
      { position: 1, measure: 1, isChord: false, notes: [note('B', 1, 3)] },
      { position: 9, measure: 2, isChord: false, notes: [note('B', 1, 5)] }
    ];
    const out = formatter.formatTablature(
      tabData(events, { measureCount: 2 }),
      defaults
    );
    expect(out).toContain('Measure 1:');
    expect(out).toContain('Measure 2:');

    const single = formatter.formatTablature(
      tabData([events[0]], { measureCount: 1 }),
      defaults
    );
    expect(single).not.toContain('Measure 1:');
  });

  it('includes the section heading when annotations are enabled', () => {
    const out = formatter.formatTablature(
      tabData(
        [{ position: 0, measure: 1, isChord: false, notes: [note('G', 2, 7)] }],
        { heading: 'Chorus' }
      ),
      defaults
    );
    expect(out).toContain('Chorus');

    const without = formatter.formatTablature(
      tabData(
        [{ position: 0, measure: 1, isChord: false, notes: [note('G', 2, 7)] }],
        { heading: 'Chorus' }
      ),
      { ...defaults, includeTiming: false }
    );
    expect(without).not.toContain('Chorus');
  });

  it('describes techniques verbosely from techniqueDetails', () => {
    const event = {
      position: 0,
      measure: 1,
      isChord: false,
      notes: [
        note('high E', 0, 7, {
          techniques: ['hammer-on'],
          techniqueDetails: [
            { type: 'hammer-on', fromFret: 5, context: 'hammer-on from 5th fret' }
          ]
        })
      ]
    };
    const out = formatter.formatTablature(tabData([event]), defaults);
    expect(out).toContain('hammer-on from 5th fret');

    const compact = formatter.formatTablature(tabData([event]), {
      ...defaults,
      verboseMode: false
    });
    expect(compact).toContain('hammer-on');
  });
});

describe('formatChordChart', () => {
  it('formats chords with open and muted strings', () => {
    const out = formatter.formatChordChart(
      [{ name: 'Am', frets: ['mute', 0, 2, 2, 1, 0], stringCount: 6 }],
      defaults
    );
    expect(out).toContain('Am chord');
    // Chord charts are written low string first: X-0-2-2-1-0 mutes the LOW E
    expect(out).toMatch(/low E: muted/);
    expect(out).toMatch(/high E: open/);
  });
});
