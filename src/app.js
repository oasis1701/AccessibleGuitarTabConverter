/**
 * @fileoverview Main application entry point
 * @module app
 */

import { TabConverter } from './modules/converter/TabConverter.js';
import { LocalStorage } from './modules/storage/LocalStorage.js';
import { notificationManager } from './modules/ui/components/NotificationManager.js';
import { firebaseAuth } from './modules/auth/FirebaseAuth.js';
import { getQueryParams, debounce } from './utils/helpers.js';
import { validateConfig, isFeatureEnabled } from './config.js';
import { ANIMATION_DURATIONS } from './utils/constants.js';

/**
 * Marker at the start of originalTab for tabs imported from Guitar Pro
 * files. The binary file itself is never stored, so these tabs cannot be
 * re-converted from the input area.
 * @type {string}
 */
const GP_PROVENANCE_PREFIX = '[Imported from Guitar Pro';

/**
 * Main application class
 */
class AccessibleGuitarTabsApp {
  constructor() {
    this.converter = new TabConverter();
    this.currentTab = null;
    this.settingsElements = {};
    this.isConverting = false;

    // Guitar Pro import state. The importer module (and alphaTab with it)
    // is only dynamically imported once a file is actually opened.
    this.gpImporter = null;
    this.gpScore = null;
    this.gpFileName = '';
    this.gpTracks = [];
    this.gpTabDataCache = new Map();
    this.gpTrackIndex = null;
    this.activeSource = 'text';

    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    // Validate configuration
    const configValidation = validateConfig();
    if (!configValidation.isValid) {
      console.error('Configuration errors:', configValidation.errors);
    }
    if (configValidation.warnings.length > 0) {
      console.warn('Configuration warnings:', configValidation.warnings);
    }

    // Initialize UI based on current page
    const currentPage = this.getCurrentPage();
    
    switch (currentPage) {
      case 'converter':
        await this.initConverterPage();
        break;
      case 'my-tabs':
        await this.initMyTabsPage();
        break;
      case 'index':
        await this.initHomePage();
        break;
    }

    // Initialize keyboard shortcuts
    this.initKeyboardShortcuts();
    
    // Bridge used by LocalStorage for cloud writes (avoids an import cycle)
    window.firebaseAuth = firebaseAuth;
  }

