/**
 * @fileoverview Parser for chord chart format tabs
 * @module converter/parsers/ChordParser
 */

import { PATTERNS } from '../../../utils/constants.js';
import { isValidChord } from '../../../utils/validators.js';

/**
 * Class to parse chord chart format tabs
 */
export class ChordParser {
  /**
   * Parse a chord chart from lines of text
   * @param {string[]} lines - Lines of text
   * @returns {Array<Object>} Array of parsed chords
   */
  parseChordChart(lines) {
    const chords = [];
    
    for (const line of lines) {
      const chord = this.parseChordLine(line.trim());
      if (chord) {
        chords.push(chord);
      }
    }
    
    return chords;
  }

  /**
   * Parse a single chord line
   * @param {string} line - Chord line (e.g., "F: 1-3-3-2-1-1")
   * @returns {Object|null} Parsed chord object or null
   * @private
   */
  parseChordLine(line) {
    const match = line.match(PATTERNS.CHORD_LINE);
    
    if (!match) return null;
    
    const chordName = match[1];
    const fretString = match[2];
    
    // Parse fret positions
    const frets = this.parseFretPositions(fretString);
    
    // Validate we have 6, 7, or 8 positions
    if (!isValidChord(frets)) {
      return null;
    }
    
    return {
      name: chordName,
      frets: frets,
      stringCount: frets.length
    };
  }

  /**
   * Parse fret positions from a string
   * @param {string} fretString - String of fret positions (e.g., "1-3-3-2-1-1")
   * @returns {Array} Array of fret positions
   * @private
   */
  parseFretPositions(fretString) {
    return fretString.split('-').map(f => {
      if (f.toUpperCase() === 'X') return 'mute';
      const num = parseInt(f);
      return isNaN(num) ? 'mute' : num;
    });
  }

  /**
   * Extract chord progressions from text
   * @param {string[]} lines - Lines of text
   * @returns {Array<Object>} Chord progression data
   */
  extractChordProgressions(lines) {
    const progressions = [];
    
    for (const line of lines) {
      // Look for lines with chord names separated by spaces or dashes
      const chordNamePattern = /^[A-G][#b]?(?:maj|min|m|M|dim|aug|sus|add)?[0-9]*/;
      const tokens = line.trim().split(/[\s\-|]+/);
      
      const chordSequence = [];
      for (const token of tokens) {
        if (chordNamePattern.test(token)) {
          chordSequence.push(token);
        }
      }
      
      if (chordSequence.length > 1) {
        progressions.push({
          chords: chordSequence,
          original: line.trim()
        });
      }
    }
    
    return progressions;
  }

  /**
   * Detect chord diagram format (ASCII art style)
   * @param {string[]} lines - Lines of text
   * @returns {Array<Object>} Parsed chord diagrams
   */
  parseChordDiagrams(lines) {
    const diagrams = [];
    
    // Look for patterns like:
    // C
    // e|---0---
    // B|---1---
    // G|---0---
    // D|---2---
    // A|---3---
    // E|-------
    
    let currentChord = null;
    let stringData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this is a chord name line
      if (line.length <= 5 && /^[A-G][#b]?[\w]*$/.test(line)) {
        // Save previous chord if exists
        if (currentChord && stringData.length === 6) {
          diagrams.push({
            name: currentChord,
            frets: this.extractFretsFromDiagram(stringData)
          });
        }
        
        currentChord = line;
        stringData = [];
      }
      // Check if this is a string line
      else if (/^[eEbBgGdDaA]\s*\|/.test(line)) {
        stringData.push(line);
      }
    }
    
    // Don't forget the last chord
    if (currentChord && stringData.length === 6) {
      diagrams.push({
        name: currentChord,
        frets: this.extractFretsFromDiagram(stringData)
      });
    }
    
    return diagrams;
  }

  /**
   * Extract fret numbers from chord diagram lines
   * @param {string[]} stringLines - Lines representing strings
   * @returns {Array} Fret positions
   * @private
   */
  extractFretsFromDiagram(stringLines) {
    const frets = [];
    
    // Process in order from high E to low E
    const stringOrder = ['e', 'B', 'G', 'D', 'A', 'E'];
    
    for (const stringName of stringOrder) {
      const line = stringLines.find(l => 
        l.toLowerCase().startsWith(stringName.toLowerCase())
      );
      
      if (line) {
        // Extract numbers from the line
        const match = line.match(/\|[^\|]*?(\d+|x|X|-)/);
        if (match) {
          const fret = match[1];
          if (fret === '-' || fret === 'x' || fret === 'X') {
            frets.push('mute');
          } else {
            frets.push(parseInt(fret));
          }
        } else {
          frets.push('mute');
        }
      }
    }
    
    return frets;
  }
}
