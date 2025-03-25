/**
 * Settings Management System
 * 
 * A comprehensive system for managing application settings with:
 * - Type-safe settings schema with validation
 * - Multi-tier storage with encryption for sensitive data
 * - Automatic migration between versions
 * - Optimized DOM operations with element caching
 * - Real-time setting preview with reactive updates
 * - Import/export capabilities with validation
 * - Event-driven architecture for cross-component communication
 * 
 * @module settings
 * @version 2.0.0
 */

// Constants for storage keys
const STORAGE_KEYS = {
    SETTINGS: 'claude_assistant_settings',
    THEME: 'claude_assistant_theme',
    VERSION: 'claude_settings_version'
  };
  
  /**
   * Available Claude API models
   * @type {Object[]}
   */
  const AVAILABLE_MODELS = [
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
  ];
  
  /**
   * Settings schema with validation, defaults, and metadata
   * @type {Object}
   */
  const SETTINGS_SCHEMA = {
    apiKey: {
      type: 'string',
      default: '',
      sensitive: true,
      validate: value => typeof value === 'string',
      sanitize: value => value?.trim() || '',
      category: 'connection',
      label: 'API Key',
      description: 'Your Anthropic API key for accessing Claude'
    },
    model: {
      type: 'string',
      default: 'claude-3-7-sonnet-20250219',
      options: AVAILABLE_MODELS,
      validate: value => AVAILABLE_MODELS.some(model => model.value === value),
      category: 'ai',
      label: 'AI Model',
      description: 'The Claude model to use for generating responses'
    },
    temperature: {
      type: 'number',
      default: 0.7,
      min: 0,
      max: 1,
      step: 0.1,
      validate: value => typeof value === 'number' && value >= 0 && value <= 1,
      sanitize: value => Math.min(1, Math.max(0, parseFloat(value) || 0)),
      category: 'ai',
      label: 'Temperature',
      description: 'Controls randomness: lower values are more focused, higher values more creative'
    },
    thinkingBudget: {
      type: 'number',
      default: 10240,
      min: 1024,
      max: 120000,
      step: 1024,
      validate: value => typeof value === 'number' && value >= 1024,
      sanitize: value => Math.max(1024, parseInt(value) || 1024),
      category: 'ai',
      label: 'Thinking Budget',
      description: 'Maximum tokens allocated for Claude\'s thinking process'
    },
    maxTokens: {
      type: 'number',
      default: 4096,
      min: 1024,
      max: 20000,
      step: 1024,
      validate: value => typeof value === 'number' && value >= 1024,
      sanitize: value => Math.max(1024, parseInt(value) || 1024),
      category: 'ai',
      label: 'Max Tokens',
      description: 'Maximum number of tokens in Claude\'s response'
    },
    messagesToKeep: {
      type: 'number',
      default: 20,
      min: 1,
      max: 100,
      step: 1,
      validate: value => typeof value === 'number' && value >= 1 && value <= 100,
      sanitize: value => Math.min(100, Math.max(1, parseInt(value) || 20)),
      category: 'chat',
      label: 'Messages to Keep',
      description: 'Number of messages to retain in chat history'
    },
    autoScroll: {
      type: 'boolean',
      default: true,
      validate: value => typeof value === 'boolean',
      category: 'interface',
      label: 'Auto-scroll to Bottom',
      description: 'Automatically scroll to the latest message'
    },
    soundEffects: {
      type: 'boolean',
      default: true,
      validate: value => typeof value === 'boolean',
      category: 'interface',
      label: 'Sound Effects',
      description: 'Play sound effects for notifications and events'
    },
    theme: {
      type: 'string',
      default: 'system',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'system', label: 'System Default' }
      ],
      validate: value => ['light', 'dark', 'system'].includes(value),
      category: 'interface',
      label: 'Theme',
      description: 'Application color theme'
    }
  };
  
  /**
   * Settings presets for quick configuration
   * @type {Object}
   */
  const SETTINGS_PRESETS = {
    default: {
      temperature: 0.7,
      thinkingBudget: 10240,
      maxTokens: 4096
    },
    creative: {
      temperature: 1.0,
      thinkingBudget: 16384,
      maxTokens: 8192
    },
    precise: {
      temperature: 0.3,
      thinkingBudget: 20480,
      maxTokens: 4096
    },
    efficient: {
      temperature: 0.5,
      thinkingBudget: 5120,
      maxTokens: 2048
    }
  };
  
  /**
   * Settings categories for UI organization
   * @type {Object[]}
   */
  const SETTINGS_CATEGORIES = [
    {
      id: 'connection',
      label: 'Connection',
      icon: 'key',
      description: 'API connection settings'
    },
    {
      id: 'ai',
      label: 'AI Configuration',
      icon: 'cpu',
      description: 'Configure Claude\'s behavior and capabilities'
    },
    {
      id: 'interface',
      label: 'Interface',
      icon: 'monitor',
      description: 'User interface preferences'
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: 'message-circle',
      description: 'Chat behavior and history settings'
    }
  ];
  
  /**
   * Security utility for handling sensitive data
   */
  class SecurityUtil {
    /**
     * Simple obfuscation for sensitive values
     * @param {string} value - Value to obfuscate
     * @returns {string} Obfuscated value
     */
    static obfuscate(value) {
      if (!value) return '';
      try {
        return btoa(`${value}:${Date.now()}`);
      } catch (e) {
        console.error('Failed to obfuscate value', e);
        return '';
      }
    }
  
    /**
     * Deobfuscate sensitive value
     * @param {string} obfuscated - Obfuscated value
     * @returns {string} Original value
     */
    static deobfuscate(obfuscated) {
      if (!obfuscated) return '';
      try {
        const decoded = atob(obfuscated);
        return decoded.split(':')[0];
      } catch (e) {
        console.error('Failed to deobfuscate value', e);
        return '';
      }
    }
  
    /**
     * Create a secure hash of a value (for comparison)
     * @param {string} value - Value to hash
     * @returns {string} Hashed value
     */
    static hash(value) {
      if (!value) return '';
      
      // Simple hash function for browser environments
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(36);
    }
  }
  
  /**
   * Storage adapter with multi-tier fallbacks
   */
  class StorageAdapter {
    /**
     * Save data to storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} Success status
     */
    static async save(key, value) {
      try {
        // Serialize for storage
        const serialized = JSON.stringify(value);
        
        // Try localStorage first
        try {
          localStorage.setItem(key, serialized);
          return true;
        } catch (e) {
          // Fall back to sessionStorage
          try {
            sessionStorage.setItem(key, serialized);
            return true;
          } catch (innerError) {
            console.error('Failed to save to storage:', innerError);
            return false;
          }
        }
      } catch (e) {
        console.error('Failed to serialize settings:', e);
        return false;
      }
    }
  
    /**
     * Load data from storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Retrieved value or default
     */
    static async load(key, defaultValue = null) {
      let data = null;
  
      // Try localStorage first
      try {
        data = localStorage.getItem(key);
      } catch (e) {
        // Ignore localStorage errors
      }
  
      // Try sessionStorage if not in localStorage
      if (data === null) {
        try {
          data = sessionStorage.getItem(key);
        } catch (e) {
          // Ignore sessionStorage errors
        }
      }
  
      // Parse data if found
      if (data) {
        try {
          return JSON.parse(data);
        } catch (e) {
          console.error('Failed to parse stored settings:', e);
        }
      }
  
      // Return default if all else fails
      return defaultValue;
    }
  
    /**
     * Remove data from all storage backends
     * @param {string} key - Storage key to clear
     */
    static clear(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore localStorage errors
      }
  
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        // Ignore sessionStorage errors
      }
    }
  
    /**
     * Test if storage is available
     * @returns {boolean} Whether storage is available
     */
    static isAvailable() {
      try {
        const testKey = '__storage_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        try {
          // Try sessionStorage as fallback
          const testKey = '__storage_test__';
          sessionStorage.setItem(testKey, testKey);
          sessionStorage.removeItem(testKey);
          return true;
        } catch (innerError) {
          return false;
        }
      }
    }
  }
  
  /**
   * Event emitter for settings events
   */
  class EventEmitter {
    constructor() {
      this.events = {};
    }
  
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} listener - Event callback
     * @returns {Function} Unsubscribe function
     */
    on(event, listener) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(listener);
      
      // Return unsubscribe function
      return () => this.off(event, listener);
    }
  
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} listener - Event callback to remove
     */
    off(event, listener) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
      if (!this.events[event]) return;
      this.events[event].forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  
    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} listener - Event callback
     */
    once(event, listener) {
      const remove = this.on(event, data => {
        remove();
        listener(data);
      });
    }
    
    /**
     * Check if event has listeners
     * @param {string} event - Event name
     * @returns {boolean} Has listeners
     */
    hasListeners(event) {
      return !!(this.events[event] && this.events[event].length > 0);
    }
  }
  
  /**
   * DOM utility for efficient element operations
   */
  class DOMUtil {
    /**
     * Element cache for performance
     */
    static elementCache = new Map();
  
    /**
     * Get element by ID from cache or DOM
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} Found element or null
     */
    static getElement(id) {
      if (this.elementCache.has(id)) {
        return this.elementCache.get(id);
      }
      
      const element = document.getElementById(id);
      if (element) {
        this.elementCache.set(id, element);
      }
      return element;
    }
  
    /**
     * Create a debounced function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Debounce wait time in ms
     * @returns {Function} Debounced function
     */
    static debounce(func, wait = 300) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
    
    /**
     * Add multiple classes to an element
     * @param {HTMLElement} element - Target element
     * @param {...string} classes - Classes to add
     */
    static addClasses(element, ...classes) {
      if (!element) return;
      element.classList.add(...classes.filter(Boolean));
    }
    
    /**
     * Remove multiple classes from an element
     * @param {HTMLElement} element - Target element
     * @param {...string} classes - Classes to remove
     */
    static removeClasses(element, ...classes) {
      if (!element) return;
      element.classList.remove(...classes.filter(Boolean));
    }
    
    /**
     * Set attributes on an element
     * @param {HTMLElement} element - Target element
     * @param {Object} attributes - Attributes to set
     */
    static setAttributes(element, attributes) {
      if (!element) return;
      Object.entries(attributes).forEach(([attr, value]) => {
        if (value === null || value === undefined) {
          element.removeAttribute(attr);
        } else {
          element.setAttribute(attr, value);
        }
      });
    }
  }
  
  /**
   * Toast notification manager
   */
  const ToastManager = {
    /**
     * Show a toast notification
     * @param {Object} options - Toast options
     */
    show(options) {
      // Use global showToast if available
      if (typeof window.showToast === 'function') {
        window.showToast(options);
      } else {
        // Fallback console output
        console.log(`[${options.type}] ${options.title}: ${options.message}`);
      }
    },
    
    /**
     * Show a success toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {number} duration - Display duration in ms
     */
    success(title, message, duration = 3000) {
      this.show({
        title,
        message,
        type: 'success',
        duration
      });
    },
    
    /**
     * Show an error toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {number} duration - Display duration in ms
     */
    error(title, message, duration = 5000) {
      this.show({
        title,
        message,
        type: 'error',
        duration
      });
    },
    
    /**
     * Show a warning toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {number} duration - Display duration in ms
     */
    warning(title, message, duration = 4000) {
      this.show({
        title,
        message,
        type: 'warning',
        duration
      });
    },
    
    /**
     * Show an info toast
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {number} duration - Display duration in ms
     */
    info(title, message, duration = 3000) {
      this.show({
        title,
        message,
        type: 'info',
        duration
      });
    }
  };
  
  /**
   * Settings Manager - Core class for managing application settings
   */
  class SettingsManager {
    /**
     * Create a new SettingsManager instance
     */
    constructor() {
      // Configuration
      this.version = '2.0.0';
      this.schema = SETTINGS_SCHEMA;
      this.presets = SETTINGS_PRESETS;
      this.categories = SETTINGS_CATEGORIES;
      
      // State
      this.settings = null;
      this.events = new EventEmitter();
      this.elements = {};
      this.initialized = false;
      this.pendingChanges = {};
      this.hasUnsavedChanges = false;
      
      // Bind methods that need this context
      this._boundHandleThemePrefChange = this._handleThemePreferenceChange.bind(this);
      
      // Debounced methods
      this.debouncedSave = DOMUtil.debounce(this._saveSettings.bind(this), 300);
      this.debouncedUpdateUI = DOMUtil.debounce(this._updateUIFromSettings.bind(this), 50);
      this.previewSetting = DOMUtil.debounce(this._previewSetting.bind(this), 50);
    }
    
    /**
     * Initialize settings manager
     * @returns {Promise<SettingsManager>} Initialized instance
     */
    async init() {
      if (this.initialized) return this;
      
      try {
        console.time('Settings Initialization');
        
        // Check storage availability
        if (!StorageAdapter.isAvailable()) {
          console.warn('Local storage is not available. Settings will not persist.');
        }
        
        // Load settings with fallbacks
        await this._loadSettings();
        
        // Validate and migrate settings
        this._validateAndMigrate();
        
        // Initialize DOM elements
        this._initializeDOM();
        
        // Initialize theme
        this._initializeTheme();
        
        // Set up media query listeners
        this._setupMediaListeners();
        
        // Mark as initialized
        this.initialized = true;
        
        // Emit initialized event
        this.events.emit('initialized', { 
          settings: this.getPublicSettings(),
          categories: this.categories
        });
        
        // Check if API key is set, if not, prompt to configure
        if (!this.settings.apiKey) {
          this.events.emit('missing-api-key');
        }
        
        console.timeEnd('Settings Initialization');
        return this;
      } catch (error) {
        console.error('Failed to initialize settings:', error);
        
        // Reset to defaults as fallback
        this.settings = this._getDefaultSettings();
        this._saveSettings(this.settings);
        
        // Emit error event
        this.events.emit('error', { 
          message: 'Failed to initialize settings',
          error
        });
        
        throw error;
      }
    }
    
    /**
     * Load settings from storage
     * @private
     */
    async _loadSettings() {
      // Load from storage
      const storedSettings = await StorageAdapter.load(STORAGE_KEYS.SETTINGS);
      
      if (storedSettings) {
        this.settings = storedSettings;
        
        // Handle encrypted sensitive data
        for (const [key, schema] of Object.entries(this.schema)) {
          if (schema.sensitive) {
            const encryptedKey = `${key}_encrypted`;
            
            if (this.settings[encryptedKey]) {
              try {
                this.settings[key] = SecurityUtil.deobfuscate(this.settings[encryptedKey]);
                delete this.settings[encryptedKey];
              } catch (e) {
                console.warn(`Could not decrypt ${key}, resetting to default`);
                this.settings[key] = schema.default;
              }
            }
          }
        }
      } else {
        // Use defaults if nothing stored
        this.settings = this._getDefaultSettings();
        
        // Save defaults
        await this._saveSettings(this.settings);
      }
    }
    
    /**
     * Get default settings
     * @returns {Object} Default settings
     * @private
     */
    _getDefaultSettings() {
      const defaults = {};
      
      // Extract defaults from schema
      for (const [key, schema] of Object.entries(this.schema)) {
        defaults[key] = schema.default;
      }
      
      return defaults;
    }
    
    /**
     * Save settings to storage
     * @param {Object} settings - Settings to save
     * @returns {Promise<boolean>} Success status
     * @private
     */
    async _saveSettings(settings = this.settings) {
      if (!settings) return false;
      
      try {
        // Create a copy for storage
        const storageSettings = { ...settings };
        
        // Handle sensitive fields
        for (const [key, schema] of Object.entries(this.schema)) {
          if (schema.sensitive && storageSettings[key]) {
            // Encrypt sensitive data
            storageSettings[`${key}_encrypted`] = SecurityUtil.obfuscate(storageSettings[key]);
            // Remove the actual value from storage
            storageSettings[key] = Boolean(storageSettings[key]); // Just store that we have a value
          }
        }
        
        // Save to storage
        const success = await StorageAdapter.save(STORAGE_KEYS.SETTINGS, storageSettings);
        
        if (success) {
          this.hasUnsavedChanges = false;
          this.events.emit('settings-saved', { settings: this.getPublicSettings() });
        }
        
        return success;
      } catch (error) {
        console.error('Failed to save settings:', error);
        return false;
      }
    }
    
    /**
     * Validate settings and migrate if needed
     * @private
     */
    _validateAndMigrate() {
      const newSettings = { ...this.settings };
      let needsUpdate = false;
      
      // Check version for migrations
      const storedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
      
      // Process version migration if needed
      if (storedVersion && storedVersion !== this.version) {
        this._migrateFromVersion(storedVersion, newSettings);
        needsUpdate = true;
      }
      
      // Store current version
      localStorage.setItem(STORAGE_KEYS.VERSION, this.version);
      
      // Validate each setting against schema
      for (const [key, schema] of Object.entries(this.schema)) {
        // Check if key exists
        if (!(key in newSettings) || newSettings[key] === undefined || newSettings[key] === null) {
          newSettings[key] = schema.default;
          needsUpdate = true;
          continue;
        }
        
        // Validate value
        const value = newSettings[key];
        
        if (schema.validate && !schema.validate(value)) {
          // Try to sanitize
          if (schema.sanitize) {
            try {
              newSettings[key] = schema.sanitize(value);
              needsUpdate = true;
            } catch (e) {
              // Sanitization failed, use default
              console.warn(`Could not sanitize ${key}, resetting to default`, e);
              newSettings[key] = schema.default;
              needsUpdate = true;
            }
          } else {
            // No sanitize function, use default
            newSettings[key] = schema.default;
            needsUpdate = true;
          }
        }
      }
      
      // Update settings if needed
      if (needsUpdate) {
        this.settings = newSettings;
        this._saveSettings(newSettings);
      }
    }
    
    /**
     * Migrate settings from a previous version
     * @param {string} fromVersion - Previous version
     * @param {Object} settings - Settings object to migrate
     * @private
     */
    _migrateFromVersion(fromVersion, settings) {
      console.log(`Migrating settings from version ${fromVersion} to ${this.version}`);
      
      // v1.0.0 to v1.2.0
      if (fromVersion === '1.0.0' || fromVersion === '1.1.0') {
        // Add new v1.2.0 settings with defaults
        if (!('thinkingBudget' in settings)) {
          settings.thinkingBudget = 10240;
        }
      }
      
      // v1.2.0 to v2.0.0
      if (fromVersion === '1.2.0') {
        // No migration needed currently
      }
      
      // Store new version
      localStorage.setItem(STORAGE_KEYS.VERSION, this.version);
    }
    
    /**
     * Initialize DOM elements
     * @private
     */
    _initializeDOM() {
      // Primary controls
      ['settingsButton', 'sidebarSettingsBtn', 'closeSettings', 'saveSettings', 
       'settingsPanel', 'overlay', 'presetSelector'].forEach(id => {
        this.elements[id] = DOMUtil.getElement(id);
      });
      
      // Settings inputs
      for (const [key, schema] of Object.entries(this.schema)) {
        this.elements[key] = DOMUtil.getElement(key);
        
        // Special cases for some settings
        if (key === 'apiKey') {
          this.elements.togglePassword = DOMUtil.getElement('togglePassword');
          if (this.elements.togglePassword) {
            this.elements.showPasswordIcon = this.elements.togglePassword.querySelector('.show-password');
            this.elements.hidePasswordIcon = this.elements.togglePassword.querySelector('.hide-password');
          }
        }
        
        if (key === 'temperature') {
          this.elements.temperatureValue = DOMUtil.getElement('temperatureValue');
        }
      }
      
      // Additional elements
      this.elements.usageInfo = DOMUtil.getElement('usageInfo');
      this.elements.exportSettingsBtn = DOMUtil.getElement('exportSettingsBtn');
      this.elements.importSettingsBtn = DOMUtil.getElement('importSettingsBtn');
      this.elements.resetSettingsBtn = DOMUtil.getElement('resetSettingsBtn');
      
      // Initialize UI
      this._initializeUI();
    }
    
    /**
     * Initialize UI interactions
     * @private
     */
    _initializeUI() {
      // Skip if settings panel not found
      if (!this.elements.settingsPanel) return;
      
      // Apply current settings to UI
      this._updateUIFromSettings();
      
      // Set up event listeners
      this._setupEventListeners();
    }
    
    /**
     * Set up event listeners
     * @private
     */
    _setupEventListeners() {
      // Settings panel toggling
      if (this.elements.settingsButton) {
        this.elements.settingsButton.addEventListener('click', () => this.openSettings());
      }
      
      if (this.elements.sidebarSettingsBtn) {
        this.elements.sidebarSettingsBtn.addEventListener('click', () => {
          this.openSettings();
          const sidebar = document.getElementById('sidebar');
          if (sidebar) sidebar.classList.remove('open');
        });
      }
      
      if (this.elements.closeSettings) {
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
      }
      
      if (this.elements.overlay) {
        this.elements.overlay.addEventListener('click', (e) => {
          // Only close if clicking the overlay directly
          if (e.target === this.elements.overlay) {
            this.closeSettings();
          }
        });
      }
      
      // Save settings
      if (this.elements.saveSettings) {
        this.elements.saveSettings.addEventListener('click', () => this.saveSettingsFromUI());
      }
      
      // Set up specialized input handlers
      this._setupInputHandlers();
      
      // Preset selector
      if (this.elements.presetSelector) {
        this.elements.presetSelector.addEventListener('change', (e) => {
          const preset = e.target.value;
          if (preset && this.presets[preset]) {
            this.applyPreset(preset);
          }
        });
      }
      
      // Export/import handlers
      if (this.elements.exportSettingsBtn) {
        this.elements.exportSettingsBtn.addEventListener('click', () => this.exportSettings());
      }
      
      if (this.elements.importSettingsBtn) {
        this.elements.importSettingsBtn.addEventListener('click', () => this.importSettings());
      }
      
      // Reset settings
      if (this.elements.resetSettingsBtn) {
        this.elements.resetSettingsBtn.addEventListener('click', () => this.resetSettings());
      }
      
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Close settings panel with ESC key
        if (e.key === 'Escape' && this.isSettingsPanelOpen()) {
          this.closeSettings();
        }
        
        // Open settings with Ctrl+, (common shortcut)
        if (e.key === ',' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.openSettings();
        }
        
        // Save settings with Ctrl+S while panel is open
        if (e.key === 's' && (e.ctrlKey || e.metaKey) && this.isSettingsPanelOpen()) {
          e.preventDefault();
          this.saveSettingsFromUI();
        }
      });
    }
    
    /**
     * Set up specialized input handlers
     * @private
     */
    _setupInputHandlers() {
      // Set up real-time preview for inputs
      for (const [key, element] of Object.entries(this.elements)) {
        // Skip non-schema elements
        if (!this.schema[key] || !element) continue;
        
        const schema = this.schema[key];
        
        // Handle input events for real-time preview
        if (schema.type === 'boolean' && element.type === 'checkbox') {
          element.addEventListener('change', (e) => {
            this.previewSetting(key, e.target.checked);
            this.pendingChanges[key] = e.target.checked;
            this.hasUnsavedChanges = true;
            this._updateSaveButtonState();
          });
        } else if (schema.type === 'number') {
          element.addEventListener('input', (e) => {
            let value = schema.sanitize ? 
              schema.sanitize(e.target.value) : 
              parseFloat(e.target.value);
              
            this.previewSetting(key, value);
            this.pendingChanges[key] = value;
            this.hasUnsavedChanges = true;
            this._updateSaveButtonState();
            
            // Special cases
            if (key === 'temperature' && this.elements.temperatureValue) {
              this.elements.temperatureValue.textContent = value.toFixed(1);
            } else if (key === 'thinkingBudget') {
              this.updateUsageInfo(value);
            }
          });
        } else {
          element.addEventListener('input', (e) => {
            let value = schema.sanitize ? 
              schema.sanitize(e.target.value) : 
              e.target.value;
              
            this.previewSetting(key, value);
            this.pendingChanges[key] = value;
            this.hasUnsavedChanges = true;
            this._updateSaveButtonState();
          });
        }
      }
      
      // API key field with password toggle
      if (this.elements.apiKey && this.elements.togglePassword) {
        this.elements.togglePassword.addEventListener('click', () => {
          const apiKeyInput = this.elements.apiKey;
          const showIcon = this.elements.showPasswordIcon;
          const hideIcon = this.elements.hidePasswordIcon;
          
          if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            showIcon.style.display = 'none';
            hideIcon.style.display = 'inline';
          } else {
            apiKeyInput.type = 'password';
            showIcon.style.display = 'inline';
            hideIcon.style.display = 'none';
          }
        });
      }
    }
    
    /**
     * Update UI elements from settings
     * @private
     */
    _updateUIFromSettings() {
      for (const [key, value] of Object.entries(this.settings)) {
        const element = this.elements[key];
        if (!element) continue;
        
        const schema = this.schema[key];
        if (!schema) continue;
        
        // Handle different input types
        if (element.type === 'checkbox') {
          element.checked = !!value;
        } else if (key === 'apiKey' && schema.sensitive) {
          // For API key, only set non-empty values
          element.value = value || '';
        } else {
          element.value = value;
        }
        
        // Special cases
        if (key === 'temperature' && this.elements.temperatureValue) {
          this.elements.temperatureValue.textContent = typeof value === 'number' ? 
            value.toFixed(1) : value;
        }
      }
      
      // Update additional UI elements
      this.updateUsageInfo(this.settings.thinkingBudget);
      this.updateModelIndicator(this.settings.model);
      
      // Reset pending changes
      this.pendingChanges = {};
      this.hasUnsavedChanges = false;
      this._updateSaveButtonState();
    }
    
    /**
     * Preview a setting change without saving
     * @param {string} key - Setting key
     * @param {any} value - New value
     * @private
     */
    _previewSetting(key, value) {
      // Emit preview event for UI updates
      this.events.emit('setting-preview', { 
        key, 
        value, 
        previousValue: this.settings[key]
      });
      
      // Special case for theme - apply immediately for preview
      if (key === 'theme') {
        this._updateTheme(value);
      }
    }
    
    /**
     * Update save button state based on changes
     * @private
     */
    _updateSaveButtonState() {
      if (!this.elements.saveSettings) return;
      
      this.elements.saveSettings.disabled = !this.hasUnsavedChanges;
      
      if (this.hasUnsavedChanges) {
        this.elements.saveSettings.classList.add('highlight');
      } else {
        this.elements.saveSettings.classList.remove('highlight');
      }
    }
    
    /**
     * Initialize theme based on settings
     * @private
     */
    _initializeTheme() {
      const theme = this.settings.theme || 'system';
      this._updateTheme(theme);
    }
    
    /**
     * Set up media query listeners
     * @private
     */
    _setupMediaListeners() {
      // Listen for system theme changes
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Remove previous listener if exists (avoids duplicates on re-init)
      darkModeMediaQuery.removeEventListener('change', this._boundHandleThemePrefChange);
      
      // Add listener with bound method
      darkModeMediaQuery.addEventListener('change', this._boundHandleThemePrefChange);
    }
    
    /**
     * Handle system theme preference change
     * @param {MediaQueryListEvent} e - Media query change event
     * @private
     */
    _handleThemePreferenceChange(e) {
      // Only apply if theme is set to 'system'
      if (this.settings.theme === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        this._applyTheme(newTheme);
      }
    }
    
    /**
     * Update theme based on setting
     * @param {string} themeSetting - Theme setting (light, dark, system)
     * @private
     */
    _updateTheme(themeSetting) {
      const body = document.body;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // Remove existing theme classes
      DOMUtil.removeClasses(body, 'light-theme', 'dark-theme');
      
      if (themeSetting === 'system') {
        // Use system preference
        const systemTheme = prefersDark ? 'dark' : 'light';
        DOMUtil.addClasses(body, `${systemTheme}-theme`);
        
        // Apply theme
        this._applyTheme(systemTheme);
      } else {
        // Apply specific theme
        DOMUtil.addClasses(body, `${themeSetting}-theme`);
        
        // Apply theme
        this._applyTheme(themeSetting);
      }
    }
    
    /**
     * Apply a specific theme
     * @param {string} theme - Theme to apply ('light' or 'dark')
     * @private
     */
    _applyTheme(theme) {
      // Set CSS variable or data attribute for theme
      document.documentElement.setAttribute('data-theme', theme);
      
      // Emit theme changed event
      this.events.emit('theme-changed', { theme });
    }
    
    /**
     * Open settings panel
     */
    openSettings() {
      if (!this.elements.settingsPanel || !this.elements.overlay) {
        console.error('Settings panel elements not found');
        return;
      }
      
      // Reset pending changes
      this.pendingChanges = {};
      this.hasUnsavedChanges = false;
      
      // Refresh UI with current settings
      this._updateUIFromSettings();
      
      // Show panel with animation
      DOMUtil.addClasses(this.elements.settingsPanel, 'open');
      DOMUtil.addClasses(this.elements.overlay, 'open');
      
      // Focus on first input (but not API key for security)
      const firstInput = this.elements.model || this.elements.temperature;
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
      
      // Emit event
      this.events.emit('settings-opened');
    }
    
    /**
     * Close settings panel
     * @param {boolean} [skipConfirm=false] - Skip confirmation dialog for unsaved changes
     * @returns {boolean} Whether the panel was closed
     */
    closeSettings(skipConfirm = false) {
      if (!this.elements.settingsPanel || !this.elements.overlay) return false;
      
      // Check for unsaved changes
      if (!skipConfirm && this.hasUnsavedChanges) {
        const confirmed = confirm('You have unsaved changes. Are you sure you want to close settings?');
        if (!confirmed) return false;
      }
      
      // Hide panel
      DOMUtil.removeClasses(this.elements.settingsPanel, 'open');
      DOMUtil.removeClasses(this.elements.overlay, 'open');
      
      // Reset changes
      this.pendingChanges = {};
      this.hasUnsavedChanges = false;
      
      // Emit event
      this.events.emit('settings-closed');
      
      return true;
    }
    
    /**
     * Check if settings panel is open
     * @returns {boolean} Whether settings panel is open
     */
    isSettingsPanelOpen() {
      return this.elements.settingsPanel?.classList.contains('open') || false;
    }
    
    /**
     * Save settings from UI inputs
     */
    saveSettingsFromUI() {
      const newSettings = { ...this.settings };
      let hasErrors = false;
      
      // Extract values from UI elements
      for (const [key, schema] of Object.entries(this.schema)) {
        const element = this.elements[key];
        if (!element) continue;
        
        let value;
        
        // Extract value based on input type
        if (element.type === 'checkbox') {
          value = element.checked;
        } else if (schema.type === 'number') {
          value = schema.sanitize ? schema.sanitize(element.value) : parseFloat(element.value);
        } else {
          value = schema.sanitize ? schema.sanitize(element.value) : element.value;
        }
        
        // Validate value
        if (schema.validate && !schema.validate(value)) {
          hasErrors = true;
          this._showValidationError(key, value);
          continue;
        }
        
        // Special handling for sensitive data
        if (schema.sensitive && key === 'apiKey') {
          // Only update if changed (not empty)
          if (value.trim()) {
            newSettings[key] = value;
          }
        } else {
          newSettings[key] = value;
        }
      }
      
      // Don't save if validation errors
      if (hasErrors) return;
      
      // Save settings
      this.setSettings(newSettings);
      
      // Reset pending changes
      this.pendingChanges = {};
      this.hasUnsavedChanges = false;
      this._updateSaveButtonState();
      
      // Close panel if we saved successfully
      this.closeSettings(true);
      
      // Show success message
      ToastManager.success(
        'Settings Saved',
        'Your settings have been updated successfully.'
      );
    }
    
    /**
     * Show validation error for a setting
     * @param {string} key - Setting key
     * @param {any} value - Invalid value
     * @private
     */
    _showValidationError(key, value) {
      const schema = this.schema[key];
      let message = `Invalid value for ${schema.label || key}`;
      
      // Create more specific error messages
      if (schema.type === 'number') {
        if (schema.min !== undefined && schema.max !== undefined) {
          message = `${schema.label || key} must be between ${schema.min} and ${schema.max}`;
        } else if (schema.min !== undefined) {
          message = `${schema.label || key} must be at least ${schema.min}`;
        } else if (schema.max !== undefined) {
          message = `${schema.label || key} must be at most ${schema.max}`;
        }
      }
      
      // Show error message
      ToastManager.error('Invalid Setting', message);
      
      // Highlight the input
      const element = this.elements[key];
      if (element) {
        DOMUtil.addClasses(element, 'error');
        element.focus();
        
        // Remove error class after animation
        setTimeout(() => {
          DOMUtil.removeClasses(element, 'error');
        }, 2000);
      }
    }
    
    /**
     * Apply a settings preset
     * @param {string} presetName - Name of the preset
     */
    applyPreset(presetName) {
      const preset = this.presets[presetName];
      if (!preset) return;
      
      // Update UI with preset values
      for (const [key, value] of Object.entries(preset)) {
        const element = this.elements[key];
        if (!element) continue;
        
        // Update element
        if (element.type === 'checkbox') {
          element.checked = !!value;
        } else {
          element.value = value;
        }
        
        // Update associated displays
        if (key === 'temperature' && this.elements.temperatureValue) {
          this.elements.temperatureValue.textContent = value.toFixed(1);
        } else if (key === 'thinkingBudget') {
          this.updateUsageInfo(value);
        }
        
        // Add to pending changes
        this.pendingChanges[key] = value;
      }
      
      // Mark as having unsaved changes
      this.hasUnsavedChanges = true;
      this._updateSaveButtonState();
      
      // Show notification
      ToastManager.info(
        'Preset Applied',
        `Applied the "${presetName}" preset settings. Click Save to keep these changes.`
      );
    }
    
    /**
     * Reset settings to defaults
     */
    resetSettings() {
      if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
        // Get default settings
        const defaultSettings = this._getDefaultSettings();
        
        // Preserve API key if user has one
        if (this.settings.apiKey) {
          defaultSettings.apiKey = this.settings.apiKey;
        }
        
        // Apply defaults
        this.setSettings(defaultSettings);
        
        // Update UI
        this._updateUIFromSettings();
        
        ToastManager.info(
          'Settings Reset',
          'All settings have been reset to default values.'
        );
      }
    }
    
    /**
     * Update the UI to reflect thinking budget
     * @param {number} budget - Thinking budget in tokens
     */
    updateUsageInfo(budget) {
      if (!this.elements.usageInfo) return;
      
      // Format number with commas
      const formattedBudget = new Intl.NumberFormat().format(budget);
      this.elements.usageInfo.textContent = `Thinking Budget: ${formattedBudget} tokens`;
      
      // Add color coding
      DOMUtil.removeClasses(this.elements.usageInfo, 'high-budget', 'low-budget');
      
      if (budget > 20000) {
        DOMUtil.addClasses(this.elements.usageInfo, 'high-budget');
      } else if (budget < 5000) {
        DOMUtil.addClasses(this.elements.usageInfo, 'low-budget');
      }
    }
    
    /**
     * Update model indicator in the UI
     * @param {string} model - Model identifier
     */
    updateModelIndicator(model) {
      const modelName = document.querySelector('.model-name');
      if (!modelName) return;
      
      // Find model in schema options
      const modelOption = this.schema.model.options.find(opt => opt.value === model);
      
      if (modelOption) {
        modelName.textContent = modelOption.label;
      } else {
        // Fallback formatting for unknown models
        modelName.textContent = model.split('-').slice(0, 3).join(' ');
      }
      
      // Update model dot color based on model capability
      const modelDot = document.querySelector('.model-dot');
      if (modelDot) {
        if (model.includes('opus')) {
          modelDot.style.backgroundColor = '#4285f4'; // Blue for highest capability
        } else if (model.includes('sonnet')) {
          modelDot.style.backgroundColor = '#0f9d58'; // Green for medium
        } else if (model.includes('haiku')) {
          modelDot.style.backgroundColor = '#f4b400'; // Yellow for fastest
        } else {
          modelDot.style.backgroundColor = '#db4437'; // Red for unknown
        }
      }
    }
    
    /**
     * Export settings to JSON file
     */
    exportSettings() {
      try {
        // Create a clean copy of settings (without sensitive data)
        const exportData = {
          settings: { ...this.settings },
          version: this.version,
          timestamp: new Date().toISOString()
        };
        
        // Remove sensitive data
        for (const [key, schema] of Object.entries(this.schema)) {
          if (schema.sensitive) {
            exportData.settings[key] = '';
          }
        }
        
        // Convert to JSON
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `claude-assistant-settings-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        ToastManager.success(
          'Settings Exported',
          'Your settings have been exported successfully.'
        );
      } catch (error) {
        console.error('Failed to export settings:', error);
        
        ToastManager.error(
          'Export Failed',
          'Could not export settings: ' + error.message
        );
      }
    }
    
    /**
     * Import settings from JSON file
     */
    importSettings() {
      // Create file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/json';
      
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importData = JSON.parse(event.target.result);
            
            // Validate import data
            if (!importData.settings || !importData.version) {
              throw new Error('Invalid settings file format');
            }
            
            // Merge with current settings
            const newSettings = { ...this.settings };
            let changedCount = 0;
            
            // Only import valid settings from our schema
            for (const [key, schema] of Object.entries(this.schema)) {
              if (importData.settings[key] !== undefined && 
                  !schema.sensitive) { // Never import sensitive data
                
                // Validate and sanitize
                let value = importData.settings[key];
                
                // Skip validation for null/empty values (use current value)
                if (value === null || value === '') continue;
                
                try {
                  // Sanitize if needed
                  if (schema.sanitize) {
                    value = schema.sanitize(value);
                  }
                  
                  // Validate
                  if (!schema.validate || schema.validate(value)) {
                    if (newSettings[key] !== value) {
                      newSettings[key] = value;
                      changedCount++;
                    }
                  }
                } catch (e) {
                  console.warn(`Skipping invalid imported setting: ${key}`, e);
                }
              }
            }
            
            // Only update if at least one setting changed
            if (changedCount > 0) {
              // Save merged settings
              this.setSettings(newSettings);
              
              // Update UI
              this._updateUIFromSettings();
              
              ToastManager.success(
                'Settings Imported',
                `Successfully imported ${changedCount} settings`
              );
            } else {
              ToastManager.info(
                'No Changes',
                'Imported settings were identical or invalid'
              );
            }
          } catch (error) {
            console.error('Failed to import settings:', error);
            
            ToastManager.error(
              'Import Failed',
              'Could not import settings: ' + error.message
            );
          }
        };
        
        reader.readAsText(file);
      };
      
      // Trigger file selection
      fileInput.click();
    }
    
    // ===============================================================
    // Public API
    // ===============================================================
    
    /**
     * Update settings
     * @param {Object} newSettings - New settings object
     */
    setSettings(newSettings) {
      // Track changes
      const changedKeys = [];
      const changedSettings = {};
      
      // Validate and apply changes
      for (const [key, value] of Object.entries(newSettings)) {
        // Skip unknown keys
        if (!this.schema[key]) continue;
        
        const schema = this.schema[key];
        let processedValue = value;
        
        // Sanitize if needed
        if (schema.sanitize) {
          processedValue = schema.sanitize(value);
        }
        
        // Validate
        if (schema.validate && !schema.validate(processedValue)) {
          console.warn(`Invalid value for setting ${key}:`, value);
          continue;
        }
        
        // Check if value changed
        if (this.settings[key] !== processedValue) {
          changedSettings[key] = processedValue;
          changedKeys.push(key);
        }
      }
      
      // Skip save if nothing changed
      if (changedKeys.length === 0) return;
      
      // Update settings object
      for (const key of changedKeys) {
        this.settings[key] = changedSettings[key];
      }
      
      // Save to storage
      this._saveSettings(this.settings);
      
      // Apply runtime changes
      if (changedKeys.includes('theme')) {
        this._updateTheme(this.settings.theme);
      }
      
      if (changedKeys.includes('model')) {
        this.updateModelIndicator(this.settings.model);
      }
      
      // Emit change events for each changed setting
      for (const key of changedKeys) {
        this.events.emit('setting-changed', { 
          key, 
          value: this.settings[key],
          previousValue: changedSettings[key]
        });
      }
      
      // Emit general settings changed event
      this.events.emit('settings-changed', { 
        settings: this.getPublicSettings(),
        changedKeys
      });
    }
    
    /**
     * Get current settings (full copy)
     * @returns {Object} Current settings
     */
    getSettings() {
      return { ...this.settings };
    }
    
    /**
     * Get public version of settings (omitting sensitive data)
     * @returns {Object} Settings without sensitive data
     */
    getPublicSettings() {
      const publicSettings = { ...this.settings };
      
      // Remove sensitive data
      for (const [key, schema] of Object.entries(this.schema)) {
        if (schema.sensitive && publicSettings[key]) {
          publicSettings[key] = true; // Indicate value exists without revealing it
        }
      }
      
      return publicSettings;
    }
    
    /**
     * Get a specific setting
     * @param {string} key - Setting key
     * @param {any} defaultValue - Default value if not found
     * @returns {any} Setting value
     */
    getSetting(key, defaultValue = undefined) {
      return key in this.settings ? this.settings[key] : defaultValue;
    }
    
    /**
     * Update a single setting
     * @param {string} key - Setting key
     * @param {any} value - New value
     * @returns {boolean} Success status
     */
    updateSetting(key, value) {
      // Check if key exists in schema
      if (!(key in this.schema)) {
        console.warn(`Attempt to update unknown setting: ${key}`);
        return false;
      }
      
      // Update via setSettings for validation
      const update = {};
      update[key] = value;
      this.setSettings(update);
      
      return true;
    }
    
    /**
     * Check if the user has set up required settings
     * @returns {boolean} Whether setup is complete
     */
    isSetupComplete() {
      // Check if API key is set
      return !!this.settings.apiKey;
    }
    
    /**
     * Register a callback for settings events
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
      return this.events.on(event, callback);
    }
    
    /**
     * Get all available settings categories
     * @returns {Object[]} Settings categories
     */
    getCategories() {
      return [...this.categories];
    }
    
    /**
     * Get settings schema
     * @returns {Object} Settings schema
     */
    getSchema() {
      return { ...this.schema };
    }
    
    /**
     * Get all settings grouped by category
     * @returns {Object} Settings grouped by category
     */
    getSettingsByCategory() {
      const result = {};
      
      // Initialize categories
      for (const category of this.categories) {
        result[category.id] = [];
      }
      
      // Add settings to categories
      for (const [key, schema] of Object.entries(this.schema)) {
        if (schema.category && result[schema.category]) {
          result[schema.category].push({
            key,
            ...schema,
            value: this.settings[key]
          });
        }
      }
      
      return result;
    }
  }
  
  // Create singleton instance
  const settingsManager = new SettingsManager();
  
  // ===============================================================
  // Legacy functions for backward compatibility
  // ===============================================================
  
  /**
   * Get current settings
   * @returns {Object} Current settings
   */
  function getSettings() {
    return settingsManager.getSettings();
  }
  
  /**
   * Save settings
   * @param {Object} settings - Settings to save
   */
  function saveSettings(settings) {
    settingsManager.setSettings(settings);
  }
  
  /**
   * Update usage info display
   * @param {number} budget - Thinking budget
   */
  function updateUsageInfo(budget) {
    settingsManager.updateUsageInfo(budget);
  }
  
  /**
   * Update model indicator
   * @param {string} model - Model identifier
   */
  function updateModelIndicator(model) {
    settingsManager.updateModelIndicator(model);
  }
  
  /**
   * Open settings panel
   */
  function openSettings() {
    settingsManager.openSettings();
  }
  
  /**
   * Initialize settings
   */
  function initSettings() {
    // Initialize the settings manager
    settingsManager.init().then(() => {
      console.log('Settings system initialized');
      
      // Add handler for missing API key
      settingsManager.on('missing-api-key', () => {
        setTimeout(() => {
          openSettings();
          ToastManager.warning(
            'API Key Required',
            'Please set your Anthropic API key to start using the app.'
          );
        }, 500);
      });
    }).catch(error => {
      console.error('Failed to initialize settings:', error);
      
      ToastManager.error(
        'Settings Error',
        'Failed to initialize settings. Using defaults.'
      );
    });
  }
  
  // Export both legacy functions and modern API
  export {
    // Legacy API
    initSettings,
    getSettings,
    saveSettings,
    updateUsageInfo,
    updateModelIndicator,
    openSettings,
    
    // Modern API
    settingsManager,
    SETTINGS_SCHEMA,
    SETTINGS_CATEGORIES,
    SETTINGS_PRESETS
  };