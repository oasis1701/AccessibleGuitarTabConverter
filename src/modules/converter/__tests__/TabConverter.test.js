import { describe, it, expect } from 'vitest';
import { TabConverter } from '../TabConverter.js';
import * as fixtures from './fixtures.js';

const converter = new TabConverter();
const defaults = {
  includeTiming: true,
  verboseMode: true,
  useStringNames: true,
  includeTechniqueDetails: true
};

describe('end-to-end conversion', () => {
  it('converts the measures fixture with measure headers and open strings', () => {
    const out = converter.convert(fixtures.measuresTest, defaults);
    expect(out).toContain('Measure 1');
    expect(out).toContain('Measure 2');
    expect(out).toContain('12th fret');
    expect(out).toContain('open');
    expect(out).not.toContain('0th fret');
    expect(out).not.toContain('undefined');
    // No phantom chord from re-reading "12" as "2"
    expect(out).not.toMatch(/2nd fret, B string 2nd fret/);
  });

  it('mentions the section heading', () => {
    const out = converter.convert(fixtures.measuresTest, defaults);
    expect(out).toContain('Intro');
  });

  it('converts lowercase-labeled tabs instead of rejecting them', () => {
    const out = converter.convert(fixtures.lowercaseLabelsTest, defaults);
    expect(out).toContain('high E string');
    expect(out).toContain('3rd fret');
  });

  it('converts identically for \\n and \\r\\n input', () => {
    const unix = converter.convert(fixtures.techniquesTest, defaults);
    const windows = converter.convert(
      fixtures.techniquesTest.replace(/\n/g, '\r\n'),
      defaults
    );
    expect(windows).toBe(unix);
  });

  it('names all strings in 7-string chords in numbers mode', () => {
    const out = converter.convert(fixtures.sevenStringTest, {
      ...defaults,
      useStringNames: false
    });
    expect(out).not.toContain('undefined');
    expect(out).toContain('7th string');
  });

  it('handles the 8-string tab in both naming modes', () => {
    const withNames = converter.convert(fixtures.eightStringTest, defaults);
    expect(withNames).toContain('F#');
    expect(withNames).not.toContain('undefined');
    const withNumbers = converter.convert(fixtures.eightStringTest, {
      ...defaults,
      useStringNames: false
    });
    expect(withNumbers).toContain('8th string');
    expect(withNumbers).not.toContain('undefined');
  });

  it('describes techniques in verbose mode', () => {
    const out = converter.convert(fixtures.techniquesTest, defaults);
    expect(out).toMatch(/hammer-on/);
    expect(out).toMatch(/pull-off/);
    expect(out).toMatch(/bend/);
    expect(out).toMatch(/vibrato/);
  });

  it('converts muted and open notation', () => {
    const out = converter.convert(fixtures.mutedNotesTest, defaults);
    expect(out).toContain('muted');
    expect(out).toContain('open');
    expect(out).not.toContain('0th fret');
  });

  it('still converts chord charts', () => {
    const out = converter.convert(fixtures.chordChartTest, defaults);
    expect(out).toContain('F chord');
    expect(out).toContain('Am chord');
    expect(out).toContain('open');
    expect(out).toContain('muted');
  });

  it('splits multi-section standard tabs into two sections', () => {
    const out = converter.convert(fixtures.twoSectionsTest, defaults);
    expect(out).toContain('Section 1');
    expect(out).toContain('Section 2');
  });

  it('converts bare tabs without labels or pipes', () => {
    const out = converter.convert(fixtures.bareLinesTest, defaults);
    expect(out).toContain('Section 1');
    expect(out).toContain('3rd fret');
  });

  it('converts bass tabs', () => {
    const out = converter.convert(fixtures.bassTest, defaults);
    expect(out).toContain('A string');
    expect(out).toContain('5th fret');
  });
});

describe('error behavior', () => {
  it('throws a single-level, plain-language error for non-tab text', () => {
    let message = '';
    try {
      converter.convert(fixtures.notATabTest, defaults);
    } catch (error) {
      message = error.message;
    }
    expect(message).toBeTruthy();
    expect(message).not.toContain('Error converting tab:');
    expect(message).not.toContain('Failed to parse tab:');
    // No nesting of the same phrase
    const firstSentence = message.split('.')[0];
    expect(message.split(firstSentence).length - 1).toBe(1);
  });

  it('throws for empty input', () => {
    expect(() => converter.convert('', defaults)).toThrow();
    expect(() => converter.convert(null, defaults)).toThrow();
  });
});

describe('settings', () => {
  it('compact mode produces chord fret patterns', () => {
    const out = converter.convert(fixtures.dropDTest, {
      ...defaults,
      verboseMode: false
    });
    expect(out).toMatch(/Chord: \([\dx-]+\)/);
  });

  it('reads settings from checkbox-like elements', () => {
    const elements = {
      includeTiming: { type: 'checkbox', checked: false },
      verboseMode: { type: 'checkbox', checked: true }
    };
    const settings = TabConverter.getSettingsFromElements(elements);
    expect(settings).toEqual({ includeTiming: false, verboseMode: true });
  });
});
