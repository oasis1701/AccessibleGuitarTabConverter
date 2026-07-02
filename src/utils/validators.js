/**
 * @fileoverview Validation functions for the application
 * @module utils/validators
 */

import { PATTERNS, TAB_FORMATS } from './constants.js';

/**
 * Characters that may appear in the musical body of a tab string line.
 * Dashes, digits, bar lines, technique symbols, mute/open markers,
 * ghost-note and harmonic brackets, and whitespace.
 * @type {RegExp}
 */
const MUSIC_CHARS = /^[-|:0-9xXoO()<>hpbrstv~/\\^.=*\s]*$/;

/**
 * Validate if a string looks like a convertible tab
 * @param {string} tabText - Tab text to validate
 * @returns {boolean} True if valid tab format
 */
export function isValidTab(tabText) {
  return detectTabFormat(tabText) !== null;
}

/**
 * Check if lines represent a chord chart
 * @param {string[]} lines - Non-blank lines to check
 * @returns {boolean} True if chord chart format
 */
export function isChordChart(lines) {
  let chordLines = 0;

  for (const line of lines) {
    if (PATTERNS.CHORD_LINE.test(line.trim())) {
      chordLines++;
    }
  }

  // If more than half the lines are chord definitions, treat as chord chart
  return chordLines > 0 && chordLines / lines.length > 0.5;
}

/**
 * Split a labeled tab line into its label and musical body.
 * @param {string} line - Line to split
 * @returns {{label: string, body: string, bodyStart: number}|null}
 *   Label info, or null when the line has no string label
 */
export function splitStringLabel(line) {
  const match = line.match(PATTERNS.STRING_LABEL);
  if (!match) return null;

  return {
    label: match[1],
    body: line.slice(match[0].length),
    bodyStart: match[0].length
  };
}

/**
 * Check whether text is plausible musical tab content:
 * only tab characters, mostly dashes/digits/bars, at least a few dashes.
 * @param {string} text - Candidate body text
 * @returns {boolean} True if the text looks like tab music
 */
export function isMusicContent(text) {
  if (!text || !MUSIC_CHARS.test(text)) return false;

  const solid = text.replace(/\s/g, '');
  if (solid.length < 4) return false;

  const dashes = (solid.match(/-/g) || []).length;
  if (dashes < 2) return false;

  const core = (solid.match(/[-|0-9]/g) || []).length;
  return core / solid.length >= 0.5;
}

/**
 * Check if a line is a tab string line — labeled (any case, any tuning
 * letter) or bare (dashes and frets with no label).
 * @param {string} line - Line to check
 * @returns {boolean} True if the line carries string music
 */
export function isStringLine(line) {
  if (!line || !line.trim()) return false;
  if (isTechniqueLine(line.trim())) return false;

  const labeled = splitStringLabel(line);
  if (labeled) return isMusicContent(labeled.body);

  return isMusicContent(line.trim());
}

/**
 * Check if a line is a technique legend/key line (e.g. "| h  Hammer-on")
 * @param {string} line - Line to check
 * @returns {boolean} True if technique line
 */
export function isTechniqueLine(line) {
  return PATTERNS.TECHNIQUE_LINE.test(line) || PATTERNS.LEGEND_LINE.test(line);
}

/**
 * Detect the format of a tab
 * @param {string} tabText - Tab text to analyze
 * @returns {string|null} Tab format type from TAB_FORMATS enum, or null
 */
export function detectTabFormat(tabText) {
  if (!tabText || typeof tabText !== 'string') return null;

  const lines = tabText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return null;

  if (isChordChart(lines)) {
    return TAB_FORMATS.CHORD_CHART;
  }

  const stringLines = lines.filter(line => isStringLine(line));
  if (stringLines.length >= 2) {
    const anyLabeled = stringLines.some(line => splitStringLabel(line));
    return anyLabeled ? TAB_FORMATS.LABELED_TAB : TAB_FORMATS.STANDARD_TAB;
  }

  return null;
}

/**
 * Validate conversion settings
 * @param {Object} settings - Settings object to validate
 * @returns {Object} Validated settings with defaults for missing values
 */
export function validateSettings(settings) {
  const validSettings = {
    includeTiming: true,
    verboseMode: true,
    useStringNames: true,
    includeTechniqueDetails: true
  };

  if (settings && typeof settings === 'object') {
    // Only copy boolean values
    Object.keys(validSettings).forEach(key => {
      if (typeof settings[key] === 'boolean') {
        validSettings[key] = settings[key];
      }
    });
  }

  return validSettings;
}

/**
 * Validate a tab name
 * @param {string} name - Tab name to validate
 * @returns {Object} Validation result with isValid and error message
 */
export function validateTabName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Tab name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Tab name cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Tab name must be less than 100 characters' };
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(trimmed)) {
    return { isValid: false, error: 'Tab name contains invalid characters' };
  }

  return { isValid: true, name: trimmed };
}

/**
 * Validate fret number
 * @param {*} fret - Fret value to validate
 * @returns {boolean} True if valid fret number
 */
export function isValidFret(fret) {
  if (fret === 'mute' || fret === 'x' || fret === 'X') {
    return true;
  }

  const num = parseInt(fret);
  return !isNaN(num) && num >= 0 && num <= 24;
}

/**
 * Validate string index
 * @param {number} index - String index to validate
 * @returns {boolean} True if valid string index (0-7 for up to 8 strings)
 */
export function isValidStringIndex(index) {
  return Number.isInteger(index) && index >= 0 && index <= 7;
}

/**
 * Validate chord fret positions
 * @param {Array} frets - Array of fret positions
 * @returns {boolean} True if valid chord
 */
export function isValidChord(frets) {
  if (!Array.isArray(frets)) {
    return false;
  }

  // Accept 6, 7, or 8 string chords
  if (frets.length < 6 || frets.length > 8) {
    return false;
  }

  return frets.every(fret => isValidFret(fret));
}

/**
 * Validate tab data structure
 * @param {Object} tabData - Tab data to validate
 * @returns {Object} Validation result
 */
export function validateTabData(tabData) {
  const errors = [];

  if (!tabData || typeof tabData !== 'object') {
    return { isValid: false, errors: ['Invalid tab data'] };
  }

  // Required fields
  if (!tabData.name || typeof tabData.name !== 'string') {
    errors.push('Tab name is required');
  }

  if (!tabData.originalTab || typeof tabData.originalTab !== 'string') {
    errors.push('Original tab content is required');
  }

  if (!tabData.convertedTab || typeof tabData.convertedTab !== 'string') {
    errors.push('Converted tab content is required');
  }

  // Optional fields with type checking
  if (tabData.settings && typeof tabData.settings !== 'object') {
    errors.push('Settings must be an object');
  }

  if (tabData.dateCreated && !isValidDate(tabData.dateCreated)) {
    errors.push('Invalid creation date');
  }

  if (tabData.dateModified && !isValidDate(tabData.dateModified)) {
    errors.push('Invalid modification date');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Check if a value is a valid date string
 * @param {*} dateString - Date string to validate
 * @returns {boolean} True if valid date
 */
function isValidDate(dateString) {
  if (typeof dateString !== 'string') {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
