/**
 * Claude Chat UI Controller
 * 
 * A high-performance UI system for Claude Chat that provides:
 * - Virtual DOM-based rendering with efficient update batching
 * - Message virtualization using Intersection Observer API
 * - View Transitions API integration for smooth UI transitions
 * - WebAnimation API for high-performance animations
 * - Container Queries support for responsive components
 * - WCAG AAA accessibility compliance
 * - Markdown and code syntax highlighting with web workers
 * - Optimized real-time message streaming
 * - CSS Layers integration
 * - Comprehensive error handling with graceful degradation
 * 
 * @version 4.0.0
 * @license MIT
 * @updated 2025-03-24
 */

const UIController = (() => {
    'use strict';
  
    // ===============================================================
    // Configuration & Constants
    // ===============================================================
    
    const DEFAULT_CONFIG = {
      animations: {
        enabled: true,
        duration: 280,
        easing: 'cubic-bezier(0.2, 0.0, 0.2, 1)',
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        viewTransitions: 'viewTransition' in document
      },
      scrollBehavior: 'smooth',
      markdown: {
        enabled: true,
        sanitize: true,
        breaks: true,
        linkify: true,
        allowedTags: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                     'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'strong', 
                     'em', 'a', 'code', 'pre', 'table', 'thead', 'tbody', 
                     'tr', 'th', 'td', 'img', 'sup', 'sub', 'details', 'summary']
      },
      codeHighlighting: {
        enabled: true,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        useWorker: true,
        languages: ['javascript', 'python', 'java', 'html', 'css', 'bash',
                   'typescript', 'jsx', 'tsx', 'json', 'yaml', 'go', 'rust', 
                   'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin', 'sql']
      },
      virtualization: {
        enabled: true,
        bufferSize: 15,
        recycleNodes: true,
        observerThreshold: [0, 0.1, 0.5, 0.9, 1.0],
        observerRootMargin: '200px 0px'
      },
      messageGrouping: {
        enabled: true,
        timeThreshold: 120000
      },
      timestamps: {
        format: 'relative',
        updateInterval: 60000
      },
      avatars: {
        enabled: true,
        human: new URL('/assets/img/user-avatar.svg', import.meta.url).href,
        assistant: new URL('/assets/img/claude-avatar.svg', import.meta.url).href
      },
      accessibility: {
        announceMessages: true,
        focusableMessages: true,
        keyboardNavigation: true,
        highContrast: matchMedia('(prefers-contrast: more)').matches
      },
      typewriter: {
        enabled: false,
        speed: 30,
        maxSpeed: 100
      },
      files: {
        maxSizeMB: 10,
        allowedTypes: [
          'image/*', '.pdf', '.txt', '.md', '.json', '.csv', '.docx', '.xlsx'
        ],
        imageOptimization: true,
        maxPreviewSize: 800
      },
      performance: {
        batchSize: 8,
        renderThrottleMs: 16,
        idleRenderTimeout: 200,
        maxPendingUpdates: 100
      },
      contextMenu: {
        enabled: true,
        items: ['copy', 'edit', 'regenerate', 'cite', 'save']
      },
      citationFormat: {
        default: 'MLA',
        formats: ['MLA', 'APA', 'Chicago', 'IEEE']
      },
      wikipedia: {
        linkPreview: true,
        autoSummarize: true,
        citationGeneration: true,
        relatedArticles: true
      },
      errorHandling: {
        retryEnabled: true,
        maxRetries: 3,
        notifyErrors: true
      }
    };
    
    // CSS classes - using atomic, namespaced approach
    const CSS = {
      container: 'claude-chat',
      layout: {
        main: 'cc-layout',
        chat: 'cc-chat',
        sidebar: 'cc-sidebar',
        welcome: 'cc-welcome',
        hidden: 'cc-hidden',
        visible: 'cc-visible',
        loading: 'cc-loading',
        expanded: 'cc-expanded',
        collapsed: 'cc-collapsed'
      },
      message: {
        container: 'cc-msg',
        human: 'cc-msg--human',
        assistant: 'cc-msg--assistant',
        error: 'cc-msg--error',
        thinking: 'cc-msg--thinking',
        selected: 'cc-msg--selected',
        focused: 'cc-msg--focused',
        streaming: 'cc-msg--streaming',
        visible: 'cc-msg--visible',
        grouped: 'cc-msg--grouped',
        removing: 'cc-msg--removing',
        withFiles: 'cc-msg--with-files',
        withCitation: 'cc-msg--with-citation',
        edited: 'cc-msg--edited'
      },
      content: {
        wrapper: 'cc-content',
        markdown: 'cc-content--markdown',
        thinking: 'cc-content--thinking',
        streaming: 'cc-content--streaming',
        code: 'cc-content--code',
        inlineCode: 'cc-content--code-inline',
        raw: 'cc-content--raw',
        error: 'cc-content--error',
        loading: 'cc-content--loading',
        citation: 'cc-content--citation'
      },
      animation: {
        fadeIn: 'cc-anim-fade-in',
        fadeOut: 'cc-anim-fade-out',
        slideIn: 'cc-anim-slide-in',
        slideOut: 'cc-anim-slide-out',
        pulse: 'cc-anim-pulse',
        typing: 'cc-anim-typing'
      },
      ui: {
        button: 'cc-btn',
        primary: 'cc-btn--primary',
        secondary: 'cc-btn--secondary',
        danger: 'cc-btn--danger',
        icon: 'cc-btn--icon',
        input: 'cc-input',
        textarea: 'cc-textarea',
        dropdown: 'cc-dropdown',
        modal: 'cc-modal',
        toast: 'cc-toast',
        tooltip: 'cc-tooltip'
      },
      virtualization: {
        container: 'cc-virtual-container',
        spacer: 'cc-virtual-spacer',
        sentinelTop: 'cc-virtual-sentinel-top',
        sentinelBottom: 'cc-virtual-sentinel-bottom'
      }
    };
    
    // Message rendering strategies
    const RENDERERS = {
      DEFAULT: 'default',
      STREAMING: 'streaming',
      THINKING: 'thinking',
      MARKDOWN: 'markdown',
      CODE: 'code',
      IMAGE: 'image',
      FILE: 'file',
      ERROR: 'error',
      WIKI_REFERENCE: 'wikiReference'
    };
  
    // ===============================================================
    // Utility Classes
    // ===============================================================
    
    /**
     * DOM utility class with optimized methods for DOM operations
     */
    class DOM {
      /**
       * Creates an element with attributes and properties
       */
      static create(tag, options = {}) {
        const { attrs = {}, props = {}, events = {}, children = [], dataset = {} } = options;
        const element = document.createElement(tag);
        
        // Set attributes
        for (const [key, value] of Object.entries(attrs)) {
          if (value != null) element.setAttribute(key, value);
        }
        
        // Set properties
        for (const [key, value] of Object.entries(props)) {
          if (value != null) element[key] = value;
        }
        
        // Set dataset
        for (const [key, value] of Object.entries(dataset)) {
          if (value != null) element.dataset[key] = value;
        }
        
        // Append children efficiently
        if (children.length) {
          if (children.length === 1) {
            const child = children[0];
            if (typeof child === 'string') {
              element.textContent = child;
            } else if (child instanceof Node) {
              element.appendChild(child);
            }
          } else {
            const fragment = document.createDocumentFragment();
            
            for (const child of children) {
              if (typeof child === 'string') {
                fragment.appendChild(document.createTextNode(child));
              } else if (child instanceof Node) {
                fragment.appendChild(child);
              }
            }
            
            element.appendChild(fragment);
          }
        }
        
        return element;
      }
      
      /**
       * Batch DOM updates using requestAnimationFrame
       */
      static batch(updateFn) {
        return new Promise(resolve => {
          requestAnimationFrame(() => {
            updateFn();
            resolve();
          });
        });
      }
      
      /**
       * Creates an element from HTML string with security measures
       */
      static fromHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
      }
      
      /**
       * Efficiently empty an element
       */
      static empty(element) {
        if (!element) return;
        element.textContent = '';
      }
      
      /**
       * Safely remove an element
       */
      static remove(element) {
        element?.remove();
      }
      
      /**
       * Apply multiple styles with batched updates
       */
      static setStyles(element, styles) {
        if (!element) return;
        Object.assign(element.style, styles);
      }
      
      /**
       * Add multiple classes with a single classList operation
       */
      static addClass(element, ...classes) {
        if (!element) return;
        element.classList.add(...classes.filter(Boolean));
      }
      
      /**
       * Remove multiple classes with a single classList operation
       */
      static removeClass(element, ...classes) {
        if (!element) return;
        element.classList.remove(...classes.filter(Boolean));
      }
      
      /**
       * Toggle multiple classes based on conditions
       */
      static toggleClasses(element, classMap) {
        if (!element) return;
        for (const [cls, value] of Object.entries(classMap)) {
          element.classList.toggle(cls, !!value);
        }
      }
      
      /**
       * Enhanced visibility check considering container
       */
      static isVisibleIn(element, container) {
        if (!element || !container) return false;
        
        const eleRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        return (
          eleRect.top < containerRect.bottom &&
          eleRect.bottom > containerRect.top &&
          eleRect.width > 0 &&
          eleRect.height > 0
        );
      }
      
      /**
       * Create a debounced function with cancellation
       */
      static debounce(fn, delay) {
        let timer;
        
        const debounced = function(...args) {
          clearTimeout(timer);
          timer = setTimeout(() => fn.apply(this, args), delay);
        };
        
        debounced.cancel = () => clearTimeout(timer);
        
        return debounced;
      }
      
      /**
       * Create a throttled function with trailing option
       */
      static throttle(fn, limit, options = {}) {
        const { trailing = true } = options;
        let lastCall = 0;
        let lastArgs = null;
        let timer = null;
        
        const invoke = (args) => {
          lastCall = Date.now();
          fn.apply(this, args);
        };
        
        const throttled = function(...args) {
          const now = Date.now();
          const remaining = limit - (now - lastCall);
          
          if (remaining <= 0) {
            clearTimeout(timer);
            timer = null;
            invoke(args);
          } else if (trailing) {
            lastArgs = args;
            
            if (!timer) {
              timer = setTimeout(() => {
                timer = null;
                if (lastArgs) {
                  invoke(lastArgs);
                  lastArgs = null;
                }
              }, remaining);
            }
          }
        };
        
        throttled.cancel = () => {
          clearTimeout(timer);
          timer = null;
          lastArgs = null;
        };
        
        return throttled;
      }
      
      /**
       * Run function when browser is idle
       */
      static runWhenIdle(fn, timeout = 200) {
        if ('requestIdleCallback' in window) {
          return requestIdleCallback(fn, { timeout });
        } else {
          return setTimeout(fn, 1);
        }
      }
      
      /**
       * Utility to measure element dimensions without causing reflow
       */
      static measureElement(element) {
        if (!element) return { width: 0, height: 0 };
        
        // Use a cached DOMRect if available
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }
    }
    
    /**
     * Event delegation manager for efficient event handling
     */
    class EventManager {
      constructor(rootElement = document) {
        this.root = rootElement;
        this.handlers = new Map();
        this.delegatedEvents = new Set();
      }
      
      /**
       * Add a delegated event listener
       */
      on(eventType, selector, handler, options = {}) {
        // Create a unique ID for this handler
        const id = `${eventType}|${selector}|${handler.name || Math.random().toString(36).slice(2, 7)}`;
        
        // Create delegation handler if not already set up
        if (!this.delegatedEvents.has(eventType)) {
          const delegationHandler = (event) => {
            // Find all matching handlers for this event type
            const eventHandlers = [...this.handlers.entries()]
              .filter(([key]) => key.startsWith(`${eventType}|`))
              .map(([, value]) => value);
            
            // Process each handler
            for (const { selector, callback } of eventHandlers) {
              if (selector === '*') {
                callback(event);
                continue;
              }
              
              // Find closest matching element
              const target = event.target.closest(selector);
              if (target) {
                callback.call(target, event, target);
              }
            }
          };
          
          this.root.addEventListener(eventType, delegationHandler, {
            passive: options.passive ?? true,
            capture: options.capture ?? false
          });
          
          this.delegatedEvents.add(eventType);
        }
        
        // Store the handler
        this.handlers.set(id, { selector, callback: handler });
        
        // Return function to remove this handler
        return () => this.off(id);
      }
      
      /**
       * Remove an event handler by ID
       */
      off(handlerId) {
        return this.handlers.delete(handlerId);
      }
      
      /**
       * Remove all event handlers
       */
      removeAll() {
        // Remove all delegated event listeners
        for (const eventType of this.delegatedEvents) {
          this.root.removeEventListener(eventType, this.delegationHandlers.get(eventType));
        }
        
        this.handlers.clear();
        this.delegatedEvents.clear();
      }
    }
    
    /**
     * Animation controller with View Transitions API support
     */
    class AnimationController {
      constructor(config) {
        this.config = config;
        this.supportsViewTransitions = 'viewTransition' in document;
        this.useViewTransitions = this.supportsViewTransitions && config.animations.viewTransitions;
        this.reducedMotion = config.animations.reducedMotion;
        
        // Listen for reduced motion preference changes
        this.reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
        this.reducedMotionQuery.addEventListener('change', this.#handleReducedMotionChange.bind(this));
      }
      
      /**
       * Handle reduced motion preference changes
       */
      #handleReducedMotionChange(e) {
        this.reducedMotion = e.matches;
        
        document.documentElement.classList.toggle('reduced-motion', this.reducedMotion);
        
        if (this.reducedMotion) {
          // Apply immediate styles for reduced motion
          const style = document.createElement('style');
          style.id = 'reduced-motion-styles';
          style.textContent = `
            *, *::before, *::after {
              transition-duration: 0.001ms !important;
              animation-duration: 0.001ms !important;
            }
          `;
          document.head.appendChild(style);
        } else {
          // Remove reduced motion styles
          document.getElementById('reduced-motion-styles')?.remove();
        }
      }
      
      /**
       * Animate an element with options
       */
      animate(element, keyframes, options = {}) {
        if (!element || this.reducedMotion) return null;
        
        const animation = element.animate(keyframes, {
          duration: options.duration ?? this.config.animations.duration,
          easing: options.easing ?? this.config.animations.easing,
          fill: options.fill ?? 'both',
          ...options
        });
        
        return animation;
      }
      
      /**
       * Perform a view transition with fallback
       */
      async transition(updateFn, options = {}) {
        if (this.reducedMotion) {
          updateFn();
          return;
        }
        
        const { skipTransition = false } = options;
        
        // Skip if view transitions not supported or explicitly skipped
        if (skipTransition || !this.useViewTransitions) {
          return updateFn();
        }
        
        try {
          // Use View Transitions API
          const transition = document.startViewTransition(() => updateFn());
          return await transition.finished;
        } catch (err) {
          // Fallback if view transition fails
          console.warn('View transition failed, using fallback', err);
          return updateFn();
        }
      }
      
      /**
       * Fade in an element
       */
      fadeIn(element, options = {}) {
        if (!element || this.reducedMotion) {
          element.style.opacity = '1';
          return Promise.resolve();
        }
        
        return this.animate(element, [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], options).finished;
      }
      
      /**
       * Fade out an element
       */
      fadeOut(element, options = {}) {
        if (!element || this.reducedMotion) {
          element.style.opacity = '0';
          return Promise.resolve();
        }
        
        return this.animate(element, [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(8px)' }
        ], options).finished;
      }
      
      /**
       * Clean up resources
       */
      destroy() {
        this.reducedMotionQuery.removeEventListener('change', this.#handleReducedMotionChange);
      }
    }
    
    /**
     * Renders markdown content with web worker offloading
     */
    class MarkdownRenderer {
      constructor(config) {
        this.config = config;
        this.parser = null;
        this.sanitizer = null;
        this.worker = null;
        this.workerReady = false;
        this.pendingTasks = new Map();
        this.taskIdCounter = 0;
      }
      
      /**
       * Initialize the markdown renderer
       */
      async init() {
        try {
          // Load DOMPurify for sanitization
          if (this.config.markdown.sanitize) {
            this.sanitizer = (await import('https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.es.min.js')).default;
            this.sanitizer.setConfig({
              ALLOWED_TAGS: this.config.markdown.allowedTags,
              ADD_ATTR: ['target', 'rel', 'loading', 'class']
            });
          }
          
          // Try to use web worker for markdown processing
          if (window.Worker) {
            try {
              this.worker = new Worker(new URL('./markdown-worker.js', import.meta.url));
              
              this.worker.addEventListener('message', (e) => {
                const { id, html, error } = e.data;
                
                if (this.pendingTasks.has(id)) {
                  const { resolve, reject } = this.pendingTasks.get(id);
                  this.pendingTasks.delete(id);
                  
                  if (error) {
                    reject(new Error(error));
                  } else {
                    resolve(this.#sanitizeHtml(html));
                  }
                }
              });
              
              // Initialize worker with config
              this.worker.postMessage({ 
                type: 'init', 
                config: {
                  breaks: this.config.markdown.breaks,
                  linkify: this.config.markdown.linkify
                }
              });
              
              this.workerReady = true;
            } catch (err) {
              console.warn('Failed to initialize markdown worker, falling back to main thread', err);
              this.worker = null;
            }
          }
          
          // Fallback to main thread
          if (!this.worker) {
            const { marked } = await import('https://cdn.jsdelivr.net/npm/marked@11.1.1/lib/marked.esm.js');
            this.parser = marked;
            
            this.parser.setOptions({
              breaks: this.config.markdown.breaks,
              gfm: true,
              headerIds: false,
              mangle: false,
              smartLists: true,
              smartypants: true
            });
          }
          
          return true;
        } catch (err) {
          console.error('Failed to initialize markdown renderer', err);
          return false;
        }
      }
      
      /**
       * Sanitize HTML output
       */
      #sanitizeHtml(html) {
        return this.config.markdown.sanitize && this.sanitizer 
          ? this.sanitizer.sanitize(html) 
          : html;
      }
      
      /**
       * Render markdown content to HTML
       */
      async render(markdown) {
        if (!markdown) return '';
        
        try {
          // Use worker if available
          if (this.worker && this.workerReady) {
            const taskId = ++this.taskIdCounter;
            
            const result = new Promise((resolve, reject) => {
              this.pendingTasks.set(taskId, { resolve, reject });
            });
            
            this.worker.postMessage({ type: 'render', id: taskId, markdown });
            return await result;
          }
          
          // Fallback to main thread
          if (this.parser) {
            const html = this.parser(markdown);
            return this.#sanitizeHtml(html);
          }
          
          // Last resort: basic escaping
          return this.#escapeHTML(markdown);
        } catch (err) {
          console.error('Markdown rendering failed', err);
          return this.#escapeHTML(markdown);
        }
      }
      
      /**
       * Basic HTML escaping for fallback
       */
      #escapeHTML(text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br>');
      }
      
      /**
       * Clean up resources
       */
      destroy() {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        
        this.pendingTasks.clear();
      }
    }
    
    /**
     * Syntax highlighting with web worker offloading
     */
    class CodeHighlighter {
      constructor(config) {
        this.config = config;
        this.highlighter = null;
        this.worker = null;
        this.pendingTasks = new Map();
        this.taskIdCounter = 0;
        this.loadedLanguages = new Set(['javascript', 'xml', 'css']);
        this.cssLoaded = false;
      }
      
      /**
       * Initialize the code highlighter
       */
      async init() {
        try {
          // Load CSS for the selected theme
          await this.#loadCss();
          
          // Try to use web worker
          if (window.Worker && this.config.codeHighlighting.useWorker) {
            try {
              this.worker = new Worker(new URL('./highlight-worker.js', import.meta.url));
              
              this.worker.addEventListener('message', (e) => {
                const { id, html, error, language } = e.data;
                
                if (this.pendingTasks.has(id)) {
                  const { resolve, reject } = this.pendingTasks.get(id);
                  this.pendingTasks.delete(id);
                  
                  if (error) {
                    reject(new Error(error));
                  } else {
                    if (language) this.loadedLanguages.add(language);
                    resolve(html);
                  }
                }
              });
              
              // Initialize worker with config
              this.worker.postMessage({ 
                type: 'init', 
                theme: this.config.codeHighlighting.theme,
                preloadLanguages: ['javascript', 'python', 'html', 'css', 'java', 'bash']
              });
            } catch (err) {
              console.warn('Failed to initialize highlight worker, falling back to main thread', err);
              this.worker = null;
            }
          }
          
          // Fallback to main thread
          if (!this.worker) {
            const hljsModule = await import('https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/highlight.min.js');
            this.highlighter = hljsModule.default;
            
            // Preload common languages
            const commonLangs = ['javascript', 'python', 'html', 'css', 'java', 'bash'];
            for (const lang of commonLangs) {
              if (!this.loadedLanguages.has(lang)) {
                try {
                  await this.#loadLanguage(lang);
                } catch (e) {
                  console.warn(`Failed to preload language: ${lang}`, e);
                }
              }
            }
          }
          
          return true;
        } catch (err) {
          console.error('Failed to initialize code highlighter', err);
          return false;
        }
      }
      
      /**
       * Load CSS for syntax highlighting
       */
      async #loadCss() {
        if (this.cssLoaded) return;
        
        const isDark = this.config.codeHighlighting.theme === 'dark';
        const cssUrl = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/${
          isDark ? 'github-dark' : 'github'
        }.min.css`;
        
        if (!document.querySelector(`link[href="${cssUrl}"]`)) {
          return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssUrl;
            link.onload = () => {
              this.cssLoaded = true;
              resolve();
            };
            link.onerror = () => {
              console.warn('Failed to load syntax highlighting CSS');
              resolve();
            };
            document.head.appendChild(link);
          });
        }
        
        this.cssLoaded = true;
      }
      
      /**
       * Load a specific language for highlighting
       */
      async #loadLanguage(language) {
        if (this.loadedLanguages.has(language)) return;
        
        try {
          // Specific mapping for some common languages
          const langMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'rb': 'ruby',
            'sh': 'bash',
            'yml': 'yaml',
            'md': 'markdown'
          };
          
          const normalizedLang = langMap[language] || language;
          
          // Dynamically import the language
          const langUrl = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/${normalizedLang}.min.js`;
          const langModule = await import(langUrl);
          
          // Register the language
          if (this.highlighter && langModule.default) {
            this.highlighter.registerLanguage(normalizedLang, langModule.default);
            this.loadedLanguages.add(normalizedLang);
            if (language !== normalizedLang) this.loadedLanguages.add(language);
          }
        } catch (err) {
          console.warn(`Failed to load language: ${language}`, err);
        }
      }
      
      /**
       * Highlight code with specified language
       */
      async highlight(code, language) {
        if (!code) return code;
        
        try {
          // Use worker if available
          if (this.worker) {
            const taskId = ++this.taskIdCounter;
            
            const result = new Promise((resolve, reject) => {
              this.pendingTasks.set(taskId, { resolve, reject });
            });
            
            this.worker.postMessage({ type: 'highlight', id: taskId, code, language });
            return await result;
          }
          
          // Fallback to main thread
          if (this.highlighter) {
            // Load language if needed
            if (language && !this.loadedLanguages.has(language)) {
              await this.#loadLanguage(language);
            }
            
            if (language && this.loadedLanguages.has(language)) {
              return this.highlighter.highlight(code, { language }).value;
            } else {
              return this.highlighter.highlightAuto(code).value;
            }
          }
          
          // Last resort: basic escaping
          return this.#escapeHTML(code);
        } catch (err) {
          console.error('Code highlighting failed', err);
          return this.#escapeHTML(code);
        }
      }
      
      /**
       * Basic HTML escaping for fallback
       */
      #escapeHTML(text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      
      /**
       * Update the theme being used
       */
      updateTheme(theme) {
        this.config.codeHighlighting.theme = theme;
        
        // Need to reload CSS for the new theme
        this.cssLoaded = false;
        this.#loadCss();
        
        // Notify worker of theme change if available
        if (this.worker) {
          this.worker.postMessage({ type: 'setTheme', theme });
        }
      }
      
      /**
       * Clean up resources
       */
      destroy() {
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        
        this.pendingTasks.clear();
      }
    }
    
    /**
     * Manages virtualized list rendering for messages
     */
    class VirtualScroller {
      constructor(container, config, eventBus) {
        this.container = container;
        this.config = config;
        this.eventBus = eventBus;
        
        this.state = {
          items: [],
          visibleStartIndex: 0,
          visibleEndIndex: 0,
          bufferSize: config.virtualization.bufferSize,
          renderCallback: null,
          recycledNodes: [],
          itemHeights: new Map(),
          averageHeight: 100,
          measuring: false,
          pendingUpdate: false,
          scrollPosition: 0,
          lastScrollTop: 0,
          scrollDirection: 'down',
          sentinelObserver: null,
          resizeObserver: null
        };
        
        // Set up structure
        this.#setupDOMStructure();
        
        // Set up observers
        this.#setupObservers();
        
        // Bind handlers
        this.handleScroll = this.#handleScroll.bind(this);
        this.update = DOM.throttle(this.#update.bind(this), 50, { trailing: true });
        
        // Add event listeners
        this.container.addEventListener('scroll', this.handleScroll, { passive: true });
        
        // Mark container
        this.container.classList.add(CSS.virtualization.container);
      }
      
      /**
       * Set up the DOM structure for virtualization
       */
      #setupDOMStructure() {
        // Create sentinel elements for tracking scroll positions
        this.topSentinel = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { className: CSS.virtualization.sentinelTop }
        });
        
        this.bottomSentinel = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { className: CSS.virtualization.sentinelBottom }
        });
        
        // Create spacer elements
        this.topSpacer = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { className: CSS.virtualization.spacer }
        });
        
        this.bottomSpacer = DOM.create('div', {
          attrs: { 'aria-hidden': 'true' },
          props: { className: CSS.virtualization.spacer }
        });
        
        // Add to container
        this.container.insertBefore(this.topSentinel, this.container.firstChild);
        this.container.insertBefore(this.topSpacer, this.topSentinel.nextSibling);
        this.container.appendChild(this.bottomSpacer);
        this.container.appendChild(this.bottomSentinel);
      }
      
      /**
       * Set up Intersection and Resize observers
       */
      #setupObservers() {
        // Intersection Observer for sentinels
        const sentinelOptions = {
          root: this.container,
          rootMargin: this.config.virtualization.observerRootMargin,
          threshold: 0
        };
        
        this.state.sentinelObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              if (entry.target === this.topSentinel) {
                this.#loadMoreAbove();
              } else if (entry.target === this.bottomSentinel) {
                this.#loadMoreBelow();
              }
            }
          });
        }, sentinelOptions);
        
        this.state.sentinelObserver.observe(this.topSentinel);
        this.state.sentinelObserver.observe(this.bottomSentinel);
        
        // Resize Observer for container
        if (window.ResizeObserver) {
          this.state.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              if (entry.target === this.container) {
                // Schedule an update on resize
                this.state.pendingUpdate = true;
                this.update();
              }
            }
          });
          
          this.state.resizeObserver.observe(this.container);
        }
      }
      
      /**
       * Set items to be virtualized
       */
      setItems(items, renderCallback) {
        this.state.items = items;
        this.state.renderCallback = renderCallback;
        this.state.pendingUpdate = true;
        this.update();
      }
      
      /**
       * Handle scroll events
       */
      #handleScroll() {
        const { scrollTop } = this.container;
        
        // Determine scroll direction
        this.state.scrollDirection = scrollTop > this.state.lastScrollTop ? 'down' : 'up';
        this.state.lastScrollTop = scrollTop;
        this.state.scrollPosition = scrollTop;
        
        // Trigger a new update if needed
        if (!this.state.measuring) {
          this.state.pendingUpdate = true;
          this.update();
        }
        
        // Fire scroll event for other components
        this.eventBus.emit('scroll', {
          scrollTop,
          direction: this.state.scrollDirection,
          atBottom: this.isScrolledToBottom()
        });
      }
      
      /**
       * Check if scrolled to bottom
       */
      isScrolledToBottom() {
        const { scrollTop, scrollHeight, clientHeight } = this.container;
        const scrollBottom = scrollTop + clientHeight;
        const threshold = clientHeight * 0.05; // 5% of container height
        
        return scrollBottom >= scrollHeight - threshold;
      }
      
      /**
       * Update visible items and manage rendering
       */
      #update() {
        if (!this.state.pendingUpdate || !this.state.renderCallback) return;
        this.state.pendingUpdate = false;
        
        const { items, bufferSize } = this.state;
        if (items.length === 0) return;
        
        // Calculate visible indices
        const newVisibleIndices = this.#calculateVisibleIndices();
        if (!newVisibleIndices) return;
        
        const { visibleStartIndex, visibleEndIndex } = newVisibleIndices;
        
        // Calculate buffer indices with overlap
        const bufferedStartIndex = Math.max(0, visibleStartIndex - bufferSize);
        const bufferedEndIndex = Math.min(items.length - 1, visibleEndIndex + bufferSize);
        
        // Update state
        this.state.visibleStartIndex = visibleStartIndex;
        this.state.visibleEndIndex = visibleEndIndex;
        
        // Determine which items need to be rendered
        const itemsToShow = items.slice(bufferedStartIndex, bufferedEndIndex + 1);
        const itemsToRecycle = items.filter((_, index) => 
          index < bufferedStartIndex || index > bufferedEndIndex
        );
        
        // Measure phase if needed
        if (this.state.measuring) {
          this.#updateItemHeights();
        }
        
        // Apply spacer heights
        this.#updateSpacers(bufferedStartIndex, bufferedEndIndex);
        
        // Render visible items
        DOM.batch(() => {
          // Recycle DOM nodes for items outside buffer
          this.#recycleNodes(itemsToRecycle);
          
          // Render items in buffer
          this.state.renderCallback(itemsToShow, bufferedStartIndex);
        }).then(() => {
          // Allow some time for rendering then schedule another measurement
          setTimeout(() => {
            this.state.measuring = true;
            this.#updateItemHeights();
            this.state.measuring = false;
          }, 50);
        });
      }
      
      /**
       * Calculate which indices are currently visible
       */
      #calculateVisibleIndices() {
        // Find elements that are message containers
        const allElements = Array.from(this.container.querySelectorAll(`.${CSS.message.container}`));
        if (allElements.length === 0) return null;
        
        // Map elements to indices by data-message-id
        const visibleIndices = [];
        
        for (let i = 0; i < allElements.length; i++) {
          const element = allElements[i];
          const messageId = element.dataset.messageId;
          
          // Skip if no message ID
          if (!messageId) continue;
          
          // Find if element is visible
          const rect = element.getBoundingClientRect();
          const containerRect = this.container.getBoundingClientRect();
          
          if (
            rect.bottom >= containerRect.top &&
            rect.top <= containerRect.bottom
          ) {
            // Find index of this item
            const index = this.state.items.findIndex(item => item.id === messageId);
            if (index !== -1) {
              visibleIndices.push(index);
            }
          }
        }
        
        // If no visible elements, use fallback
        if (visibleIndices.length === 0) {
          return {
            visibleStartIndex: 0,
            visibleEndIndex: Math.min(10, this.state.items.length - 1)
          };
        }
        
        return {
          visibleStartIndex: Math.min(...visibleIndices),
          visibleEndIndex: Math.max(...visibleIndices)
        };
      }
      
      /**
       * Update stored item heights for accurate spacers
       */
      #updateItemHeights() {
        // Find all visible message elements
        const elements = this.container.querySelectorAll(`.${CSS.message.container}`);
        
        let totalHeight = 0;
        let measureCount = 0;
        
        // Measure each element
        for (const element of elements) {
          const messageId = element.dataset.messageId;
          if (!messageId) continue;
          
          const height = element.offsetHeight;
          if (height > 0) {
            this.state.itemHeights.set(messageId, height);
            totalHeight += height;
            measureCount++;
          }
        }
        
        // Update average height if we measured elements
        if (measureCount > 0) {
          this.state.averageHeight = totalHeight / measureCount;
        }
      }
      
      /**
       * Update spacer heights for virtual scrolling
       */
      #updateSpacers(startIndex, endIndex) {
        const { items, averageHeight, itemHeights } = this.state;
        
        // Calculate heights of hidden elements
        let topHeight = 0;
        for (let i = 0; i < startIndex; i++) {
          const item = items[i];
          topHeight += itemHeights.get(item.id) || averageHeight;
        }
        
        let bottomHeight = 0;
        for (let i = endIndex + 1; i < items.length; i++) {
          const item = items[i];
          bottomHeight += itemHeights.get(item.id) || averageHeight;
        }
        
        // Apply heights to spacers
        this.topSpacer.style.height = `${topHeight}px`;
        this.bottomSpacer.style.height = `${bottomHeight}px`;
      }
      
      /**
       * Recycle DOM nodes for better performance
       */
      #recycleNodes(itemsToRecycle) {
        if (!this.config.virtualization.recycleNodes) return;
        
        for (const item of itemsToRecycle) {
          const element = this.container.querySelector(`[data-message-id="${item.id}"]`);
          if (element) {
            // Add to recycled nodes pool
            this.state.recycledNodes.push({
              element,
              id: item.id,
              type: element.dataset.type
            });
            
            // Remove from DOM
            element.remove();
          }
        }
        
        // Limit recycled pool size
        if (this.state.recycledNodes.length > 50) {
          this.state.recycledNodes.length = 50;
        }
      }
      
      /**
       * Get a recycled node if available
       */
      getRecycledNode(id, type) {
        if (!this.config.virtualization.recycleNodes) return null;
        
        // Find a matching node or similar type
        const exactIndex = this.state.recycledNodes.findIndex(n => n.id === id);
        if (exactIndex !== -1) {
          const node = this.state.recycledNodes.splice(exactIndex, 1)[0];
          return node.element;
        }
        
        // Find by type
        if (type) {
          const typeIndex = this.state.recycledNodes.findIndex(n => n.type === type);
          if (typeIndex !== -1) {
            const node = this.state.recycledNodes.splice(typeIndex, 1)[0];
            node.element.dataset.messageId = id;
            return node.element;
          }
        }
        
        return null;
      }
      
      /**
       * Load more items above the visible area
       */
      #loadMoreAbove() {
        const { visibleStartIndex } = this.state;
        
        // Skip if already at the top
        if (visibleStartIndex <= 0) return;
        
        this.state.pendingUpdate = true;
        this.update();
        
        // Emit event to notify about loading more
        this.eventBus.emit('loadMoreAbove', { 
          visibleStartIndex, 
          visibleEndIndex: this.state.visibleEndIndex 
        });
      }
      
      /**
       * Load more items below the visible area
       */
      #loadMoreBelow() {
        const { visibleEndIndex, items } = this.state;
        
        // Skip if already at the bottom
        if (visibleEndIndex >= items.length - 1) return;
        
        this.state.pendingUpdate = true;
        this.update();
        
        // Emit event to notify about loading more
        this.eventBus.emit('loadMoreBelow', { 
          visibleStartIndex: this.state.visibleStartIndex, 
          visibleEndIndex 
        });
      }
      
      /**
       * Scroll to a specific item by ID
       */
      scrollToItem(id, options = {}) {
        const { behavior = 'smooth', block = 'center' } = options;
        
        const element = this.container.querySelector(`[data-message-id="${id}"]`);
        if (element) {
          element.scrollIntoView({
            behavior: this.config.animations.reducedMotion ? 'auto' : behavior,
            block
          });
          return true;
        }
        
        // Item not in DOM, try to find its index and scroll to estimated position
        const index = this.state.items.findIndex(item => item.id === id);
        if (index !== -1) {
          // Calculate approximate position
          const { averageHeight, itemHeights } = this.state;
          
          let estimatedPosition = 0;
          for (let i = 0; i < index; i++) {
            const item = this.state.items[i];
            estimatedPosition += itemHeights.get(item.id) || averageHeight;
          }
          
          // Scroll to estimated position
          this.container.scrollTo({
            top: estimatedPosition,
            behavior: this.config.animations.reducedMotion ? 'auto' : behavior
          });
          
          // Force an update to render the target
          this.state.pendingUpdate = true;
          this.update();
          
          // Try again after rendering
          setTimeout(() => {
            const element = this.container.querySelector(`[data-message-id="${id}"]`);
            if (element) {
              element.scrollIntoView({
                behavior: this.config.animations.reducedMotion ? 'auto' : behavior,
                block
              });
            }
          }, 100);
          
          return true;
        }
        
        return false;
      }
      
      /**
       * Scroll to the bottom of the container
       */
      scrollToBottom(options = {}) {
        const { behavior = 'smooth' } = options;
        
        this.container.scrollTo({
          top: this.container.scrollHeight,
          behavior: this.config.animations.reducedMotion ? 'auto' : behavior
        });
      }
      
      /**
       * Reset the scroller state
       */
      reset() {
        this.state.items = [];
        this.state.visibleStartIndex = 0;
        this.state.visibleEndIndex = 0;
        this.state.itemHeights.clear();
        this.state.recycledNodes = [];
        this.state.pendingUpdate = true;
        
        // Reset spacers
        this.topSpacer.style.height = '0px';
        this.bottomSpacer.style.height = '0px';
        
        this.update();
      }
      
      /**
       * Clean up resources
       */
      destroy() {
        // Remove event listeners
        this.container.removeEventListener('scroll', this.handleScroll);
        
        // Disconnect observers
        this.state.sentinelObserver?.disconnect();
        this.state.resizeObserver?.disconnect();
        
        // Clean up DOM
        this.topSentinel.remove();
        this.bottomSentinel.remove();
        this.topSpacer.remove();
        this.bottomSpacer.remove();
        
        // Clear state
        this.state.recycledNodes = [];
        this.state.itemHeights.clear();
      }
    }
  
    /**
     * Event bus for internal component communication
     */
    class EventBus {
      constructor() {
        this.handlers = new Map();
      }
      
      /**
       * Subscribe to an event
       */
      on(eventName, handler) {
        if (!this.handlers.has(eventName)) {
          this.handlers.set(eventName, []);
        }
        
        const handlers = this.handlers.get(eventName);
        handlers.push(handler);
        
        // Return unsubscribe function
        return () => {
          const index = handlers.indexOf(handler);
          if (index !== -1) {
            handlers.splice(index, 1);
          }
        };
      }
      
      /**
       * Emit an event with data
       */
      emit(eventName, data = {}) {
        // Add timestamp if not provided
        if (!data.timestamp) {
          data.timestamp = Date.now();
        }
        
        // Get handlers for this event
        const handlers = this.handlers.get(eventName) || [];
        
        // Call all handlers
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in event handler for ${eventName}:`, error);
          }
        }
        
        // Create and dispatch DOM event for external listeners
        const event = new CustomEvent(`claudechat:${eventName}`, {
          detail: data,
          bubbles: true
        });
        
        document.dispatchEvent(event);
      }
      
      /**
       * Remove all handlers for an event
       */
      off(eventName) {
        this.handlers.delete(eventName);
      }
      
      /**
       * Clean up all event handlers
       */
      clear() {
        this.handlers.clear();
      }
    }
  
    /**
     * Core UI Controller implementation
     */
    class Controller {
      constructor() {
        // Initialize configuration with defaults
        this.config = structuredClone(DEFAULT_CONFIG);
        
        // Initialize event bus
        this.eventBus = new EventBus();
        
        // Initialize state
        this.state = {
          initialized: false,
          elements: new Map(),
          messages: new Map(),
          visibleMessages: new Set(),
          activeMessageId: null,
          currentChatId: null,
          streaming: {
            active: false,
            messageId: null,
            content: '',
            startTime: 0,
            totalBytes: 0
          },
          thinking: false,
          scrollLocked: true,
          updateQueue: [],
          processingQueue: false,
          messageRenderers: new Map(),
          toastQueue: [],
          wikipediaArticle: null,
          rendererPromises: {
            markdown: null,
            codeHighlighter: null
          },
          undoStack: [],
          redoStack: []
        };
        
        // Initialize component references
        this.components = {
          animationController: null,
          markdownRenderer: null,
          codeHighlighter: null,
          virtualScroller: null,
          eventManager: null
        };
      }
      
      /**
       * Initialize the UI controller
       */
      async init(options = {}) {
        if (this.state.initialized) {
          console.warn('UI controller already initialized');
          return this;
        }
        
        console.time('UI Initialization');
        
        try {
          // Merge configurations
          this.config = this.#mergeConfig(this.config, options);
          
          // Detect system preferences
          this.#detectSystemPreferences();
          
          // Cache DOM elements
          this.#cacheElements();
          
          // Initialize component dependencies
          await this.#initComponents();
          
          // Set up event handlers
          this.#setupEventHandlers();
          
          // Register message renderers
          this.#registerMessageRenderers();
          
          // Set up keyboard shortcuts
          this.#setupKeyboardShortcuts();
          
          // Apply initial theme
          this.#applyTheme();
          
          // Set up accessibility features
          this.#setupAccessibility();
          
          // Mark as initialized
          this.state.initialized = true;
          
          // Notify of initialization
          this.eventBus.emit('initialized', {
            timestamp: Date.now(),
            config: this.config
          });
          
          console.timeEnd('UI Initialization');
          
          return this;
        } catch (error) {
          console.error('Failed to initialize UI controller:', error);
          
          // Attempt to show error to user
          this.#showInitializationError(error);
          
          // Notify of initialization error
          this.eventBus.emit('initError', { error });
          
          throw error;
        }
      }
      
      /**
       * Merge configuration objects with deep merge
       */
      #mergeConfig(target, source) {
        const merged = { ...target };
        
        for (const [key, value] of Object.entries(source)) {
          // Skip null/undefined values
          if (value == null) continue;
          
          // Deep merge objects (but not arrays)
          if (typeof value === 'object' && !Array.isArray(value) &&
              typeof target[key] === 'object' && !Array.isArray(target[key])) {
            merged[key] = this.#mergeConfig(target[key], value);
          } else {
            merged[key] = value;
          }
        }
        
        return merged;
      }
      
      /**
       * Detect system preferences for accessibility and animations
       */
      #detectSystemPreferences() {
        // Check for reduced motion
        const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
          this.config.animations.reducedMotion = true;
          this.config.scrollBehavior = 'auto';
          this.config.typewriter.enabled = false;
        }
        
        // Check for high contrast
        const prefersHighContrast = matchMedia('(prefers-contrast: more)').matches;
        if (prefersHighContrast) {
          this.config.accessibility.highContrast = true;
        }
        
        // Check for dark mode
        const prefersDarkMode = matchMedia('(prefers-color-scheme: dark)').matches;
        const explicitLightMode = document.documentElement.classList.contains('light') || 
                                 document.body.classList.contains('light-theme');
                                 
        if (prefersDarkMode && !explicitLightMode) {
          this.config.codeHighlighting.theme = 'dark';
          document.documentElement.classList.add('dark');
        }
      }
      
      /**
       * Cache common DOM elements
       */
      #cacheElements() {
        // Common elements to cache
        const elementsToCacheById = [
          'chatContainer', 'welcomeScreen', 'userInput', 'sendButton', 
          'attachButton', 'fileUpload', 'chatHistory', 'settingsPanel',
          'overlay', 'toastContainer', 'menuBtn', 'sidebar', 'newChatBtn',
          'formatButton', 'formatMenu', 'scrollToBottomBtn'
        ];
        
        // Cache each element by ID
        for (const id of elementsToCacheById) {
          const element = document.getElementById(id);
          if (element) {
            this.state.elements.set(id, element);
          }
        }
        
        // Create essential elements if missing
        this.#ensureCriticalElementsExist();
      }
      
      /**
       * Ensure critical UI elements exist
       */
      #ensureCriticalElementsExist() {
        // Create toast container if needed
        if (!this.state.elements.has('toastContainer')) {
          const toastContainer = DOM.create('div', {
            attrs: { id: 'toastContainer' },
            props: { className: CSS.ui.toast + '-container' }
          });
          document.body.appendChild(toastContainer);
          this.state.elements.set('toastContainer', toastContainer);
        }
        
        // Create accessibility live region
        if (this.config.accessibility.announceMessages) {
          const liveRegion = document.getElementById('sr-live-region') || 
            DOM.create('div', {
              attrs: {
                id: 'sr-live-region',
                'aria-live': 'polite',
                'aria-atomic': 'true'
              },
              props: { className: 'sr-only' }
            });
          
          if (!liveRegion.parentNode) {
            document.body.appendChild(liveRegion);
          }
          
          this.state.elements.set('liveRegion', liveRegion);
        }
        
        // Create scroll-to-bottom button if needed
        const chatContainer = this.state.elements.get('chatContainer');
        if (chatContainer && !this.state.elements.has('scrollToBottomBtn')) {
          const scrollButton = DOM.create('button', {
            attrs: {
              id: 'scrollToBottomBtn',
              'aria-label': 'Scroll to bottom',
              type: 'button'
            },
            props: { 
              className: 'scroll-to-bottom-btn',
              innerHTML: `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              `
            }
          });
          
          chatContainer.appendChild(scrollButton);
          this.state.elements.set('scrollToBottomBtn', scrollButton);
        }
      }
      
      /**
       * Initialize component dependencies
       */
      async #initComponents() {
        // Create event manager for optimized event delegation
        this.components.eventManager = new EventManager(document);
        
        // Create animation controller
        this.components.animationController = new AnimationController(this.config);
        
        // Initialize markdown renderer
        this.components.markdownRenderer = new MarkdownRenderer(this.config);
        this.state.rendererPromises.markdown = this.components.markdownRenderer.init();
        
        // Initialize code highlighter
        this.components.codeHighlighter = new CodeHighlighter(this.config);
        this.state.rendererPromises.codeHighlighter = this.components.codeHighlighter.init();
        
        // Initialize virtual scroller if enabled and chat container exists
        const chatContainer = this.state.elements.get('chatContainer');
        if (this.config.virtualization.enabled && chatContainer) {
          this.components.virtualScroller = new VirtualScroller(
            chatContainer, 
            this.config,
            this.eventBus
          );
        }
        
        // Wait for renderers to initialize
        await Promise.allSettled([
          this.state.rendererPromises.markdown,
          this.state.rendererPromises.codeHighlighter
        ]);
      }
      
      /**
       * Set up event handlers
       */
      #setupEventHandlers() {
        const eventManager = this.components.eventManager;
        
        // Set up scrollToBottom button
        eventManager.on('click', '#scrollToBottomBtn', () => {
          this.scrollToBottom();
        });
        
        // Set up send button
        eventManager.on('click', '#sendButton', (e) => {
          this.#handleSendClick(e);
        });
        
        // Set up new chat button
        eventManager.on('click', '#newChatBtn', () => {
          this.eventBus.emit('newChatRequested');
        });
        
        // User input handlers
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          userInput.addEventListener('input', this.#handleInputChange.bind(this));
          userInput.addEventListener('keydown', this.#handleInputKeydown.bind(this));
        }
        
        // Message action handlers
        eventManager.on('click', '.cc-msg-action', (e, target) => {
          const action = target.dataset.action;
          const messageId = target.closest('[data-message-id]')?.dataset.messageId;
          
          if (action && messageId) {
            this.#handleMessageAction(action, messageId);
          }
        });
        
        // Code block actions
        eventManager.on('click', '.cc-code-action', (e, target) => {
          const action = target.dataset.action;
          const codeBlock = target.closest('.cc-code-block');
          const codeElement = codeBlock?.querySelector('code');
          
          if (action === 'copy' && codeElement) {
            navigator.clipboard.writeText(codeElement.textContent)
              .then(() => {
                target.classList.add('success');
                if (target.querySelector('.label')) {
                  target.querySelector('.label').textContent = 'Copied!';
                }
                
                setTimeout(() => {
                  target.classList.remove('success');
                  if (target.querySelector('.label')) {
                    target.querySelector('.label').textContent = 'Copy';
                  }
                }, 2000);
              })
              .catch(err => console.error('Failed to copy code', err));
          }
        });
        
        // Theme change detection
        const darkModeMediaQuery = matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.addEventListener('change', this.#handleThemeChange.bind(this));
        
        // Document-level keyboard events (using capture to get events before they reach inputs)
        document.addEventListener('keydown', this.#handleKeyDown.bind(this), { capture: true });
        
        // Listen for reduced motion changes
        matchMedia('(prefers-reduced-motion: reduce)')
          .addEventListener('change', (e) => {
            this.config.animations.reducedMotion = e.matches;
            document.documentElement.classList.toggle('reduced-motion', e.matches);
          });
          
        // Internal event subscriptions
        this.eventBus.on('scroll', (data) => {
          const { atBottom } = data;
          this.state.scrollLocked = atBottom;
          
          // Update scroll button visibility
          const scrollButton = this.state.elements.get('scrollToBottomBtn');
          if (scrollButton) {
            scrollButton.classList.toggle('visible', !atBottom);
          }
        });
      }
      
      /**
       * Register message rendering strategies
       */
      #registerMessageRenderers() {
        this.state.messageRenderers.set(RENDERERS.DEFAULT, this.#renderDefaultMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.STREAMING, this.#renderStreamingMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.THINKING, this.#renderThinkingMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.MARKDOWN, this.#renderMarkdownMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.CODE, this.#renderCodeMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.IMAGE, this.#renderImageMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.FILE, this.#renderFileMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.ERROR, this.#renderErrorMessage.bind(this));
        this.state.messageRenderers.set(RENDERERS.WIKI_REFERENCE, this.#renderWikiReferenceMessage.bind(this));
      }
      
      /**
       * Set up keyboard shortcuts
       */
      #setupKeyboardShortcuts() {
        // Map of shortcut configurations
        this.keyboardShortcuts = new Map([
          ['Escape', {
            handler: () => this.#handleEscapeKey(),
            description: 'Close open dialogs'
          }],
          ['n+Ctrl', {
            handler: () => this.eventBus.emit('newChatRequested'),
            description: 'New chat'
          }],
          ['/', {
            handler: () => this.#focusInput(),
            description: 'Focus input'
          }],
          ['ArrowUp+Alt', {
            handler: () => this.#navigateToPreviousMessage(),
            description: 'Previous message'
          }],
          ['ArrowDown+Alt', {
            handler: () => this.#navigateToNextMessage(),
            description: 'Next message'
          }],
          ['b+Ctrl', {
            handler: (e) => this.#formatText(e, '**', '**'),
            description: 'Bold text',
            allowInInput: true
          }],
          ['i+Ctrl', {
            handler: (e) => this.#formatText(e, '*', '*'),
            description: 'Italic text',
            allowInInput: true
          }],
          ['`+Ctrl', {
            handler: (e) => this.#formatText(e, '`', '`'),
            description: 'Inline code',
            allowInInput: true
          }],
          ['z+Ctrl', {
            handler: () => this.#undo(),
            description: 'Undo'
          }],
          ['z+Ctrl+Shift', {
            handler: () => this.#redo(),
            description: 'Redo'
          }],
          ['?', {
            handler: () => this.#showKeyboardShortcuts(),
            description: 'Keyboard shortcuts'
          }]
        ]);
      }
      
      /**
       * Apply theme to the UI
       */
      #applyTheme() {
        // Check for dark mode
        const isDarkTheme = document.documentElement.classList.contains('dark') || 
                           document.body.classList.contains('dark-theme') ||
                           (!document.documentElement.classList.contains('light') && 
                            !document.body.classList.contains('light-theme') &&
                            matchMedia('(prefers-color-scheme: dark)').matches);
        
        // Apply theme attribute
        document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
        
        // Apply high contrast if needed
        if (this.config.accessibility.highContrast) {
          document.documentElement.setAttribute('data-high-contrast', 'true');
        }
        
        // Apply reduced motion if needed
        if (this.config.animations.reducedMotion) {
          document.documentElement.setAttribute('data-reduced-motion', 'true');
        }
        
        // Update code theme
        if (this.components.codeHighlighter) {
          this.components.codeHighlighter.updateTheme(isDarkTheme ? 'dark' : 'light');
        }
      }
      
      /**
       * Set up accessibility features
       */
      #setupAccessibility() {
        // Add needed ARIA attributes to chat container
        const chatContainer = this.state.elements.get('chatContainer');
        if (chatContainer) {
          if (!chatContainer.getAttribute('aria-live')) {
            chatContainer.setAttribute('aria-live', 'polite');
          }
          if (!chatContainer.getAttribute('role')) {
            chatContainer.setAttribute('role', 'log');
          }
        }
        
        // Set up input field accessibility
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          if (!userInput.getAttribute('aria-label')) {
            userInput.setAttribute('aria-label', 'Message Claude');
          }
        }
        
        // Ensure all UI controls have proper attributes
        const sendButton = this.state.elements.get('sendButton');
        if (sendButton && !sendButton.getAttribute('aria-label')) {
          sendButton.setAttribute('aria-label', 'Send message');
        }
      }
      
      /**
       * Handle input changes for auto-growing textarea
       */
      #handleInputChange(e) {
        const textarea = e.target;
        
        // Reset height to auto to get proper scrollHeight
        textarea.style.height = 'auto';
        
        // Set new height with min/max bounds
        const newHeight = Math.min(
          Math.max(textarea.scrollHeight, 40),
          300
        );
        textarea.style.height = `${newHeight}px`;
        
        // Update empty state
        const hasContent = textarea.value.trim().length > 0;
        textarea.classList.toggle('has-content', hasContent);
        
        // Enable/disable send button
        const sendButton = this.state.elements.get('sendButton');
        if (sendButton) {
          sendButton.disabled = !hasContent;
          sendButton.setAttribute('aria-disabled', !hasContent ? 'true' : 'false');
        }
        
        // Notify of input change
        this.eventBus.emit('inputChanged', {
          content: textarea.value,
          isEmpty: !hasContent
        });
      }
      
      /**
       * Handle input keydown events
       */
      #handleInputKeydown(e) {
        const textarea = e.target;
        
        // Handle Enter without shift for message sending
        if (e.key === 'Enter' && !e.shiftKey) {
          const value = textarea.value.trim();
          
          if (value) {
            e.preventDefault();
            this.#sendMessage(value);
          }
        }
      }
      
      /**
       * Handle send button click
       */
      #handleSendClick() {
        const userInput = this.state.elements.get('userInput');
        if (!userInput) return;
        
        const value = userInput.value.trim();
        if (value) {
          this.#sendMessage(value);
        }
      }
      
      /**
       * Handle keyboard events for shortcuts
       */
      #handleKeyDown(e) {
        // Skip handling if in an input/textarea and shortcut doesn't allow it
        const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        
        // Build shortcut key
        let shortcutKey = e.key;
        
        // Add modifiers in order
        if (e.ctrlKey || e.metaKey) shortcutKey += '+Ctrl';
        if (e.altKey) shortcutKey += '+Alt';
        if (e.shiftKey) shortcutKey += '+Shift';
        
        // Look up the shortcut
        const shortcut = this.keyboardShortcuts.get(shortcutKey);
        
        // Execute if found and applicable
        if (shortcut && (!isInInput || shortcut.allowInInput)) {
          const result = shortcut.handler(e);
          
          // Prevent default unless handler explicitly returned false
          if (result !== false) {
            e.preventDefault();
          }
        }
      }
      
      /**
       * Handle theme changes
       */
      #handleThemeChange(e) {
        const isDark = e.matches;
        
        // Toggle dark class
        document.documentElement.classList.toggle('dark', isDark);
        
        // Update attribute
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        
        // Update code theme
        if (this.components.codeHighlighter) {
          this.components.codeHighlighter.updateTheme(isDark ? 'dark' : 'light');
        }
        
        // Emit theme change event
        this.eventBus.emit('themeChanged', { theme: isDark ? 'dark' : 'light' });
      }
      
      /**
       * Handle message actions
       */
      #handleMessageAction(action, messageId) {
        // Get message data
        const message = this.state.messages.get(messageId);
        if (!message) return;
        
        switch (action) {
          case 'copy':
            this.#copyMessageToClipboard(messageId);
            break;
          case 'edit':
            this.#enableMessageEditing(messageId);
            break;
          case 'regenerate':
            this.eventBus.emit('regenerateMessage', { messageId });
            break;
          case 'copy-code':
            this.#copyCodeFromMessage(messageId);
            break;
          case 'cite':
            this.#citeSourcesFromMessage(messageId);
            break;
          case 'save':
            this.#saveMessageAsNote(messageId);
            break;
          case 'delete':
            this.#confirmMessageDeletion(messageId);
            break;
        }
        
        // Emit action event
        this.eventBus.emit('messageAction', {
          action,
          messageId,
          message: message.data
        });
      }
      
      /**
       * Handle Escape key
       */
      #handleEscapeKey() {
        // Close popups in priority order
        
        // Any open modal
        const modal = document.querySelector('.cc-modal:not(.cc-hidden)');
        if (modal) {
          modal.classList.add('cc-hidden');
          return true;
        }
        
        // Context menu
        const contextMenu = document.querySelector('.cc-context-menu');
        if (contextMenu) {
          contextMenu.remove();
          return true;
        }
        
        // Format menu
        const formatMenu = this.state.elements.get('formatMenu');
        if (formatMenu && !formatMenu.hidden) {
          formatMenu.hidden = true;
          return true;
        }
        
        // Settings panel
        const settingsPanel = this.state.elements.get('settingsPanel');
        if (settingsPanel?.classList.contains('open')) {
          settingsPanel.classList.remove('open');
          return true;
        }
        
        return false;
      }
      
      /**
       * Navigate to previous message
       */
      #navigateToPreviousMessage() {
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => a.data.timestamp - b.data.timestamp);
        
        if (messages.length === 0) return false;
        
        const activeIndex = this.state.activeMessageId 
          ? messages.findIndex(m => m.id === this.state.activeMessageId)
          : -1;
        
        const prevIndex = activeIndex > 0 ? activeIndex - 1 : messages.length - 1;
        const prevMessage = messages[prevIndex];
        
        this.scrollToMessage(prevMessage.id, { focus: true });
        this.state.activeMessageId = prevMessage.id;
        
        return true;
      }
      
      /**
       * Navigate to next message
       */
      #navigateToNextMessage() {
        const messages = Array.from(this.state.messages.values())
          .sort((a, b) => a.data.timestamp - b.data.timestamp);
        
        if (messages.length === 0) return false;
        
        const activeIndex = this.state.activeMessageId 
          ? messages.findIndex(m => m.id === this.state.activeMessageId)
          : -1;
        
        const nextIndex = activeIndex < messages.length - 1 ? activeIndex + 1 : 0;
        const nextMessage = messages[nextIndex];
        
        this.scrollToMessage(nextMessage.id, { focus: true });
        this.state.activeMessageId = nextMessage.id;
        
        return true;
      }
      
      /**
       * Format selected text in input
       */
      #formatText(e, prefix, suffix) {
        const userInput = this.state.elements.get('userInput');
        if (!userInput) return false;
        
        // Only apply in the textarea
        if (document.activeElement !== userInput) return false;
        
        e.preventDefault();
        
        const { selectionStart, selectionEnd, value } = userInput;
        
        // Get selected text
        const selectedText = value.substring(selectionStart, selectionEnd);
        
        // Format text
        const formattedText = prefix + selectedText + suffix;
        
        // Replace selected text with formatted text
        const newValue = value.substring(0, selectionStart) + 
                        formattedText + 
                        value.substring(selectionEnd);
        
        // Update value and selection
        userInput.value = newValue;
        
        // Set cursor position after the inserted text
        const newCursorPos = selectionStart + formattedText.length;
        userInput.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event to update UI
        userInput.dispatchEvent(new Event('input'));
        
        return true;
      }
      
      /**
       * Focus the input field
       */
      #focusInput() {
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          userInput.focus();
          return true;
        }
        return false;
      }
      
      /**
       * Send a message
       */
      #sendMessage(content) {
        // Clear input field
        const userInput = this.state.elements.get('userInput');
        if (userInput) {
          userInput.value = '';
          userInput.style.height = 'auto';
          userInput.classList.remove('has-content');
          
          // Disable send button
          const sendButton = this.state.elements.get('sendButton');
          if (sendButton) {
            sendButton.disabled = true;
            sendButton.setAttribute('aria-disabled', 'true');
          }
          
          // Focus back to input for next message
          userInput.focus();
        }
        
        // Emit event for application to handle
        this.eventBus.emit('sendMessage', { content });
      }
      
      /**
       * Show initialization error
       */
      #showInitializationError(error) {
        // Create error container if needed
        const errorContainer = document.getElementById('claude-init-error') || 
          DOM.create('div', {
            attrs: { id: 'claude-init-error' },
            props: { className: 'cc-init-error' }
          });
        
        // Clear existing content
        DOM.empty(errorContainer);
        
        // Add error message
        const errorTitle = DOM.create('h3', {
          props: { textContent: 'Failed to initialize Claude Chat UI' }
        });
        
        const errorMessage = DOM.create('p', {
          props: { textContent: error.message || 'An unknown error occurred' }
        });
        
        const errorDetails = DOM.create('pre', {
          props: { textContent: error.stack || error.toString() }
        });
        
        const retryButton = DOM.create('button', {
          props: { 
            className: CSS.ui.button + ' ' + CSS.ui.primary,
            textContent: 'Retry Initialization'
          },
          events: {
            click: () => {
              errorContainer.remove();
              this.init();
            }
          }
        });
        
        errorContainer.appendChild(errorTitle);
        errorContainer.appendChild(errorMessage);
        errorContainer.appendChild(errorDetails);
        errorContainer.appendChild(retryButton);
        
        // Add to document
        document.body.appendChild(errorContainer);
      }
      
      /**
       * Copy message to clipboard
       */
      #copyMessageToClipboard(messageId) {
        const message = this.state.messages.get(messageId);
        if (!message) return;
        
        // Get content
        const { data } = message;
        const content = data.content;
        
        // Copy to clipboard
        navigator.clipboard.writeText(content)
          .then(() => {
            this.#showToast({
              type: 'success',
              title: 'Copied to clipboard',
              duration: 2000
            });
          })
          .catch(err => {
            console.error('Failed to copy message:', err);
            this.#showToast({
              type: 'error',
              title: 'Failed to copy',
              message: 'Could not copy message to clipboard',
              duration: 3000
            });
          });
      }
      
      /**
       * Enable message editing
       */
      #enableMessageEditing(messageId) {
        const message = this.state.messages.get(messageId);
        if (!message || message.data.role !== 'human') return;
        
        const { element, data } = message;
        
        // Find content element
        const contentElement = element.querySelector(`.${CSS.content.wrapper}`);
        if (!contentElement) return;
        
        // Get current content
        const currentContent = data.content;
        
        // Create editor
        const editor = DOM.create('div', {
          props: { className: 'cc-msg-editor' },
          children: [
            DOM.create('textarea', {
              props: {
                className: 'cc-msg-editor-textarea',
                value: currentContent,
                rows: Math.min(10, currentContent.split('\n').length + 1)
              }
            }),
            DOM.create('div', {
              props: { className: 'cc-msg-editor-actions' },
              children: [
                DOM.create('button', {
                  props: {
                    className: `${CSS.ui.button} ${CSS.ui.secondary}`,
                    textContent: 'Cancel'
                  },
                  events: {
                    click: () => this.#cancelMessageEditing(messageId)
                  }
                }),
                DOM.create('button', {
                  props: {
                    className: `${CSS.ui.button} ${CSS.ui.primary}`,
                    textContent: 'Save'
                  },
                  events: {
                    click: (e) => {
                      const textarea = element.querySelector('.cc-msg-editor-textarea');
                      if (textarea) {
                        this.#saveMessageEdit(messageId, textarea.value);
                      }
                    }
                  }
                })
              ]
            })
          ]
        });
        
        // Replace content
        DOM.empty(contentElement);
        contentElement.appendChild(editor);
        
        // Add editing class
        element.classList.add('editing');
        
        // Focus textarea
        const textarea = editor.querySelector('textarea');
        textarea.focus();
        
        // Select all text
        textarea.setSelectionRange(0, textarea.value.length);
        
        // Notify
        this.eventBus.emit('messageEditingStarted', { messageId });
      }
      
      /**
       * Cancel message editing
       */
      #cancelMessageEditing(messageId) {
        const message = this.state.messages.get(messageId);
        if (!message) return;
        
        const { element, data } = message;
        
        // Get renderer for message
        const renderStrategy = this.#getRendererForMessage(data);
        const renderer = this.state.messageRenderers.get(renderStrategy);
        
        // Find content element
        const contentElement = element.querySelector(`.${CSS.content.wrapper}`);
        if (!contentElement) return;
        
        // Reset content
        DOM.empty(contentElement);
        if (renderer) {
          renderer(contentElement, data);
        }
        
        // Remove editing class
        element.classList.remove('editing');
        
        // Notify
        this.eventBus.emit('messageEditingCanceled', { messageId });
      }
      
      /**
       * Save message edit
       */
      #saveMessageEdit(messageId, newContent) {
        const message = this.state.messages.get(messageId);
        if (!message) return;
        
        const { data } = message;
        
        // Save state for undo
        this.#saveToUndoStack({
          type: 'edit',
          messageId,
          previousContent: data.content,
          newContent
        });
        
        // Update message in place
        this.updateMessage(messageId, {
          content: newContent,
          edited: true,
          editTimestamp: Date.now()
        }, { updateTimestamp: false, partial: true });
      }
      
      /**
       * Copy code from message
       */
      #copyCodeFromMessage(messageId) {
        const message = this.state.messages.get(messageId);
        if (!message) return;
        
        const { element } = message;
        
        // Find code blocks
        const codeBlocks = element.querySelectorAll('pre code');
        if (!codeBlocks.length) return;
        
        // If only one code block, copy it directly
        if (codeBlocks.length === 1) {
          navigator.clipboard.writeText(codeBlocks[0].textContent)
            .then(() => {
              this.#showToast({
                type: 'success',
                title: 'Code copied to clipboard',
                duration: 2000
              });
            })
            .catch(err => {
              console.error('Failed to copy code:', err);
              this.#showToast({
                type: 'error',
                title: 'Failed to copy',
                message: 'Could not copy code to clipboard',
                duration: 3000
              });
            });
        } else {
          // Show code block selection dialog for multiple blocks
          this.#showCodeSelectionDialog(messageId, Array.from(codeBlocks));
        }
      }
      
      /**
       * Show code selection dialog
       */
      #showCodeSelectionDialog(messageId, codeBlocks) {
        // Create modal with a list of code blocks
        const modal = DOM.create('div', {
          props: { className: CSS.ui.modal + ' code-selection-modal' },
          children: [
            DOM.create('div', {
              props: { className: 'modal-content' },
              children: [
                // Header
                DOM.create('div', {
                  props: { className: 'modal-header' },
                  children: [
                    DOM.create('h3', { props: { textContent: 'Select Code Block to Copy' } }),
                    DOM.create('button', {
                      props: {
                        className: 'modal-close',
                        innerHTML: '&times;'
                      },
                      attrs: { 'aria-label': 'Close' },
                      events: { click: () => modal.remove() }
                    })
                  ]
                }),
                
                // Code blocks list
                DOM.create('div', {
                  props: { className: 'code-blocks-list' },
                  children: codeBlocks.map((code, index) => {
                    // Get language if available
                    const langMatch = code.className?.match(/language-(\w+)/);
                    const language = langMatch ? langMatch[1] : '';
                    
                    return DOM.create('div', {
                      props: { className: 'code-preview' },
                      children: [
                        // Language label
                        language ? DOM.create('div', {
                          props: {
                            className: 'code-lang-label',
                            textContent: language
                          }
                        }) : null,
                        
                        // Code snippet
                        DOM.create('pre', {
                          props: { className: 'code-snippet' },
                          children: [
                            DOM.create('code', {
                              props: {
                                textContent: code.textContent.slice(0, 150) + 
                                           (code.textContent.length > 150 ? '...' : '')
                              }
                            })
                          ]
                        }),
                        
                        // Copy button
                        DOM.create('button', {
                          props: {
                            className: 'copy-block-btn',
                            textContent: 'Copy'
                          },
                          events: {
                            click: () => {
                              navigator.clipboard.writeText(code.textContent)
                                .then(() => {
                                  modal.remove();
                                  this.#showToast({
                                    type: 'success',
                                    title: 'Code copied to clipboard',
                                    duration: 2000
                                  });
                                })
                                .catch(err => {
                                  console.error('Failed to copy code:', err);
                                  this.#showToast({
                                    type: 'error',
                                    title: 'Failed to copy',
                                    message: 'Could not copy code to clipboard',
                                    duration: 3000
                                  });
                                });
                            }
                          }
                        })
                      ]
                    });
                  }).filter(Boolean)
                }),
                
                // Copy all button
                DOM.create('button', {
                  props: {
                    className: `${CSS.ui.button} ${CSS.ui.primary} copy-all-btn`,
                    textContent: 'Copy All Blocks'
                  },
                  events: {
                    click: () => {
                      const allCode = codeBlocks
                        .map(block => block.textContent)
                        .join('\n\n');
                        
                      navigator.clipboard.writeText(allCode)
                        .then(() => {
                          modal.remove();
                          this.#showToast({
                            type: 'success',
                            title: 'All code blocks copied',
                            message: `${codeBlocks.length} blocks copied to clipboard`,
                            duration: 2000
                          });
                        })
                        .catch(err => {
                          console.error('Failed to copy all code:', err);
                          this.#showToast({
                            type: 'error',
                            title: 'Failed to copy',
                            message: 'Could not copy all code blocks',
                            duration: 3000
                          });
                        });
                    }
                  }
                })
              ]
            })
          ]
        });
        
        // Add to body
        document.body.appendChild(modal);
        
        // Close when clicking outside
        modal.addEventListener('click', e => {
          if (e.target === modal) modal.remove();
        });
      }
      
      /**
       * Cite sources from message
       */
      #citeSourcesFromMessage(messageId) {
        const message = this.state.messages.get(messageId);
        if (!message) return;
        
        const { data } = message;
        
        // Handle Wikipedia references
        if (data.type === 'wikiReference' || (data.metadata?.source?.includes('wikipedia.org'))) {
          const article = data.metadata || this.state.wikipediaArticle;
          
          if (article) {
            this.generateCitation(article);
          } else if (data.metadata?.source) {
            // Try to load article first
            this.loadWikipediaArticle(data.metadata.source)
              .then(article => {
                if (article) {
                  this.generateCitation(article);
                }
              });
          }
        }
        // Regular citation
        else if (data.citation) {
          this.#showToast({
            type: 'info',
            title: 'Citation',
            message: data.citation,
            duration: 8000,
            actions: [
              {
                label: 'Copy',
                callback: () => {
                  navigator.clipboard.writeText(data.citation);
                  this.#showToast({
                    type: 'success',
                    title: 'Citation copied',
                    duration: 2000
                  });
                }
              }
            ]
          });
        }
        // No citation available
        else {
          this.#showToast({
            type: 'info',
            title: 'No citation available',
            message: 'This message does not have citation information',
            duration: 3000
          });
        }
      }
      
      /**
       * Save message as note
       */
      #saveMessageAsNote(messageId) {
        const message = this.state.messages.get(messageId);
        if (!message) return;
        
        const { data } = message;
        
        try {
          // Prepare content
          const content = data.content;
          
          // Create filename with timestamp
          const date = new Date().toISOString().split('T')[0];
          const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
          const role = data.role === 'human' ? 'user' : 'claude';
          const filename = `claude-chat_${role}_${date}_${time}.txt`;
          
          // Create and download file
          const blob = new Blob([content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          
          this.#showToast({
            type: 'success',
            title: 'Note saved',
            message: `Saved as ${filename}`,
            duration: 3000
          });
        } catch (err) {
          console.error('Failed to save note:', err);
          
          this.#showToast({
            type: 'error',
            title: 'Failed to save note',
            message: err.message || 'Unknown error occurred',
            duration: 3000
          });
        }
      }
      
      /**
       * Confirm message deletion
       */
      #confirmMessageDeletion(messageId) {
        // Create confirmation dialog
        const dialog = DOM.create('div', {
          props: { className: CSS.ui.modal + ' confirmation-dialog' },
          children: [
            DOM.create('div', {
              props: { className: 'modal-content' },
              children: [
                // Header
                DOM.create('div', {
                  props: { className: 'modal-header' },
                  children: [
                    DOM.create('h3', { props: { textContent: 'Delete Message?' } }),
                    DOM.create('button', {
                      props: {
                        className: 'modal-close',
                        innerHTML: '&times;'
                      },
                      attrs: { 'aria-label': 'Close' },
                      events: { click: () => dialog.remove() }
                    })
                  ]
                }),
                
                // Message
                DOM.create('p', {
                  props: {
                    className: 'dialog-message',
                    textContent: 'Are you sure you want to delete this message? This action cannot be undone.'
                  }
                }),
                
                // Actions
                DOM.create('div', {
                  props: { className: 'dialog-actions' },
                  children: [
                    DOM.create('button', {
                      props: {
                        className: `${CSS.ui.button} ${CSS.ui.secondary}`,
                        textContent: 'Cancel'
                      },
                      events: { click: () => dialog.remove() }
                    }),
                    DOM.create('button', {
                      props: {
                        className: `${CSS.ui.button} ${CSS.ui.danger}`,
                        textContent: 'Delete'
                      },
                      events: {
                        click: () => {
                          dialog.remove();
                          this.removeMessage(messageId);
                        }
                      }
                    })
                  ]
                })
              ]
            })
          ]
        });
        
        // Add to body
        document.body.appendChild(dialog);
        
        // Close when clicking outside
        dialog.addEventListener('click', e => {
          if (e.target === dialog) dialog.remove();
        });
      }
      
      /**
       * Show keyboard shortcuts dialog
       */
      #showKeyboardShortcuts() {
        // Group shortcuts by category
        const categories = {
          'General': [],
          'Navigation': [],
          'Messages': [],
          'Formatting': []
        };
        
        // Fill categories
        for (const [shortcutKey, shortcut] of this.keyboardShortcuts.entries()) {
          const { description, handler } = shortcut;
          
          // Format key display
          const keyDisplay = this.#formatKeyboardShortcut(shortcutKey);
          
          // Categorize based on description
          if (description.includes('message') || description.includes('Message')) {
            categories['Messages'].push({ key: keyDisplay, description });
          } else if (description.includes('text') || description.includes('code')) {
            categories['Formatting'].push({ key: keyDisplay, description });
          } else if (description.includes('focus') || description.includes('scroll')) {
            categories['Navigation'].push({ key: keyDisplay, description });
          } else {
            categories['General'].push({ key: keyDisplay, description });
          }
        }
        
        // Create modal
        const modal = DOM.create('div', {
          props: { className: CSS.ui.modal + ' shortcuts-modal' },
          children: [
            DOM.create('div', {
              props: { className: 'modal-content' },
              children: [
                // Header
                DOM.create('div', {
                  props: { className: 'modal-header' },
                  children: [
                    DOM.create('h3', { props: { textContent: 'Keyboard Shortcuts' } }),
                    DOM.create('button', {
                      props: {
                        className: 'modal-close',
                        innerHTML: '&times;'
                      },
                      attrs: { 'aria-label': 'Close' },
                      events: { click: () => modal.remove() }
                    })
                  ]
                }),
                
                // Shortcuts by category
                DOM.create('div', {
                  props: { className: 'shortcuts-content' },
                  children: Object.entries(categories)
                    .filter(([_, shortcuts]) => shortcuts.length > 0)
                    .map(([category, shortcuts]) => 
                      DOM.create('div', {
                        props: { className: 'shortcuts-category' },
                        children: [
                          DOM.create('h4', { props: { textContent: category } }),
                          DOM.create('div', {
                            props: { className: 'shortcuts-list' },
                            children: shortcuts.map(shortcut => 
                              DOM.create('div', {
                                props: { className: 'shortcut-item' },
                                children: [
                                  DOM.create('div', {
                                    props: {
                                      className: 'shortcut-key',
                                      innerHTML: shortcut.key
                                    }
                                  }),
                                  DOM.create('div', {
                                    props: {
                                      className: 'shortcut-description',
                                      textContent: shortcut.description
                                    }
                                  })
                                ]
                              })
                            )
                          })
                        ]
                      })
                  )
                })
              ]
            })
          ]
        });
        
        // Add to body
        document.body.appendChild(modal);
        
        // Close when clicking outside
        modal.addEventListener('click', e => {
          if (e.target === modal) modal.remove();
        });
        
        // Add Escape key handler
        const handleEscape = e => {
          if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
          }
        };
        
        document.addEventListener('keydown', handleEscape);
      }
      
      /**
       * Format keyboard shortcut for display
       */
      #formatKeyboardShortcut(shortcutKey) {
        const parts = shortcutKey.split('+');
        const keyName = parts[0];
        const hasCtrl = parts.includes('Ctrl');
        const hasAlt = parts.includes('Alt');
        const hasShift = parts.includes('Shift');
        
        const keyLabels = [];
        
        // Add modifiers
        if (hasCtrl) keyLabels.push('<kbd>Ctrl</kbd>');
        if (hasAlt) keyLabels.push('<kbd>Alt</kbd>');
        if (hasShift) keyLabels.push('<kbd>Shift</kbd>');
        
        // Format main key
        let keyDisplay = keyName;
        
        // Special key formatting
        switch (keyName) {
          case 'ArrowUp': keyDisplay = '↑'; break;
          case 'ArrowDown': keyDisplay = '↓'; break;
          case 'ArrowLeft': keyDisplay = '←'; break;
          case 'ArrowRight': keyDisplay = '→'; break;
          case 'Enter': keyDisplay = 'Enter'; break;
          case 'Escape': keyDisplay = 'Esc'; break;
        }
        
        keyLabels.push(`<kbd>${keyDisplay}</kbd>`);
        
        return keyLabels.join(' + ');
      }
      
      /**
       * Save to undo stack
       */
      #saveToUndoStack(action) {
        // Add timestamp for tracking
        action.timestamp = Date.now();
        
        // Add to undo stack
        this.state.undoStack.push(action);
        
        // Clear redo stack on new action
        this.state.redoStack = [];
        
        // Limit stack size
        if (this.state.undoStack.length > 50) {
          this.state.undoStack.shift();
        }
      }
      
      /**
       * Undo last action
       */
      #undo() {
        if (this.state.undoStack.length === 0) return false;
        
        // Get last action
        const action = this.state.undoStack.pop();
        
        // Add to redo stack
        this.state.redoStack.push(action);
        
        // Execute undo based on action type
        switch (action.type) {
          case 'edit':
            // Restore previous content
            this.updateMessage(action.messageId, {
              content: action.previousContent
            }, { addToHistory: false, partial: true });
            break;
            
          case 'remove':
            // Restore deleted message
            this.addMessage(action.data, { 
              addToHistory: false
            });
            break;
            
          case 'update':
            // Restore previous data
            this.updateMessage(action.messageId, action.previousData, { 
              addToHistory: false
            });
            break;
        }
        
        // Show toast
        this.#showToast({
          type: 'info',
          title: 'Undo',
          message: 'Last action undone',
          duration: 2000
        });
        
        return true;
      }
      
      /**
       * Redo last undone action
       */
      #redo() {
        if (this.state.redoStack.length === 0) return false;
        
        // Get last undone action
        const action = this.state.redoStack.pop();
        
        // Add back to undo stack
        this.state.undoStack.push(action);
        
        // Execute redo based on action type
        switch (action.type) {
          case 'edit':
            // Apply new content
            this.updateMessage(action.messageId, {
              content: action.newContent
            }, { addToHistory: false, partial: true });
            break;
            
          case 'remove':
            // Remove message again
            this.removeMessage(action.messageId, { addToHistory: false });
            break;
            
          case 'update':
            // Apply updated data
            this.updateMessage(action.messageId, action.currentData, { 
              addToHistory: false
            });
            break;
        }
        
        // Show toast
        this.#showToast({
          type: 'info',
          title: 'Redo',
          message: 'Action redone',
          duration: 2000
        });
        
        return true;
      }
      
      /**
       * Show toast notification
       */
      #showToast(options = {}) {
        const {
          type = 'info',
          title = '',
          message = '',
          duration = 5000,
          actions = []
        } = options;
        
        // Add to queue
        this.state.toastQueue.push({
          type,
          title,
          message,
          duration,
          actions,
          id: `toast-${Date.now()}`
        });
        
        // Process queue
        this.#processToastQueue();
      }
      
      /**
       * Process toast queue
       */
      #processToastQueue() {
        if (this.state.toastQueue.length === 0) return;
        
        const toastContainer = this.state.elements.get('toastContainer');
        if (!toastContainer) return;
        
        // Get next toast
        const toast = this.state.toastQueue.shift();
        
        // Create toast element
        const toastElement = DOM.create('div', {
          attrs: {
            'role': 'alert',
            'aria-live': 'polite',
            'id': toast.id
          },
          props: {
            className: `${CSS.ui.toast} ${CSS.ui.toast}--${toast.type}`
          },
          children: [
            // Toast content
            DOM.create('div', {
              props: { className: `${CSS.ui.toast}-content` },
              children: [
                // Icon
                DOM.create('div', {
                  props: { 
                    className: `${CSS.ui.toast}-icon`,
                    innerHTML: this.#getToastIcon(toast.type)
                  }
                }),
                
                // Text content
                DOM.create('div', {
                  props: { className: `${CSS.ui.toast}-text` },
                  children: [
                    // Title
                    toast.title ? DOM.create('div', {
                      props: {
                        className: `${CSS.ui.toast}-title`,
                        textContent: toast.title
                      }
                    }) : null,
                    
                    // Message
                    toast.message ? DOM.create('div', {
                      props: {
                        className: `${CSS.ui.toast}-message`,
                        textContent: toast.message
                      }
                    }) : null
                  ].filter(Boolean)
                })
              ]
            }),
            
            // Close button
            DOM.create('button', {
              attrs: {
                'aria-label': 'Close notification',
                'type': 'button'
              },
              props: {
                className: `${CSS.ui.toast}-close`,
                innerHTML: '&times;'
              },
              events: {
                click: () => this.#removeToast(toastElement)
              }
            }),
            
            // Actions
            toast.actions.length > 0 ? DOM.create('div', {
              props: { className: `${CSS.ui.toast}-actions` },
              children: toast.actions.map(action => 
                DOM.create('button', {
                  props: {
                    className: `${CSS.ui.toast}-action`,
                    textContent: action.label
                  },
                  events: {
                    click: () => {
                      if (action.callback) {
                        action.callback();
                      }
                      this.#removeToast(toastElement);
                    }
                  }
                })
              )
            }) : null
          ].filter(Boolean)
        });
        
        // Add to container
        toastContainer.appendChild(toastElement);
        
        // Animate in
        this.components.animationController.fadeIn(toastElement);
        
        // Auto-remove after duration
        if (toast.duration > 0) {
          setTimeout(() => {
            this.#removeToast(toastElement);
          }, toast.duration);
        }
        
        // Process next toast after a delay
        if (this.state.toastQueue.length > 0) {
          setTimeout(() => {
            this.#processToastQueue();
          }, 250);
        }
      }
      
      /**
       * Remove toast notification
       */
      #removeToast(toastElement) {
        if (!toastElement) return;
        
        // Animate out
        this.components.animationController
          .fadeOut(toastElement, { duration: 250 })
          .then(() => {
            toastElement.remove();
            
            // Process next toast if any
            if (this.state.toastQueue.length > 0) {
              this.#processToastQueue();
            }
          });
      }
      
      /**
       * Get toast icon based on type
       */
      #getToastIcon(type) {
        switch (type) {
          case 'success':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 12l2 2 4-4"></path>
                  </svg>`;
          case 'error':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>`;
          case 'warning':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>`;
          case 'info':
          default:
            return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>`;
        }
      }
      
      /**
       * Announce a message to screen readers
       */
      #announceToScreenReader(text) {
        if (!this.config.accessibility.announceMessages) return;
        
        const liveRegion = this.state.elements.get('liveRegion');
        if (liveRegion) {
          liveRegion.textContent = text;
        }
      }
      
      /**
       * Get message renderer strategy
       */
      #getRendererForMessage(message) {
        // Check for streaming
        if (this.state.streaming.active && 
            this.state.streaming.messageId === message.id) {
          return RENDERERS.STREAMING;
        }
        
        // Check message type
        if (message.type) {
          switch (message.type) {
            case 'thinking': return RENDERERS.THINKING;
            case 'error': return RENDERERS.ERROR;
            case 'image': return RENDERERS.IMAGE;
            case 'code': return RENDERERS.CODE;
            case 'wikiReference': return RENDERERS.WIKI_REFERENCE;
          }
        }
        
        // Check for error
        if (message.error) {
          return RENDERERS.ERROR;
        }
        
        // Check for files
        if (message.files?.length > 0) {
          return RENDERERS.FILE;
        }
        
        // Check content type
        if (message.content && typeof message.content === 'object') {
          if (message.content.type === 'image') {
            return RENDERERS.IMAGE;
          }
        }
        
        // Use markdown if enabled and available
        if (this.config.markdown.enabled && 
            this.components.markdownRenderer && 
            typeof message.content === 'string') {
          return RENDERERS.MARKDOWN;
        }
        
        // Default
        return RENDERERS.DEFAULT;
      }
      
      /**
       * Default message renderer
       */
      #renderDefaultMessage(container, message) {
        if (typeof message.content === 'string') {
          const textContainer = DOM.create('div', {
            props: { 
              className: CSS.content.raw,
              textContent: message.content
            }
          });
          container.appendChild(textContainer);
        } else if (message.content && typeof message.content === 'object') {
          try {
            const codeContainer = DOM.create('pre', {
              props: {
                className: 'object-json',
                textContent: JSON.stringify(message.content, null, 2)
              }
            });
            container.appendChild(codeContainer);
          } catch (e) {
            container.textContent = '[Complex content]';
          }
        } else {
          container.textContent = '';
        }
      }
      
      /**
       * Streaming message renderer
       */
      #renderStreamingMessage(container, message) {
        // Add streaming class
        container.classList.add(CSS.content.streaming);
        
        // Get streaming content
        const content = this.state.streaming.content || message.content || '';
        
        // Create content wrapper
        const contentWrapper = DOM.create('div', {
          props: { className: 'streaming-content' }
        });
        
        // Render with markdown if enabled
        if (this.config.markdown.enabled && this.components.markdownRenderer) {
          this.components.markdownRenderer.render(content)
            .then(html => {
              contentWrapper.innerHTML = html;
              
              // Add typing cursor
              const cursor = DOM.create('span', {
                props: { className: 'typing-cursor' }
              });
              contentWrapper.appendChild(cursor);
              
              // Enhance code blocks
              this.#enhanceCodeBlocks(contentWrapper);
            })
            .catch(err => {
              console.error('Error rendering markdown in streaming', err);
              contentWrapper.textContent = content;
              
              // Add typing cursor
              const cursor = DOM.create('span', {
                props: { className: 'typing-cursor' }
              });
              contentWrapper.appendChild(cursor);
            });
        } else {
          contentWrapper.textContent = content;
          
          // Add typing cursor
          const cursor = DOM.create('span', {
            props: { className: 'typing-cursor' }
          });
          contentWrapper.appendChild(cursor);
        }
        
        container.appendChild(contentWrapper);
      }
      
      /**
       * Thinking message renderer
       */
      #renderThinkingMessage(container, message) {
        // Add thinking class
        container.classList.add(CSS.content.thinking);
        
        // Create thinking content
        const thinkingContent = DOM.create('div', {
          props: { className: 'thinking-indicator' },
          children: [
            DOM.create('span', {
              props: {
                className: 'thinking-text',
                textContent: message.content || 'Thinking...'
              }
            }),
            DOM.create('div', {
              props: { className: 'thinking-dots' },
              children: [
                DOM.create('span', { props: { className: 'dot' } }),
                DOM.create('span', { props: { className: 'dot' } }),
                DOM.create('span', { props: { className: 'dot' } })
              ]
            })
          ]
        });
        
        container.appendChild(thinkingContent);
      }
      
      /**
       * Markdown message renderer
       */
      async #renderMarkdownMessage(container, message) {
        if (!this.components.markdownRenderer || typeof message.content !== 'string') {
          return this.#renderDefaultMessage(container, message);
        }
        
        // Add markdown class
        container.classList.add(CSS.content.markdown);
        
        try {
          // Render markdown
          const html = await this.components.markdownRenderer.render(message.content);
          
          // Update container
          container.innerHTML = html;
          
          // Enhance code blocks
          this.#enhanceCodeBlocks(container);
          
          // Process Wikipedia links
          if (message.content.includes('wikipedia.org')) {
            this.#processWikipediaLinks(container);
          }
        } catch (error) {
          console.error('Error rendering markdown:', error);
          this.#renderDefaultMessage(container, message);
        }
      }
      
      /**
       * Code message renderer
       */
      async #renderCodeMessage(container, message) {
        // Add code class
        container.classList.add(CSS.content.code);
        
        // Create code block
        const codeBlock = DOM.create('div', {
          props: { className: 'cc-code-block' }
        });
        
        // Extract code and language
        const code = message.content || '';
        const language = message.language || '';
        
        // Add language label if specified
        if (language) {
          const langLabel = DOM.create('div', {
            props: {
              className: 'cc-code-language',
              textContent: language
            }
          });
          codeBlock.appendChild(langLabel);
        }
        
        // Add code actions
        const actions = DOM.create('div', {
          props: { className: 'cc-code-actions' },
          children: [
            DOM.create('button', {
              props: {
                className: 'cc-code-action',
                innerHTML: `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span class="label">Copy</span>
                `
              },
              dataset: { action: 'copy' }
            })
          ]
        });
        
        codeBlock.appendChild(actions);
        
        // Create pre and code elements
        const pre = DOM.create('pre');
        const codeElement = DOM.create('code', {
          props: { textContent: code },
          attrs: language ? { class: `language-${language}` } : {}
        });
        
        pre.appendChild(codeElement);
        codeBlock.appendChild(pre);
        
        container.appendChild(codeBlock);
        
        // Apply syntax highlighting
        if (this.config.codeHighlighting.enabled && this.components.codeHighlighter) {
          try {
            const highlighted = await this.components.codeHighlighter.highlight(code, language);
            codeElement.innerHTML = highlighted;
          } catch (err) {
            console.warn('Failed to highlight code:', err);
          }
        }
      }
      
      /**
       * Image message renderer
       */
      #renderImageMessage(container, message) {
        // Add image class
        container.classList.add(CSS.content.image);
        
        // Create image wrapper
        const wrapper = DOM.create('div', {
          props: { className: 'cc-img-wrapper' }
        });
        
        // Determine image source
        let imgSrc = '';
        let imgType = '';
        
        if (message.url) {
          imgSrc = message.url;
        } else if (message.data) {
          imgType = message.mime || 'image/jpeg';
          imgSrc = `data:${imgType};base64,${message.data}`;
        } else if (message.content?.type === 'image' && message.content?.data) {
          imgType = message.content.mime || 'image/jpeg';
          imgSrc = `data:${imgType};base64,${message.content.data}`;
        }
        
        if (imgSrc) {
          // Create image element
          const img = DOM.create('img', {
            attrs: {
              src: imgSrc,
              alt: message.alt || 'Image',
              loading: 'lazy'
            },
            props: { className: 'cc-msg-image' }
          });
          
          wrapper.appendChild(img);
          
          // Add caption if present
          if (message.caption) {
            const caption = DOM.create('figcaption', {
              props: {
                className: 'cc-img-caption',
                textContent: message.caption
              }
            });
            wrapper.appendChild(caption);
          }
          
          container.appendChild(wrapper);
        } else {
          // Fallback for missing image data
          container.textContent = '[Image data not available]';
        }
      }
      
      /**
       * File message renderer
       */
      #renderFileMessage(container, message) {
        // Render text content if present
        if (message.content) {
          if (this.config.markdown.enabled && 
              this.components.markdownRenderer && 
              typeof message.content === 'string') {
            this.components.markdownRenderer.render(message.content)
              .then(html => {
                const contentDiv = DOM.create('div', {
                  props: {
                    className: CSS.content.markdown,
                    innerHTML: html
                  }
                });
                container.appendChild(contentDiv);
                this.#enhanceCodeBlocks(contentDiv);
              })
              .catch(err => {
                console.error('Error rendering markdown in file message', err);
                container.textContent = message.content;
              });
          } else if (typeof message.content === 'string') {
            container.textContent = message.content;
          }
        }
        
        // Add files attachments
        if (message.files && message.files.length > 0) {
          const filesContainer = DOM.create('div', {
            props: { className: 'cc-file-attachments' }
          });
          
          // Add each file
          for (const file of message.files) {
            const fileElement = this.#createFileAttachment(file);
            filesContainer.appendChild(fileElement);
          }
          
          container.appendChild(filesContainer);
        }
      }
      
      /**
       * Error message renderer
       */
      #renderErrorMessage(container, message) {
        // Add error class
        container.classList.add(CSS.content.error);
        
        // Extract error text
        let errorText = '';
        if (typeof message.content === 'string') {
          errorText = message.content;
        } else if (message.error && typeof message.error === 'string') {
          errorText = message.error;
        } else if (message.error?.message) {
          errorText = message.error.message;
        } else {
          errorText = 'An error occurred';
        }
        
        // Create error content
        const errorContent = DOM.create('div', {
          props: { className: 'cc-error-content' },
          children: [
            // Error icon
            DOM.create('div', {
              props: {
                className: 'cc-error-icon',
                innerHTML: `
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                `
              }
            }),
            
            // Error message
            DOM.create('div', {
              props: {
                className: 'cc-error-message',
                textContent: errorText
              }
            }),
            
            // Retry button (if enabled)
            this.config.errorHandling.retryEnabled && message.canRetry ? 
              DOM.create('button', {
                props: {
                  className: `${CSS.ui.button} ${CSS.ui.secondary} cc-error-retry`,
                  textContent: 'Retry'
                },
                events: {
                  click: () => this.eventBus.emit('regenerateMessage', { messageId: message.id })
                }
              }) : null
          ].filter(Boolean)
        });
        
        container.appendChild(errorContent);
      }
      
      /**
       * Wiki reference message renderer
       */
      #renderWikiReferenceMessage(container, message) {
        // Add wiki reference class
        container.classList.add('cc-wiki-reference');
        
        // Create container
        const refContainer = DOM.create('div', {
          props: { className: 'cc-wiki-content' }
        });
        
        // Add image if available
        if (message.metadata?.image) {
          const imgWrapper = DOM.create('div', {
            props: { className: 'cc-wiki-image' },
            children: [
              DOM.create('img', {
                attrs: {
                  src: message.metadata.image,
                  alt: message.metadata.title || 'Wikipedia image',
                  loading: 'lazy'
                }
              })
            ]
          });
          refContainer.appendChild(imgWrapper);
        }
        
        // Render content with markdown
        const contentWrapper = DOM.create('div', {
          props: { className: 'cc-wiki-text' }
        });
        
        if (this.config.markdown.enabled && 
            this.components.markdownRenderer && 
            typeof message.content === 'string') {
          this.components.markdownRenderer.render(message.content)
            .then(html => {
              contentWrapper.innerHTML = html;
              this.#enhanceCodeBlocks(contentWrapper);
            })
            .catch(err => {
              console.error('Error rendering wiki reference markdown', err);
              contentWrapper.textContent = message.content;
            });
        } else {
          contentWrapper.textContent = message.content;
        }
        
        refContainer.appendChild(contentWrapper);
        
        // Add source attribution
        if (message.metadata?.source) {
          const source = DOM.create('div', {
            props: { className: 'cc-wiki-source' },
            children: [
              DOM.create('a', {
                attrs: {
                  href: message.metadata.source,
                  target: '_blank',
                  rel: 'noopener noreferrer'
                },
                props: {
                  textContent: 'Source: Wikipedia'
                }
              })
            ]
          });
          refContainer.appendChild(source);
        }
        
        container.appendChild(refContainer);
      }
      
      /**
       * Create file attachment element
       */
      #createFileAttachment(file) {
        const fileElement = DOM.create('div', {
          props: { className: 'cc-file-attachment' }
        });
        
        // Add header with file info
        const header = DOM.create('div', {
          props: { className: 'cc-file-header' },
          children: [
            // Icon
            DOM.create('div', {
              props: {
                className: 'cc-file-icon',
                innerHTML: this.#getFileIcon(file.type)
              }
            }),
            
            // Filename
            DOM.create('span', {
              props: {
                className: 'cc-file-name',
                textContent: file.name || 'File'
              }
            })
          ]
        });
        
        fileElement.appendChild(header);
        
        // Add content based on type
        if (file.type === 'image' || file.type?.startsWith('image/')) {
          const imgWrapper = DOM.create('div', {
            props: { className: 'cc-file-preview' }
          });
          
          // Determine image source
          if (file.url) {
            const img = DOM.create('img', {
              attrs: {
                src: file.url,
                alt: file.name || 'Image attachment',
                loading: 'lazy'
              }
            });
            imgWrapper.appendChild(img);
          } else if (file.data) {
            const img = DOM.create('img', {
              attrs: {
                src: `data:${file.mime || 'image/jpeg'};base64,${file.data}`,
                alt: file.name || 'Image attachment',
                loading: 'lazy'
              }
            });
            imgWrapper.appendChild(img);
          } else if (file.element) {
            // Clone existing element
            imgWrapper.appendChild(file.element.cloneNode(true));
          }
          
          fileElement.appendChild(imgWrapper);
        } else {
          // Text content preview
          const content = DOM.create('div', {
            props: { className: 'cc-file-content' }
          });
          
          if (typeof file.content === 'string') {
            content.textContent = file.content;
          } else if (file.text) {
            content.textContent = file.text;
          } else if (file.preview) {
            content.innerHTML = file.preview;
          } else {
            content.textContent = 'File content not available for preview';
          }
          
          fileElement.appendChild(content);
        }
        
        return fileElement;
      }
      
      /**
       * Enhance code blocks with additional features
       */
      #enhanceCodeBlocks(container) {
        // Find all code blocks
        const codeBlocks = container.querySelectorAll('pre code');
        if (!codeBlocks.length) return;
        
        for (const codeBlock of codeBlocks) {
          const pre = codeBlock.parentElement;
          if (!pre || pre.dataset.enhanced === 'true') continue;
          
          // Get language
          const langMatch = codeBlock.className?.match(/language-(\w+)/);
          const language = langMatch ? langMatch[1] : '';
          
          // Create wrapper
          const wrapper = DOM.create('div', {
            props: { className: 'cc-code-block' },
            dataset: { language }
          });
          
          // Add language label
          if (language) {
            const langLabel = DOM.create('div', {
              props: {
                className: 'cc-code-language',
                textContent: language
              }
            });
            wrapper.appendChild(langLabel);
          }
          
          // Create actions toolbar
          const actions = DOM.create('div', {
            props: { className: 'cc-code-actions' },
            children: [
              // Copy button
              DOM.create('button', {
                props: {
                  className: 'cc-code-action',
                  innerHTML: `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span class="label">Copy</span>
                  `
                },
                dataset: { action: 'copy' }
              })
            ]
          });
          
          wrapper.appendChild(actions);
          
          // Move pre into wrapper
          pre.parentNode.insertBefore(wrapper, pre);
          wrapper.appendChild(pre);
          
          // Mark as enhanced
          pre.dataset.enhanced = 'true';
          
          // Apply syntax highlighting if needed
          if (this.config.codeHighlighting.enabled && 
              this.components.codeHighlighter && 
              language && 
              !codeBlock.dataset.highlighted) {
            
            this.components.codeHighlighter.highlight(codeBlock.textContent, language)
              .then(html => {
                codeBlock.innerHTML = html;
                codeBlock.dataset.highlighted = 'true';
              })
              .catch(err => console.warn('Failed to highlight code:', err));
          }
        }
      }
      
      /**
       * Process Wikipedia links for enhanced interaction
       */
      #processWikipediaLinks(container) {
        if (!this.config.wikipedia.linkPreview) return;
        
        // Find all Wikipedia links
        const links = container.querySelectorAll('a[href*="wikipedia.org"]');
        if (!links.length) return;
        
        for (const link of links) {
          // Skip if already processed
          if (link.dataset.wikiProcessed) continue;
          
          // Mark as processed
          link.dataset.wikiProcessed = 'true';
          
          // Add Wikipedia class
          link.classList.add('cc-wiki-link');
          
          // Add tooltip button
          link.addEventListener('mouseenter', (e) => {
            // Remove any existing tooltips
            document.querySelectorAll('.cc-wiki-tooltip').forEach(el => el.remove());
            
            // Create tooltip
            const tooltip = DOM.create('div', {
              props: { className: 'cc-wiki-tooltip' },
              children: [
                DOM.create('button', {
                  props: {
                    className: 'cc-wiki-preview-btn',
                    textContent: 'Preview'
                  },
                  events: {
                    click: (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Remove tooltip
                      tooltip.remove();
                      
                      // Load article
                      this.loadWikipediaArticle(link.href);
                    }
                  }
                }),
                DOM.create('button', {
                  props: {
                    className: 'cc-wiki-cite-btn',
                    textContent: 'Cite'
                  },
                  events: {
                    click: (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Remove tooltip
                      tooltip.remove();
                      
                      // Load article and generate citation
                      this.loadWikipediaArticle(link.href)
                        .then(article => {
                          if (article) {
                            this.generateCitation(article);
                          }
                        });
                    }
                  }
                })
              ]
            });
            
            // Position tooltip
            const rect = link.getBoundingClientRect();
            tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
            tooltip.style.left = `${rect.left + window.scrollX}px`;
            
            // Add to body
            document.body.appendChild(tooltip);
            
            // Remove on mouseleave
            const handleMouseLeave = (e) => {
              // Don't remove if moving to tooltip
              if (e.relatedTarget === tooltip || tooltip.contains(e.relatedTarget)) {
                return;
              }
              
              tooltip.remove();
              link.removeEventListener('mouseleave', handleMouseLeave);
            };
            
            link.addEventListener('mouseleave', handleMouseLeave);
            
            // Also remove tooltip when mouse leaves tooltip (unless going back to link)
            tooltip.addEventListener('mouseleave', (e) => {
              if (e.relatedTarget === link || link.contains(e.relatedTarget)) {
                return;
              }
              
              tooltip.remove();
            });
          });
        }
      }
      
      /**
       * Get icon for file type
       */
      #getFileIcon(fileType) {
        if (!fileType) return this.#getDefaultFileIcon();
        
        // Image
        if (fileType === 'image' || fileType.startsWith('image/')) {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>`;
        }
        
        // Document
        if (fileType === 'document' || fileType.includes('pdf') || 
            fileType.includes('text/') || fileType.includes('document')) {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>`;
        }
        
        // Code
        if (fileType === 'code' || fileType.includes('json') || 
            fileType.includes('javascript') || fileType.includes('application/')) {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>`;
        }
        
        return this.#getDefaultFileIcon();
      }
      
      /**
       * Get default file icon
       */
      #getDefaultFileIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>`;
      }
      
      /**
       * Create thinking indicator
       */
      #createThinkingIndicator(model, text) {
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return null;
        
        // Hide existing indicator if present
        this.hideThinking();
        
        // Create indicator
        const indicator = DOM.create('div', {
          attrs: { id: 'thinkingIndicator' },
          props: { className: 'cc-thinking-indicator' },
          children: [
            // Avatar (if enabled)
            this.config.avatars.enabled ? DOM.create('div', {
              props: { className: 'cc-thinking-avatar' },
              children: [
                DOM.create('img', {
                  attrs: {
                    src: this.config.avatars.assistant,
                    alt: 'Claude thinking',
                    loading: 'lazy'
                  }
                })
              ]
            }) : null,
            
            // Text
            DOM.create('div', {
              props: {
                className: 'cc-thinking-text',
                textContent: text || `${model || 'Claude'} is thinking...`
              }
            }),
            
            // Animated dots
            DOM.create('div', {
              props: { className: 'cc-thinking-dots' },
              children: [
                DOM.create('span', { props: { className: 'dot' } }),
                DOM.create('span', { props: { className: 'dot' } }),
                DOM.create('span', { props: { className: 'dot' } })
              ]
            })
          ].filter(Boolean)
        });
        
        // Add to chat container
        chatContainer.appendChild(indicator);
        
        // Animate entrance
        this.components.animationController.fadeIn(indicator);
        
        // Update state
        this.state.thinking = true;
        
        // Scroll to bottom
        this.scrollToBottom({ behavior: 'auto' });
        
        // Announce to screen readers
        this.#announceToScreenReader(text || `${model || 'Claude'} is thinking...`);
        
        return indicator;
      }
      
      /**
       * Format timestamp according to settings
       */
      #formatTimestamp(timestamp, format = this.config.timestamps.format) {
        const date = new Date(timestamp);
        
        switch (format) {
          case 'relative':
            return this.#formatRelativeTime(timestamp);
            
          case 'time':
            return date.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: 'numeric'
            });
            
          case 'datetime':
            return date.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            });
            
          default:
            return date.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: 'numeric'
            });
        }
      }
      
      /**
       * Format timestamp as relative time
       */
      #formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        // Just now (< 1 minute)
        if (diff < 60000) {
          return 'just now';
        }
        
        // Minutes
        if (diff < 3600000) {
          const minutes = Math.floor(diff / 60000);
          return `${minutes}m ago`;
        }
        
        // Hours
        if (diff < 86400000) {
          const hours = Math.floor(diff / 3600000);
          return `${hours}h ago`;
        }
        
        // Days
        if (diff < 604800000) {
          const days = Math.floor(diff / 86400000);
          return `${days}d ago`;
        }
        
        // Weeks
        if (diff < 2592000000) {
          const weeks = Math.floor(diff / 604800000);
          return `${weeks}w ago`;
        }
        
        // Months
        if (diff < 31536000000) {
          const months = Math.floor(diff / 2592000000);
          return `${months}mo ago`;
        }
        
        // Years
        const years = Math.floor(diff / 31536000000);
        return `${years}y ago`;
      }
      
      /**
       * Schedule an update in the update queue
       */
      #scheduleUpdate(updateFn, priority = 10) {
        // Add to queue
        this.state.updateQueue.push({
          update: updateFn,
          priority,
          timestamp: Date.now()
        });
        
        // Sort by priority (lower numbers are higher priority)
        this.state.updateQueue.sort((a, b) => a.priority - b.priority);
        
        // Limit queue size
        if (this.state.updateQueue.length > this.config.performance.maxPendingUpdates) {
          this.state.updateQueue.length = this.config.performance.maxPendingUpdates;
        }
        
        // Process queue if not already processing
        if (!this.state.processingQueue) {
          this.#processUpdateQueue();
        }
      }
      
      /**
       * Process update queue
       */
      #processUpdateQueue() {
        this.state.processingQueue = true;
        
        // If no updates, we're done
        if (this.state.updateQueue.length === 0) {
          this.state.processingQueue = false;
          return;
        }
        
        // Take a batch of updates
        const batch = this.state.updateQueue.splice(0, this.config.performance.batchSize);
        
        // Process in a requestAnimationFrame
        requestAnimationFrame(() => {
          // Apply all updates in batch
          for (const item of batch) {
            try {
              item.update();
            } catch (err) {
              console.error('Error processing update:', err);
            }
          }
          
          // Continue processing or finish
          if (this.state.updateQueue.length > 0) {
            setTimeout(() => {
              this.#processUpdateQueue();
            }, this.config.performance.renderThrottleMs);
          } else {
            this.state.processingQueue = false;
          }
        });
      }
      
      /**
       * Hide welcome screen
       */
      #hideWelcomeScreen() {
        const welcomeScreen = this.state.elements.get('welcomeScreen');
        if (!welcomeScreen || welcomeScreen.classList.contains(CSS.layout.hidden)) {
          return;
        }
        
        // Hide with animation
        this.components.animationController.transition(() => {
          welcomeScreen.classList.add(CSS.layout.hidden);
          
          // Focus input after hiding
          setTimeout(() => {
            const userInput = this.state.elements.get('userInput');
            if (userInput) userInput.focus();
          }, 100);
        });
      }
      
      /**
       * Show welcome screen
       */
      #showWelcomeScreen() {
        const welcomeScreen = this.state.elements.get('welcomeScreen');
        if (!welcomeScreen) return;
        
        // Show with animation
        this.components.animationController.transition(() => {
          welcomeScreen.classList.remove(CSS.layout.hidden);
        });
      }
      
      /**
       * Update a chat history item
       */
      #updateChatHistoryItem(chatId, updateData) {
        const chatHistory = this.state.elements.get('chatHistory');
        if (!chatHistory) return null;
        
        // Find existing item
        const listItem = chatHistory.querySelector(`li[data-chat-id="${chatId}"]`);
        if (!listItem) return null;
        
        const button = listItem.querySelector('button');
        if (!button) return null;
        
        // Update title if provided
        if (updateData.title) {
          const titleEl = button.querySelector('.chat-history-text');
          if (titleEl) {
            titleEl.textContent = this.#formatChatTitle(updateData.title);
          }
        }
        
        // Update timestamp if provided
        if (updateData.timestamp) {
          const timeEl = button.querySelector('.chat-history-time');
          if (timeEl) {
            timeEl.textContent = this.#formatRelativeTime(updateData.timestamp);
            timeEl.title = new Date(updateData.timestamp).toLocaleString();
          }
        }
        
        return listItem;
      }
      
      /**
       * Create a chat history item
       */
      #createChatHistoryItem(chat, isActive = false) {
        return DOM.create('li', {
          attrs: { 'data-chat-id': chat.id },
          children: [
            DOM.create('button', {
              attrs: {
                'aria-selected': isActive ? 'true' : 'false',
                'role': 'tab'
              },
              props: {
                className: isActive ? 'active' : ''
              },
              events: {
                click: () => this.selectChat(chat.id)
              },
              children: [
                // Icon
                DOM.create('span', {
                  props: {
                    className: 'chat-history-icon',
                    innerHTML: `
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    `
                  }
                }),
                
                // Title
                DOM.create('span', {
                  props: {
                    className: 'chat-history-text',
                    textContent: this.#formatChatTitle(chat.title)
                  }
                }),
                
                // Timestamp
                DOM.create('span', {
                  attrs: {
                    title: new Date(chat.updatedAt || chat.createdAt).toLocaleString()
                  },
                  props: {
                    className: 'chat-history-time',
                    textContent: this.#formatRelativeTime(chat.updatedAt || chat.createdAt)
                  }
                }),
                
                // Actions
                DOM.create('div', {
                  props: { className: 'chat-history-actions' },
                  children: [
                    // Delete button
                    DOM.create('button', {
                      attrs: {
                        'aria-label': 'Delete chat',
                        'title': 'Delete chat',
                        'type': 'button'
                      },
                      props: {
                        className: 'chat-history-action-btn',
                        innerHTML: `
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        `
                      },
                      events: {
                        click: (e) => {
                          e.stopPropagation();
                          this.#confirmDeleteChat(chat.id);
                        }
                      }
                    })
                  ]
                })
              ]
            })
          ]
        });
      }
      
      /**
       * Format chat title for display
       */
      #formatChatTitle(title) {
        if (!title) return 'New Chat';
        
        // Truncate long titles
        return title.length > 30 ? title.substring(0, 27) + '...' : title;
      }
      
      /**
       * Confirm chat deletion
       */
      #confirmDeleteChat(chatId) {
        // Create confirmation dialog
        const dialog = DOM.create('div', {
          props: { className: CSS.ui.modal + ' confirmation-dialog' },
          children: [
            DOM.create('div', {
              props: { className: 'modal-content' },
              children: [
                // Header
                DOM.create('div', {
                  props: { className: 'modal-header' },
                  children: [
                    DOM.create('h3', { props: { textContent: 'Delete Chat?' } }),
                    DOM.create('button', {
                      props: {
                        className: 'modal-close',
                        innerHTML: '&times;'
                      },
                      attrs: { 'aria-label': 'Close' },
                      events: { click: () => dialog.remove() }
                    })
                  ]
                }),
                
                // Message
                DOM.create('p', {
                  props: {
                    className: 'dialog-message',
                    textContent: 'Are you sure you want to delete this chat? This action cannot be undone.'
                  }
                }),
                
                // Actions
                DOM.create('div', {
                  props: { className: 'dialog-actions' },
                  children: [
                    DOM.create('button', {
                      props: {
                        className: `${CSS.ui.button} ${CSS.ui.secondary}`,
                        textContent: 'Cancel'
                      },
                      events: { click: () => dialog.remove() }
                    }),
                    DOM.create('button', {
                      props: {
                        className: `${CSS.ui.button} ${CSS.ui.danger}`,
                        textContent: 'Delete'
                      },
                      events: {
                        click: () => {
                          dialog.remove();
                          this.eventBus.emit('deleteChat', { chatId });
                        }
                      }
                    })
                  ]
                })
              ]
            })
          ]
        });
        
        // Add to body
        document.body.appendChild(dialog);
        
        // Close when clicking outside
        dialog.addEventListener('click', e => {
          if (e.target === dialog) dialog.remove();
        });
      }
      
      /**
       * Create a message element
       */
      #createMessageElement(message, options = {}) {
        const {
          messageId,
          isVisible = false
        } = options;
        
        // Check if we can recycle a node
        let element = null;
        if (this.components.virtualScroller) {
          element = this.components.virtualScroller.getRecycledNode(messageId, message.type);
        }
        
        // Create new element if no recycled node
        if (!element) {
          // Message container
          element = DOM.create('div', {
            attrs: {
              'data-message-id': messageId,
              'data-role': message.role,
              'data-type': message.type || 'text',
              'data-timestamp': message.timestamp || Date.now(),
              'role': 'article',
              'tabindex': this.config.accessibility.focusableMessages ? '0' : '-1'
            },
            props: {
              className: `${CSS.message.container} ${
                message.role === 'human' ? CSS.message.human : CSS.message.assistant
              }`
            }
          });
          
          // Add classes based on message properties
          if (message.type === 'error') {
            element.classList.add(CSS.message.error);
          }
          
          if (message.type === 'thinking') {
            element.classList.add(CSS.message.thinking);
          }
          
          if (message.files?.length > 0) {
            element.classList.add(CSS.message.withFiles);
          }
          
          if (message.citation || (message.metadata && message.metadata.source)) {
            element.classList.add(CSS.message.withCitation);
          }
          
          if (message.edited) {
            element.classList.add(CSS.message.edited);
          }
          
          if (isVisible) {
            element.classList.add(CSS.message.visible);
          }
        } else {
          // Update recycled node attributes
          element.setAttribute('data-role', message.role);
          element.setAttribute('data-type', message.type || 'text');
          element.setAttribute('data-timestamp', message.timestamp || Date.now());
          
          // Update classes
          element.className = `${CSS.message.container} ${
            message.role === 'human' ? CSS.message.human : CSS.message.assistant
          }`;
          
          // Add conditional classes
          if (message.type === 'error') element.classList.add(CSS.message.error);
          if (message.type === 'thinking') element.classList.add(CSS.message.thinking);
          if (message.files?.length > 0) element.classList.add(CSS.message.withFiles);
          if (message.citation || (message.metadata && message.metadata.source)) {
            element.classList.add(CSS.message.withCitation);
          }
          if (message.edited) element.classList.add(CSS.message.edited);
          if (isVisible) element.classList.add(CSS.message.visible);
          
          // Clear existing content
          DOM.empty(element);
        }
        
        // Add header
        const header = this.#createMessageHeader(message);
        element.appendChild(header);
        
        // Add content container
        const contentContainer = DOM.create('div', {
          props: { className: CSS.content.wrapper }
        });
        
        // Get renderer for message
        const renderStrategy = this.#getRendererForMessage(message);
        const renderer = this.state.messageRenderers.get(renderStrategy);
        
        // Apply renderer
        if (renderer) {
          renderer(contentContainer, message);
        } else {
          // Fallback
          this.state.messageRenderers.get(RENDERERS.DEFAULT)(contentContainer, message);
        }
        
        element.appendChild(contentContainer);
        
        // Add actions if appropriate
        if (this.#shouldAddMessageActions(message)) {
          const actions = this.#createMessageActions(message);
          element.appendChild(actions);
        }
        
        return element;
      }
      
      /**
       * Create message header
       */
      #createMessageHeader(message) {
        const header = DOM.create('div', {
          props: { className: 'cc-msg-header' }
        });
        
        // Add avatar if enabled
        if (this.config.avatars.enabled) {
          const avatarContainer = DOM.create('div', {
            props: { className: 'cc-msg-avatar' }
          });
          
          const avatarSrc = message.role === 'human' ? 
            this.config.avatars.human : this.config.avatars.assistant;
          
          const avatarAlt = message.role === 'human' ? 
            'Your avatar' : 'Claude avatar';
          
          const avatar = DOM.create('img', {
            attrs: {
              src: avatarSrc,
              alt: avatarAlt,
              loading: 'lazy'
            }
          });
          
          avatarContainer.appendChild(avatar);
          header.appendChild(avatarContainer);
        }
        
        // Add metadata section
        const metadata = DOM.create('div', {
          props: { className: 'cc-msg-meta' }
        });
        
        // Add role name
        const roleName = DOM.create('span', {
          props: { 
            className: 'cc-msg-sender',
            textContent: message.role === 'human' ? 'You' : (message.name || 'Claude')
          }
        });
        metadata.appendChild(roleName);
        
        // Add model name if available for assistant
        if (message.role === 'assistant' && message.model) {
          const modelName = DOM.create('span', {
            props: {
              className: 'cc-msg-model',
              textContent: message.model
            }
          });
          metadata.appendChild(modelName);
        }
        
        // Add timestamp
        const timestamp = DOM.create('span', {
          attrs: {
            'data-timestamp': message.timestamp || Date.now()
          },
          props: {
            className: 'cc-msg-time',
            textContent: this.#formatTimestamp(message.timestamp || Date.now())
          }
        });
        metadata.appendChild(timestamp);
        
        // Add edited indicator if message was edited
        if (message.edited) {
          const editedIndicator = DOM.create('span', {
            props: {
              className: 'cc-msg-edited',
              textContent: '(edited)'
            },
            attrs: {
              title: message.editTimestamp ? 
                `Edited ${this.#formatTimestamp(message.editTimestamp)}` : 
                'Edited'
            }
          });
          metadata.appendChild(editedIndicator);
        }
        
        header.appendChild(metadata);
        
        return header;
      }
      
      /**
       * Check if message should have actions
       */
      #shouldAddMessageActions(message) {
        // Don't add actions to thinking messages
        if (message.type === 'thinking') return false;
        
        // Don't add actions to error messages
        if (message.type === 'error') return false;
        
        return true;
      }
      
      /**
       * Create message actions
       */
      #createMessageActions(message) {
        const actionsContainer = DOM.create('div', {
          props: { className: 'cc-msg-actions' }
        });
        
        // Define available actions
        const actions = [
          {
            id: 'copy',
            label: 'Copy message',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>`,
            roles: ['human', 'assistant']
          },
          {
            id: 'edit',
            label: 'Edit message',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>`,
            roles: ['human']
          },
          {
            id: 'regenerate',
            label: 'Regenerate response',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path>
                  </svg>`,
            roles: ['assistant']
          },
          {
            id: 'copy-code',
            label: 'Copy code',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>`,
            roles: ['assistant'],
            condition: () => message.content && message.content.includes('```')
          },
          {
            id: 'cite',
            label: 'Cite sources',
            icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9H2v6h4v-6z"></path>
                    <path d="M14 9h-4v6h4v-6z"></path>
                    <path d="M22 9h-4v6h4v-6z"></path>
                    <path d="M18 13a2 2 0 0 1-2 2v4"></path>
                    <path d="M10 13a2 2 0 0 1-2 2v4"></path>
                    <path d="M2 3h16"></path>
                  </svg>`,
            roles: ['assistant'],
            condition: () => message.metadata?.source || message.type === 'wikiReference'
          }
        ];
        
        // Add buttons for applicable actions
        for (const action of actions) {
          // Skip if not applicable to this role
          if (!action.roles.includes(message.role)) continue;
          
          // Skip if condition is not met
          if (action.condition && !action.condition()) continue;
          
          const button = DOM.create('button', {
            attrs: {
              'data-action': action.id,
              'aria-label': action.label,
              'title': action.label,
              'type': 'button'
            },
            props: {
              className: 'cc-msg-action',
              innerHTML: action.icon
            }
          });
          
          actionsContainer.appendChild(button);
        }
        
        // Add menu button
        const menuButton = DOM.create('button', {
          attrs: {
            'data-action': 'menu',
            'aria-label': 'More actions',
            'title': 'More actions',
            'type': 'button'
          },
          props: {
            className: 'cc-msg-action cc-msg-menu',
            innerHTML: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>`
          }
        });
        
        actionsContainer.appendChild(menuButton);
        
        return actionsContainer;
      }
      
      /**
       * Clean up resources when destroying the controller
       */
      destroy() {
        if (!this.state.initialized) return;
        
        // Remove event listeners
        this.components.eventManager.removeAll();
        
        // Clean up component resources
        this.components.animationController.destroy();
        this.components.markdownRenderer.destroy();
        this.components.codeHighlighter.destroy();
        
        if (this.components.virtualScroller) {
          this.components.virtualScroller.destroy();
        }
        
        // Clear event handlers
        this.eventBus.clear();
        
        // Clear state
        this.state.messages.clear();
        this.state.visibleMessages.clear();
        this.state.elements.clear();
        this.state.updateQueue = [];
        this.state.undoStack = [];
        this.state.redoStack = [];
        
        // Mark as uninitialized
        this.state.initialized = false;
        
        // Emit destroyed event
        document.dispatchEvent(new CustomEvent('claudechat:destroyed', {
          detail: { timestamp: Date.now() }
        }));
      }
      
      // ===============================================================
      // Public API Methods
      // ===============================================================
      
      /**
       * Add a new message to the chat
       */
      addMessage(message, options = {}) {
        if (!this.state.initialized) return null;
        
        const {
          animate = true,
          prepend = false,
          scrollIntoView = true,
          notify = true,
          groupWithPrevious = false,
          addToHistory = true
        } = options;
        
        // Get chat container
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return null;
        
        // Hide welcome screen if visible
        this.#hideWelcomeScreen();
        
        // Generate message ID if not provided
        const messageId = message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        
        // Check if message already exists
        if (this.state.messages.has(messageId)) {
          return this.updateMessage(messageId, message);
        }
        
        // Determine grouping
        let shouldGroup = groupWithPrevious;
        
        if (!shouldGroup && this.config.messageGrouping.enabled) {
          const messages = Array.from(this.state.messages.values());
          
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            
            // Group with previous message if same role and within time threshold
            if (lastMessage.data.role === message.role) {
              const timeDiff = (message.timestamp || Date.now()) - lastMessage.data.timestamp;
              shouldGroup = timeDiff < this.config.messageGrouping.timeThreshold;
            }
          }
        }
        
        // Create message element
        const messageElement = this.#createMessageElement(message, {
          messageId,
          isVisible: !this.config.virtualization.enabled
        });
        
        // Add grouped class if needed
        if (shouldGroup) {
          messageElement.classList.add(CSS.message.grouped);
        }
        
        // Store in state
        this.state.messages.set(messageId, {
          id: messageId,
          element: messageElement,
          data: { ...message },
          timestamp: message.timestamp || Date.now()
        });
        
        // Use transition API for smooth addition
        this.components.animationController.transition(() => {
          // Add to DOM
          if (prepend) {
            chatContainer.insertBefore(messageElement, chatContainer.firstChild);
          } else {
            chatContainer.appendChild(messageElement);
          }
          
          // Apply entrance animation
          if (animate && !this.config.animations.reducedMotion) {
            this.components.animationController.fadeIn(messageElement);
          }
          
          // Add to visible set if using virtualization
          if (this.config.virtualization.enabled) {
            this.state.visibleMessages.add(messageId);
          }
          
          // Update virtual scroller
          if (this.components.virtualScroller) {
            const messages = Array.from(this.state.messages.values())
              .map(m => ({ id: m.id, timestamp: m.timestamp }))
              .sort((a, b) => a.timestamp - b.timestamp);
              
            this.components.virtualScroller.setItems(messages, (items, startIndex) => {
              // This callback handles rendering visible items
            });
          }
        });
        
        // Add to undo stack if enabled
        if (addToHistory) {
          this.#saveToUndoStack({
            type: 'add',
            messageId,
            data: { ...message }
          });
        }
        
        // Scroll into view if requested
        if (scrollIntoView) {
          this.scrollToMessage(messageId);
        }
        
        // Announce to screen readers
        if (notify && this.config.accessibility.announceMessages) {
          const announcement = message.role === 'human' ? 
            `You: ${message.content}` : 
            `Claude: ${message.content}`;
            
          this.#announceToScreenReader(announcement);
        }
        
        // Emit event
        this.eventBus.emit('messageAdded', {
          id: messageId,
          message: { ...message },
          element: messageElement
        });
        
        return messageElement;
      }
      
      /**
       * Update an existing message
       */
      updateMessage(messageId, updates = {}, options = {}) {
        if (!this.state.initialized) return null;
        
        const {
          scrollIntoView = false,
          updateTimestamp = true,
          partial = false,
          addToHistory = true
        } = options;
        
        // Check if message exists
        const message = this.state.messages.get(messageId);
        if (!message) return null;
        
        // Save to undo stack if requested
        if (addToHistory) {
          this.#saveToUndoStack({
            type: 'update',
            messageId,
            previousData: { ...message.data },
            currentData: partial ? { ...message.data, ...updates } : { ...updates }
          });
        }
        
        // Update message data
        const updatedData = partial
          ? { ...message.data, ...updates }
          : { id: message.data.id, role: message.data.role, ...updates };
        
        // Update timestamp if requested
        if (updateTimestamp) {
          message.timestamp = Date.now();
          updatedData.timestamp = message.timestamp;
        }
        
        // Store updated data
        message.data = updatedData;
        
        // Schedule rendering update
        this.#scheduleUpdate(() => {
          // Get renderer for updated message
          const element = message.element;
          const renderStrategy = this.#getRendererForMessage(updatedData);
          const renderer = this.state.messageRenderers.get(renderStrategy);
          
          // Create a new message element
          const newElement = this.#createMessageElement(updatedData, {
            messageId,
            isVisible: element.classList.contains(CSS.message.visible)
          });
          
          // Replace old element with new one
          if (element.parentNode) {
            element.parentNode.replaceChild(newElement, element);
            
            // Update reference in state
            message.element = newElement;
            
            // Scroll if requested
            if (scrollIntoView) {
              this.scrollToMessage(messageId);
            }
          }
        });
        
        // Emit event
        this.eventBus.emit('messageUpdated', {
          id: messageId,
          message: updatedData
        });
        
        return message.element;
      }
      
      /**
       * Remove a message from the chat
       */
      removeMessage(messageId, options = {}) {
        if (!this.state.initialized) return false;
        
        const {
          animate = true,
          addToHistory = true
        } = options;
        
        // Check if message exists
        const message = this.state.messages.get(messageId);
        if (!message) return false;
        
        // Save to undo stack if requested
        if (addToHistory) {
          this.#saveToUndoStack({
            type: 'remove',
            messageId,
            data: { ...message.data }
          });
        }
        
        // Get the element
        const element = message.element;
        
        // Use transitions API for smooth removal
        this.components.animationController.transition(async () => {
          // Animate out if requested
          if (animate && !this.config.animations.reducedMotion) {
            element.classList.add(CSS.message.removing);
            
            // Wait for animation
            await this.components.animationController.fadeOut(element);
          }
          
          // Remove from DOM
          element.remove();
          
          // Remove from state
          this.state.messages.delete(messageId);
          this.state.visibleMessages.delete(messageId);
          
          // Update virtual scroller
          if (this.components.virtualScroller) {
            const messages = Array.from(this.state.messages.values())
              .map(m => ({ id: m.id, timestamp: m.timestamp }))
              .sort((a, b) => a.timestamp - b.timestamp);
              
            this.components.virtualScroller.setItems(messages, (items, startIndex) => {
              // This callback handles rendering visible items
            });
          }
        });
        
        // Emit event
        this.eventBus.emit('messageRemoved', { id: messageId });
        
        return true;
      }
      
      /**
       * Start streaming a response
       */
      startStreaming(messageId, initialData = {}) {
        if (!this.state.initialized) return null;
        
        // Create or get existing message
        let messageElement;
        
        if (!this.state.messages.has(messageId)) {
          // Create new message for streaming
          const message = {
            id: messageId,
            role: initialData.role || 'assistant',
            content: initialData.content || '',
            timestamp: initialData.timestamp || Date.now(),
            ...initialData
          };
          
          // Add as streaming message
          messageElement = this.addMessage(message, {
            scrollIntoView: true,
            notify: false
          });
          
          // Add streaming class
          messageElement.classList.add(CSS.message.streaming);
        } else {
          // Update existing message
          const messageData = this.state.messages.get(messageId);
          messageElement = messageData.element;
          
          // Update with streaming class
          messageElement.classList.add(CSS.message.streaming);
          
          // Update content if streaming is starting with content
          if (initialData.content) {
            this.updateMessage(messageId, {
              content: initialData.content
            }, { updateTimestamp: false, addToHistory: false });
          }
        }
        
        // Update streaming state
        this.state.streaming = {
          active: true,
          messageId,
          content: initialData.content || '',
          startTime: Date.now(),
          totalBytes: 0
        };
        
        // Hide thinking indicator if visible
        this.hideThinking();
        
        // Emit event
        this.eventBus.emit('streamingStarted', { 
          id: messageId,
          timestamp: Date.now() 
        });
        
        return messageElement;
      }
      
      /**
       * Append content to a streaming message
       */
      appendStreamContent(messageId, content, options = {}) {
        if (!this.state.initialized) return null;
        
        const {
          scrollIntoView = true,
          replace = false,
          updateDOM = true
        } = options;
        
        // Check if message exists
        const message = this.state.messages.get(messageId);
        if (!message) return null;
        
        const { element, data } = message;
        
        // Update streaming state
        const contentLength = content?.length || 0;
        this.state.streaming.totalBytes += contentLength;
        
        // Update message content
        if (replace) {
          this.state.streaming.content = content;
          data.content = content;
        } else {
          this.state.streaming.content += content;
          data.content = (data.content || '') + content;
        }
        
        // Update DOM if requested and enough content accumulated
        if (updateDOM) {
          // Schedule a low-priority update
          this.#scheduleUpdate(() => {
            // Get content container
            const contentElement = element.querySelector(`.${CSS.content.wrapper}`);
            if (!contentElement) return;
            
            // Get renderer and re-render
            const renderStrategy = RENDERERS.STREAMING;
            const renderer = this.state.messageRenderers.get(renderStrategy);
            
            if (renderer) {
              // Clear content
              DOM.empty(contentElement);
              
              // Apply renderer
              renderer(contentElement, data);
            }
          }, 20); // Lower priority number = higher priority
        }
        
        // Scroll into view if requested and user is at bottom
        if (scrollIntoView && this.state.scrollLocked) {
          this.scrollToBottom({ behavior: 'auto' });
        }
        
        return element;
      }
      
      /**
       * Stop streaming and finalize message
       */
      stopStreaming(messageId, finalContent = null) {
        if (!this.state.initialized) return null;
        
        // Check if message exists
        const message = this.state.messages.get(messageId);
        if (!message) return null;
        
        const { element, data } = message;
        
        // Remove streaming class
        element.classList.remove(CSS.message.streaming);
        
        // Update content if provided
        if (finalContent !== null) {
          // Handle string content
          if (typeof finalContent === 'string') {
            data.content = finalContent;
            this.state.streaming.content = finalContent;
          } 
          // Handle object with updates
          else if (finalContent && typeof finalContent === 'object') {
            Object.assign(data, finalContent);
            if (finalContent.content) {
              this.state.streaming.content = finalContent.content;
            }
          }
          
          // Update element
          this.updateMessage(messageId, data, { 
            updateTimestamp: false,
            addToHistory: false
          });
        }
        
        // Reset streaming state
        this.state.streaming = {
          active: false,
          messageId: null,
          content: '',
          startTime: 0,
          totalBytes: 0
        };
        
        // Announce to screen readers
        if (this.config.accessibility.announceMessages) {
          const announcement = `Claude: ${data.content}`;
          this.#announceToScreenReader(announcement);
        }
        
        // Scroll to bottom if locked
        if (this.state.scrollLocked) {
          this.scrollToBottom();
        }
        
        // Emit event
        this.eventBus.emit('streamingStopped', { 
          id: messageId,
          timestamp: Date.now(),
          totalBytes: this.state.streaming.totalBytes
        });
        
        return element;
      }
      
      /**
       * Show thinking indicator
       */
      showThinking(options = {}) {
        if (!this.state.initialized) return null;
        
        const {
          model = 'Claude',
          delay = 0,
          text = null
        } = options;
        
        // Hide existing indicator
        this.hideThinking();
        
        // Hide welcome screen if visible
        this.#hideWelcomeScreen();
        
        // Use delay if requested
        if (delay > 0) {
          setTimeout(() => {
            const indicator = this.#createThinkingIndicator(model, text);
            this.state.thinking = true;
            return indicator;
          }, delay);
          
          this.state.thinking = true;
          return null;
        } else {
          const indicator = this.#createThinkingIndicator(model, text);
          this.state.thinking = true;
          return indicator;
        }
      }
      
      /**
       * Hide thinking indicator
       */
      hideThinking(options = {}) {
        if (!this.state.initialized) return false;
        
        const thinkingIndicator = document.getElementById('thinkingIndicator');
        if (!thinkingIndicator) {
          this.state.thinking = false;
          return false;
        }
        
        const { animate = !this.config.animations.reducedMotion } = options;
        
        if (animate) {
          // Fade out
          this.components.animationController.fadeOut(thinkingIndicator, {
            duration: 250
          }).then(() => {
            thinkingIndicator.remove();
          });
        } else {
          // Remove immediately
          thinkingIndicator.remove();
        }
        
        this.state.thinking = false;
        return true;
      }
      
      /**
       * Scroll to the bottom of the chat
       */
      scrollToBottom(options = {}) {
        if (!this.state.initialized) return;
        
        const { behavior = this.config.scrollBehavior } = options;
        
        // Use virtual scroller if available
        if (this.components.virtualScroller) {
          this.components.virtualScroller.scrollToBottom({ behavior });
          return;
        }
        
        // Fallback to native scrolling
        const chatContainer = this.state.elements.get('chatContainer');
        if (!chatContainer) return;
        
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: this.config.animations.reducedMotion ? 'auto' : behavior
        });
        
        // Update scroll lock state
        this.state.scrollLocked = true;
        
        // Hide scroll button
        const scrollButton = this.state.elements.get('scrollToBottomBtn');
        if (scrollButton) {
          scrollButton.classList.remove('visible');
        }
      }
      
      /**
       * Scroll to a specific message
       */
      scrollToMessage(messageId, options = {}) {
        if (!this.state.initialized) return;
        
        const {
          behavior = this.config.scrollBehavior,
          block = 'center',
          focus = false
        } = options;
        
        // Use virtual scroller if available
        if (this.components.virtualScroller) {
          const result = this.components.virtualScroller.scrollToItem(messageId, { behavior, block });
          
          // Focus if requested
          if (focus && result) {
            const message = this.state.messages.get(messageId);
            if (message?.element) {
              message.element.focus();
              this.state.activeMessageId = messageId;
              
              // Add focus class briefly
              message.element.classList.add(CSS.message.focused);
              setTimeout(() => {
                message.element.classList.remove(CSS.message.focused);
              }, 2000);
            }
          }
          
          return;
        }
        
        // Fallback to native scrolling
        const message = this.state.messages.get(messageId);
        if (!message?.element) return;
        
        message.element.scrollIntoView({
          behavior: this.config.animations.reducedMotion ? 'auto' : behavior,
          block
        });
        
        // Focus if requested
        if (focus) {
          message.element.focus();
          this.state.activeMessageId = messageId;
          
          // Add focus class briefly
          message.element.classList.add(CSS.message.focused);
          setTimeout(() => {
            message.element.classList.remove(CSS.message.focused);
          }, 2000);
        }
      }
      
      /**
       * Update chat history UI in sidebar
       */
      updateChatHistoryUI(state) {
        if (!this.state.initialized) return;
        
        const chatHistory = this.state.elements.get('chatHistory');
        if (!chatHistory || !state.chats) return;
        
        // Update current chat ID
        this.state.currentChatId = state.currentChat?.id;
        
        // Use View Transitions API for smooth updates
        this.components.animationController.transition(() => {
          // Clear existing content
          DOM.empty(chatHistory);
          
          // Create document fragment for efficient insertion
          const fragment = document.createDocumentFragment();
          
          // Show empty state if no chats
          if (state.chats.length === 0) {
            const emptyItem = DOM.create('li', {
              props: { className: 'empty-history' },
              children: ['No chats yet']
            });
            fragment.appendChild(emptyItem);
          } else {
            // Add chat history items
            for (const chat of state.chats) {
              const isActive = chat.id === state.currentChat?.id;
              const chatItem = this.#createChatHistoryItem(chat, isActive);
              fragment.appendChild(chatItem);
            }
          }
          
          // Add to DOM
          chatHistory.appendChild(fragment);
        });
      }
      
      /**
       * Select a chat from history
       */
      selectChat(chatId) {
        if (!this.state.initialized) return;
        
        // Get chat history element
        const chatHistory = this.state.elements.get('chatHistory');
        if (!chatHistory) return;
        
        // Find all chat items
        const chatItems = chatHistory.querySelectorAll('li[data-chat-id]');
        
        // Update selected state
        for (const item of chatItems) {
          const isSelected = item.dataset.chatId === chatId;
          const button = item.querySelector('button');
          
          if (button) {
            button.classList.toggle('active', isSelected);
            button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
          }
        }
        
        // Update current chat ID
        this.state.currentChatId = chatId;
        
        // Emit event
        this.eventBus.emit('chatSelected', { chatId });
      }
      
      /**
       * Load a Wikipedia article
       */
      async loadWikipediaArticle(articleTitle) {
        if (!this.state.initialized) return null;
        
        try {
          // Extract title from URL if needed
          let title = articleTitle;
          if (articleTitle.includes('wikipedia.org')) {
            const url = new URL(articleTitle);
            const pathParts = url.pathname.split('/');
            title = pathParts[pathParts.length - 1];
          }
          
          // Decode URI component if needed
          title = decodeURIComponent(title.replace(/_/g, ' '));
          
          // Show loading state
          this.showThinking({ text: `Fetching Wikipedia article: ${title}` });
          
          // Use Wikipedia API
          const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to load article: ${response.statusText}`);
          }
          
          const article = await response.json();
          
          // Store in state
          this.state.wikipediaArticle = article;
          
          // Hide loading indicator
          this.hideThinking();
          
          // Emit event
          this.eventBus.emit('wikipediaArticleLoaded', { article });
          
          // Show article summary
          this.showArticleSummary(article, { addAsMessage: false });
          
          return article;
        } catch (error) {
          console.error('Error loading Wikipedia article:', error);
          
          // Show error toast
          this.#showToast({
            type: 'error',
            title: 'Error Loading Article',
            message: error.message || 'Failed to load Wikipedia article',
            duration: 5000
          });
          
          // Hide loading indicator
          this.hideThinking();
          
          // Emit error event
          this.eventBus.emit('wikipediaError', { error });
          
          return null;
        }
      }
      
      /**
       * Show article summary in UI
       */
      showArticleSummary(article, options = {}) {
        if (!this.state.initialized) return;
        
        const {
          addAsMessage = true,
          showImage = true
        } = options;
        
        const articleData = article || this.state.wikipediaArticle;
        if (!articleData) return;
        
        if (addAsMessage) {
          // Create message with article summary
          const message = {
            role: 'assistant',
            content: `**Wikipedia Summary: ${articleData.title}**\n\n${articleData.extract}`,
            type: 'wikiReference',
            metadata: {
              source: articleData.content_urls.desktop.page,
              title: articleData.title,
              image: showImage && articleData.thumbnail ? articleData.thumbnail.source : null,
              lastModified: articleData.timestamp
            }
          };
          
          // Add to chat
          this.addMessage(message);
        } else {
          // Show in modal
          const modal = DOM.create('div', {
            props: { className: CSS.ui.modal + ' wiki-modal' },
            children: [
              DOM.create('div', {
                props: { className: 'modal-content' },
                children: [
                  // Header
                  DOM.create('div', {
                    props: { className: 'modal-header' },
                    children: [
                      DOM.create('h3', { props: { textContent: articleData.title } }),
                      DOM.create('button', {
                        props: {
                          className: 'modal-close',
                          innerHTML: '&times;'
                        },
                        attrs: { 'aria-label': 'Close' },
                        events: { click: () => modal.remove() }
                      })
                    ]
                  }),
                  
                  // Article content
                  DOM.create('div', {
                    props: { className: 'wiki-content' },
                    children: [
                      // Image
                      showImage && articleData.thumbnail ? DOM.create('div', {
                        props: { className: 'wiki-image' },
                        children: [
                          DOM.create('img', {
                            attrs: {
                              src: articleData.thumbnail.source,
                              alt: articleData.title,
                              loading: 'lazy'
                            }
                          })
                        ]
                      }) : null,
                      
                      // Description
                      DOM.create('div', {
                        props: { 
                          className: 'wiki-description',
                          innerHTML: this.components.markdownRenderer 
                            ? this.components.markdownRenderer.render(articleData.extract)
                            : articleData.extract
                        }
                      })
                    ].filter(Boolean)
                  }),
                  
                  // Footer with links and actions
                  DOM.create('div', {
                    props: { className: 'wiki-footer' },
                    children: [
                      // Read more link
                      DOM.create('a', {
                        attrs: {
                          href: articleData.content_urls.desktop.page,
                          target: '_blank',
                          rel: 'noopener noreferrer'
                        },
                        props: {
                          className: 'wiki-link',
                          textContent: 'Read on Wikipedia'
                        }
                      }),
                      
                      // Citation button
                      DOM.create('button', {
                        props: {
                          className: `${CSS.ui.button} ${CSS.ui.secondary}`,
                          textContent: 'Generate Citation'
                        },
                        events: {
                          click: () => this.generateCitation(articleData)
                        }
                      }),
                      
                      // Add to chat button
                      DOM.create('button', {
                        props: {
                          className: `${CSS.ui.button} ${CSS.ui.primary}`,
                          textContent: 'Add to Chat'
                        },
                        events: {
                          click: () => {
                            this.showArticleSummary(articleData, { 
                              addAsMessage: true,
                              showImage
                            });
                            modal.remove();
                          }
                        }
                      })
                    ]
                  })
                ]
              })
            ]
          });
          
          // Add to body
          document.body.appendChild(modal);
          
          // Close when clicking outside
          modal.addEventListener('click', e => {
            if (e.target === modal) modal.remove();
          });
        }
      }
      
      /**
       * Generate citation for article
       */
      generateCitation(article, format = this.config.citationFormat.default) {
        if (!this.state.initialized) return null;
        
        const articleData = article || this.state.wikipediaArticle;
        if (!articleData) return null;
        
        // Get authors (for Wikipedia, it's "contributors")
        const author = "Wikipedia contributors";
        
        // Format date
        const publicationDate = new Date(articleData.timestamp);
        const formattedDate = publicationDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Format citation based on style
        let citation = '';
        
        switch (format.toUpperCase()) {
          case 'MLA':
            citation = `${author}. "${articleData.title}." <i>Wikipedia</i>, ${formattedDate}, ${articleData.content_urls.desktop.page}.`;
            break;
            
          case 'APA':
            citation = `${author}. (${publicationDate.getFullYear()}, ${publicationDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}). <i>${articleData.title}</i>. In <i>Wikipedia</i>. ${articleData.content_urls.desktop.page}`;
            break;
            
          case 'CHICAGO':
            citation = `${author}, "${articleData.title}," <i>Wikipedia</i>, last modified ${formattedDate}, ${articleData.content_urls.desktop.page}.`;
            break;
            
          case 'IEEE':
            citation = `"${articleData.title}," <i>Wikipedia</i>. [Online]. Available: ${articleData.content_urls.desktop.page}. [Accessed: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}].`;
            break;
            
          default:
            citation = `${author}. "${articleData.title}." <i>Wikipedia</i>, ${formattedDate}, ${articleData.content_urls.desktop.page}.`;
        }
        
        // Show toast with copy option
        this.#showToast({
          title: `${format.toUpperCase()} Citation`,
          message: citation,
          type: 'info',
          duration: 8000,
          actions: [
            {
              label: 'Copy',
              callback: () => {
                navigator.clipboard.writeText(citation.replace(/<\/?i>/g, ''))
                  .then(() => {
                    this.#showToast({
                      title: 'Citation Copied',
                      type: 'success',
                      duration: 2000
                    });
                  })
                  .catch(err => {
                    console.error('Failed to copy citation:', err);
                    this.#showToast({
                      title: 'Failed to Copy',
                      message: 'Could not copy to clipboard',
                      type: 'error',
                      duration: 3000
                    });
                  });
              }
            }
          ]
        });
        
        return citation;
      }
      
      /**
       * Subscribe to an event
       */
      on(eventName, handler) {
        return this.eventBus.on(eventName, handler);
      }
    }
    
    // ===============================================================
    // Initialize and Export Public API
    // ===============================================================
    
    // Create controller instance
    const controller = new Controller();
    
    // Return public API
    return {
      // Core functionality
      init: controller.init.bind(controller),
      destroy: controller.destroy.bind(controller),
      
      // Message management
      addMessage: controller.addMessage.bind(controller),
      updateMessage: controller.updateMessage.bind(controller),
      removeMessage: controller.removeMessage.bind(controller),
      startStreaming: controller.startStreaming.bind(controller),
      appendStreamContent: controller.appendStreamContent.bind(controller),
      stopStreaming: controller.stopStreaming.bind(controller),
      showThinking: controller.showThinking.bind(controller),
      hideThinking: controller.hideThinking.bind(controller),
      
      // Navigation
      scrollToBottom: controller.scrollToBottom.bind(controller),
      scrollToMessage: controller.scrollToMessage.bind(controller),
      
      // Chat history
      updateChatHistoryUI: controller.updateChatHistoryUI.bind(controller),
      selectChat: controller.selectChat.bind(controller),
      
      // Wikipedia integration
      loadWikipediaArticle: controller.loadWikipediaArticle.bind(controller),
      showArticleSummary: controller.showArticleSummary.bind(controller),
      generateCitation: controller.generateCitation.bind(controller),
      
      // Event handling
      on: controller.on.bind(controller)
    };
  })();
  
  // Support module systems
  if (typeof exports !== 'undefined') {
    exports.UIController = UIController;
  }
  
  if (typeof window !== 'undefined') {
    window.UIController = UIController;
  }
  
  export default UIController;