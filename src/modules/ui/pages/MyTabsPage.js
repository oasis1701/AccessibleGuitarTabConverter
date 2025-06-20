/**
 * @fileoverview My Tabs page functionality
 * @module ui/pages/MyTabsPage
 */

import { LocalStorage } from '../../storage/LocalStorage.js';
import { notificationManager } from '../components/NotificationManager.js';
import { formatDate, escapeHtml } from '../../../utils/helpers.js';

/**
 * Class to manage the My Tabs page
 */
export class MyTabsPage {
  constructor() {
    this.init();
  }

  /**
   * Initialize the My Tabs page
   */
  init() {
    this.setupElements();
    this.bindEvents();
    this.displaySavedTabs();
  }

  /**
   * Set up DOM element references
   */
  setupElements() {
    this.noTabsMessage = document.getElementById('no-tabs-message');
    this.tabsContainer = document.getElementById('tabs-container');
    this.clearAllBtn = document.getElementById('clear-all-btn');
    this.tabsTable = document.getElementById('tabs-table');
    this.tabsTbody = document.getElementById('tabs-tbody');
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Clear all tabs button
    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => this.clearAllTabs());
    }

    // Global delete handler (using event delegation)
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-button')) {
        const tabId = e.target.dataset.tabId;
        if (tabId) {
          this.deleteTab(tabId);
        }
      }
    });

    // Keyboard navigation for table
    if (this.tabsTable) {
      this.tabsTable.addEventListener('keydown', (e) => {
        this.handleTableKeyboard(e);
      });
    }
  }

  /**
   * Display saved tabs
   */
  displaySavedTabs() {
    const tabs = LocalStorage.getAllTabs();
    
    if (tabs.length === 0) {
      this.showNoTabsMessage();
    } else {
      this.showTabsList(tabs);
    }

    // Update page title with count
    document.title = `My Tabs (${tabs.length}) - Accessible Guitar Tabs`;
  }

  /**
   * Show no tabs message
   */
  showNoTabsMessage() {
    if (this.noTabsMessage) this.noTabsMessage.style.display = 'block';
    if (this.tabsContainer) this.tabsContainer.style.display = 'none';
    if (this.clearAllBtn) this.clearAllBtn.style.display = 'none';
  }

  /**
   * Show tabs list
   * @param {Array<Object>} tabs - Tabs to display
   */
  showTabsList(tabs) {
    if (this.noTabsMessage) this.noTabsMessage.style.display = 'none';
    if (this.tabsContainer) this.tabsContainer.style.display = 'block';
    if (this.clearAllBtn) this.clearAllBtn.style.display = 'inline-block';

    // Clear existing rows
    if (this.tabsTbody) {
      this.tabsTbody.innerHTML = '';

      // Sort tabs by date modified (newest first)
      const sortedTabs = [...tabs].sort((a, b) => {
        const dateA = new Date(b.dateModified || b.dateCreated);
        const dateB = new Date(a.dateModified || a.dateCreated);
        return dateA - dateB;
      });

      // Add rows for each tab
      sortedTabs.forEach((tab, index) => {
        const row = this.createTabRow(tab, index);
        this.tabsTbody.appendChild(row);
      });
    }

    // Announce to screen readers
    notificationManager.announce(`Displaying ${tabs.length} saved tabs`);
  }

  /**
   * Create a table row for a tab
   * @param {Object} tab - Tab data
   * @param {number} index - Row index
   * @returns {HTMLTableRowElement} Table row element
   */
  createTabRow(tab, index) {
    const row = document.createElement('tr');
    row.setAttribute('data-tab-id', tab.id);
    
    // Tab name cell
    const nameCell = document.createElement('td');
    const tabLink = document.createElement('a');
    tabLink.href = `converter.html?load=${encodeURIComponent(tab.id)}`;
    tabLink.className = 'tab-link';
    tabLink.textContent = tab.name;
    tabLink.setAttribute('aria-label', `Open ${tab.name}`);
    nameCell.appendChild(tabLink);
    
    // Date cell
    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(tab.dateModified || tab.dateCreated);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${tab.name}`);
    deleteBtn.dataset.tabId = tab.id;
    actionsCell.appendChild(deleteBtn);
    
    // Add export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'export-button';
    exportBtn.textContent = 'Export';
    exportBtn.setAttribute('aria-label', `Export ${tab.name}`);
    exportBtn.addEventListener('click', () => this.exportTab(tab));
    actionsCell.appendChild(exportBtn);
    
    row.appendChild(nameCell);
    row.appendChild(dateCell);
    row.appendChild(actionsCell);
    
    return row;
  }

  /**
   * Delete a tab
   * @param {string} tabId - Tab ID to delete
   */
  async deleteTab(tabId) {
    const tab = LocalStorage.getTab(tabId);
    if (!tab) return;

    const confirmed = await notificationManager.confirm(
      `Are you sure you want to delete "${tab.name}"?`,
      {
        title: 'Delete Tab',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'warning'
      }
    );

    if (confirmed) {
      if (LocalStorage.deleteTab(tabId)) {
        notificationManager.success(`Tab "${tab.name}" deleted`);
        this.displaySavedTabs();
      } else {
        notificationManager.error('Failed to delete tab');
      }
    }
  }

  /**
   * Clear all tabs
   */
  async clearAllTabs() {
    const tabs = LocalStorage.getAllTabs();
    if (tabs.length === 0) return;

    const confirmed = await notificationManager.confirm(
      `Are you sure you want to delete all ${tabs.length} saved tabs? This cannot be undone.`,
      {
        title: 'Clear All Tabs',
        confirmText: 'Delete All',
        cancelText: 'Cancel',
        type: 'error'
      }
    );

    if (confirmed) {
      if (LocalStorage.clearAllTabs()) {
        notificationManager.success('All tabs cleared');
        this.displaySavedTabs();
      } else {
        notificationManager.error('Failed to clear tabs');
      }
    }
  }

  /**
   * Export a single tab
   * @param {Object} tab - Tab to export
   */
  exportTab(tab) {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      tabs: [tab]
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab.name.replace(/[^a-z0-9]/gi, '_')}_guitar_tab.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    notificationManager.success(`Exported "${tab.name}"`);
  }

  /**
   * Handle keyboard navigation in the table
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleTableKeyboard(e) {
    const target = e.target;
    
    // Handle arrow key navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      
      const row = target.closest('tr');
      if (!row) return;
      
      const nextRow = e.key === 'ArrowUp' ? 
        row.previousElementSibling : 
        row.nextElementSibling;
      
      if (nextRow) {
        const focusable = nextRow.querySelector('a, button');
        if (focusable) focusable.focus();
      }
    }
  }

  /**
   * Add search functionality
   */
  addSearchFunctionality() {
    // Create search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
      <label for="tab-search">Search tabs:</label>
      <input type="search" id="tab-search" placeholder="Search by name or content...">
    `;
    
    this.tabsContainer.insertBefore(searchContainer, this.tabsTable);
    
    const searchInput = document.getElementById('tab-search');
    searchInput.addEventListener('input', (e) => {
      this.filterTabs(e.target.value);
    });
  }

  /**
   * Filter tabs based on search query
   * @param {string} query - Search query
   */
  filterTabs(query) {
    if (!query) {
      this.displaySavedTabs();
      return;
    }
    
    const filteredTabs = LocalStorage.searchTabs(query);
    if (filteredTabs.length === 0) {
      this.tabsTbody.innerHTML = '<tr><td colspan="3">No tabs found matching your search.</td></tr>';
    } else {
      this.showTabsList(filteredTabs);
    }
  }
}
