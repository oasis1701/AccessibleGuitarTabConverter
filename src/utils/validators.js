/**
 * @fileoverview Validation functions for the application
 * @module utils/validators
 */

import { PATTERNS, TAB_FORMATS } from './constants.js';

/**
 * Validate if a string is a valid tab format
 * @param {string} tabText - Tab text to validate
 * @returns {boolean} True if valid tab format
 */
export function isValidTab(tabText) {
  if (!tabText || typeof tabText !== 'string') {
    return false;
  }
  
  const lines = tabText.split('\n').filter(line => line.trim());
  return lines.length > 0 && (
    isChordChart(lines) || 
    hasTabLines(lines)
  );
}

/**
 * Check if lines represent a chord chart
 * @param {string[]} lines - Lines to check
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
  return chordLines > 0 && (chordLines / lines.length) > 0.5;
}

/**
 * Check if lines contain valid tab lines
 * @param {string[]} lines - Lines to check
 * @returns {boolean} True if contains tab lines
 */
export function hasTabLines(lines) {
  let tabLineCount = 0;
  
  for (const line of lines) {
    if (isTabLine(line) || isStandardTabLine(line)) {
      tabLineCount++;
    }
  }
  
  return tabLineCount >= 3; // Need at least 3 strings for valid tab
}

/**
 * Check if a line is a labeled tab line
 * @param {string} line - Line to check
 * @returns {boolean} True if labeled tab line
 */
export function isTabLine(line) {
  const hasNumbers = /\d/.test(line);
  const hasDashes = /-/.test(line);
  return PATTERNS.TAB_LINE.test(line) && (hasNumbers || hasDashes);
}

/**
 * Check if a line is a standard tab line
 * @param {string} line - Line to check
 * @returns {boolean} True if standard tab line
 */
export function isStandardTabLine(line) {
  return PATTERNS.STANDARD_TAB_LINE.test(line) || 
         /^\|[-\d\/\\~\^vhp\s|]+\|[-\d\/\\~\^vhp\s|]+/.test(line);
}

/**
 * Check if a line is a technique explanation line
 * @param {string} line - Line to check
 * @returns {boolean} True if technique line
 */
export function isTechniqueLine(line) {
  return PATTERNS.TECHNIQUE_LINE.test(line) || 
         PATTERNS.LEGEND_LINE.test(line);
}

/**
 * Detect the format of a tab
 * @param {string} tabText - Tab text to analyze
 * @returns {string} Tab format type from TAB_FORMATS enum
 */
export function detectTabFormat(tabText) {
  const lines = tabText.split('\n').filter(line => line.trim());
  
  if (isChordChart(lines)) {
    return TAB_FORMATS.CHORD_CHART;
  }
  
  // Check for standard tab format (starts with |)
  const standardTabLines = lines.filter(line => isStandardTabLine(line));
  if (standardTabLines.length >= 3) {
    return TAB_FORMATS.STANDARD_TAB;
  }
  
  // Check for labeled tab format
  const labeledTabLines = lines.filter(line => isTabLine(line));
  if (labeledTabLines.length >= 3) {
    return TAB_FORMATS.LABELED_TAB;
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
