/**
 * Advanced Utility Library
 * 
 * A comprehensive collection of optimized utility functions for the Claude Chat application.
 * Provides tools for data manipulation, formatting, validation, performance optimization,
 * browser compatibility, and more.
 * 
 * @version 2.0.0
 * @author Claude Chat Team
 */

// Use IIFE to avoid polluting global scope
const Utils = (function() {
    'use strict';
    
    /**
     * ==========================================
     * String Manipulation Utilities
     * ==========================================
     */
    
    /**
     * Truncates text with ellipsis if it exceeds specified length
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length before truncation
     * @param {string} [ellipsis='...'] - Ellipsis string
     * @returns {string} - Truncated text or original if short enough
     */
    function truncateText(text, maxLength, ellipsis = '...') {
      if (!text || typeof text !== 'string') return '';
      if (text.length <= maxLength) return text;
      
      return text.substring(0, maxLength) + ellipsis;
    }
    
    /**
     * Escapes HTML special characters to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} - HTML-escaped text
     */
    function escapeHTML(text) {
      if (!text || typeof text !== 'string') return '';
      
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    /**
     * Sanitizes user input for safe insertion into HTML
     * More comprehensive than escapeHTML 
     * @param {string} input - User input to sanitize
     * @param {boolean} [allowMarkdown=false] - Allow basic markdown (bold, italic, links)
     * @returns {string} - Sanitized HTML string
     */
    function sanitizeInput(input, allowMarkdown = false) {
      if (!input) return '';
      
      // First escape HTML
      let sanitized = escapeHTML(input);
      
      // If markdown is allowed, process specific patterns
      if (allowMarkdown) {
        // Bold: **text** or __text__
        sanitized = sanitized.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');
        
        // Italic: *text* or _text_
        sanitized = sanitized.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
        
        // Links: [text](url)
        sanitized = sanitized.replace(
          /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, 
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Code: `code`
        sanitized = sanitized.replace(/`([^`]+)`/g, '<code>$1</code>');
      }
      
      return sanitized;
    }
    
    /**
     * Converts URLs in text to clickable links
     * @param {string} text - Text to linkify
     * @returns {string} - Text with HTML links
     */
    function linkify(text) {
      if (!text) return '';
      
      // URLs starting with http(s)://, ftp://, mailto:
      const urlPattern = /(\b(https?|ftp|mailto):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gim;
      
      // URLs starting with "www." (without // before it)
      const pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
      
      // Email addresses
      const emailAddressPattern = /[\w.]+@[a-zA-Z_-]+?(?:\.[a-zA-Z]{2,})+/gim;
      
      return text
        .replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer" class="external-link">$1</a>')
        .replace(pseudoUrlPattern, '$1<a href="http://$2" target="_blank" rel="noopener noreferrer" class="external-link">$2</a>')
        .replace(emailAddressPattern, '<a href="mailto:$&" class="email-link">$&</a>');
    }
    
    /**
     * Generates a slug from a string (useful for IDs, URLs, etc.)
     * @param {string} text - Text to slugify
     * @returns {string} - URL-friendly slug
     */
    function slugify(text) {
      if (!text) return '';
      
      return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/&/g, '-and-')   // Replace & with 'and'
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-')   // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start of text
        .replace(/-+$/, '');      // Trim - from end of text
    }
    
    /**
     * ==========================================
     * Date and Time Formatting Utilities
     * ==========================================
     */
    
    /**
     * Format a date object or timestamp to a localized string
     * @param {Date|number|string} date - Date to format
     * @param {Object} options - Intl.DateTimeFormat options
     * @returns {string} - Formatted date string
     */
    function formatDate(date, options = {}) {
      if (!date) return '';
      
      // Default options
      const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      };
      
      const mergedOptions = {...defaultOptions, ...options};
      
      try {
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) throw new Error('Invalid date');
        
        return new Intl.DateTimeFormat(navigator.language, mergedOptions).format(dateObj);
      } catch (error) {
        console.error('Date formatting error:', error);
        return '';
      }
    }
    
    /**
     * Format a date object or timestamp to a localized time string
     * @param {Date|number|string} date - Date to format
     * @param {boolean} includeSeconds - Whether to include seconds
     * @returns {string} - Formatted time string
     */
    function formatTime(date, includeSeconds = false) {
      const options = {
        hour: '2-digit',
        minute: '2-digit',
        ...(includeSeconds ? { second: '2-digit' } : {})
      };
      
      return formatDate(date, options);
    }
    
    /**
     * Format date to relative time (e.g., "5 minutes ago")
     * @param {Date|number|string} date - Date to format
     * @param {boolean} includeTime - Whether to include time for older dates
     * @returns {string} - Human-readable relative time
     */
    function formatRelativeTime(date, includeTime = false) {
      if (!date) return '';
      
      try {
        const dateObj = date instanceof Date ? date : new Date(date);
        if (isNaN(dateObj.getTime())) throw new Error('Invalid date');
        
        const now = new Date();
        const diffMs = now - dateObj;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        // Just now (less than a minute ago)
        if (diffSec < 60) {
          return 'just now';
        }
        
        // Less than an hour
        if (diffMin < 60) {
          return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
        }
        
        // Less than a day
        if (diffHour < 24) {
          return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
        }
        
        // Less than 7 days
        if (diffDay < 7) {
          return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
        }
        
        // For older dates, show actual date
        const options = { month: 'short', day: 'numeric' };
        
        // Include year if different from current year
        if (dateObj.getFullYear() !== now.getFullYear()) {
          options.year = 'numeric';
        }
        
        // Include time if requested
        if (includeTime) {
          options.hour = '2-digit';
          options.minute = '2-digit';
        }
        
        return formatDate(date, options);
      } catch (error) {
        console.error('Relative time formatting error:', error);
        return '';
      }
    }
    
    /**
     * Get time difference between two dates in a readable format
     * @param {Date|number|string} startDate - Start date
     * @param {Date|number|string} endDate - End date
     * @returns {string} - Readable duration (e.g. "5m 30s" or "2h 15m")
     */
    function formatDuration(startDate, endDate) {
      try {
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        const end = endDate || new Date();
        const diffMs = end - start;
        
        if (isNaN(diffMs)) return '';
        
        const seconds = Math.floor((diffMs / 1000) % 60);
        const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        
        let result = [];
        
        if (hours > 0) {
          result.push(`${hours}h`);
        }
        
        if (minutes > 0 || hours > 0) {
          result.push(`${minutes}m`);
        }
        
        // Only show seconds if under an hour
        if (hours === 0) {
          result.push(`${seconds}s`);
        }
        
        return result.join(' ');
      } catch (error) {
        console.error('Duration formatting error:', error);
        return '';
      }
    }
    
    /**
     * ==========================================
     * Object and Array Utilities
     * ==========================================
     */
    
    /**
     * Creates a deep clone of an object or array
     * @param {any} obj - Object to clone
     * @returns {any} - Deep clone of input
     */
    function deepClone(obj) {
      // Handle null, undefined and primitives
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      // Handle Date
      if (obj instanceof Date) {
        return new Date(obj.getTime());
      }
      
      // Handle Array
      if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
      }
      
      // Handle Set
      if (obj instanceof Set) {
        return new Set(Array.from(obj, item => deepClone(item)));
      }
      
      // Handle Map
      if (obj instanceof Map) {
        return new Map(Array.from(obj, ([key, value]) => [deepClone(key), deepClone(value)]));
      }
      
      // Handle regular objects
      const clone = Object.create(Object.getPrototypeOf(obj));
      
      Object.getOwnPropertySymbols(obj).forEach(symbol => {
        const descriptor = Object.getOwnPropertyDescriptor(obj, symbol);
        if (descriptor.enumerable) {
          clone[symbol] = deepClone(obj[symbol]);
        }
      });
      
      Object.keys(obj).forEach(key => {
        clone[key] = deepClone(obj[key]);
      });
      
      return clone;
    }
    
    /**
     * Safely gets a nested property from an object using path
     * @param {Object} obj - Object to get property from
     * @param {string|Array<string>} path - Property path ('a.b.c' or ['a', 'b', 'c'])
     * @param {any} [defaultValue=undefined] - Default value if property doesn't exist
     * @returns {any} - Property value or default value
     */
    function get(obj, path, defaultValue = undefined) {
      if (!obj) return defaultValue;
      
      // Convert to array if string
      const keyPath = Array.isArray(path) ? path : path.split('.');
      
      let result = obj;
      
      for (let key of keyPath) {
        // Handle array indices in path
        if (result === null || result === undefined) return defaultValue;
        result = result[key];
      }
      
      return result !== undefined ? result : defaultValue;
    }
    
    /**
     * Sets a nested property on an object using a path
     * @param {Object} obj - Object to modify
     * @param {string|Array<string>} path - Property path ('a.b.c' or ['a', 'b', 'c'])
     * @param {any} value - Value to set
     * @returns {Object} - Modified object
     */
    function set(obj, path, value) {
      if (!obj || typeof obj !== 'object') return obj;
      
      // Convert to array if string
      const keyPath = Array.isArray(path) ? path : path.split('.');
      
      let current = obj;
      
      for (let i = 0; i < keyPath.length - 1; i++) {
        const key = keyPath[i];
        
        // If next key is numeric, create array, else create object
        const nextIsNumeric = !isNaN(Number(keyPath[i + 1]));
        
        // Create path if it doesn't exist
        if (current[key] === undefined) {
          current[key] = nextIsNumeric ? [] : {};
        } else if (typeof current[key] !== 'object') {
          // Convert to object if it's a primitive
          current[key] = nextIsNumeric ? [] : {};
        }
        
        current = current[key];
      }
      
      // Set final property
      const finalKey = keyPath[keyPath.length - 1];
      current[finalKey] = value;
      
      return obj;
    }
    
    /**
     * Safely merges objects without mutating originals
     * @param {...Object} objects - Objects to merge
     * @returns {Object} - New merged object
     */
    function merge(...objects) {
      return objects.reduce((acc, obj) => {
        if (!obj) return acc;
        
        Object.keys(obj).forEach(key => {
          // If both values are objects, merge them recursively
          if (acc[key] && typeof acc[key] === 'object' && 
              obj[key] && typeof obj[key] === 'object' && 
              !(acc[key] instanceof Date) && 
              !(obj[key] instanceof Date)) {
            acc[key] = merge(acc[key], obj[key]);
          } else {
            // Otherwise, use the value from the current object
            acc[key] = obj[key];
          }
        });
        
        return acc;
      }, {});
    }
    
    /**
     * Groups an array of objects by a key
     * @param {Array<Object>} array - Array to group
     * @param {string|Function} key - Key to group by or function that returns key
     * @returns {Object} - Object with groups
     */
    function groupBy(array, key) {
      if (!Array.isArray(array)) return {};
      
      return array.reduce((result, item) => {
        // Get the key value
        const keyValue = typeof key === 'function' ? key(item) : item[key];
        
        // Ensure the key exists
        if (!result[keyValue]) {
          result[keyValue] = [];
        }
        
        // Add the item to the group
        result[keyValue].push(item);
        
        return result;
      }, {});
    }
    
    /**
     * Creates a new array with unique values
     * @param {Array} array - Array with possible duplicates
     * @param {Function} [comparator] - Optional function for custom equality check
     * @returns {Array} - Array with unique values
     */
    function unique(array, comparator) {
      if (!Array.isArray(array)) return [];
      
      if (comparator) {
        const result = [];
        array.forEach(item => {
          if (!result.some(existingItem => comparator(existingItem, item))) {
            result.push(item);
          }
        });
        return result;
      }
      
      return [...new Set(array)];
    }
    
    /**
     * ==========================================
     * DOM Utilities
     * ==========================================
     */
    
    /**
     * Creates a DOM element with attributes and children
     * @param {string} tagName - Tag name
     * @param {Object} [attributes={}] - Element attributes
     * @param {Array|Node|string} [children] - Child elements, nodes, or text
     * @returns {HTMLElement} - Created element
     */
    function createElement(tagName, attributes = {}, children) {
      const element = document.createElement(tagName);
      
      // Set attributes
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'style' && typeof value === 'object') {
          Object.assign(element.style, value);
        } else if (key === 'dataset' && typeof value === 'object') {
          Object.assign(element.dataset, value);
        } else if (key === 'className') {
          element.className = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
          // Event listeners
          const eventName = key.substring(2).toLowerCase();
          element.addEventListener(eventName, value);
        } else {
          // Regular attributes
          element.setAttribute(key, value);
        }
      });
      
      // Add children
      if (children !== undefined) {
        if (Array.isArray(children)) {
          children.forEach(child => {
            if (child) {
              element.appendChild(
                typeof child === 'string' || typeof child === 'number'
                  ? document.createTextNode(child)
                  : child
              );
            }
          });
        } else if (typeof children === 'string' || typeof children === 'number') {
          element.textContent = children;
        } else if (children instanceof Node) {
          element.appendChild(children);
        }
      }
      
      return element;
    }
    
    /**
     * Safely remove all child nodes from an element
     * @param {HTMLElement} element - Element to clear
     */
    function clearElement(element) {
      if (!element) return;
      
      // Using innerHTML='' is faster but less safe for elements with event listeners
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    }
    
    /**
     * Creates a document fragment from HTML string
     * @param {string} htmlString - HTML to convert to DOM
     * @returns {DocumentFragment} - Document fragment with parsed HTML
     */
    function createFragmentFromHTML(htmlString) {
      const template = document.createElement('template');
      template.innerHTML = htmlString.trim();
      return template.content;
    }
    
    /**
     * Safely append multiple children to an element
     * @param {HTMLElement} parent - Parent element
     * @param {Array<Node>|NodeList} children - Children to append
     */
    function appendChildren(parent, children) {
      if (!parent) return;
      
      if (children instanceof DocumentFragment) {
        parent.appendChild(children);
        return;
      }
      
      // Use fragment for better performance with multiple elements
      const fragment = document.createDocumentFragment();
      
      // Support both array and NodeList
      const childrenArray = Array.isArray(children) ? children : Array.from(children);
      
      childrenArray.forEach(child => {
        if (!child) return;
        
        if (typeof child === 'string' || typeof child === 'number') {
          fragment.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          fragment.appendChild(child);
        }
      });
      
      parent.appendChild(fragment);
    }
    
    /**
     * Handles element visibility with animation support
     * @param {HTMLElement} element - Element to show/hide
     * @param {boolean} visible - Whether element should be visible
     * @param {string} [showClass='show'] - CSS class for visible state
     * @param {string} [hiddenClass='hidden'] - CSS class for hidden state
     * @param {Function} [callback] - Callback after animation completes
     */
    function toggleVisibility(element, visible, showClass = 'show', hiddenClass = 'hidden', callback) {
      if (!element) return;
      
      if (visible) {
        // First make sure element is in DOM
        element.classList.remove(hiddenClass);
        
        // Force a reflow to ensure transition will trigger
        element.offsetHeight;
        
        element.classList.add(showClass);
        
        // Optional callback after animation
        if (callback) {
          // Use transitionend if element has transitions
          const hasTransition = getComputedStyle(element).transitionDuration !== '0s';
          
          if (hasTransition) {
            const handleTransitionEnd = () => {
              callback();
              element.removeEventListener('transitionend', handleTransitionEnd);
            };
            element.addEventListener('transitionend', handleTransitionEnd);
          } else {
            // If no transition, call immediately
            callback();
          }
        }
      } else {
        element.classList.remove(showClass);
        
        if (callback) {
          // Wait for transition before hiding
          const hasTransition = getComputedStyle(element).transitionDuration !== '0s';
          
          if (hasTransition) {
            const handleTransitionEnd = () => {
              element.classList.add(hiddenClass);
              callback();
              element.removeEventListener('transitionend', handleTransitionEnd);
            };
            element.addEventListener('transitionend', handleTransitionEnd);
          } else {
            element.classList.add(hiddenClass);
            callback();
          }
        } else {
          // Simple case - wait for transition, then hide
          const duration = parseFloat(getComputedStyle(element).transitionDuration) * 1000;
          if (duration > 0) {
            setTimeout(() => {
              element.classList.add(hiddenClass);
            }, duration);
          } else {
            element.classList.add(hiddenClass);
          }
        }
      }
    }
    
    /**
     * ==========================================
     * Performance Utilities
     * ==========================================
     */
    
    /**
     * Debounce function to limit execution frequency
     * @param {Function} fn - Function to debounce
     * @param {number} wait - Milliseconds to wait
     * @param {boolean} [immediate=false] - Whether to trigger on leading edge
     * @returns {Function} - Debounced function
     */
    function debounce(fn, wait, immediate = false) {
      let timeout;
      
      return function debounced(...args) {
        const context = this;
        
        const later = () => {
          timeout = null;
          if (!immediate) fn.apply(context, args);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) fn.apply(context, args);
      };
    }
    
    /**
     * Throttle function to limit execution rate
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Minimum milliseconds between calls
     * @returns {Function} - Throttled function
     */
    function throttle(fn, limit) {
      let inThrottle = false;
      let lastFunc;
      let lastRan;
      
      return function throttled(...args) {
        const context = this;
        
        if (!inThrottle) {
          fn.apply(context, args);
          lastRan = Date.now();
          inThrottle = true;
          
          setTimeout(() => {
            inThrottle = false;
            if (lastFunc) {
              throttled.apply(context, lastFunc);
              lastFunc = null;
            }
          }, limit);
        } else {
          lastFunc = args;
        }
      };
    }
    
    /**
     * Creates an async delay/sleep function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Resolves after delay
     */
    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Breaks long tasks into smaller chunks to avoid UI blocking
     * @param {Array} items - Items to process
     * @param {Function} processor - Function to process each item
     * @param {Object} options - Chunking options
     * @param {number} [options.chunkSize=10] - Items per chunk
     * @param {number} [options.delay=0] - Delay between chunks in ms
     * @returns {Promise} - Resolves when all items are processed
     */
    function processInChunks(items, processor, { chunkSize = 10, delay: chunkDelay = 0 } = {}) {
      if (!items || !items.length) return Promise.resolve([]);
      
      const results = [];
      let index = 0;
      
      return new Promise((resolve, reject) => {
        function processChunk() {
          const start = index;
          const end = Math.min(start + chunkSize, items.length);
          
          // Process current chunk
          try {
            for (let i = start; i < end; i++) {
              results.push(processor(items[i], i));
              index++;
            }
            
            // Check if done
            if (index >= items.length) {
              resolve(results);
              return;
            }
            
            // Schedule next chunk
            if (chunkDelay > 0) {
              setTimeout(processChunk, chunkDelay);
            } else {
              // Use requestAnimationFrame to avoid UI blocking
              requestAnimationFrame(processChunk);
            }
          } catch (err) {
            reject(err);
          }
        }
        
        processChunk();
      });
    }
    
    /**
     * ==========================================
     * Validation Utilities
     * ==========================================
     */
    
    /**
     * Checks if a value is empty (null, undefined, empty string, array, or object)
     * @param {any} value - Value to check
     * @returns {boolean} - Whether value is empty
     */
    function isEmpty(value) {
      if (value === null || value === undefined) return true;
      
      if (typeof value === 'string' || Array.isArray(value)) {
        return value.length === 0;
      }
      
      if (typeof value === 'object') {
        return Object.keys(value).length === 0;
      }
      
      return false;
    }
    
    /**
     * Validates an email address
     * @param {string} email - Email to validate
     * @returns {boolean} - Whether email is valid
     */
    function isValidEmail(email) {
      if (!email || typeof email !== 'string') return false;
      
      // RFC 5322 compliant email regex
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
      return emailRegex.test(email);
    }
    
    /**
     * Validates a URL
     * @param {string} url - URL to validate
     * @param {boolean} [requireProtocol=true] - Whether protocol is required
     * @returns {boolean} - Whether URL is valid
     */
    function isValidURL(url, requireProtocol = true) {
      if (!url || typeof url !== 'string') return false;
      
      try {
        const urlObj = new URL(url);
        return requireProtocol ? urlObj.protocol === 'http:' || urlObj.protocol === 'https:' : true;
      } catch (e) {
        if (requireProtocol) return false;
        
        // Try adding protocol if it's missing
        try {
          const urlWithProtocol = new URL(`https://${url}`);
          return true;
        } catch (e) {
          return false;
        }
      }
    }
    
    /**
     * ==========================================
     * File and Format Utilities
     * ==========================================
     */
    
    /**
     * Gets file extension from filename or mime type
     * @param {string} filenameOrMime - Filename or MIME type
     * @returns {string} - File extension without dot
     */
    function getFileExtension(filenameOrMime) {
      if (!filenameOrMime) return '';
      
      // Check if it's a MIME type
      if (filenameOrMime.includes('/')) {
        const mimeExtensions = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'image/svg+xml': 'svg',
          'image/bmp': 'bmp',
          'image/tiff': 'tiff',
          'audio/mpeg': 'mp3',
          'audio/mp4': 'm4a',
          'audio/ogg': 'ogg',
          'audio/wav': 'wav',
          'video/mp4': 'mp4',
          'video/webm': 'webm',
          'video/ogg': 'ogv',
          'application/pdf': 'pdf',
          'application/zip': 'zip',
          'application/json': 'json',
          'application/xml': 'xml',
          'text/plain': 'txt',
          'text/html': 'html',
          'text/css': 'css',
          'text/javascript': 'js',
          'text/csv': 'csv'
        };
        
        return mimeExtensions[filenameOrMime] || 'bin';
      }
      
      // It's a filename, extract extension
      const parts = filenameOrMime.split('.');
      return parts.length > 1 ? parts.pop().toLowerCase() : '';
    }
    
    /**
     * Gets file extension based on programming language
     * @param {string} language - Programming language
     * @returns {string} - Appropriate file extension
     */
    function getLanguageExtension(language) {
      if (!language) return 'txt';
      
      const langMap = {
        'javascript': 'js',
        'typescript': 'ts',
        'jsx': 'jsx', 
        'tsx': 'tsx',
        'python': 'py',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'csharp': 'cs',
        'php': 'php',
        'ruby': 'rb',
        'go': 'go',
        'rust': 'rs',
        'swift': 'swift',
        'kotlin': 'kt',
        'scala': 'scala',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'xml': 'xml',
        'json': 'json',
        'yaml': 'yml',
        'markdown': 'md',
        'bash': 'sh',
        'shell': 'sh',
        'powershell': 'ps1',
        'sql': 'sql',
        'graphql': 'graphql',
        'dockerfile': 'dockerfile',
        'plaintext': 'txt'
      };
      
      return langMap[language.toLowerCase()] || 'txt';
    }
    
    /**
     * Convert bytes to human-readable file size
     * @param {number} bytes - Bytes to format
     * @param {number} [decimals=2] - Decimal places
     * @returns {string} - Formatted file size
     */
    function formatFileSize(bytes, decimals = 2) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    }
    
    /**
     * Reads file content as text or data URL
     * @param {File} file - File to read
     * @returns {Promise} - Resolves with file content
     */
    function readFileContent(file) {
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error('No file provided'));
          return;
        }
        
        const reader = new FileReader();
        
        reader.onload = () => {
          resolve({
            content: reader.result,
            type: file.type,
            name: file.name,
            size: file.size
          });
        };
        
        reader.onerror = () => {
          reject(new Error('File read error'));
        };
        
        // Read as data URL for images, text for others
        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }
    
    /**
     * ==========================================
     * Browser and Device Utilities
     * ==========================================
     */
    
    /**
     * Detects browser, OS, and device type
     * @returns {Object} - Browser and device info
     */
    function getDeviceInfo() {
      const ua = navigator.userAgent;
      const platform = navigator.platform || 'unknown';
      
      // Detect browser
      const browser = (() => {
        const isOpera = !!window.opera || ua.indexOf(' OPR/') >= 0;
        const isEdge = ua.indexOf('Edg') >= 0;
        const isChromium = !!window.chrome;
        const isIE = /*@cc_on!@*/false || !!document.documentMode;
        const isFirefox = typeof InstallTrigger !== 'undefined';
        const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
        
        if (isOpera) return 'Opera';
        if (isEdge) return 'Edge';
        if (isChromium) return 'Chrome';
        if (isIE) return 'Internet Explorer';
        if (isFirefox) return 'Firefox';
        if (isSafari) return 'Safari';
        
        return 'Unknown';
      })();
      
      // Detect OS
      const os = (() => {
        if (ua.indexOf('Windows') !== -1) return 'Windows';
        if (ua.indexOf('Mac') !== -1) return 'macOS';
        if (ua.indexOf('Linux') !== -1) return 'Linux';
        if (ua.indexOf('Android') !== -1) return 'Android';
        if (ua.indexOf('iOS') !== -1 || ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) return 'iOS';
        
        return 'Unknown';
      })();
      
      // Device type
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua);
      
      // Screen info
      const screenInfo = {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
        touchscreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0
      };
      
      // System preferences
      const preferences = {
        darkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
        reducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches
      };
      
      return {
        browser,
        os,
        platform,
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet,
        screen: screenInfo,
        preferences,
        language: navigator.language || navigator.userLanguage,
        online: navigator.onLine
      };
    }
    
    /**
     * Detects if device is in dark mode
     * @returns {boolean} - Whether device is in dark mode
     */
    function isDarkMode() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    /**
     * Copies text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise} - Resolves when copied or rejects with error
     */
    function copyToClipboard(text) {
      // Use modern Clipboard API if available
      if (navigator.clipboard) {
        return navigator.clipboard.writeText(text)
          .then(() => true)
          .catch(error => {
            console.error('Clipboard error:', error);
            return Promise.reject(new Error('Failed to copy to clipboard'));
          });
      }
      
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (success) {
          return Promise.resolve(true);
        } else {
          return Promise.reject(new Error('Failed to copy to clipboard'));
        }
      } catch (error) {
        console.error('Clipboard error:', error);
        return Promise.reject(new Error('Failed to copy to clipboard'));
      }
    }
    
    /**
     * ==========================================
     * Identification and Security Utilities
     * ==========================================
     */
    
    /**
     * Generates a unique ID with optional prefix
     * @param {string} [prefix=''] - ID prefix
     * @returns {string} - Unique ID
     */
    function generateUniqueId(prefix = '') {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 10);
      
      return `${prefix}${timestamp}-${randomPart}`;
    }
    
    /**
     * Creates a hash of a string (simple, non-cryptographic)
     * @param {string} str - String to hash
     * @returns {string} - Hash of string
     */
    function simpleHash(str) {
      if (!str) return '';
      
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(36);
    }
    
    /**
     * Obfuscates sensitive data like API keys for display
     * @param {string} text - Text to obfuscate
     * @param {Object} [options] - Options
     * @param {number} [options.visibleStart=4] - Visible chars at start
     * @param {number} [options.visibleEnd=4] - Visible chars at end
     * @returns {string} - Obfuscated text
     */
    function obfuscateSensitiveData(text, { visibleStart = 4, visibleEnd = 4 } = {}) {
      if (!text || text.length < 8) {
        return '•'.repeat(text ? text.length : 4);
      }
      
      const start = text.substring(0, visibleStart);
      const end = text.substring(text.length - visibleEnd);
      const middle = '•'.repeat(Math.min(10, text.length - visibleStart - visibleEnd));
      
      return `${start}${middle}${end}`;
    }
    
    /**
     * ==========================================
     * Accessibility Utilities
     * ==========================================
     */
    
    /**
     * Announces a message to screen readers
     * @param {string} message - Message to announce
     * @param {string} [politeness='polite'] - ARIA live region politeness (polite or assertive)
     */
    function announceToScreenReader(message, politeness = 'polite') {
      // Find or create announcer element
      let announcer = document.getElementById('sr-announcer');
      
      if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'sr-announcer';
        announcer.className = 'sr-only';
        announcer.setAttribute('aria-live', politeness);
        announcer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(announcer);
      }
      
      // Set politeness level
      announcer.setAttribute('aria-live', politeness);
      
      // Clear and then set content to ensure announcement
      announcer.textContent = '';
      
      // Use setTimeout to ensure announcement happens
      setTimeout(() => {
        announcer.textContent = message;
      }, 50);
    }
    
    /**
     * Focuses first focusable element in container
     * @param {HTMLElement} container - Container to search in
     * @returns {boolean} - Whether focus was set
     */
    function focusFirstElement(container) {
      if (!container) return false;
      
      const focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusable.length === 0) return false;
      
      // Find first non-disabled element
      for (const element of focusable) {
        if (!element.disabled && element.type !== 'hidden' && 
            !element.hasAttribute('disabled') && 
            element.offsetParent !== null) {
          element.focus();
          return true;
        }
      }
      
      return false;
    }
    
    /**
     * Traps focus within an element (for modals, dialogs, etc.)
     * @param {HTMLElement} container - Container to trap focus in
     * @returns {Function} - Function to remove trap
     */
    function trapFocus(container) {
      if (!container) return () => {};
      
      // Find all focusable elements
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return () => {};
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // Initial focus
      firstElement.focus();
      
      // Handle tabbing
      const handleKeyDown = (e) => {
        // Only handle Tab key
        if (e.key !== 'Tab') return;
        
        if (e.shiftKey) {
          // Shift + Tab: if at first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if at last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };
      
      // Set up event listener
      document.addEventListener('keydown', handleKeyDown);
      
      // Return function to remove the trap
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    
    /**
     * ==========================================
     * Legacy API for Backward Compatibility
     * ==========================================
     */
    
    /**
     * Load chats from localStorage (Legacy function)
     * @returns {Array} - Chat history
     */
    function loadChats() {
      console.warn('Deprecated: loadChats() is deprecated. Use AppStorage module instead.');
      try {
        const chatsString = localStorage.getItem('aiAssistantChats');
        return chatsString ? JSON.parse(chatsString) : [];
      } catch (error) {
        console.error('Error loading chats:', error);
        return [];
      }
    }
    
    /**
     * Save chats to localStorage (Legacy function)
     * @param {Array} chats - Chat history to save
     */
    function saveChats(chats) {
      console.warn('Deprecated: saveChats() is deprecated. Use AppStorage module instead.');
      try {
        localStorage.setItem('aiAssistantChats', JSON.stringify(chats));
      } catch (error) {
        console.error('Error saving chats:', error);
        if (typeof showToast === 'function') {
          showToast({
            title: 'Error',
            message: 'Failed to save chat history. Local storage may be full.',
            type: 'error'
          });
        }
      }
    }
    
    /**
     * Save current chat to history (Legacy function)
     * @param {Object} state - Application state
     */
    function saveChat(state) {
      console.warn('Deprecated: saveChat() is deprecated. Use Conversations module instead.');
      if (!state?.currentChat) return;
      
      // Get chat messages from DOM
      const messages = [];
      document.querySelectorAll('.message').forEach(messageEl => {
        const role = messageEl.classList.contains('human') ? 'human' : 'assistant';
        const content = messageEl.querySelector('.message-content')?.innerHTML || '';
        const timestamp = messageEl.querySelector('.message-timestamp')?.textContent || new Date().toISOString();
        
        messages.push({ role, content, timestamp });
      });
      
      // Update chat object
      state.currentChat.messages = messages;
      state.currentChat.updatedAt = new Date().toISOString();
      
      // Generate title if it's a new chat
      if (state.currentChat.title === 'New Chat' && messages.length >= 2) {
        const firstUserMessage = messages.find(m => m.role === 'human');
        if (firstUserMessage) {
          let title = firstUserMessage.content.substring(0, 30);
          if (title.length === 30) title += '...';
          state.currentChat.title = title;
        }
      }
      
      // Find and update chat in state.chats
      const chatIndex = state.chats.findIndex(chat => chat.id === state.currentChat.id);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = state.currentChat;
      } else {
        state.chats.unshift(state.currentChat);
      }
      
      // Limit number of chats to keep
      const maxChats = 50; // Hardcoded for legacy function
      if (state.chats.length > maxChats) {
        state.chats = state.chats.slice(0, maxChats);
      }
      
      // Save to localStorage
      saveChats(state.chats);
      
      // Update UI if function exists
      if (typeof updateChatHistoryUI === 'function') {
        updateChatHistoryUI(state);
      }
    }
    
    /**
     * Load a chat from history (Legacy function)
     * @param {Object} state - Application state
     * @param {string} chatId - Chat ID to load
     */
    function loadChat(state, chatId) {
      console.warn('Deprecated: loadChat() is deprecated. Use Conversations module instead.');
      const chat = state.chats.find(c => c.id === chatId);
      if (!chat) return;
      
      // Set current chat
      state.currentChat = chat;
      state.conversationId = chat.id;
      
      // Clear chat container
      const chatContainer = document.getElementById('chatContainer');
      if (!chatContainer) return;
      chatContainer.innerHTML = '';
      
      // Hide welcome screen
      const welcomeScreen = document.getElementById('welcomeScreen');
      if (welcomeScreen) welcomeScreen.classList.remove('active');
      
      // Render messages
      if (chat.messages && chat.messages.length > 0) {
        chat.messages.forEach(msg => {
          const messageDiv = document.createElement('div');
          messageDiv.className = `message ${msg.role}`;
          
          // Create message header
          const headerDiv = document.createElement('div');
          headerDiv.className = 'message-header';
          
          // Set the role name with proper capitalization
          const roleName = document.createElement('span');
          roleName.textContent = msg.role === 'human' ? 'You' : 'Claude';
          headerDiv.appendChild(roleName);
          
          // Add timestamp
          const timestamp = document.createElement('span');
          timestamp.className = 'message-timestamp';
          timestamp.textContent = msg.timestamp || new Date().toLocaleTimeString();
          headerDiv.appendChild(timestamp);
          
          messageDiv.appendChild(headerDiv);
          
          // Create message content
          const contentDiv = document.createElement('div');
          contentDiv.className = 'message-content';
          contentDiv.innerHTML = msg.content;
          
          messageDiv.appendChild(contentDiv);
          
          // Re-add code block functionality
          if (typeof enhanceCodeBlocks === 'function') {
            enhanceCodeBlocks(messageDiv);
          }
          
          // Add to container
          chatContainer.appendChild(messageDiv);
        });
        
        // Scroll to bottom
        if (typeof scrollToBottom === 'function') {
          scrollToBottom();
        } else {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
      
      // Update chat history UI
      if (typeof updateChatHistoryUI === 'function') {
        updateChatHistoryUI(state);
      }
      
      // Close mobile sidebar
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    }
    
    /**
     * Delete a chat (Legacy function)
     * @param {Object} state - Application state
     * @param {string} chatId - Chat ID to delete
     */
    function deleteChat(state, chatId) {
      console.warn('Deprecated: deleteChat() is deprecated. Use Conversations module instead.');
      // Remove from chats array
      state.chats = state.chats.filter(chat => chat.id !== chatId);
      
      // Save to localStorage
      saveChats(state.chats);
      
      // If current chat was deleted, create a new one
      if (state.currentChat && state.currentChat.id === chatId) {
        if (typeof createNewChat === 'function') {
          createNewChat(state);
        } else {
          // Fallback if createNewChat doesn't exist
          state.currentChat = null;
          state.conversationId = null;
        }
      }
      
      // Update UI
      if (typeof updateChatHistoryUI === 'function') {
        updateChatHistoryUI(state);
      }
    }
    
    /**
     * Initialize PWA functionality (Legacy function)
     * Handled by PWA module in new architecture
     */
    function initPWA() {
      console.warn('Deprecated: initPWA() is deprecated. Use PWA module instead.');
      // Legacy implementation omitted to avoid duplication with app.pwa module
    }
    
    // Public API - Export both modern and legacy functions
    return {
      // String utilities
      truncateText,
      escapeHTML,
      sanitizeInput,
      linkify,
      slugify,
      
      // Date and time utilities
      formatDate,
      formatTime,
      formatRelativeTime,
      formatDuration,
      
      // Object and array utilities
      deepClone,
      get,
      set,
      merge,
      groupBy,
      unique,
      
      // DOM utilities
      createElement,
      clearElement,
      createFragmentFromHTML,
      appendChildren,
      toggleVisibility,
      
      // Performance utilities
      debounce,
      throttle,
      delay,
      processInChunks,
      
      // Validation utilities
      isEmpty,
      isValidEmail,
      isValidURL,
      
      // File and format utilities
      getFileExtension,
      getLanguageExtension,
      formatFileSize,
      readFileContent,
      
      // Browser and device utilities
      getDeviceInfo,
      isDarkMode,
      copyToClipboard,
      
      // Identification and security utilities
      generateUniqueId,
      simpleHash,
      obfuscateSensitiveData,
      
      // Accessibility utilities
      announceToScreenReader,
      focusFirstElement,
      trapFocus,
      
      // Legacy API for backward compatibility
      loadChats,
      saveChats,
      saveChat,
      loadChat,
      deleteChat,
      initPWA
    };
  })();
  
  // Make utilities available globally
  window.Utils = Utils;
  
  // For ES module support
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
  }