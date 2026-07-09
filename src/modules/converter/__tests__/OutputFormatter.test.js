import { describe, it, expect } from 'vitest';
import { OutputFormatter } from '../formatters/OutputFormatter.js';
import { TabConverter } from '../TabConverter.js';
import * as fixtures from './fixtures.js';

const formatter = new OutputFormatter();
const defaults = {
  includeTiming: true,
  verboseMode: true,
  useStringNames: true,
  includeTechniqueDetails: true,
  includeDurations: true
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
    expect(out).toContain('7th string');
    expect(out).toContain('8th string');
    expect(out).not.toContain('undefined');
  });

  it('speaks ordinal string numbers in numbers mode', () => {
    const out = formatter.formatTablature(
      tabData([{ position: 0, measure: 1, isChord: false, notes: [note('G', 2, 7)] }]),
      { ...defaults, useStringNames: false }
    );
    expect(out).toContain('- 3rd string, 7th fret');
    expect(out).not.toContain('String 3');
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

describe('durations and rests (Guitar Pro imports)', () => {
  it('appends note durations when the setting is on', () => {
    const event = {
      position: 0,
      measure: 1,
      isChord: false,
      notes: [note('B', 1, 5, { duration: 'eighth note' })]
    };
    const on = formatter.formatTablature(tabData([event]), defaults);
    expect(on).toContain('- B string, 5th fret, eighth note');

    const off = formatter.formatTablature(tabData([event]), {
      ...defaults,
      includeDurations: false
    });
    expect(off).toContain('- B string, 5th fret');
    expect(off).not.toContain('eighth note');
  });

  it('puts the duration before the technique suffix', () => {
    const event = {
      position: 0,
      measure: 1,
      isChord: false,
      notes: [
        note('high E', 0, 7, {
          duration: 'eighth note',
          techniques: ['hammer-on'],
          techniqueDetails: [
            { type: 'hammer-on', fromFret: 5, context: 'hammer-on from 5th fret' }
          ]
        })
      ]
    };
    const out = formatter.formatTablature(tabData([event]), defaults);
    expect(out).toContain('- high E string, 7th fret, eighth note (hammer-on from 5th fret)');
  });

  it('appends one duration to chord lines', () => {
    const chord = {
      position: 0,
      measure: 1,
      isChord: true,
      notes: [
        note('B', 1, 3, { duration: 'quarter note' }),
        note('G', 2, 4, { duration: 'quarter note' })
      ]
    };
    const out = formatter.formatTablature(tabData([chord]), defaults);
    expect(out.match(/quarter note/g)).toHaveLength(1);
  });

  it('prints rests only when durations are enabled', () => {
    const events = [
      { position: 0, measure: 1, isChord: false, notes: [note('B', 1, 3)] },
      { position: 4, measure: 1, isChord: false, isRest: true, duration: 'eighth rest', notes: [] }
    ];
    const on = formatter.formatTablature(tabData(events), defaults);
    expect(on).toContain('- Rest, eighth rest');

    const off = formatter.formatTablature(tabData(events), {
      ...defaults,
      includeDurations: false
    });
    expect(off).not.toContain('Rest');
  });

  it('does not let a skipped rest emit a dangling measure header', () => {
    const events = [
      { position: 0, measure: 1, isChord: false, notes: [note('B', 1, 3)] },
      { position: 8, measure: 2, isChord: false, isRest: true, duration: 'whole rest', notes: [] }
    ];
    const out = formatter.formatTablature(tabData(events, { measureCount: 2 }), {
      ...defaults,
      includeDurations: false
    });
    expect(out).not.toContain('Measure 2:');
  });

  it('summarizes the song annotation first', () => {
    const data = tabData([
      { position: 0, measure: 1, isChord: false, notes: [note('B', 1, 3)] }
    ]);
    data.annotations = [
      { text: '"Song" by Band', lineNumber: 0, category: 'song' },
      { text: 'Tempo: 90 BPM', lineNumber: 0, category: 'timing' }
    ];
    const out = formatter.formatTablature(data, defaults);
    expect(out).toContain('- Song: "Song" by Band');
    expect(out.indexOf('- Song:')).toBeLessThan(out.indexOf('- Timing:'));
  });

  it('leaves ASCII tab output byte-identical whichever way the toggle is set', () => {
    const converter = new TabConverter();
    const on = converter.convert(fixtures.measuresTest, defaults);
    const off = converter.convert(fixtures.measuresTest, {
      ...defaults,
      includeDurations: false
    });
    expect(on).toBe(off);
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

  it('speaks ordinal string numbers in numbers mode', () => {
    const out = formatter.formatChordChart(
      [{ name: 'Am', frets: ['mute', 0, 2, 2, 1, 0], stringCount: 6 }],
      { ...defaults, useStringNames: false }
    );
    expect(out).toMatch(/6th string: muted/);
    expect(out).toMatch(/1st string: open/);
  });
});
