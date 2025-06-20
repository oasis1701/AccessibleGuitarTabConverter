/**
 * @fileoverview Parser for standard tablature format
 * @module converter/parsers/StandardTabParser
 */

import { STRING_NAMES, STRING_NAMES_7, STRING_NAMES_8, PATTERNS } from '../../../utils/constants.js';
import { isTabLine, isStandardTabLine, isTechniqueLine } from '../../../utils/validators.js';

/**
 * Class to parse standard and labeled tablature formats
 */
export class StandardTabParser {
  /**
   * Parse tablature lines into structured data
   * @param {string[]} lines - All lines from the tab
   * @returns {Object} Parsed tab data with sequences and annotations
   */
  parse(lines) {
    const tabLineGroups = this.identifyTabLines(lines);
    const annotations = this.extractAnnotations(lines);
    const sequences = this.parseNoteSequences(tabLineGroups, annotations);
    
    return {
      sequences,
      annotations,
      tabLineGroups
    };
  }

  /**
   * Identify and group tab lines
   * @param {string[]} lines - All lines from the tab
   * @returns {Array<Array<Object>>} Groups of tab lines
   * @private
   */
  identifyTabLines(lines) {
    const tabLineGroups = [];
    
    // First check if this is a standard 6-line tab format (no string labels)
    const standardTabGroup = this.identifyStandardTabFormat(lines);
    if (standardTabGroup.length > 0) {
      return standardTabGroup;
    }
    
    // Fall back to labeled tab format
    let currentGroup = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (isTabLine(line)) {
        const stringInfo = this.identifyString(line);
        if (stringInfo) {
          currentGroup.push({
            content: line,
            stringIndex: stringInfo.index,
            stringName: stringInfo.name,
            lineNumber: i
          });
        }
      } else if (currentGroup.length > 0) {
        // End of current tab group
        if (currentGroup.length >= 3) { // At least 3 strings for valid tab
          tabLineGroups.push(currentGroup);
        }
        currentGroup = [];
      }
    }
    
    // Don't forget the last group
    if (currentGroup.length >= 3) {
      tabLineGroups.push(currentGroup);
    }
    
