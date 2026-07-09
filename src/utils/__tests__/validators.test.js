import { describe, it, expect } from 'vitest';
import {
  detectTabFormat,
  isStringLine,
  isMusicContent,
  validateSettings,
  validateTabName
} from '../validators.js';
import { TAB_FORMATS } from '../constants.js';
import * as fixtures from '../../modules/converter/__tests__/fixtures.js';

describe('detectTabFormat', () => {
  it('detects labeled tabs with uppercase labels', () => {
    expect(detectTabFormat(fixtures.ambiguousStringTest)).toBe(
      TAB_FORMATS.LABELED_TAB
    );
  });

  it('detects labeled tabs with lowercase labels', () => {
    expect(detectTabFormat(fixtures.lowercaseLabelsTest)).toBe(
      TAB_FORMATS.LABELED_TAB
    );
  });

  it('detects unlabeled pipe-leading tabs', () => {
    expect(detectTabFormat(fixtures.twoSectionsTest)).toBe(
      TAB_FORMATS.STANDARD_TAB
    );
  });

  it('detects bare dash tabs', () => {
    expect(detectTabFormat(fixtures.bareLinesTest)).toBe(
      TAB_FORMATS.STANDARD_TAB
    );
  });

  it('detects chord charts', () => {
    expect(detectTabFormat(fixtures.chordChartTest)).toBe(
      TAB_FORMATS.CHORD_CHART
    );
  });

  it('does not mistake a pipe-free labeled tab for a chord chart', () => {
    const tab = [
      'E :---3---5---',
      'B :---3---5---',
      'G :---0---0---',
      'D :-----------',
      'A :-----------',
      'E :-----------'
    ].join('\n');
    expect(detectTabFormat(tab)).toBe(TAB_FORMATS.LABELED_TAB);
  });

  it('returns null for plain text', () => {
    expect(detectTabFormat(fixtures.notATabTest)).toBeNull();
  });
});

describe('isStringLine', () => {
  it('accepts labeled lines of any case', () => {
    expect(isStringLine('e|---3---|')).toBe(true);
    expect(isStringLine('b|---3---|')).toBe(true);
    expect(isStringLine('F#|--0--|')).toBe(true);
    expect(isStringLine('E :----15h16----|')).toBe(true);
  });

  it('accepts bare music lines', () => {
    expect(isStringLine('----0----3----')).toBe(true);
    expect(isStringLine('|--3--5--|')).toBe(true);
  });

  it('rejects prose and legends', () => {
    expect(isStringLine('Dear diary,')).toBe(false);
    expect(isStringLine('| h  Hammer-on')).toBe(false);
    expect(isStringLine('')).toBe(false);
  });
});

describe('isMusicContent', () => {
  it('accepts dashes with digits and techniques', () => {
    expect(isMusicContent('---5h7---12b14---')).toBe(true);
  });

  it('rejects word content', () => {
    expect(isMusicContent('today I practiced')).toBe(false);
  });
});

describe('validateSettings', () => {
  it('defaults all settings to true', () => {
    expect(validateSettings({})).toEqual({
      includeTiming: true,
      verboseMode: true,
      useStringNames: true,
      includeTechniqueDetails: true,
      includeDurations: true
    });
  });

  it('only copies booleans', () => {
    const result = validateSettings({ verboseMode: false, includeTiming: 'nope' });
    expect(result.verboseMode).toBe(false);
    expect(result.includeTiming).toBe(true);
  });

  it('passes includeDurations through', () => {
    expect(validateSettings({ includeDurations: false }).includeDurations).toBe(false);
  });
});

describe('validateTabName', () => {
  it('accepts normal names and trims them', () => {
    expect(validateTabName('  Stairway  ')).toEqual({
      isValid: true,
      name: 'Stairway'
    });
  });

  it('rejects empty and invalid-character names', () => {
    expect(validateTabName('').isValid).toBe(false);
    expect(validateTabName('a<b>').isValid).toBe(false);
  });
});
