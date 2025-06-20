/**
 * @fileoverview Formatter for converting parsed tab data to accessible text format
 * @module converter/formatters/OutputFormatter
 */

import { getOrdinalSuffix } from '../../../utils/helpers.js';
import { STRING_NUMBERS } from '../../../utils/constants.js';

/**
 * Class to format parsed tab data into accessible text
 */
export class OutputFormatter {
  /**
   * Format a chord chart into accessible text
   * @param {Array<Object>} chords - Parsed chords
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted chord chart
   */
  formatChordChart(chords, settings) {
    let output = 'Chord Chart:\n\n';
    
    for (const chord of chords) {
      const stringCount = chord.frets.length;
      output += `${chord.name} chord (${stringCount}-string):\n`;
      
      for (let i = 0; i < stringCount; i++) {
        const stringName = settings.useStringNames ? 
          this.getStringName(i, stringCount) : 
          `String ${i + 1}`;
        
        const fret = chord.frets[i];
        
        if (fret === 'mute') {
          output += `- ${stringName}: muted\n`;
        } else if (fret === 0) {
          output += `- ${stringName}: open\n`;
        } else {
          output += `- ${stringName}: ${fret}${getOrdinalSuffix(fret)} fret\n`;
        }
      }
      
      output += '\n';
    }
    
    return output.trim();
  }

  /**
   * Format tablature data into accessible text
   * @param {Object} tabData - Parsed tab data
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted tablature
   */
  formatTablature(tabData, settings) {
    let output = '';
    const { sequences, annotations } = tabData;
    
    if (sequences.length === 0) {
      return 'No notes found in the tab. Please make sure your tab is properly formatted.';
    }
    
    // Group annotations by category for summary
    const annotationSummary = this.summarizeAnnotations(annotations);
    if (annotationSummary && settings.includeTiming) {
      output += annotationSummary + '\n\n';
    }
    
    // Format each sequence
    for (const sequence of sequences) {
      output += this.formatSequence(sequence, settings) + '\n';
    }
    
    return output.trim();
  }

  /**
   * Format a single sequence of notes
   * @param {Object} sequence - Note sequence
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted sequence
   * @private
   */
  formatSequence(sequence, settings) {
    let output = '';
    
    // Section header
    const sectionAnnotations = this.getSequenceAnnotations(sequence);
    if (settings.includeTiming && sectionAnnotations.length > 0) {
      output += `Section ${sequence.section} (${sectionAnnotations.join(', ')}):\n`;
    } else {
      output += `Section ${sequence.section}:\n`;
    }
    
    // Format notes
    for (const noteGroup of sequence.notes) {
      if (noteGroup.isChord && noteGroup.notes.length > 1) {
        output += this.formatChord(noteGroup.notes, settings);
      } else {
        for (const note of noteGroup.notes) {
          output += this.formatNote(note, settings);
        }
      }
      
      // Add annotation if present
      if (settings.includeTiming && noteGroup.annotation) {
        output = output.trimEnd() + ` [${noteGroup.annotation}]\n`;
      }
    }
    
    return output;
  }

  /**
   * Format a single note
   * @param {Object} note - Note to format
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted note
   * @private
   */
  formatNote(note, settings) {
    let noteDesc = '- ';
    
    // String name
    if (settings.useStringNames) {
      noteDesc += `${note.string} string`;
    } else {
      noteDesc += `String ${note.stringIndex + 1}`;
    }
    
    // Fret
    if (note.fret === 'mute') {
      noteDesc += ', muted';
    } else {
      noteDesc += `, ${note.fret}${getOrdinalSuffix(note.fret)} fret`;
    }
    
    // Techniques
    if (settings.includeTechniqueDetails && note.techniques && note.techniques.length > 0) {
      if (settings.verboseMode) {
        const techniqueDescs = note.techniqueDetails ? 
          note.techniqueDetails.map(t => t.context || t.name).filter(Boolean) :
          note.techniques;
        noteDesc += ` (${techniqueDescs.join(', ')})`;
      } else {
        noteDesc += ` ${note.techniques.join('+')}`;
      }
    }
    
    return noteDesc + '\n';
  }

