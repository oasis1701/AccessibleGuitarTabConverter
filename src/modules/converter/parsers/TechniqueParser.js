/**
 * @fileoverview Parser for guitar playing techniques
 * @module converter/parsers/TechniqueParser
 */

import { TECHNIQUES } from '../../../utils/constants.js';

/**
 * Class to parse and enhance notes with technique information
 */
export class TechniqueParser {
  constructor() {
    this.techniques = TECHNIQUES;
  }

  /**
   * Enhance note sequences with detailed technique information
   * @param {Array<Object>} sequences - Note sequences to enhance
   * @returns {Array<Object>} Enhanced sequences
   */
  enhanceWithTechniques(sequences) {
    return sequences.map(sequence => ({
      ...sequence,
      notes: this.enhanceNotes(sequence.notes)
    }));
  }

  /**
   * Enhance individual notes with technique details
   * @param {Array<Object>} notes - Notes to enhance
   * @returns {Array<Object>} Enhanced notes
   * @private
   */
  enhanceNotes(notes) {
    const enhancedNotes = [];
    
    for (let i = 0; i < notes.length; i++) {
      const currentNote = notes[i];
      const previousNote = i > 0 ? notes[i - 1] : null;
      const nextNote = i < notes.length - 1 ? notes[i + 1] : null;
      
      const enhanced = {
        ...currentNote,
        notes: currentNote.notes.map(note => 
          this.enhanceSingleNote(note, previousNote, nextNote)
        )
      };
      
      enhancedNotes.push(enhanced);
    }
    
    return enhancedNotes;
  }

  /**
   * Enhance a single note with technique context
   * @param {Object} note - Note to enhance
   * @param {Object|null} previousNote - Previous note group
   * @param {Object|null} nextNote - Next note group
   * @returns {Object} Enhanced note
   * @private
   */
  enhanceSingleNote(note, previousNote, nextNote) {
    const enhanced = { ...note };
    
    // Add context for techniques
    if (note.techniques && note.techniques.length > 0) {
      enhanced.techniqueDetails = this.getDetailedTechniques(
        note, 
        previousNote, 
        nextNote
      );
    }
    
    return enhanced;
  }

  /**
   * Get detailed technique information
   * @param {Object} note - Current note
   * @param {Object|null} previousNote - Previous note group
   * @param {Object|null} nextNote - Next note group
   * @returns {Array<Object>} Detailed technique information
   * @private
   */
  getDetailedTechniques(note, previousNote, nextNote) {
    return note.techniques.map(technique => {
      const details = {
        name: technique,
        description: this.getTechniqueDescription(technique)
      };
      
      // Add context for slides and hammer-ons/pull-offs
      if (technique === 'slide up' || technique === 'slide down') {
        details.context = this.getSlideContext(note, nextNote, technique);
      } else if (technique === 'hammer-on' || technique === 'pull-off') {
        details.context = this.getHammerPullContext(note, previousNote, nextNote, technique);
      } else if (technique === 'bend') {
        details.context = this.getBendContext(note);
      }
      
      return details;
    });
  }

  /**
   * Get technique description
   * @param {string} technique - Technique name
   * @returns {string} Technique description
   * @private
   */
  getTechniqueDescription(technique) {
    const descriptions = {
      'hammer-on': 'Strike the string and tap the higher fret with another finger',
      'pull-off': 'Pull your finger off the fret to sound the lower note',
      'bend': 'Push or pull the string to raise the pitch',
      'release': 'Return the bent string to its original position',
      'slide': 'Slide your finger along the string between frets',
      'slide up': 'Slide your finger up to a higher fret',
      'slide down': 'Slide your finger down to a lower fret',
      'vibrato': 'Rapidly bend and release the string for a wavering effect',
      'tap': 'Tap the fret with your picking hand finger',
      'mute': 'Lightly touch the string to prevent it from ringing',
      'whammy': 'Use the whammy bar to lower and raise the pitch'
    };
    
    return descriptions[technique] || technique;
  }

  /**
   * Get context for slide techniques
   * @param {Object} note - Current note
   * @param {Object|null} nextNote - Next note group
   * @param {string} technique - Slide technique
   * @returns {string} Slide context
   * @private
   */
  getSlideContext(note, nextNote, technique) {
    if (!nextNote || !nextNote.notes) return '';
    
    // Find the next note on the same string
    const nextNoteOnString = nextNote.notes.find(n => 
      n.stringIndex === note.stringIndex
    );
    
    if (nextNoteOnString && typeof nextNoteOnString.fret === 'number') {
      const direction = technique === 'slide up' ? 'up' : 'down';
      return `Slide ${direction} from ${note.fret} to ${nextNoteOnString.fret}`;
    }
    
    return '';
  }

  /**
   * Get context for hammer-on and pull-off techniques
   * @param {Object} note - Current note
   * @param {Object|null} previousNote - Previous note group
   * @param {Object|null} nextNote - Next note group
   * @param {string} technique - Technique name
   * @returns {string} Technique context
   * @private
   */
  getHammerPullContext(note, previousNote, nextNote, technique) {
    if (technique === 'hammer-on' && previousNote) {
      const prevNoteOnString = previousNote.notes.find(n => 
        n.stringIndex === note.stringIndex
      );
      
      if (prevNoteOnString && typeof prevNoteOnString.fret === 'number') {
        return `Hammer from ${prevNoteOnString.fret} to ${note.fret}`;
      }
    } else if (technique === 'pull-off' && nextNote) {
      const nextNoteOnString = nextNote.notes.find(n => 
        n.stringIndex === note.stringIndex
      );
      
      if (nextNoteOnString && typeof nextNoteOnString.fret === 'number') {
        return `Pull off from ${note.fret} to ${nextNoteOnString.fret}`;
      }
    }
    
    return '';
  }

  /**
   * Get context for bend techniques
   * @param {Object} note - Current note
   * @returns {string} Bend context
   * @private
   */
  getBendContext(note) {
    // Could be enhanced to detect bend amount if notation includes it
    return `Bend the string at fret ${note.fret}`;
  }

  /**
   * Detect ghost notes and grace notes
   * @param {string} content - Tab line content
   * @param {number} position - Note position
   * @returns {Object} Ghost/grace note info
   */
  detectSpecialNotes(content, position) {
    const specialNotes = {
      isGhost: false,
      isGrace: false
    };
    
    // Check for parentheses (ghost notes)
    if (position > 0 && position < content.length - 1) {
      if (content[position - 1] === '(' && content[position + 1] === ')') {
        specialNotes.isGhost = true;
      }
    }
    
    // Check for grace notes (usually smaller or with specific notation)
    // This would need more sophisticated parsing based on the tab format
    
    return specialNotes;
  }

  /**
   * Parse complex techniques like harmonics
   * @param {string} content - Tab line content
   * @param {number} position - Note position
   * @returns {Array<string>} Additional techniques
   */
  parseComplexTechniques(content, position) {
    const techniques = [];
    
    // Check for harmonics notation
    if (content.includes('<') && content.includes('>')) {
      const beforePos = content.lastIndexOf('<', position);
      const afterPos = content.indexOf('>', position);
      
      if (beforePos !== -1 && afterPos !== -1 && beforePos < position && position < afterPos) {
        techniques.push('harmonic');
      }
    }
    
    // Check for palm mute notation (PM)
    if (position >= 2 && content.substring(position - 2, position) === 'PM') {
      techniques.push('palm mute');
    }
    
    return techniques;
  }
}
