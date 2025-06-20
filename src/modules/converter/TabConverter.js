/**
 * @fileoverview Main tab converter class that orchestrates the conversion process
 * @module converter/TabConverter
 */

import { STRING_NAMES, STRING_NAMES_7, STRING_NAMES_8, STRING_NUMBERS, STRING_NUMBERS_7, STRING_NUMBERS_8, DEFAULT_SETTINGS } from '../../utils/constants.js';
import { ChordParser } from './parsers/ChordParser.js';
import { StandardTabParser } from './parsers/StandardTabParser.js';
import { TechniqueParser } from './parsers/TechniqueParser.js';
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
    this.stringNames = STRING_NAMES;
    this.stringNumbers = STRING_NUMBERS;
    
    // Initialize parsers
    this.chordParser = new ChordParser();
    this.standardTabParser = new StandardTabParser();
    this.techniqueParser = new TechniqueParser();
    this.outputFormatter = new OutputFormatter();
  }

  /**
   * Convert tab text to accessible format
   * @param {string} tabText - Raw tab text
   * @param {Object} settings - Conversion settings
   * @returns {string} Converted accessible format
   * @throws {Error} If conversion fails
   */
  convert(tabText, settings = {}) {
    if (!tabText || typeof tabText !== 'string') {
      throw new Error('Please enter a guitar tab to convert.');
    }

    const validatedSettings = validateSettings(settings);
    const tabFormat = detectTabFormat(tabText);

    if (!tabFormat) {
      throw new Error('No valid tab format detected. Please check that your tab is in the correct format.');
    }

    try {
      switch (tabFormat) {
        case TAB_FORMATS.CHORD_CHART:
          return this.convertChordChart(tabText, validatedSettings);
        
        case TAB_FORMATS.STANDARD_TAB:
        case TAB_FORMATS.LABELED_TAB:
          return this.convertTablature(tabText, validatedSettings, tabFormat);
        
        default:
          throw new Error('Unsupported tab format');
      }
    } catch (error) {
      throw new Error(`Error converting tab: ${error.message}`);
    }
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
   * @param {string} tabFormat - Tab format type
   * @returns {string} Converted tablature
   * @private
   */
  convertTablature(tabText, settings, tabFormat) {
    const lines = tabText.split('\n').filter(line => line.trim());
    
    // Parse the tab based on format
    const parser = tabFormat === TAB_FORMATS.STANDARD_TAB ? 
      this.standardTabParser : this.standardTabParser; // Use same parser for now
    
    const tabData = parser.parse(lines);
    
    if (tabData.sequences.length === 0) {
      throw new Error('No notes found in the tab. Please make sure your tab is properly formatted.');
    }
    
    // Apply technique analysis
    tabData.sequences = this.techniqueParser.enhanceWithTechniques(tabData.sequences);
    
    // Format the output
    return this.outputFormatter.formatTablature(tabData, settings);
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
