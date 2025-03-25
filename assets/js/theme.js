/**
 * Enhanced Theme Management System
 * 
 * Features:
 * - Multiple theme support (light, dark, system, high-contrast)
 * - CSS variable-based theming with smooth transitions
 * - System preference detection and synchronization
 * - Theme event notifications
 * - Custom accent color support
 * - Accessibility considerations
 * - Persistence with fallbacks
 */

// Use IIFE pattern to avoid global scope pollution
const ThemeManager = (() => {
    // Private variables
    let initialized = false;
    let currentTheme = 'system';
    let currentAccentColor = 'purple';
    let transitionsEnabled = true;
    
    // Configuration options
    const config = {
      themeStorageKey: 'theme',
      accentColorStorageKey: 'accentColor',
      darkModeClass: 'dark-theme',
      highContrastClass: 'high-contrast',
      defaultTheme: 'system',
      defaultAccentColor: 'purple',
      transitionDuration: 300,
      themes: ['light', 'dark', 'system', 'high-contrast'],
      accentColors: ['purple', 'blue', 'green', 'red', 'orange', 'pink'],
      themeDataAttribute: 'data-theme',
      colorSchemeMetaTag: 'color-scheme-meta'
    };
    
    // DOM elements cache
    const elements = {
      toggleBtn: null,
      toggleText: null,
      accentColorPicker: null,
      themeSelect: null
    };
    
    // Event listeners
    const eventListeners = new Map();
    
    /**
     * Initialize the theme system
     * @param {Object} options - Configuration options
     * @returns {Object} - Public API
     */
    function init(options = {}) {
      if (initialized) return publicAPI;
      
      console.log('Theme system initializing...');
      
      // Merge options with defaults
      Object.assign(config, options);
      
      // Cache DOM elements
      cacheElements();
      
      // Load saved theme or use system preference
      loadSavedTheme();
      
      // Load saved accent color
      loadSavedAccentColor();
      
      // Set up event listeners
      setupEventListeners();
      
      // Apply initial theme without transition
      disableTransitions();
      applyTheme(currentTheme);
      applyAccentColor(currentAccentColor);
      setTimeout(enableTransitions, 50);
      
      // Set initialization flag
      initialized = true;
      
      console.log('Theme system initialized:', currentTheme, currentAccentColor);
      return publicAPI;
    }
    
    /**
     * Cache DOM elements for better performance
     */
    function cacheElements() {
      elements.toggleBtn = document.getElementById('toggleThemeBtn');
      elements.toggleText = document.getElementById('themeButtonText');
      elements.accentColorPicker = document.getElementById('accentColorPicker');
      elements.themeSelect = document.getElementById('themeSelect');
      
      // Create or update color scheme meta tag
      let metaTag = document.querySelector(`meta[name="color-scheme"]`);
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.name = 'color-scheme';
        metaTag.content = 'light dark';
        metaTag.id = config.colorSchemeMetaTag;
        document.head.appendChild(metaTag);
      }
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
      // Theme toggle button
      if (elements.toggleBtn) {
        elements.toggleBtn.addEventListener('click', toggleTheme);
      }
      
      // Accent color picker
      if (elements.accentColorPicker) {
        elements.accentColorPicker.addEventListener('change', (e) => {
          setAccentColor(e.target.value);
        });
      }
      
      // Theme select dropdown
      if (elements.themeSelect) {
        elements.themeSelect.addEventListener('change', (e) => {
          setTheme(e.target.value);
        });
      }
      
      // System preference change listener
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      prefersDark.addEventListener('change', handleSystemPreferenceChange);
      
      // High contrast preference change
      if ('matchMedia' in window) {
        const prefersContrast = window.matchMedia('(prefers-contrast: more)');
        try {
          prefersContrast.addEventListener('change', handleContrastPreferenceChange);
        } catch (e) {
          // Some browsers don't support this media query yet
          console.log('Contrast preference detection not supported');
        }
      }
      
      // Listen for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (prefersReducedMotion.matches) {
        disableTransitions();
      }
      prefersReducedMotion.addEventListener('change', (e) => {
        if (e.matches) {
          disableTransitions();
        } else {
          enableTransitions();
        }
      });
      
      // Handle visibility change to recheck system themes
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && currentTheme === 'system') {
          applyTheme('system');
        }
      });
    }
    
    /**
     * Load theme from storage or use system preference
     */
    function loadSavedTheme() {
      try {
        const savedTheme = localStorage.getItem(config.themeStorageKey);
        
        if (savedTheme && config.themes.includes(savedTheme)) {
          currentTheme = savedTheme;
        } else {
          // Default to system theme if no saved preference
          currentTheme = config.defaultTheme;
        }
        
        // Update UI elements
        updateToggleButtonText(currentTheme);
        
        if (elements.themeSelect) {
          elements.themeSelect.value = currentTheme;
        }
        
      } catch (error) {
        console.error('Error loading theme preference:', error);
        // Fall back to system theme
        currentTheme = config.defaultTheme;
      }
    }
    
    /**
     * Load accent color from storage
     */
    function loadSavedAccentColor() {
      try {
        const savedAccentColor = localStorage.getItem(config.accentColorStorageKey);
        
        if (savedAccentColor && config.accentColors.includes(savedAccentColor)) {
          currentAccentColor = savedAccentColor;
        } else {
          currentAccentColor = config.defaultAccentColor;
        }
        
        // Update color picker if it exists
        if (elements.accentColorPicker) {
          elements.accentColorPicker.value = currentAccentColor;
        }
        
      } catch (error) {
        console.error('Error loading accent color preference:', error);
        currentAccentColor = config.defaultAccentColor;
      }
    }
    
    /**
     * Apply theme to document
     * @param {string} theme - Theme to apply
     */
    function applyTheme(theme) {
      // Special handling for system theme
      if (theme === 'system') {
        const systemTheme = detectSystemTheme();
        applySystemTheme(systemTheme);
      } 
      // High contrast theme
      else if (theme === 'high-contrast') {
        document.body.classList.add(config.darkModeClass);
        document.body.classList.add(config.highContrastClass);
      }
      // Dark theme
      else if (theme === 'dark') {
        document.body.classList.add(config.darkModeClass);
        document.body.classList.remove(config.highContrastClass);
      }
      // Light theme
      else {
        document.body.classList.remove(config.darkModeClass);
        document.body.classList.remove(config.highContrastClass);
      }
      
      // Set data attribute for CSS selectors
      document.documentElement.setAttribute(config.themeDataAttribute, theme);
      
      // Update color scheme meta tag for PWA
      const metaTag = document.getElementById(config.colorSchemeMetaTag);
      if (metaTag) {
        metaTag.content = theme === 'dark' || 
                           theme === 'high-contrast' || 
                           (theme === 'system' && detectSystemTheme() === 'dark') 
                           ? 'dark' : 'light';
      }
      
      // Emit theme change event
      emitEvent('themeChanged', { theme });
    }
    
    /**
     * Apply system theme based on user preference
     * @param {string} systemTheme - Detected system theme ('dark' or 'light')
     */
    function applySystemTheme(systemTheme) {
      // Apply appropriate theme
      if (systemTheme === 'dark') {
        document.body.classList.add(config.darkModeClass);
      } else {
        document.body.classList.remove(config.darkModeClass);
      }
      
      // Check for high contrast mode
      if (detectHighContrastPreference()) {
        document.body.classList.add(config.highContrastClass);
      } else {
        document.body.classList.remove(config.highContrastClass);
      }
      
      // Update toggle button text
      updateToggleButtonText('system');
    }
    
    /**
     * Apply accent color theme
     * @param {string} color - Color name
     */
    function applyAccentColor(color) {
      // Remove existing color classes
      config.accentColors.forEach(c => {
        document.documentElement.classList.remove(`accent-${c}`);
      });
      
      // Add new color class
      document.documentElement.classList.add(`accent-${color}`);
      
      // Emit color change event
      emitEvent('accentColorChanged', { color });
    }
    
    /**
     * Set theme and save preference
     * @param {string} theme - Theme to set
     */
    function setTheme(theme) {
      if (!config.themes.includes(theme)) {
        console.error(`Invalid theme: ${theme}. Allowed values: ${config.themes.join(', ')}`);
        return;
      }
      
      // Update current theme
      currentTheme = theme;
      
      // Save preference
      try {
        localStorage.setItem(config.themeStorageKey, theme);
      } catch (error) {
        console.error('Error saving theme preference:', error);
      }
      
      // Apply theme
      applyTheme(theme);
      
      // Update UI
      updateToggleButtonText(theme);
      
      if (elements.themeSelect) {
        elements.themeSelect.value = theme;
      }
      
      return publicAPI;
    }
    
    /**
     * Set accent color and save preference
     * @param {string} color - Color to set
     */
    function setAccentColor(color) {
      if (!config.accentColors.includes(color)) {
        console.error(`Invalid accent color: ${color}. Allowed values: ${config.accentColors.join(', ')}`);
        return;
      }
      
      // Update current accent color
      currentAccentColor = color;
      
      // Save preference
      try {
        localStorage.setItem(config.accentColorStorageKey, color);
      } catch (error) {
        console.error('Error saving accent color preference:', error);
      }
      
      // Apply accent color
      applyAccentColor(color);
      
      // Update UI
      if (elements.accentColorPicker) {
        elements.accentColorPicker.value = color;
      }
      
      return publicAPI;
    }
    
    /**
     * Toggle between light and dark themes
     */
    function toggleTheme() {
      // For system theme, toggle based on current state
      if (currentTheme === 'system') {
        setTheme(document.body.classList.contains(config.darkModeClass) ? 'light' : 'dark');
        return;
      }
      
      // For dark theme, switch to light
      if (currentTheme === 'dark' || currentTheme === 'high-contrast') {
        setTheme('light');
        return;
      }
      
      // For light theme, switch to dark
      setTheme('dark');
    }
    
    /**
     * Detect system theme preference
     * @returns {string} - 'dark' or 'light'
     */
    function detectSystemTheme() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    /**
     * Detect high contrast preference
     * @returns {boolean} - Whether high contrast is preferred
     */
    function detectHighContrastPreference() {
      if ('matchMedia' in window) {
        // Check for specific high contrast modes
        return window.matchMedia('(prefers-contrast: more)').matches || 
               window.matchMedia('(-ms-high-contrast: active)').matches;
      }
      return false;
    }
    
    /**
     * Handle system theme preference change
     * @param {MediaQueryListEvent} event - Media query change event
     */
    function handleSystemPreferenceChange(event) {
      // Only update if using system theme
      if (currentTheme === 'system') {
        applySystemTheme(event.matches ? 'dark' : 'light');
      }
    }
    
    /**
     * Handle contrast preference change
     * @param {MediaQueryListEvent} event - Media query change event
     */
    function handleContrastPreferenceChange(event) {
      // Only update if using system theme
      if (currentTheme === 'system') {
        if (event.matches) {
          document.body.classList.add(config.highContrastClass);
        } else {
          document.body.classList.remove(config.highContrastClass);
        }
      }
    }
    
    /**
     * Update theme toggle button text
     * @param {string} theme - Current theme
     */
    function updateToggleButtonText(theme) {
      if (!elements.toggleText) return;
      
      // Special handling for system theme
      if (theme === 'system') {
        const systemTheme = detectSystemTheme();
        elements.toggleText.textContent = systemTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
      }
      // For explicit themes
      else {
        elements.toggleText.textContent = (theme === 'dark' || theme === 'high-contrast') 
          ? 'Light Mode' 
          : 'Dark Mode';
      }
    }
    
    /**
     * Disable theme transitions temporarily
     */
    function disableTransitions() {
      if (!transitionsEnabled) return;
      
      document.documentElement.classList.add('disable-transitions');
      transitionsEnabled = false;
    }
    
    /**
     * Re-enable theme transitions
     */
    function enableTransitions() {
      if (transitionsEnabled) return;
      
      document.documentElement.classList.remove('disable-transitions');
      transitionsEnabled = true;
    }
    
    /**
     * Subscribe to theme events
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} - Unsubscribe function
     */
    function on(event, callback) {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      
      eventListeners.get(event).add(callback);
      
      // Return unsubscribe function
      return () => {
        if (eventListeners.has(event)) {
          eventListeners.get(event).delete(callback);
        }
      };
    }
    
    /**
     * Emit theme event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    function emitEvent(event, data) {
      if (eventListeners.has(event)) {
        eventListeners.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in theme ${event} event handler:`, error);
          }
        });
      }
      
      // Dispatch DOM event for broader integration
      document.dispatchEvent(new CustomEvent(`theme:${event}`, { detail: data }));
    }
    
    /**
     * Get current theme
     * @returns {string} - Current theme
     */
    function getTheme() {
      return currentTheme;
    }
    
    /**
     * Get effective theme (resolved system preference)
     * @returns {string} - Effective theme
     */
    function getEffectiveTheme() {
      if (currentTheme === 'system') {
        return detectSystemTheme();
      }
      return currentTheme;
    }
    
    /**
     * Get current accent color
     * @returns {string} - Current accent color
     */
    function getAccentColor() {
      return currentAccentColor;
    }
    
    /**
     * Check if dark mode is active
     * @returns {boolean} - Whether dark mode is active
     */
    function isDarkMode() {
      return document.body.classList.contains(config.darkModeClass);
    }
    
    /**
     * Check if high contrast mode is active
     * @returns {boolean} - Whether high contrast mode is active
     */
    function isHighContrast() {
      return document.body.classList.contains(config.highContrastClass);
    }
    
    // Public API
    const publicAPI = {
      init,
      setTheme,
      getTheme,
      getEffectiveTheme,
      toggleTheme,
      setAccentColor,
      getAccentColor,
      isDarkMode,
      isHighContrast,
      on
    };
    
    return publicAPI;
  })();
  
  /**
   * Legacy function for backward compatibility
   * @deprecated Use ThemeManager.init() instead
   */
  function initTheme() {
    console.warn('initTheme() is deprecated, use ThemeManager.init() instead');
    return ThemeManager.init();
  }
  
  // Auto-initialize if document is already loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    ThemeManager.init();
  } else {
    // Otherwise wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      ThemeManager.init();
    });
  }
  
  // Export for module usage if supported
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
  }
  
  // Make globally available
  window.ThemeManager = ThemeManager;