  /**
   * Format a chord (multiple simultaneous notes)
   * @param {Array<Object>} notes - Notes in the chord
   * @param {Object} settings - Formatting settings
   * @returns {string} Formatted chord
   * @private
   */
  formatChord(notes, settings) {
    let chordDesc = '- Chord: ';
    
    if (settings.verboseMode) {
      // Detailed format
      const noteDescs = notes.map(note => {
        let desc = '';
        if (settings.useStringNames) {
          desc += `${note.string} string`;
        } else {
          desc += STRING_NUMBERS[note.stringIndex] + ' string';
        }
        
        if (note.fret === 'mute') {
          desc += ' muted';
        } else {
          desc += ` ${note.fret}${getOrdinalSuffix(note.fret)} fret`;
        }
        
        return desc;
      });
      
      chordDesc += noteDescs.join(', ');
    } else {
      // Compact format
      const fretPattern = notes
        .sort((a, b) => a.stringIndex - b.stringIndex)
        .map(n => n.fret === 'mute' ? 'x' : n.fret)
        .join('-');
      
      chordDesc += `(${fretPattern})`;
    }
    
    // Add techniques if any
    const allTechniques = notes
      .flatMap(n => n.techniques || [])
      .filter((v, i, a) => a.indexOf(v) === i); // unique
    
    if (settings.includeTechniqueDetails && allTechniques.length > 0) {
      chordDesc += ` with ${allTechniques.join(', ')}`;
    }
    
    return chordDesc + '\n';
  }

  /**
   * Get string name for a given index
   * @param {number} index - String index (0-7)
   * @param {number} totalStrings - Total number of strings (6, 7, or 8)
   * @returns {string} String name
   * @private
   */
  getStringName(index, totalStrings = 6) {
    const names6 = ['high E', 'B', 'G', 'D', 'A', 'low E'];
    const names7 = ['high E', 'B', 'G', 'D', 'A', 'E', 'low B'];
    const names8 = ['high E', 'B', 'G', 'D', 'A', 'E', 'B', 'F#'];
    
    let names;
    switch (totalStrings) {
      case 7:
        names = names7;
        break;
      case 8:
        names = names8;
        break;
      case 6:
      default:
        names = names6;
        break;
    }
    
    return names[index] || `String ${index + 1}`;
  }

  /**
   * Summarize annotations by category
   * @param {Array<Object>} annotations - All annotations
   * @returns {string} Annotation summary
   * @private
   */
  summarizeAnnotations(annotations) {
    if (!annotations || annotations.length === 0) return '';
    
    const categories = {};
    
    for (const annotation of annotations) {
      if (!categories[annotation.category]) {
        categories[annotation.category] = [];
      }
      if (!categories[annotation.category].includes(annotation.text)) {
        categories[annotation.category].push(annotation.text);
      }
    }
    
    let summary = 'Tab Information:\n';
    
    if (categories.section) {
      summary += `- Sections: ${categories.section.join(', ')}`;
    }
    
    if (categories.timing) {
      summary += `\n- Timing: ${categories.timing.join(', ')}`;
    }
    
    if (categories.chords) {
      summary += `\n- Chord progression: ${categories.chords.join(', ')}`;
    }
    
    if (categories.instruction) {
      summary += `\n- Instructions: ${categories.instruction.join(', ')}`;
    }
    
    if (categories.lyrics) {
      summary += `\n- Contains lyrics`;
    }
    
    return summary;
  }

  /**
   * Get annotations for a specific sequence
   * @param {Object} sequence - Note sequence
   * @returns {Array<string>} Unique annotations in sequence
   * @private
   */
  getSequenceAnnotations(sequence) {
    const annotations = sequence.notes
      .filter(n => n.annotation)
      .map(n => n.annotation);
    
    // Return unique annotations
    return [...new Set(annotations)];
  }

  /**
   * Format output for screen reader with additional context
   * @param {string} output - Base output
   * @param {Object} settings - Formatting settings
   * @returns {string} Enhanced output
   */
  enhanceForScreenReader(output, settings) {
    if (!settings.verboseMode) {
      return output;
    }
    
    // Add navigation hints
    const enhanced = `Guitar Tab - Accessible Format\n\n` +
      `Navigation: Each line represents a note or chord to play.\n` +
      `Format: String name/number, fret position, and any techniques.\n\n` +
      output;
    
    return enhanced;
  }

  /**
   * Generate a summary of the tab
   * @param {Object} tabData - Parsed tab data
   * @returns {string} Tab summary
   */
  generateSummary(tabData) {
    const { sequences } = tabData;
    let totalNotes = 0;
    let totalChords = 0;
    const techniques = new Set();
    
    for (const sequence of sequences) {
      for (const noteGroup of sequence.notes) {
        if (noteGroup.isChord) {
          totalChords++;
        } else {
          totalNotes += noteGroup.notes.length;
        }
        
        for (const note of noteGroup.notes) {
          if (note.techniques) {
            note.techniques.forEach(t => techniques.add(t));
          }
        }
      }
    }
    
    return `Tab Summary: ${sequences.length} sections, ` +
           `${totalNotes} individual notes, ${totalChords} chords` +
           (techniques.size > 0 ? `, techniques used: ${[...techniques].join(', ')}` : '');
  }
}
