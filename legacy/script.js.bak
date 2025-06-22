// Guitar Tab to Accessible Format Converter
// Main functionality

class GuitarTabConverter {
    constructor() {
        this.stringNames = ['E', 'B', 'G', 'D', 'A', 'E']; // High to low (6-string)
        this.stringNames7 = ['E', 'B', 'G', 'D', 'A', 'E', 'B']; // 7-string
        this.stringNames8 = ['E', 'B', 'G', 'D', 'A', 'E', 'B', 'F#']; // 8-string
        this.stringNumbers = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
        this.stringNumbers7 = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
        this.stringNumbers8 = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
        
        this.techniques = {
            'h': 'hammer-on',
            'p': 'pull-off',
            'b': 'bend',
            'r': 'release',
            's': 'slide',
            '/': 'slide up',
            '\\': 'slide down',
            '~': 'vibrato',
            't': 'tap',
            'x': 'mute',
            '^': 'bend',
            'v': 'whammy down and up'
        };
        
        this.currentTab = null; // Track currently loaded tab
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupAccessibility();
        this.loadTabFromUrl(); // Check if loading a specific tab
    }
    
    bindEvents() {
        const convertBtn = document.getElementById('convert-btn');
        const copyBtn = document.getElementById('copy-btn');
        const saveBtn = document.getElementById('save-btn');
        const tabInput = document.getElementById('tab-input');
        
        convertBtn.addEventListener('click', () => this.convertTab());
        copyBtn.addEventListener('click', () => this.copyToClipboard());
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveTab());
        }
        
        // Enable convert button when there's input
        tabInput.addEventListener('input', () => {
            convertBtn.disabled = tabInput.value.trim().length === 0;
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.convertTab();
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (saveBtn && !saveBtn.disabled) {
                    this.saveTab();
                }
            }
        });
    }
    
    setupAccessibility() {
        // Announce when conversion is complete
        this.announcer = document.createElement('div');
        this.announcer.setAttribute('aria-live', 'polite');
        this.announcer.setAttribute('aria-atomic', 'true');
        this.announcer.style.position = 'absolute';
        this.announcer.style.left = '-10000px';
        this.announcer.style.width = '1px';
        this.announcer.style.height = '1px';
        this.announcer.style.overflow = 'hidden';
        document.body.appendChild(this.announcer);
    }
    
    announce(message) {
        this.announcer.textContent = message;
    }
    
    convertTab() {
        const input = document.getElementById('tab-input').value;
        const output = document.getElementById('tab-output');
        const copyBtn = document.getElementById('copy-btn');
        const saveBtn = document.getElementById('save-btn');
        
        if (!input.trim()) {
            this.announce('Please enter a guitar tab to convert.');
            return;
        }
        
        try {
            const converted = this.parseTab(input);
            output.value = converted;
            copyBtn.disabled = false;
            if (saveBtn) {
                saveBtn.disabled = false;
            }
            this.announce('Tab converted successfully. Check the output area.');
            output.focus();
        } catch (error) {
            output.value = `Error converting tab: ${error.message}\n\nPlease check that your tab is in the correct format.`;
            copyBtn.disabled = true;
            if (saveBtn) {
                saveBtn.disabled = true;
            }
            this.announce('Error converting tab. Please check the format.');
        }
    }
    
    parseTab(tabText) {
        const lines = tabText.split('\n').filter(line => line.trim());
        const settings = this.getSettings();
        
        // Check if this is a chord chart format
        if (this.isChordChart(lines)) {
            return this.parseChordChart(lines, settings);
        }
        
        // Find tab lines (lines that contain string indicators)
        const tabLines = this.identifyTabLines(lines);
        
        if (tabLines.length === 0) {
            throw new Error('No valid tab lines found. Make sure your tab includes string lines with dashes and fret numbers.');
        }
        
        // Parse annotation information (timing, lyrics, notes, etc.)
        const annotations = this.extractAnnotations(lines);
        
        // Convert tab to note sequences
        const noteSequences = this.parseNoteSequences(tabLines, annotations);
        
        // Format output
        return this.formatOutput(noteSequences, settings);
    }
    
    isChordChart(lines) {
        // Check if most lines follow the chord chart pattern: ChordName: X-X-X-X-X-X
        let chordLines = 0;
        
        for (const line of lines) {
            const chordPattern = /^[A-G][#b]?[\w\*]*[\s]*:[\s]*[\dX\-]+$/i;
            if (chordPattern.test(line.trim())) {
                chordLines++;
            }
        }
        
        // If more than half the lines are chord definitions, treat as chord chart
        return chordLines > 0 && (chordLines / lines.length) > 0.5;
    }
    
    parseChordChart(lines, settings) {
        const chords = [];
        
        for (const line of lines) {
            const chord = this.parseChordLine(line.trim());
            if (chord) {
                chords.push(chord);
            }
        }
        
        if (chords.length === 0) {
            throw new Error('No valid chords found in chord chart.');
        }
        
        return this.formatChordChart(chords, settings);
    }
    
    parseChordLine(line) {
        // Parse lines like "F: 1-3-3-2-1-1" or "Dm*: X-X-0-2-3-1"
        const chordPattern = /^([A-G][#b]?[\w\*]*)[\s]*:[\s]*([\dX\-]+)$/i;
        const match = line.match(chordPattern);
        
        if (!match) return null;
        
        const chordName = match[1];
        const fretString = match[2];
        
        // Parse fret positions
        const frets = fretString.split('-').map(f => {
            if (f.toUpperCase() === 'X') return 'mute';
            const num = parseInt(f);
            return isNaN(num) ? 'mute' : num;
        });
        
        // Validate we have 6, 7, or 8 positions
        if (frets.length < 6 || frets.length > 8) return null;
        
        return {
            name: chordName,
            frets: frets
        };
    }
    
    formatChordChart(chords, settings) {
        let output = 'Chord Chart:\n\n';
        
        for (const chord of chords) {
            const stringCount = chord.frets.length;
            output += `${chord.name} chord (${stringCount}-string):\n`;
            
            for (let i = 0; i < stringCount; i++) {
                const stringNames = this.getStringNamesForCount(stringCount);
                const stringName = settings.useStringNames ? 
                    stringNames[i] : 
                    `String ${i + 1}`;
                
                const fret = chord.frets[i];
                
                if (fret === 'mute') {
                    output += `- ${stringName}: muted\n`;
                } else if (fret === 0) {
                    output += `- ${stringName}: open\n`;
                } else {
                    output += `- ${stringName}: ${fret}${this.getOrdinalSuffix(fret)} fret\n`;
                }
            }
            
            output += '\n';
        }
        
        return output.trim();
    }
    
    identifyTabLines(lines) {
        const tabLines = [];
        let currentGroup = [];
        
        // First check if this is a standard 6-line tab format (no string labels)
        const standardTabGroup = this.identifyStandardTabFormat(lines);
        if (standardTabGroup.length > 0) {
            return standardTabGroup;
        }
        
        // Fall back to labeled tab format
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this looks like a tab line
            if (this.isTabLine(line)) {
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
                    tabLines.push(currentGroup);
                }
                currentGroup = [];
            }
        }
        
        // Don't forget the last group
        if (currentGroup.length >= 3) {
            tabLines.push(currentGroup);
        }
        
        return tabLines;
    }
    
    identifyStandardTabFormat(lines) {
        const tabGroups = [];
        let currentGroup = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and technique legends
            if (!line || this.isTechniqueLine(line)) {
                continue;
            }
            
            // Check if this looks like a standard tab line (starts with |)
            if (this.isStandardTabLine(line)) {
                currentGroup.push({
                    content: line,
                    stringIndex: currentGroup.length, // Position determines string
                    stringName: this.stringNames[currentGroup.length],
                    lineNumber: i
                });
                
                // If we have 6 lines, check if there are more (7 or 8 string guitar)
                if (currentGroup.length === 6) {
                    // Look ahead for 7th and 8th strings
                    let nextIdx = i + 1;
                    while (nextIdx < lines.length && currentGroup.length < 8) {
                        const nextLine = lines[nextIdx].trim();
                        if (this.isStandardTabLine(nextLine)) {
                            currentGroup.push({
                                content: nextLine,
                                stringIndex: currentGroup.length,
                                stringName: this.getStringNamesForCount(currentGroup.length + 1)[currentGroup.length],
                                lineNumber: nextIdx
                            });
                            i = nextIdx; // Skip this line in the main loop
                        } else if (!nextLine || this.isTechniqueLine(nextLine)) {
                            // Skip empty lines or technique lines
                            nextIdx++;
                            continue;
                        } else {
                            break; // Not a tab line, stop looking
                        }
                        nextIdx++;
                    }
                    
                    // Update string names based on final count
                    const stringNames = this.getStringNamesForCount(currentGroup.length);
                    currentGroup.forEach((line, idx) => {
                        line.stringName = stringNames[idx];
                    });
                    
                    tabGroups.push([...currentGroup]);
                    currentGroup = [];
                }
            } else if (currentGroup.length > 0) {
                // End current group if we have at least 3 strings
                if (currentGroup.length >= 3) {
                    tabGroups.push([...currentGroup]);
                }
                currentGroup = [];
            }
        }
        
        // Don't forget the last group
        if (currentGroup.length >= 3) {
            tabGroups.push(currentGroup);
        }
        
        return tabGroups;
    }
    
    isTechniqueLine(line) {
        // Check if this line is explaining techniques
        const techniquePattern = /^[~\/\\\^vhp]\s+/;
        const legendPattern = /^\|\s*[a-zA-Z]\s+(Bend|Hammer|Pull|Slide|Vibrato|Trill|Release)/i;
        return techniquePattern.test(line) || legendPattern.test(line);
    }
    
    isStandardTabLine(line) {
        // Standard tab lines start with | and contain dashes, numbers, and technique symbols
        // Also handle lines with multiple measures (multiple | sections)
        return /^\|[-\d\/\\~\^vhp\s|]+\|?$/.test(line) || 
               /^\|[-\d\/\\~\^vhp\s|]+\|[-\d\/\\~\^vhp\s|]+/.test(line);
    }
    
    isTabLine(line) {
        // Check if line contains typical tab characters
        const tabPattern = /[E|A|D|G|B|e][\s]*[:|\|].*[-|\d]/;
        const hasNumbers = /\d/.test(line);
        const hasDashes = /-/.test(line);
        
        return tabPattern.test(line) && (hasNumbers || hasDashes);
    }
    
    identifyString(line) {
        const trimmed = line.trim();
        
        // Common string indicators
        const stringPatterns = [
            { pattern: /^e[\s]*[:|\|]/, index: 0, name: 'high E' },
            { pattern: /^E[\s]*[:|\|]/, index: 0, name: 'high E' },
            { pattern: /^B[\s]*[:|\|]/, index: 1, name: 'B' },
            { pattern: /^G[\s]*[:|\|]/, index: 2, name: 'G' },
            { pattern: /^D[\s]*[:|\|]/, index: 3, name: 'D' },
            { pattern: /^A[\s]*[:|\|]/, index: 4, name: 'A' },
            { pattern: /^E[\s]*[:|\|]/, index: 5, name: 'low E' }
        ];
        
        for (const sp of stringPatterns) {
            if (sp.pattern.test(trimmed)) {
                return { index: sp.index, name: sp.name };
            }
        }
        
        return null;
    }
    
    extractAnnotations(lines) {
        const annotations = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for any text that appears between tab sections
            // This could be timing, lyrics, notes, chord names, etc.
            if (!this.isTabLine(line) && !this.isChordChart([line]) && line.trim().length > 0) {
                // Skip technique legend lines
                if (!this.isTechniqueLine(line)) {
                    // Find position in the line for annotation placement
                    const trimmed = line.trim();
                    const position = line.indexOf(trimmed);
                    
                    // Categorize the annotation for better formatting
                    let category = 'note';
                    if (/^[IVX]+\s*-/.test(trimmed)) {
                        category = 'section';
                    } else if (trimmed.startsWith('"') || trimmed.includes('"')) {
                        category = 'lyrics';
                    } else if (/\d+:\d+/.test(trimmed)) {
                        category = 'timing';
                    } else if (/repeat|times|x\d+/i.test(trimmed)) {
                        category = 'instruction';
                    }
                    
                    annotations.push({ 
                        text: trimmed, 
                        position: position,
                        lineNumber: i,
                        category: category
                    });
                }
            }
        }
        
        return annotations;
    }
    
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
        
        if (fretNum === '') return null;
        
        // Look for techniques before and after the fret
        const techniques = this.findTechniques(content, position);
        
        return {
            string: stringLine.stringName,
            stringIndex: stringLine.stringIndex,
            fret: parseInt(fretNum),
            techniques: techniques,
            position: position
        };
    }
    
    findTechniques(content, fretPosition) {
        const techniques = [];
        const searchRadius = 3; // Look 3 characters before and after
        
        const start = Math.max(0, fretPosition - searchRadius);
        const end = Math.min(content.length, fretPosition + searchRadius + 2);
        
        const segment = content.slice(start, end);
        
        for (const [symbol, technique] of Object.entries(this.techniques)) {
            if (segment.includes(symbol)) {
                techniques.push(technique);
            }
        }
        
        return techniques;
    }
    
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
    
    formatOutput(sequences, settings) {
        let output = '';
        
        if (sequences.length === 0) {
            return 'No notes found in the tab. Please make sure your tab is properly formatted.';
        }
        
        for (const sequence of sequences) {
            // Check if any notes in this sequence have annotations
            const sequenceAnnotations = sequence.notes
                .filter(n => n.annotation)
                .map(n => n.annotation);
            
            if (settings.includeTiming && sequenceAnnotations.length > 0) {
                // Show unique annotations for this section
                const uniqueAnnotations = [...new Set(sequenceAnnotations)];
                output += `Section ${sequence.section} (${uniqueAnnotations.join(', ')}):\n`;
            } else {
                output += `Section ${sequence.section}:\n`;
            }
            
            for (const noteGroup of sequence.notes) {
                if (noteGroup.isChord && noteGroup.notes.length > 1) {
                    output += this.formatChord(noteGroup.notes, settings);
                } else {
                    for (const note of noteGroup.notes) {
                        output += this.formatNote(note, settings);
                    }
                }
            }
            
            output += '\n';
        }
        
        return output.trim();
    }
    
    formatNote(note, settings) {
        let noteDesc = '- ';
        
        // String name
        if (settings.useStringNames) {
            noteDesc += `${note.string} string`;
        } else {
            noteDesc += `String ${note.stringIndex + 1}`;
        }
        
        // Fret
        noteDesc += `, ${note.fret}${this.getOrdinalSuffix(note.fret)} fret`;
        
        // Techniques
        if (settings.includeTechniqueDetails && note.techniques.length > 0) {
            if (settings.verboseMode) {
                noteDesc += ` (${note.techniques.join(', ')})`;
            } else {
                noteDesc += ` ${note.techniques.join('+')}`;
            }
        }
        
        return noteDesc + '\n';
    }
    
    formatChord(notes, settings) {
        let chordDesc = '- Chord: ';
        const noteDescs = [];
        
        for (const note of notes) {
            let desc = '';
            if (settings.useStringNames) {
                desc += `${note.string} string ${note.fret}${this.getOrdinalSuffix(note.fret)} fret`;
            } else {
                desc += `String ${note.stringIndex + 1} fret ${note.fret}`;
            }
            noteDescs.push(desc);
        }
        
        chordDesc += noteDescs.join(', ');
        
        return chordDesc + '\n';
    }
    
    getOrdinalSuffix(num) {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return 'st';
        if (j === 2 && k !== 12) return 'nd';
        if (j === 3 && k !== 13) return 'rd';
        return 'th';
    }
    
    getStringNamesForCount(count) {
        switch (count) {
            case 7:
                return this.stringNames7;
            case 8:
                return this.stringNames8;
            case 6:
            default:
                return this.stringNames;
        }
    }
    
    getSettings() {
        return {
            includeTiming: document.getElementById('include-timing').checked,
            verboseMode: document.getElementById('verbose-mode').checked,
            useStringNames: document.getElementById('string-names').checked,
            includeTechniqueDetails: document.getElementById('technique-details').checked
        };
    }
    
    async copyToClipboard() {
        const output = document.getElementById('tab-output');
        
        try {
            await navigator.clipboard.writeText(output.value);
            this.announce('Converted tab copied to clipboard.');
            
            // Visual feedback
            const copyBtn = document.getElementById('copy-btn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
            
        } catch (err) {
            // Fallback for older browsers
            output.select();
            document.execCommand('copy');
            this.announce('Converted tab copied to clipboard.');
        }
    }
    
    loadTabFromUrl() {
        // Check if loading a specific tab from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const tabId = urlParams.get('load');
        
        if (tabId && typeof TabStorage !== 'undefined') {
            const tab = TabStorage.getTab(tabId);
            if (tab) {
                this.loadTab(tab);
            }
        }
    }
    
    loadTab(tab) {
        const tabInput = document.getElementById('tab-input');
        const tabOutput = document.getElementById('tab-output');
        const convertBtn = document.getElementById('convert-btn');
        const copyBtn = document.getElementById('copy-btn');
        const saveBtn = document.getElementById('save-btn');
        
        // Load the tab data
        tabInput.value = tab.originalTab;
        tabOutput.value = tab.convertedTab;
        
        // Enable buttons
        convertBtn.disabled = false;
        copyBtn.disabled = false;
        if (saveBtn) {
            saveBtn.disabled = false;
        }
        
        // Load settings if available
        if (tab.settings) {
            this.loadSettings(tab.settings);
        }
        
        // Set current tab reference
        this.currentTab = tab;
        
        this.announce(`Loaded tab: ${tab.name}`);
    }
    
    loadSettings(settings) {
        // Load conversion settings
        const checkboxes = {
            'include-timing': settings.includeTiming,
            'verbose-mode': settings.verboseMode,
            'string-names': settings.useStringNames,
            'technique-details': settings.includeTechniqueDetails
        };
        
        for (const [id, value] of Object.entries(checkboxes)) {
            const checkbox = document.getElementById(id);
            if (checkbox && value !== undefined) {
                checkbox.checked = value;
            }
        }
    }
    
    async saveTab() {
        const tabInput = document.getElementById('tab-input');
        const tabOutput = document.getElementById('tab-output');
        
        if (!tabInput.value.trim()) {
            this.announce('Please enter a tab before saving.');
            return;
        }
        
        if (!tabOutput.value.trim()) {
            this.announce('Please convert the tab before saving.');
            return;
        }
        
        // Get tab name from user
        const currentName = this.currentTab ? this.currentTab.name : '';
        const tabName = prompt('Enter a name for this tab:', currentName);
        
        if (tabName === null) {
            return; // User cancelled
        }
        
        if (!tabName.trim()) {
            this.announce('Please enter a valid tab name.');
            return;
        }
        
        try {
            const settings = this.getSettings();
            
            // Check if this is an update or new save
            const isUpdate = this.currentTab && this.currentTab.name === tabName.trim();
            
            const tabData = {
                id: isUpdate ? this.currentTab.id : undefined,
                name: tabName.trim(),
                originalTab: tabInput.value,
                convertedTab: tabOutput.value,
                settings: settings,
                dateCreated: isUpdate ? this.currentTab.dateCreated : undefined
            };
            
            const savedTab = TabStorage.saveTab(tabData);
            this.currentTab = savedTab;
            
            this.announce(`Tab "${savedTab.name}" saved successfully.`);
            
            // Visual feedback
            const saveBtn = document.getElementById('save-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 2000);
            
        } catch (error) {
            console.error('Error saving tab:', error);
            this.announce('Error saving tab. Please try again.');
        }
    }
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GuitarTabConverter();
});

