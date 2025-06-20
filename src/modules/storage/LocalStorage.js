/**
 * @fileoverview Local storage management for guitar tabs
 * @module storage/LocalStorage
 */

import { STORAGE_KEYS } from '../../utils/constants.js';
import { generateId } from '../../utils/helpers.js';
import { validateTabData } from '../../utils/validators.js';

/**
 * Class to manage local storage operations for tabs
 */
export class LocalStorage {
  /**
   * Get all saved tabs from local storage
   * @returns {Array<Object>} Array of saved tabs
   */
  static getAllTabs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TABS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading tabs from localStorage:', error);
      return [];
    }
  }

  /**
   * Get a specific tab by ID
   * @param {string} id - Tab ID
   * @returns {Object|null} Tab object or null if not found
   */
  static getTab(id) {
    const tabs = this.getAllTabs();
    return tabs.find(tab => tab.id === id) || null;
  }

  /**
   * Save a new tab or update existing one
   * @param {Object} tabData - Tab data to save
   * @returns {Object} Saved tab object
   * @throws {Error} If save fails
   */
  static saveTab(tabData) {
    // Validate tab data
    const validation = validateTabData(tabData);
    if (!validation.isValid) {
      throw new Error(`Invalid tab data: ${validation.errors.join(', ')}`);
    }

    try {
      const tabs = this.getAllTabs();
      const existingIndex = tabs.findIndex(tab => tab.id === tabData.id);
      
      const tabToSave = {
        id: tabData.id || generateId('tab'),
        name: tabData.name,
        originalTab: tabData.originalTab,
        convertedTab: tabData.convertedTab,
        settings: tabData.settings || {},
        dateCreated: tabData.dateCreated || new Date().toISOString(),
        dateModified: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        // Update existing tab
        tabs[existingIndex] = { ...tabs[existingIndex], ...tabToSave };
      } else {
        // Add new tab
        tabs.push(tabToSave);
      }

      // Check storage quota
      const serialized = JSON.stringify(tabs);
      if (serialized.length > 5 * 1024 * 1024) { // 5MB limit warning
        console.warn('Local storage is approaching its limit');
      }

      localStorage.setItem(STORAGE_KEYS.TABS, serialized);
      return tabToSave;
      
    } catch (error) {
      console.error('Error saving tab to localStorage:', error);
      throw new Error('Failed to save tab. Storage might be full.');
    }
  }

  /**
   * Delete a tab by ID
   * @param {string} id - Tab ID to delete
   * @returns {boolean} True if deleted successfully
   */
  static deleteTab(id) {
    try {
      const tabs = this.getAllTabs();
      const filteredTabs = tabs.filter(tab => tab.id !== id);
      
      if (filteredTabs.length === tabs.length) {
        return false; // Tab not found
      }
      
      localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(filteredTabs));
      return true;
      
    } catch (error) {
      console.error('Error deleting tab from localStorage:', error);
      return false;
    }
  }

  /**
   * Clear all tabs
   * @returns {boolean} True if cleared successfully
   */
  static clearAllTabs() {
    try {
      localStorage.removeItem(STORAGE_KEYS.TABS);
      return true;
    } catch (error) {
      console.error('Error clearing tabs from localStorage:', error);
      return false;
    }
  }

  /**
   * Check if a tab name already exists
   * @param {string} name - Tab name to check
   * @param {string} excludeId - ID to exclude from check
   * @returns {boolean} True if name exists
   */
  static nameExists(name, excludeId = null) {
    const tabs = this.getAllTabs();
    return tabs.some(tab => 
      tab.name.toLowerCase() === name.toLowerCase() && 
      tab.id !== excludeId
    );
  }

  /**
   * Get storage usage information
   * @returns {Object} Storage usage info
   */
  static getStorageInfo() {
    try {
      const tabs = this.getAllTabs();
      const dataSize = JSON.stringify(tabs).length;
      
      // Estimate total localStorage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      
      return {
        tabCount: tabs.length,
        tabsSize: dataSize,
        tabsSizeKB: Math.round(dataSize / 1024 * 100) / 100,
        totalSize: totalSize,
        totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
        percentUsed: Math.round((totalSize / (5 * 1024 * 1024)) * 100) // Assume 5MB limit
      };
    } catch (error) {
      return { 
        tabCount: 0, 
        tabsSize: 0, 
        tabsSizeKB: 0,
        totalSize: 0,
        totalSizeKB: 0,
        percentUsed: 0
      };
    }
  }

  /**
   * Export all tabs as JSON
   * @returns {string} JSON string of exported data
   */
  static exportTabs() {
    const tabs = this.getAllTabs();
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      tabs: tabs
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import tabs from JSON
   * @param {string} jsonData - JSON data to import
   * @param {boolean} mergeMode - Whether to merge with existing tabs
   * @returns {Object} Import result
   */
  static importTabs(jsonData, mergeMode = true) {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.tabs || !Array.isArray(importData.tabs)) {
        throw new Error('Invalid import data format');
      }

      const existingTabs = mergeMode ? this.getAllTabs() : [];
      const importedTabs = importData.tabs.map(tab => ({
        ...tab,
        id: generateId('tab'), // Generate new IDs to avoid conflicts
        dateModified: new Date().toISOString()
      }));

      // Validate all imported tabs
      for (const tab of importedTabs) {
        const validation = validateTabData(tab);
        if (!validation.isValid) {
          throw new Error(`Invalid tab "${tab.name}": ${validation.errors.join(', ')}`);
        }
      }

      const allTabs = [...existingTabs, ...importedTabs];
      localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(allTabs));
      
      return {
        success: true,
        imported: importedTabs.length,
        total: allTabs.length
      };
    } catch (error) {
      console.error('Error importing tabs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search tabs by name or content
   * @param {string} query - Search query
   * @returns {Array<Object>} Matching tabs
   */
  static searchTabs(query) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const tabs = this.getAllTabs();
    
    return tabs.filter(tab => {
      return tab.name.toLowerCase().includes(lowerQuery) ||
             tab.originalTab.toLowerCase().includes(lowerQuery) ||
             tab.convertedTab.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * Get tabs sorted by a specific field
   * @param {string} field - Field to sort by (name, dateCreated, dateModified)
   * @param {boolean} ascending - Sort direction
   * @returns {Array<Object>} Sorted tabs
   */
  static getTabsSorted(field = 'dateModified', ascending = false) {
    const tabs = this.getAllTabs();
    
    return tabs.sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];
      
      // Handle string comparison for names
      if (field === 'name') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  }

  /**
   * Get recent tabs
   * @param {number} limit - Maximum number of tabs to return
   * @returns {Array<Object>} Recent tabs
   */
  static getRecentTabs(limit = 5) {
    return this.getTabsSorted('dateModified', false).slice(0, limit);
  }

  /**
   * Save user settings
   * @param {Object} settings - Settings to save
   * @returns {boolean} True if saved successfully
   */
  static saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  /**
   * Get user settings
   * @returns {Object} User settings
   */
  static getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error loading settings:', error);
      return {};
    }
  }
}