    return tabLineGroups;
  }

  /**
   * Identify standard tab format (no string labels)
   * @param {string[]} lines - All lines from the tab
   * @returns {Array<Array<Object>>} Groups of standard tab lines
   * @private
   */
  identifyStandardTabFormat(lines) {
    const tabGroups = [];
    let currentGroup = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and technique legends
      if (!line || isTechniqueLine(line)) {
        continue;
      }
      
      // Check if this looks like a standard tab line
      if (isStandardTabLine(line)) {
        currentGroup.push({
          content: line,
          stringIndex: currentGroup.length, // Position determines string
          stringName: null, // Will be set after detecting string count
          lineNumber: i
        });
        
        // Check if we have a complete group (6, 7, or 8 strings)
        if (currentGroup.length >= 6) {
          // Look ahead to see if there are more strings
          let nextLineIndex = i + 1;
          let hasMoreStrings = false;
          
          while (nextLineIndex < lines.length && currentGroup.length < 8) {
            const nextLine = lines[nextLineIndex].trim();
            if (isStandardTabLine(nextLine)) {
              currentGroup.push({
                content: nextLine,
                stringIndex: currentGroup.length,
                stringName: null,
                lineNumber: nextLineIndex
              });
              i = nextLineIndex; // Skip this line in the main loop
              hasMoreStrings = true;
            } else if (!nextLine || isTechniqueLine(nextLine)) {
              nextLineIndex++;
              continue;
            } else {
              break;
            }
            nextLineIndex++;
          }
          
          // Determine string names based on count
          const stringCount = currentGroup.length;
          const stringNames = this.getStringNamesForCount(stringCount);
          
          // Update string names
          currentGroup.forEach((line, index) => {
            line.stringName = stringNames[index];
          });
          
          tabGroups.push([...currentGroup]);
          currentGroup = [];
        }
      } else if (currentGroup.length > 0) {
        // End current group if we have at least 3 strings
        if (currentGroup.length >= 3) {
          // Set string names for incomplete groups
          const stringNames = this.getStringNamesForCount(currentGroup.length);
          currentGroup.forEach((line, index) => {
            line.stringName = stringNames[index];
          });
          tabGroups.push([...currentGroup]);
        }
        currentGroup = [];
      }
    }
    
    // Don't forget the last group
    if (currentGroup.length >= 3) {
      const stringNames = this.getStringNamesForCount(currentGroup.length);
      currentGroup.forEach((line, index) => {
        line.stringName = stringNames[index];
      });
      tabGroups.push(currentGroup);
    }
    
    return tabGroups;
  }

  /**
   * Get string names array based on string count
   * @param {number} count - Number of strings
   * @returns {string[]} Array of string names
   * @private
   */
  getStringNamesForCount(count) {
    switch (count) {
      case 7:
        return STRING_NAMES_7;
      case 8:
        return STRING_NAMES_8;
      case 6:
        return STRING_NAMES;
      default:
        // For non-standard counts, use generic names
        const names = [];
        for (let i = 0; i < count; i++) {
          if (i < 6) {
            names.push(STRING_NAMES[i]);
          } else if (i === 6) {
            names.push('B'); // 7th string
          } else if (i === 7) {
            names.push('F#'); // 8th string
          } else {
            names.push(`String ${i + 1}`);
          }
        }
        return names;
    }
  }

  /**
   * Identify string from a labeled tab line
   * @param {string} line - Tab line with string label
   * @returns {Object|null} String info with index and name
   * @private
   */
  identifyString(line) {
    const trimmed = line.trim();
    
    // Common string indicators for 6, 7, and 8 string guitars
    const stringPatterns = [
      { pattern: /^e[\s]*[:!|]/, index: 0, name: 'E' },
      { pattern: /^E[\s]*[:!|]/, index: 0, name: 'E' },
      { pattern: /^B[\s]*[:!|]/, index: 1, name: 'B' },
      { pattern: /^G[\s]*[:!|]/, index: 2, name: 'G' },
      { pattern: /^D[\s]*[:!|]/, index: 3, name: 'D' },
      { pattern: /^A[\s]*[:!|]/, index: 4, name: 'A' },
      { pattern: /^E[\s]*[:!|]/, index: 5, name: 'E' },  // Low E
      { pattern: /^B[\s]*[:!|]/, index: 6, name: 'B' },  // 7th string (low B)
      { pattern: /^F#[\s]*[:!|]/, index: 7, name: 'F#' }, // 8th string
      { pattern: /^F[\s]*[:!|]/, index: 7, name: 'F#' }   // Alternative notation
    ];
    
    // Check each pattern
    for (const sp of stringPatterns) {
      if (sp.pattern.test(trimmed)) {
        // For E and B strings, we need context to determine position
        if (sp.name === 'E') {
          // Could be high E (index 0) or low E (index 5)
          // This is a heuristic - might need the full context to be certain
          return { index: sp.index, name: sp.index === 0 ? 'high E' : 'low E' };
        } else if (sp.name === 'B' && (sp.index === 1 || sp.index === 6)) {
          // Could be regular B (index 1) or low B (index 6)
          return { index: sp.index, name: sp.index === 1 ? 'B' : 'low B' };
        }
        return { index: sp.index, name: sp.name };
      }
    }
    
    return null;
  }

  /**
   * Extract annotations from non-tab lines
   * @param {string[]} lines - All lines from the tab
   * @returns {Array<Object>} Extracted annotations
   * @private
   */
  extractAnnotations(lines) {
    const annotations = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for text that appears between tab sections
      if (!isTabLine(line) && !isStandardTabLine(line) && !isTechniqueLine(line) && line.trim().length > 0) {
        const trimmed = line.trim();
        const position = line.indexOf(trimmed);
        
        // Categorize the annotation
        let category = 'note';
        if (/^[IVX]+\s*-/.test(trimmed)) {
          category = 'section';
        } else if (trimmed.startsWith('"') || trimmed.includes('"')) {
          category = 'lyrics';
        } else if (/\d+:\d+/.test(trimmed)) {
          category = 'timing';
        } else if (/repeat|times|x\d+/i.test(trimmed)) {
          category = 'instruction';
        } else if (/^[A-G][#b]?[\w]*\s+[A-G][#b]?/.test(trimmed)) {
          category = 'chords';
        }
        
        annotations.push({ 
          text: trimmed, 
          position: position,
          lineNumber: i,
          category: category
        });
      }
    }
    
    return annotations;
  }

  /**
   * Parse note sequences from tab line groups
   * @param {Array<Array<Object>>} tabLineGroups - Groups of tab lines
   * @param {Array<Object>} annotations - Annotations
   * @returns {Array<Object>} Parsed note sequences
   * @private
   */
  parseNoteSequences(tabLineGroups, annotations) {
    const allSequences = [];
    
    for (let groupIndex = 0; groupIndex < tabLineGroups.length; groupIndex++) {
      const group = tabLineGroups[groupIndex];
      const sequence = this.parseTabGroup(group, annotations, groupIndex + 1);
      if (sequence.notes.length > 0) {
        allSequences.push(sequence);
      }
    }
    
    return allSequences;
  }

  /**
   * Parse a single group of tab lines
   * @param {Array<Object>} tabGroup - Group of tab lines
   * @param {Array<Object>} annotations - Annotations
   * @param {number} sectionNumber - Section number
   * @returns {Object} Parsed sequence
   * @private
   */
  parseTabGroup(tabGroup, annotations, sectionNumber) {
    // Sort strings by index (high E to low E)
    tabGroup.sort((a, b) => a.stringIndex - b.stringIndex);
    
    const notes = [];
    const maxLength = Math.max(...tabGroup.map(line => line.content.length));
    
    // Parse position by position
    for (let pos = 0; pos < maxLength; pos++) {
      const notesAtPosition = [];
      
      for (const stringLine of tabGroup) {
        const note = this.parseNoteAtPosition(stringLine, pos);
        if (note) {
          notesAtPosition.push(note);
        }
      }
      
      if (notesAtPosition.length > 0) {
        // Check for annotations at this position
        const annotation = this.findAnnotationAtPosition(annotations, pos, tabGroup[0].lineNumber);
        
        notes.push({
          position: pos,
          annotation: annotation,
          notes: notesAtPosition,
          isChord: notesAtPosition.length > 1
        });
      }
    }
    
    return {
      section: sectionNumber,
      notes: notes
    };
  }

  /**
   * Parse note at a specific position
   * @param {Object} stringLine - String line data
   * @param {number} position - Position in the line
   * @returns {Object|null} Parsed note or null
   * @private
   */
  parseNoteAtPosition(stringLine, position) {
    const content = stringLine.content;
    if (position >= content.length) return null;
    
    const char = content[position];
    
    // Skip non-note characters
    if (char === '-' || char === '|' || char === ' ' || char === ':') {
      return null;
    }
    
    // Parse fret number (could be multi-digit)
    let fretNum = '';
    let currentPos = position;
    
    while (currentPos < content.length && /\d/.test(content[currentPos])) {
      fretNum += content[currentPos];
      currentPos++;
    }
    
    if (fretNum === '') {
      // Check for special characters
      if (char === 'x' || char === 'X') {
        return {
          string: stringLine.stringName,
          stringIndex: stringLine.stringIndex,
          fret: 'mute',
          techniques: [],
          position: position
        };
      }
      return null;
    }
    
    // Look for techniques around this note
    const techniques = this.findTechniques(content, position, currentPos - position);
    
    return {
      string: stringLine.stringName,
      stringIndex: stringLine.stringIndex,
      fret: parseInt(fretNum),
      techniques: techniques,
      position: position
    };
  }

  /**
   * Find techniques around a note
   * @param {string} content - Line content
   * @param {number} notePosition - Position of the note
   * @param {number} noteLength - Length of the fret number
   * @returns {Array<string>} Found techniques
   * @private
   */
  findTechniques(content, notePosition, noteLength = 1) {
    const techniques = [];
    const techniqueMap = {
      'h': 'hammer-on',
      'p': 'pull-off',
      'b': 'bend',
      'r': 'release',
      's': 'slide',
      '/': 'slide up',
      '\\': 'slide down',
      '~': 'vibrato',
      't': 'tap',
      '^': 'bend',
      'v': 'whammy'
    };
    
    // Check characters immediately before and after the note
    const checkPositions = [
      notePosition - 1,
      notePosition + noteLength
    ];
    
    for (const pos of checkPositions) {
      if (pos >= 0 && pos < content.length) {
        const char = content[pos];
        if (techniqueMap[char]) {
          techniques.push(techniqueMap[char]);
        }
      }
    }
    
    return techniques;
  }

  /**
   * Find annotation at a specific position
   * @param {Array<Object>} annotations - All annotations
   * @param {number} position - Position to check
   * @param {number} lineNumber - Line number to check
   * @returns {string|null} Annotation text or null
   * @private
   */
  findAnnotationAtPosition(annotations, position, lineNumber) {
    for (const annotation of annotations) {
      // Check if annotation is near this position and line
      if (Math.abs(annotation.position - position) <= 10 && 
          Math.abs(annotation.lineNumber - lineNumber) <= 2) {
        return annotation.text;
      }
    }
    return null;
  }

  /**
   * Detect measures/bars in tab lines
   * @param {string} line - Tab line
   * @returns {Array<number>} Positions of measure markers
   */
  detectMeasures(line) {
    const measures = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '|') {
        measures.push(i);
      }
    }
    return measures;
  }
}
