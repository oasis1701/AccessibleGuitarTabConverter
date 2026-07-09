/**
 * @fileoverview Main tab converter class that orchestrates the conversion process
 * @module converter/TabConverter
 */

import { ChordParser } from './parsers/ChordParser.js';
import { StandardTabParser } from './parsers/StandardTabParser.js';
import { OutputFormatter } from './formatters/OutputFormatter.js';
import { detectTabFormat, validateSettings } from '../../utils/validators.js';
import { TAB_FORMATS } from '../../utils/constants.js';

/**
 * Main class for converting guitar tabs to accessible format
 */
export class TabConverter {
  /**
   * Create a TabConverter instance
   */
  constructor() {
    this.chordParser = new ChordParser();
    this.standardTabParser = new StandardTabParser();
    this.outputFormatter = new OutputFormatter();
  }

  /**
   * Convert tab text to accessible format
   * @param {string} tabText - Raw tab text
   * @param {Object} settings - Conversion settings
   * @returns {string} Converted accessible format
   * @throws {Error} If conversion fails; error messages are plain sentences
   *   meant to be shown to the user directly
   */
  convert(tabText, settings = {}) {
    if (!tabText || typeof tabText !== 'string' || !tabText.trim()) {
      throw new Error('Please paste a guitar tab to convert.');
    }

    // Normalize line endings, tabs and unicode dashes once, up front.
    const normalized = tabText
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/[–—]/g, '-');

    const validatedSettings = validateSettings(settings);
    const tabFormat = detectTabFormat(normalized);

    if (!tabFormat) {
      throw new Error(
        "This text doesn't look like a guitar tab. Paste the plain-text " +
          'version of a tab, with string lines made of dashes and fret ' +
          'numbers, like e|--3--5--|.'
      );
    }

    if (tabFormat === TAB_FORMATS.CHORD_CHART) {
      return this.convertChordChart(normalized, validatedSettings);
    }
    return this.convertTablature(normalized, validatedSettings);
  }

  /**
   * Convert chord chart format
   * @param {string} tabText - Chord chart text
   * @param {Object} settings - Conversion settings
   * @returns {string} Converted chord chart
   * @private
   */
  convertChordChart(tabText, settings) {
    const lines = tabText.split('\n').filter(line => line.trim());
    const chords = this.chordParser.parseChordChart(lines);

    if (chords.length === 0) {
      throw new Error('No valid chords found in chord chart.');
    }

    return this.outputFormatter.formatChordChart(chords, settings);
  }

  /**
   * Convert tablature format
   * @param {string} tabText - Tab text
   * @param {Object} settings - Conversion settings
   * @returns {string} Converted tablature
   * @private
   */
  convertTablature(tabText, settings) {
    // Keep blank lines: they separate tab sections.
    const lines = tabText.split('\n');
    const tabData = this.standardTabParser.parse(lines);

    if (tabData.sequences.length === 0) {
      throw new Error(
        'No notes found in the tab. Check that the string lines contain fret numbers.'
      );
    }

    return this.outputFormatter.formatTablature(tabData, settings);
  }

  /**
   * Format an already-parsed tab model into accessible text. Used by the
   * Guitar Pro import path, which produces the same { sequences,
   * annotations } model as the ASCII parser but from file data.
   * @param {Object} tabData - Parsed tab data
   * @param {Object} settings - Conversion settings
   * @returns {string} Converted accessible format
   */
  formatTabData(tabData, settings = {}) {
    return this.outputFormatter.formatTablature(tabData, validateSettings(settings));
  }

  /**
   * Get current conversion settings
   * @param {Object} settingsElements - Object containing setting element references
   * @returns {Object} Current settings
   */
  static getSettingsFromElements(settingsElements) {
    const settings = {};

    for (const [key, element] of Object.entries(settingsElements)) {
      if (element && element.type === 'checkbox') {
        settings[key] = element.checked;
      }
    }

    return settings;
  }

  /**
   * Apply settings to UI elements
   * @param {Object} settings - Settings to apply
   * @param {Object} settingsElements - Object containing setting element references
   */
  static applySettingsToElements(settings, settingsElements) {
    for (const [key, value] of Object.entries(settings)) {
      const element = settingsElements[key];
      if (element && element.type === 'checkbox' && typeof value === 'boolean') {
        element.checked = value;
      }
    }
  }
}