  /**
   * Get current page name
   * @returns {string} Page name
   */
  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('converter.html')) return 'converter';
    if (path.includes('my-tabs.html')) return 'my-tabs';
    return 'index';
  }

  /**
   * Initialize converter page
   */
  async initConverterPage() {
    // Get DOM elements
    this.tabInput = document.getElementById('tab-input');
    this.tabOutput = document.getElementById('tab-output');
    this.convertBtn = document.getElementById('convert-btn');
    this.copyBtn = document.getElementById('copy-btn');
    this.saveBtn = document.getElementById('save-btn');

    // Guitar Pro import elements
    this.gpFileInput = document.getElementById('gp-file-input');
    this.gpTrackPicker = document.getElementById('gp-track-picker');
    this.gpTrackSelect = document.getElementById('gp-track-select');
    this.gpConvertTrackBtn = document.getElementById('gp-convert-track-btn');

    // Get settings elements
    this.settingsElements = {
      includeTiming: document.getElementById('include-timing'),
      verboseMode: document.getElementById('verbose-mode'),
      useStringNames: document.getElementById('string-names'),
      includeTechniqueDetails: document.getElementById('technique-details'),
      includeDurations: document.getElementById('include-durations')
    };
    
    // Bind events
    this.bindConverterEvents();
    
    // Load tab from URL if specified
    await this.loadTabFromUrl();
    
    // Set up auto-save if enabled
    if (isFeatureEnabled('autoSave')) {
      this.setupAutoSave();
    }
  }

  /**
   * Bind converter page events
   */
  bindConverterEvents() {
    // Convert button
    this.convertBtn.addEventListener('click', () => this.convertTab());
    
    // Copy button
    this.copyBtn.addEventListener('click', () => this.copyToClipboard());
    
    // Save button
    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.saveTab());
    }
    
    // Guitar Pro file import
    if (this.gpFileInput) {
      this.gpFileInput.addEventListener('change', () => this.onGpFileChosen());
    }
    if (this.gpConvertTrackBtn) {
      this.gpConvertTrackBtn.addEventListener('click', () => {
        this.convertGpTrack(Number(this.gpTrackSelect.value));
      });
    }

    // Enable/disable convert button based on input
    this.tabInput.addEventListener('input', debounce(() => {
      this.convertBtn.disabled = this.tabInput.value.trim().length === 0;
    }, 100));

    // Settings change handlers. Re-convert without moving focus, so the
    // user's position on the checkbox they just toggled is preserved.
    Object.values(this.settingsElements).forEach(element => {
      if (element) {
        element.addEventListener('change', () => {
          if (!this.tabOutput.value) return;
          if (this.activeSource === 'gp' && this.gpScore && this.gpTrackIndex !== null) {
            // Re-format the Guitar Pro track from its in-memory model.
            this.convertGpTrack(this.gpTrackIndex, { moveFocus: false });
          } else if (!this.convertBtn.disabled && this.tabInput.value.trim()) {
            // Skipped for tabs loaded from a Guitar Pro import (the file
            // was not stored, so there is nothing to re-convert).
            this.convertTab({ moveFocus: false });
          }
        });
      }
    });
  }

  /**
   * Handle a chosen Guitar Pro file: load it, then convert directly or
   * offer the track picker when the song has several usable tracks.
   */
  async onGpFileChosen() {
    const file = this.gpFileInput.files && this.gpFileInput.files[0];
    if (!file) return;

    notificationManager.announce(`Loading ${file.name}...`);

    let score;
    try {
      const buffer = await file.arrayBuffer();
      if (!this.gpImporter) {
        this.gpImporter = await import('./modules/converter/importers/GuitarProImporter.js');
      }
      score = this.gpImporter.loadScore(buffer);
    } catch (error) {
      console.error('Guitar Pro load error:', error);
      const message = /Guitar Pro file/.test(error && error.message ? error.message : '')
        ? error.message
        : 'Could not read the file. Please try again.';
      notificationManager.error(message);
      this.gpFileInput.value = '';
      return;
    }

    const tracks = this.gpImporter.listConvertibleTracks(score);
    if (tracks.length === 0) {
      notificationManager.error(
        'No guitar or bass tracks were found in this file ' +
          '(drums and non-stringed instruments cannot be converted).'
      );
      this.gpFileInput.value = '';
      return;
    }

    // A new file starts a new document: never overwrite a previously
    // loaded saved tab when this import is saved.
    this.gpScore = score;
    this.gpFileName = file.name;
    this.gpTracks = tracks;
    this.gpTabDataCache = new Map();
    this.gpTrackIndex = null;
    this.currentTab = null;

    const { title } = this.gpImporter.describeScore(score);
    const loadedName = title || file.name;

    if (tracks.length === 1) {
      this.gpTrackPicker.hidden = true;
      this.gpTrackSelect.innerHTML = '';
      notificationManager.success(
        `Loaded ${loadedName}. Converting track: ${tracks[0].name || 'Untitled track'}.`
      );
      this.convertGpTrack(tracks[0].index);
    } else {
      this.populateTrackPicker(tracks);
      notificationManager.success(
        `Loaded ${loadedName}. ${tracks.length} guitar or bass tracks found. ` +
          'Choose a track, then press Convert Selected Track.'
      );
      this.gpTrackSelect.focus();
    }
  }

  /**
   * Fill and reveal the track picker for a multi-track file.
   * @param {Array<{index: number, name: string, stringCount: number}>} tracks
   *   Convertible tracks
   */
  populateTrackPicker(tracks) {
    this.gpTrackSelect.innerHTML = '';
    for (const track of tracks) {
      const option = document.createElement('option');
      option.value = String(track.index);
      option.textContent =
        `Track ${track.index + 1}: ${track.name || 'Untitled track'} (${track.stringCount} strings)`;
      this.gpTrackSelect.appendChild(option);
    }
    this.gpTrackPicker.hidden = false;
  }

  /**
   * Convert one track of the loaded Guitar Pro score.
   * @param {number} trackIndex - Index into the score's tracks
   * @param {Object} [options] - Conversion options
   * @param {boolean} [options.moveFocus=true] - Move focus to the output
   *   afterwards. Off for background re-conversions (settings changes).
   */
  convertGpTrack(trackIndex, { moveFocus = true } = {}) {
    if (this.isConverting || !this.gpScore || !this.gpImporter) return;

    // Switching to another track starts a new document; saving it must not
    // overwrite the tab saved from the previous track.
    if (this.activeSource === 'gp' && this.gpTrackIndex !== null && this.gpTrackIndex !== trackIndex) {
      this.currentTab = null;
    }

    this.isConverting = true;
    try {
      let tabData = this.gpTabDataCache.get(trackIndex);
      if (!tabData) {
        tabData = this.gpImporter.trackToTabData(this.gpScore, trackIndex);
        this.gpTabDataCache.set(trackIndex, tabData);
      }

      const settings = TabConverter.getSettingsFromElements(this.settingsElements);
      const converted = this.converter.formatTabData(tabData, settings);

      this.tabOutput.value = converted;
      this.copyBtn.disabled = false;
      if (this.saveBtn) {
        this.saveBtn.disabled = false;
      }
      this.activeSource = 'gp';
      this.gpTrackIndex = trackIndex;

      if (moveFocus) {
        notificationManager.success('Track converted. The output area has the result.');
        this.tabOutput.focus();
      } else {
        notificationManager.announce('Output updated with new settings.');
      }
    } catch (error) {
      console.error('Guitar Pro conversion error:', error);
      this.tabOutput.value = error.message;
      this.copyBtn.disabled = true;
      if (this.saveBtn) {
        this.saveBtn.disabled = true;
      }
      notificationManager.error(error.message);
      if (moveFocus) {
        this.tabOutput.focus();
      }
    } finally {
      this.isConverting = false;
    }
  }

  /**
   * Convert tab to accessible format
   * @param {Object} [options] - Conversion options
   * @param {boolean} [options.moveFocus=true] - Move focus to the output
   *   afterwards. Off for background re-conversions (settings changes).
   */
  async convertTab({ moveFocus = true } = {}) {
    if (this.isConverting) return;

    const input = this.tabInput.value.trim();
    if (!input) {
      notificationManager.warning('Please enter a guitar tab to convert.');
      return;
    }

    this.isConverting = true;
    this.convertBtn.disabled = true;
    this.convertBtn.textContent = 'Converting...';

    try {
      // Get current settings
      const settings = TabConverter.getSettingsFromElements(this.settingsElements);

      // Convert the tab
      const converted = this.converter.convert(input, settings);

      // Display result
      this.tabOutput.value = converted;
      this.copyBtn.disabled = false;
      if (this.saveBtn) {
        this.saveBtn.disabled = false;
      }
      // The output now reflects the pasted text, not a Guitar Pro track.
      this.activeSource = 'text';

      if (moveFocus) {
        notificationManager.success('Tab converted. The output area has the result.');
        this.tabOutput.focus();
      } else {
        notificationManager.announce('Output updated with new settings.');
      }

    } catch (error) {
      console.error('Conversion error:', error);
      this.tabOutput.value = error.message;
      this.copyBtn.disabled = true;
      if (this.saveBtn) {
        this.saveBtn.disabled = true;
      }

      notificationManager.error(error.message);
      if (moveFocus) {
        this.tabOutput.focus();
      }
    } finally {
      this.isConverting = false;
      this.convertBtn.disabled = false;
      this.convertBtn.textContent = 'Convert Tab to Accessible Format';
    }
  }

  /**
   * Copy converted tab to clipboard
   */
  async copyToClipboard() {
    const output = this.tabOutput.value;
    if (!output) return;
    
    try {
      await navigator.clipboard.writeText(output);
      notificationManager.success('Copied to clipboard!');
      notificationManager.announce('Converted tab copied to clipboard.');
      
      // Visual feedback
      const originalText = this.copyBtn.textContent;
      this.copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        this.copyBtn.textContent = originalText;
      }, ANIMATION_DURATIONS.BUTTON_FEEDBACK);
      
    } catch (err) {
      // Fallback for older browsers
      this.tabOutput.select();
      document.execCommand('copy');
      notificationManager.success('Copied to clipboard!');
    }
  }

  /**
   * Save tab to storage
   */
  async saveTab() {
    // Guitar Pro imports have no pasted input; only the output matters.
    const isGpImport = this.activeSource === 'gp';
    if ((!isGpImport && !this.tabInput.value.trim()) || !this.tabOutput.value.trim()) {
      notificationManager.warning('Please convert a tab before saving.');
      return;
    }

    // Get tab name from user, suggesting the song title for imports
    let suggestedName = this.currentTab ? this.currentTab.name : '';
    if (!suggestedName && isGpImport) {
      const { title } = this.gpImporter.describeScore(this.gpScore);
      suggestedName = title || this.gpFileName.replace(/\.[^.]+$/, '');
    }
    const tabName = prompt('Enter a name for this tab:', suggestedName);

    if (tabName === null) return; // User cancelled

    if (!tabName.trim()) {
      notificationManager.error('Please enter a valid tab name.');
      return;
    }

    try {
      const settings = TabConverter.getSettingsFromElements(this.settingsElements);

      // The binary file is never stored; imported tabs keep a provenance
      // line so My Tabs shows where the text came from.
      let originalTab = this.tabInput.value;
      if (isGpImport) {
        const track = this.gpTracks.find(t => t.index === this.gpTrackIndex);
        const trackName = (track && track.name) || 'Untitled track';
        originalTab =
          `${GP_PROVENANCE_PREFIX} file "${this.gpFileName}", ` +
          `track ${this.gpTrackIndex + 1}: ${trackName}]`;
      }

      const tabData = {
        id: this.currentTab?.id,
        name: tabName.trim(),
        originalTab,
        convertedTab: this.tabOutput.value,
        settings: settings,
        dateCreated: this.currentTab?.dateCreated
      };
      
      const savedTab = LocalStorage.saveTab(tabData);
      this.currentTab = savedTab;
      
      notificationManager.success(`Tab "${savedTab.name}" saved successfully!`);
      
      // Visual feedback
      const originalText = this.saveBtn.textContent;
      this.saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        this.saveBtn.textContent = originalText;
      }, ANIMATION_DURATIONS.BUTTON_FEEDBACK);
      
    } catch (error) {
      console.error('Error saving tab:', error);
      notificationManager.error('Error saving tab. ' + error.message);
    }
  }

  /**
   * Load tab from URL parameter
   */
  async loadTabFromUrl() {
    const params = getQueryParams();
    const tabId = params.load;
    
    if (tabId) {
      const tab = LocalStorage.getTab(tabId);
      if (tab) {
        this.loadTab(tab);
      } else {
        notificationManager.warning('Tab not found.');
      }
    }
  }

  /**
   * Load a tab into the converter
   * @param {Object} tab - Tab data to load
   */
  loadTab(tab) {
    this.tabInput.value = tab.originalTab;
    this.tabOutput.value = tab.convertedTab;

    // Tabs imported from Guitar Pro files store a provenance line, not a
    // convertible tab, so re-converting them can only fail.
    const isGpImport =
      typeof tab.originalTab === 'string' && tab.originalTab.startsWith(GP_PROVENANCE_PREFIX);

    // Enable buttons
    this.convertBtn.disabled = isGpImport;
    this.copyBtn.disabled = false;
    if (this.saveBtn) {
      this.saveBtn.disabled = false;
    }

    // Load settings
    if (tab.settings) {
      TabConverter.applySettingsToElements(tab.settings, this.settingsElements);
    }

    // Set current tab reference
    this.currentTab = tab;
    this.activeSource = 'text';

    if (isGpImport) {
      notificationManager.info(
        `Loaded tab: ${tab.name}. This tab was imported from a Guitar Pro file; ` +
          'the converted text is shown, and the original file was not stored.'
      );
    } else {
      notificationManager.info(`Loaded tab: ${tab.name}`);
    }
  }

  /**
   * Set up auto-save functionality
   */
  setupAutoSave() {
    let autoSaveTimeout;
    
    const autoSave = () => {
      if (this.currentTab && this.tabOutput.value) {
        try {
          const settings = TabConverter.getSettingsFromElements(this.settingsElements);
          
          const tabData = {
            ...this.currentTab,
            originalTab: this.tabInput.value,
            convertedTab: this.tabOutput.value,
            settings: settings
          };
          
          LocalStorage.saveTab(tabData);
          console.log('Auto-saved tab');
        } catch (error) {
          console.error('Auto-save error:', error);
        }
      }
    };
    
    // Auto-save on input change (debounced)
    this.tabInput.addEventListener('input', () => {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(autoSave, 5000); // 5 seconds
    });
  }

  /**
   * Initialize My Tabs page
   */
  async initMyTabsPage() {
    // Implementation moved to MyTabsPage module
    const { MyTabsPage } = await import('./modules/ui/pages/MyTabsPage.js');
    new MyTabsPage();
  }

  /**
   * Initialize home page
   */
  async initHomePage() {
    // No page-specific behavior yet
  }

  /**
   * Initialize keyboard shortcuts
   */
  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter: Convert
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (this.convertBtn && !this.convertBtn.disabled) {
          this.convertTab();
        }
      }
      
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (this.saveBtn && !this.saveBtn.disabled) {
          this.saveTab();
        }
      }
      
      // Ctrl/Cmd + Shift + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (this.copyBtn && !this.copyBtn.disabled) {
          this.copyToClipboard();
        }
      }
    });
  }

}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AccessibleGuitarTabsApp();
  });
} else {
  new AccessibleGuitarTabsApp();
}
