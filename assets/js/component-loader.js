/**
 * Advanced Component Loader System
 * 
 * A high-performance, framework-agnostic component system for dynamic web applications.
 * Features include:
 * - Optimized template loading and caching with preloading support
 * - Advanced data binding with expressions, computed properties and directives
 * - Component lifecycle management and state tracking
 * - Memory-efficient virtual DOM-like recycling
 * - Performance optimizations with batch rendering
 * - Support for Web Components integration
 * 
 * @version 2.0.0
 * @license MIT
 */

/**
 * @typedef {Object} ComponentInstance
 * @property {HTMLElement} element - The component's root element
 * @property {Object} state - The component's internal state
 * @property {Function} update - Function to update the component with new data
 * @property {Function} destroy - Function to clean up the component
 */

/**
 * @typedef {Object} ComponentOptions
 * @property {Object} data - Initial data for the component
 * @property {Object} methods - Methods to attach to the component instance
 * @property {Object} computed - Computed properties for the component
 * @property {Object} hooks - Lifecycle hooks for the component
 * @property {boolean} shadow - Whether to use Shadow DOM
 * @property {string[]} observedAttributes - Attributes to observe for changes
 * @property {boolean} useShadow - Whether to use Shadow DOM
 */

/**
 * Symbol used for storing private component state
 * @type {Symbol}
 */
const COMPONENT_STATE = Symbol('component-state');

/**
 * Symbol used for storing reactive properties
 * @type {Symbol}
 */
const REACTIVE_PROPS = Symbol('reactive-props');

/**
 * Symbol for marking nodes that should be preserved during updates
 * @type {Symbol}
 */
const PRESERVE_NODE = Symbol('preserve-node');

/**
 * Environment detection for development features
 * @type {boolean}
 */
const IS_DEV = process?.env?.NODE_ENV !== 'production' || 
               window?.localStorage?.getItem('debug-component-loader') === 'true';

/**
 * Performance monitoring in development mode
 * @type {boolean}
 */
const PERF_MONITORING = IS_DEV && window?.localStorage?.getItem('perf-component-loader') === 'true';

class ComponentLoader {
    /**
     * Creates a new ComponentLoader instance
     */
    constructor() {
        // Cache for loaded templates with advanced metadata
        this.#templateCache = new Map();
        
        // Cache for compiled templates for maximum performance
        this.#compiledTemplateCache = new Map();
        
        // Track loading promises to prevent duplicate fetches
        this.#loadingPromises = new Map();
        
        // Store registered event handlers for cleanup
        this.#eventRegistry = new WeakMap();
        
        // Store component registry for globally available components
        this.#componentRegistry = new Map();
        
        // Store component instances for lifecycle management
        this.#componentInstances = new WeakMap();
        
        // Global event bus for component communication
        this.#eventBus = new EventEmitter();
        
        // Track rendering tasks for batching
        this.#renderQueue = new Set();
        this.#isRenderScheduled = false;
        
        // Template pool for recycling
        this.#templatePool = new Map();
        
        // Performance metrics
        this.metrics = {
            renders: 0,
            templatesLoaded: 0,
            componentsCreated: 0,
            renderTime: 0
        };
        
        // Setup MutationObserver for tracking DOM changes
        if (typeof MutationObserver !== 'undefined') {
            this.#setupDomObserver();
        }
        
        // Initialize expression evaluator
        this.#expressionEvaluator = new ExpressionEvaluator();
        
        // Add built-in directives
        this.#registerBuiltInDirectives();
    }
    
    // Private properties for encapsulation
    #templateCache;
    #compiledTemplateCache;
    #loadingPromises;
    #eventRegistry;
    #componentRegistry;
    #componentInstances;
    #eventBus;
    #renderQueue;
    #isRenderScheduled;
    #domObserver;
    #expressionEvaluator;
    #directives = new Map();
    #templatePool;
    #recyclePool = new WeakMap();

    /**
     * Get the global event bus for component communication
     * @returns {EventEmitter} The event bus
     */
    get eventBus() {
        return this.#eventBus;
    }
    
    /**
     * Configure the component loader with global options
     * @param {Object} options - Configuration options
     * @param {boolean} [options.useShadowDOM=false] - Whether to use Shadow DOM by default
     * @param {boolean} [options.precompileTemplates=true] - Whether to precompile templates
     * @param {number} [options.cacheSize=100] - Maximum number of templates to cache
     * @param {string} [options.baseUrl=''] - Base URL for template paths
     * @returns {ComponentLoader} This instance for chaining
     */
    configure(options = {}) {
        this.options = {
            useShadowDOM: false,
            precompileTemplates: true,
            cacheSize: 100,
            baseUrl: '',
            ...options
        };
        
        return this;
    }

    /**
     * Register a custom directive
     * @param {string} name - Name of the directive (without data- prefix)
     * @param {Function} handler - Handler function for the directive
     * @returns {ComponentLoader} This instance for chaining
     */
    registerDirective(name, handler) {
        if (typeof handler !== 'function') {
            throw new Error(`Directive handler for '${name}' must be a function`);
        }
        
        this.#directives.set(name, handler);
        return this;
    }

    /**
     * Register built-in directives
     * @private
     */
    #registerBuiltInDirectives() {
        // Conditional rendering
        this.registerDirective('if', (element, value, data, component) => {
            const result = this.#expressionEvaluator.evaluate(value, data, component);
            if (!result) {
                if (element.parentNode) {
                    // Store the element for potential reuse
                    const placeholder = document.createComment(`if: ${value}`);
                    element.parentNode.insertBefore(placeholder, element);
                    element[PRESERVE_NODE] = true; // Mark for preservation
                    element.remove();
                    placeholder[PRESERVE_NODE] = element;
                }
            }
            return result;
        });

        // List rendering with optimized diffing
        this.registerDirective('for', (element, value, data, component) => {
            const forMatch = value.match(/([^,\s]+)(?:\s*,\s*([^,\s]+))?\s+in\s+([^,\s]+)/);
            if (!forMatch) return false;
            
            const [, itemVar, indexVar, collectionPath] = forMatch;
            const collection = this.#expressionEvaluator.evaluate(collectionPath, data, component);
            
            if (!Array.isArray(collection)) return false;
            
            const parent = element.parentNode;
            if (!parent) return false;
            
            // Get or create a template
            const templateKey = `for:${itemVar}:${component?.id || 'anonymous'}`;
            let template = this.#templatePool.get(templateKey);
            
            if (!template) {
                template = element.cloneNode(true);
                template.removeAttribute('data-for');
                this.#templatePool.set(templateKey, template);
            }
            
            // Store existing elements for recycling
            const existingElements = Array.from(parent.children)
                .filter(el => el.dataset && el.dataset.forItem === itemVar);
            
            // Create a fragment for new elements
            const fragment = document.createDocumentFragment();
            
            // Track which existing elements are reused
            const reused = new Set();
            
            // Process each item in collection
            collection.forEach((item, index) => {
                // Try to find an existing element to reuse with same key
                const key = item && item.id ? item.id : index;
                let newElement = existingElements.find(el => {
                    return el.dataset.forKey === String(key) && !reused.has(el);
                });
                
                const isReused = !!newElement;
                
                if (!newElement) {
                    newElement = template.cloneNode(true);
                }
                
                // Mark this element as used
                if (isReused) reused.add(newElement);
                
                // Set data attributes for identification
                newElement.dataset.forItem = itemVar;
                newElement.dataset.forKey = key;
                
                // Create context for this item
                const itemData = {
                    ...data,
                    [itemVar]: item,
                    ...(indexVar ? { [indexVar]: index } : {}),
                    $index: index,
                    $first: index === 0,
                    $last: index === collection.length - 1
                };
                
                // Process the element with item data if it's new
                if (!isReused) {
                    this.#processElement(newElement, itemData, component);
                } else {
                    // Just update the data slots for better performance
                    this.#updateDataBindings(newElement, itemData, component);
                }
                
                fragment.appendChild(newElement);
            });
            
            // Remove elements that weren't reused
            existingElements.forEach(el => {
                if (!reused.has(el) && el.parentNode === parent) {
                    el.remove();
                }
            });
            
            // Original element is the template, remove it if it's still in the DOM
            if (element.parentNode === parent) {
                element.remove();
            }
            
            // Append the fragment with all elements
            parent.appendChild(fragment);
            
            return true;
        });

        // Two-way binding for form elements
        this.registerDirective('bind', (element, value, data, component) => {
            const path = value.trim();
            
            // Set initial value
            const currentValue = this.#expressionEvaluator.evaluate(path, data, component);
            this.#setElementValue(element, currentValue);
            
            // Add event listener for updates
            const updateHandler = (e) => {
                const newValue = this.#getElementValue(element);
                this.#setNestedValue(data, path, newValue);
                
                // If component has state tracking, update
                if (component && component.state) {
                    component.state[path] = newValue;
                    component.update(data);
                }
            };
            
            // Different events for different element types
            const eventType = this.#getInputEventType(element);
            
            // Store and attach handler
            this.#addComponentEvent(component, element, eventType, updateHandler);
            
            return true;
        });

        // Event handling
        this.registerDirective('on', (element, value, data, component) => {
            const [eventName, handlerExpr] = value.split(':').map(s => s.trim());
            if (!eventName || !handlerExpr) return false;
            
            const handler = (event) => {
                const result = this.#expressionEvaluator.evaluate(handlerExpr, {
                    ...data,
                    $event: event,
                    $el: element
                }, component);
                
                // If result is a function, call it with event
                if (typeof result === 'function') {
                    result(event);
                }
            };
            
            this.#addComponentEvent(component, element, eventName, handler);
            return true;
        });

        // Model directive (combination of bind and input event)
        this.registerDirective('model', (element, value, data, component) => {
            // Apply bind directive first
            this.#directives.get('bind')(element, value, data, component);
            
            // Generate the corresponding on directive
            const eventType = this.#getInputEventType(element);
            const onExpr = `${eventType}:${value} = $event.target.value`;
            this.#directives.get('on')(element, onExpr, data, component);
            
            return true;
        });

        // Class binding with object syntax
        this.registerDirective('class', (element, value, data, component) => {
            // Handle object syntax: {"class-name": condition}
            try {
                const classObj = this.#expressionEvaluator.evaluate(value, data, component);
                
                if (typeof classObj === 'object' && classObj !== null) {
                    Object.entries(classObj).forEach(([className, condition]) => {
                        if (Boolean(condition)) {
                            element.classList.add(className);
                        } else {
                            element.classList.remove(className);
                        }
                    });
                } else if (typeof classObj === 'string') {
                    // Direct class name
                    element.className = classObj;
                }
                return true;
            } catch (error) {
                console.error(`Error processing class directive: ${value}`, error);
                return false;
            }
        });

        // Style binding with object syntax
        this.registerDirective('style', (element, value, data, component) => {
            try {
                const styleObj = this.#expressionEvaluator.evaluate(value, data, component);
                
                if (typeof styleObj === 'object' && styleObj !== null) {
                    Object.entries(styleObj).forEach(([prop, val]) => {
                        if (val === null || val === undefined) {
                            element.style.removeProperty(prop);
                        } else {
                            element.style.setProperty(
                                prop.replace(/([A-Z])/g, '-$1').toLowerCase(),
                                String(val)
                            );
                        }
                    });
                }
                return true;
            } catch (error) {
                console.error(`Error processing style directive: ${value}`, error);
                return false;
            }
        });
        
        // Ref directive for getting direct element references
        this.registerDirective('ref', (element, value, data, component) => {
            if (!component) return false;
            
            // Initialize refs object if it doesn't exist
            component.refs = component.refs || {};
            component.refs[value] = element;
            return true;
        });
        
        // HTML content (safer version of innerHTML)
        this.registerDirective('html', (element, value, data, component) => {
            const content = this.#expressionEvaluator.evaluate(value, data, component);
            
            // Sanitize HTML content
            const sanitized = this.#sanitizeHtml(content || '');
            element.innerHTML = sanitized;
            return true;
        });
    }
    
    /**
     * Register a component globally for reuse
     * @param {string} name - Component name
     * @param {Object} options - Component options
     * @param {string} options.template - Component template path or HTML string
     * @param {Object} [options.methods={}] - Component methods
     * @param {Object} [options.computed={}] - Computed properties
     * @param {Object} [options.hooks={}] - Lifecycle hooks
     * @param {boolean} [options.shadow=false] - Use Shadow DOM
     * @returns {ComponentLoader} This instance for chaining
     */
    registerComponent(name, options) {
        if (this.#componentRegistry.has(name)) {
            console.warn(`Component '${name}' is being overwritten.`);
        }
        
        this.#componentRegistry.set(name, options);
        
        // Preload template if it's a path
        if (options.template && options.template.includes('/')) {
            this.preloadTemplate(options.template);
        }
        
        return this;
    }
    
    /**
     * Preload templates for improved performance
     * @param {string|string[]} templates - Template path(s) to preload
     * @returns {Promise<void>}
     */
    async preloadTemplate(templates) {
        const paths = Array.isArray(templates) ? templates : [templates];
        
        const loadPromises = paths.map(path => {
            return this.loadTemplate(path).catch(err => {
                console.warn(`Failed to preload template ${path}:`, err);
            });
        });
        
        await Promise.all(loadPromises);
    }
    
    /**
     * Convert a template string to a document fragment
     * @param {string} html - HTML template string
     * @returns {DocumentFragment} The parsed fragment
     * @private
     */
    #parseTemplate(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.cloneNode(true);
    }
    
    /**
     * Compile a template for optimized rendering
     * @param {HTMLTemplateElement} template - Template to compile
     * @returns {Function} Compiled render function
     * @private
     */
    #compileTemplate(template) {
        // This would typically create an optimized function for faster rendering
        // In a production system, this would generate efficient JavaScript to create elements
        
        // For now, we'll use a simple function that clones the template
        return (data, component) => {
            const clone = document.importNode(template.content, true);
            this.#processElement(clone, data, component);
            return clone;
        };
    }

    /**
     * Load a template from the given path
     * @param {string} templatePath - Path to the template file, optionally with fragment ID
     * @returns {Promise<HTMLTemplateElement>} The loaded template element
     */
    async loadTemplate(templatePath) {
        if (PERF_MONITORING) {
            console.time(`Load template: ${templatePath}`);
        }
        
        // Check if we're requesting a specific template by ID
        let path = templatePath;
        let templateId = null;
        
        if (path.includes('#')) {
            [path, templateId] = path.split('#');
        }
        
        // Apply base URL if configured
        if (this.options && this.options.baseUrl) {
            path = `${this.options.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
        }
        
        // Return cached template if available
        const cacheKey = templateId ? `${path}#${templateId}` : path;
        if (this.#templateCache.has(cacheKey)) {
            const cachedTemplate = this.#templateCache.get(cacheKey);
            
            // Update last accessed time for LRU cache
            cachedTemplate.lastAccessed = Date.now();
            
            if (PERF_MONITORING) {
                console.timeEnd(`Load template: ${templatePath}`);
            }
            
            return cachedTemplate.template;
        }
        
        // Return existing promise if already loading this path
        if (this.#loadingPromises.has(path)) {
            const loadPromise = this.#loadingPromises.get(path);
            
            // If requesting a specific template by ID, wait for file to load, then get specific template
            if (templateId) {
                return loadPromise.then(() => {
                    const specificTemplate = this.#templateCache.get(cacheKey)?.template;
                    if (!specificTemplate) {
                        throw new Error(`Template with ID "${templateId}" not found in ${path}`);
                    }
                    return specificTemplate;
                });
            }
            
            return loadPromise;
        }
        
        try {
            // Create new loading promise for this path
            const loadingPromise = (async () => {
                let response;
                try {
                    response = await fetch(path, { cache: 'no-cache' });
                    
                    if (!response.ok) {
                        throw new Error(`Failed to load template: ${path} (Status: ${response.status})`);
                    }
                } catch (error) {
                    this.#loadingPromises.delete(path);
                    throw error;
                }
                
                const html = await response.text();
                const result = this.#processTemplateFile(html, path, templateId);
                this.#loadingPromises.delete(path);
                
                // Check cache size and potentially clean up old entries
                this.#manageCacheSize();
                
                if (PERF_MONITORING) {
                    this.metrics.templatesLoaded++;
                    console.timeEnd(`Load template: ${templatePath}`);
                }
                
                return templateId ? result[cacheKey] : result[path];
            })();
            
            this.#loadingPromises.set(path, loadingPromise);
            return loadingPromise;
        } catch (error) {
            this.#loadingPromises.delete(path);
            throw error;
        }
    }
    
    /**
     * Process an HTML template file and cache all templates
     * @param {string} html - HTML content of the template file
     * @param {string} path - Original path to the template file
     * @param {string|null} requestedId - ID of the specifically requested template
     * @returns {Object} Object mapping paths to templates
     * @private
     */
    #processTemplateFile(html, path, requestedId) {
        const now = Date.now();
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = html.trim();
        
        // Find all template elements and cache them individually
        const templates = tempContainer.querySelectorAll('template');
        const result = {};
        let defaultTemplate = null;
        
        // If no template tags found, treat the entire HTML as a template
        if (templates.length === 0) {
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            defaultTemplate = template;
            
            // Cache the template
            this.#templateCache.set(path, {
                template,
                lastAccessed: now,
                source: path,
                compiled: this.options?.precompileTemplates ? this.#compileTemplate(template) : null
            });
            
            result[path] = template;
        } else {
            // Process each template element
            templates.forEach(template => {
                const id = template.id || '';
                const key = id ? `${path}#${id}` : path;
                
                // Store in cache
                this.#templateCache.set(key, {
                    template,
                    lastAccessed: now,
                    source: path,
                    id: id || null,
                    compiled: this.options?.precompileTemplates ? this.#compileTemplate(template) : null
                });
                
                result[key] = template;
                
                // If this is the first template without ID, use as default
                if (!defaultTemplate && !template.id) {
                    defaultTemplate = template;
                }
            });
            
            // If no specific default template found, use the first one
            if (!defaultTemplate && templates.length > 0) {
                defaultTemplate = templates[0];
            }
            
            // Store default template reference
            if (defaultTemplate) {
                this.#templateCache.set(path, {
                    template: defaultTemplate,
                    lastAccessed: now,
                    source: path,
                    id: defaultTemplate.id || null,
                    compiled: this.options?.precompileTemplates ? 
                        this.#compileTemplate(defaultTemplate) : null
                });
                
                result[path] = defaultTemplate;
            }
        }
        
        return result;
    }
    
    /**
     * Manage the template cache size
     * @private
     */
    #manageCacheSize() {
        if (!this.options?.cacheSize || this.#templateCache.size <= this.options.cacheSize) {
            return;
        }
        
        // Get all cache entries sorted by least recently used
        const entries = Array.from(this.#templateCache.entries())
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        // Remove oldest entries until we're below the cache size
        const entriesToRemove = entries.slice(0, this.#templateCache.size - this.options.cacheSize);
        for (const [key] of entriesToRemove) {
            this.#templateCache.delete(key);
        }
        
        if (IS_DEV) {
            console.debug(`Cleaned up ${entriesToRemove.length} templates from cache`);
        }
    }
    
    /**
     * Create a component instance from a template
     * @param {string} templatePath - Path to the template
     * @param {Object} [options={}] - Component options
     * @param {Object} [options.data={}] - Initial data
     * @param {Object} [options.methods={}] - Component methods
     * @param {Object} [options.computed={}] - Computed properties
     * @param {Object} [options.hooks={}] - Lifecycle hooks
     * @param {boolean} [options.shadow=false] - Use Shadow DOM
     * @returns {Promise<ComponentInstance>} The created component
     */
    async createComponent(templatePath, options = {}) {
        if (PERF_MONITORING) {
            console.time(`Create component: ${templatePath}`);
        }
        
        const {
            data = {},
            methods = {},
            computed = {},
            hooks = {},
            shadow = this.options?.useShadowDOM || false
        } = options;
        
        try {
            // Load the template
            const template = await this.loadTemplate(templatePath);
            
            // Generate a unique ID for this component instance
            const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;
            
            // Create the component root element
            const root = document.createElement('div');
            root.dataset.component = componentId;
            
            // Use shadow DOM if requested
            const renderTarget = shadow ? root.attachShadow({ mode: 'open' }) : root;
            
            // Clone the template content
            const content = document.importNode(template.content, true);
            
            // Create component state with reactive properties
            const state = this.#createReactiveState(data, componentId);
            
            // Add computed properties
            for (const [key, fn] of Object.entries(computed)) {
                Object.defineProperty(state, key, {
                    get: () => fn.call(state, state),
                    enumerable: true,
                    configurable: true
                });
            }
            
            // Create component instance object
            const component = {
                id: componentId,
                element: root,
                renderTarget,
                state,
                methods: {},
                refs: {},
                hooks: { ...hooks },
                shadow,
                
                /**
                 * Update component with new data
                 * @param {Object} newData - New data to merge with current state
                 * @param {boolean} [immediate=false] - Whether to update immediately or batch
                 */
                update(newData = {}, immediate = false) {
                    // Merge new data into state
                    Object.assign(state, newData);
                    
                    // Schedule re-render
                    if (immediate) {
                        componentLoader.#updateComponent(component);
                    } else {
                        componentLoader.#queueRender(component);
                    }
                },
                
                /**
                 * Mount component to a container element
                 * @param {HTMLElement} container - Container element
                 * @returns {ComponentInstance} This component instance
                 */
                mount(container) {
                    if (!container) {
                        throw new Error('Container element is required for mounting');
                    }
                    
                    // Trigger beforeMount hook if available
                    if (hooks.beforeMount) {
                        hooks.beforeMount.call(state, component);
                    }
                    
                    // Append to container
                    container.appendChild(root);
                    
                    // Trigger mounted hook if available
                    if (hooks.mounted) {
                        hooks.mounted.call(state, component);
                    }
                    
                    return component;
                },
                
                /**
                 * Destroy the component and clean up resources
                 */
                destroy() {
                    // Trigger beforeDestroy hook if available
                    if (hooks.beforeDestroy) {
                        hooks.beforeDestroy.call(state, component);
                    }
                    
                    // Remove event listeners
                    componentLoader.#cleanupComponentEvents(component);
                    
                    // Remove from DOM
                    if (root.parentNode) {
                        root.parentNode.removeChild(root);
                    }
                    
                    // Remove from component instances
                    componentLoader.#componentInstances.delete(root);
                    
                    // Trigger destroyed hook if available
                    if (hooks.destroyed) {
                        hooks.destroyed.call(state, component);
                    }
                }
            };
            
            // Add methods to component
            for (const [name, fn] of Object.entries(methods)) {
                component.methods[name] = fn.bind(state);
                // Also add to state for easier access
                state[name] = component.methods[name];
            }
            
            // Process the template content
            this.#processElement(content, state, component);
            
            // Append to render target
            renderTarget.appendChild(content);
            
            // Store component instance for lifecycle management
            this.#componentInstances.set(root, component);
            
            // Execute created hook if provided
            if (hooks.created) {
                hooks.created.call(state, component);
            }
            
            if (PERF_MONITORING) {
                this.metrics.componentsCreated++;
                console.timeEnd(`Create component: ${templatePath}`);
            }
            
            return component;
        } catch (error) {
            console.error(`Error creating component from "${templatePath}":`, error);
            if (PERF_MONITORING) {
                console.timeEnd(`Create component: ${templatePath}`);
            }
            throw error;
        }
    }
    
    /**
     * Create a reactive state object that triggers updates on changes
     * @param {Object} data - Initial data
     * @param {string} componentId - Component ID
     * @returns {Object} Reactive state object
     * @private
     */
    #createReactiveState(data, componentId) {
        const reactiveProps = new Set();
        const state = {};
        
        // Create getters/setters for each property
        for (const [key, value] of Object.entries(data)) {
            let val = value;
            reactiveProps.add(key);
            
            Object.defineProperty(state, key, {
                get() {
                    return val;
                },
                set(newVal) {
                    const oldVal = val;
                    val = newVal;
                    
                    // Only trigger updates if the value actually changed
                    if (newVal !== oldVal) {
                        const component = componentLoader.#findComponentById(componentId);
                        if (component) {
                            componentLoader.#queueRender(component);
                        }
                    }
                },
                enumerable: true,
                configurable: true
            });
        }
        
        // Store reactive props for potential optimization
        state[REACTIVE_PROPS] = reactiveProps;
        
        return state;
    }
    
    /**
     * Find a component by its ID
     * @param {string} id - Component ID
     * @returns {ComponentInstance|null} Component instance or null if not found
     * @private
     */
    #findComponentById(id) {
        for (const [element, component] of this.#componentInstances.entries()) {
            if (component.id === id) {
                return component;
            }
        }
        return null;
    }
    
    /**
     * Queue a component for rendering
     * @param {ComponentInstance} component - Component to render
     * @private
     */
    #queueRender(component) {
        // Add to queue
        this.#renderQueue.add(component);
        
        // Schedule batch processing if not already scheduled
        if (!this.#isRenderScheduled) {
            this.#isRenderScheduled = true;
            requestAnimationFrame(() => this.#processRenderQueue());
        }
    }
    
        /**
     * Process the render queue to update components
     * @private
     */
    #processRenderQueue() {
        if (PERF_MONITORING) {
            console.time('Process render queue');
        }
        
        // Clone the queue and clear it before processing
        // This prevents issues if updates trigger more updates
        const components = [...this.#renderQueue];
        this.#renderQueue.clear();
        this.#isRenderScheduled = false;
        
        // Update each component
        components.forEach(component => {
            this.#updateComponent(component);
        });
        
        if (PERF_MONITORING) {
            this.metrics.renders += components.length;
            console.timeEnd('Process render queue');
        }
    }
    
    /**
     * Update a component with its current state
     * @param {ComponentInstance} component - Component to update
     * @private
     */
    #updateComponent(component) {
        if (PERF_MONITORING) {
            console.time(`Update component: ${component.id}`);
        }
        
        try {
            // Call beforeUpdate hook if available
            if (component.hooks.beforeUpdate) {
                component.hooks.beforeUpdate.call(component.state, component);
            }
            
            // Get all elements with data bindings
            const elements = component.renderTarget.querySelectorAll('[data-slot], [data-if], [data-for], [data-bind], [data-attr]');
            
            // Update each element
            elements.forEach(element => {
                this.#updateElement(element, component.state, component);
            });
            
            // Call updated hook if available
            if (component.hooks.updated) {
                component.hooks.updated.call(component.state, component);
            }
        } catch (error) {
            console.error(`Error updating component ${component.id}:`, error);
        }
        
        if (PERF_MONITORING) {
            console.timeEnd(`Update component: ${component.id}`);
        }
    }
    
    /**
     * Update a single element based on its data bindings
     * @param {HTMLElement} element - Element to update
     * @param {Object} data - Data to use for updates
     * @param {ComponentInstance} component - Component instance
     * @private
     */
    #updateElement(element, data, component) {
        // Skip elements that are marked for preservation
        if (element[PRESERVE_NODE]) {
            return;
        }
        
        // Process directives in priority order
        
        // 1. data-if (conditional rendering)
        if (element.hasAttribute('data-if')) {
            const condition = element.getAttribute('data-if');
            const handler = this.#directives.get('if');
            
            if (handler) {
                const result = handler(element, condition, data, component);
                
                // If condition is false, return since element is removed
                if (!result) return;
            }
        }
        
        // 2. data-for (list rendering)
        if (element.hasAttribute('data-for')) {
            const forExpr = element.getAttribute('data-for');
            const handler = this.#directives.get('for');
            
            if (handler) {
                const result = handler(element, forExpr, data, component);
                
                // If list was rendered, return since the original element is removed
                if (result) return;
            }
        }
        
        // 3. data-bind (two-way binding)
        if (element.hasAttribute('data-bind')) {
            const bindExpr = element.getAttribute('data-bind');
            const handler = this.#directives.get('bind');
            
            if (handler) {
                handler(element, bindExpr, data, component);
            }
        }
        
        // 4. data-slot (content binding)
        if (element.hasAttribute('data-slot')) {
            const slotName = element.getAttribute('data-slot');
            const slotValue = this.#expressionEvaluator.evaluate(slotName, data, component);
            
            if (slotValue !== undefined) {
                // Check if the element is an input, select, or textarea
                if (['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
                    this.#setElementValue(element, slotValue);
                } else {
                    // For other elements, update textContent
                    element.textContent = slotValue !== null ? slotValue : '';
                }
            }
        }
        
        // 5. data-html (HTML content)
        if (element.hasAttribute('data-html')) {
            const htmlExpr = element.getAttribute('data-html');
            const handler = this.#directives.get('html');
            
            if (handler) {
                handler(element, htmlExpr, data, component);
            }
        }
        
        // 6. data-attr (attribute binding)
        if (element.hasAttribute('data-attr')) {
            const attrBindings = element.getAttribute('data-attr').split(';');
            
            attrBindings.forEach(binding => {
                const [attr, expr] = binding.split(':').map(s => s.trim());
                if (!attr || !expr) return;
                
                const value = this.#expressionEvaluator.evaluate(expr, data, component);
                
                if (value === false || value === null || value === undefined) {
                    element.removeAttribute(attr);
                } else if (value === true) {
                    element.setAttribute(attr, '');
                } else {
                    element.setAttribute(attr, String(value));
                }
            });
        }
        
        // 7. data-class (class binding)
        if (element.hasAttribute('data-class')) {
            const classExpr = element.getAttribute('data-class');
            const handler = this.#directives.get('class');
            
            if (handler) {
                handler(element, classExpr, data, component);
            }
        }
        
        // 8. data-style (style binding)
        if (element.hasAttribute('data-style')) {
            const styleExpr = element.getAttribute('data-style');
            const handler = this.#directives.get('style');
            
            if (handler) {
                handler(element, styleExpr, data, component);
            }
        }
        
        // Process custom directives
        for (const [name, handler] of this.#directives.entries()) {
            const attrName = `data-${name}`;
            
            // Skip directives we've already processed
            if (['if', 'for', 'bind', 'html', 'attr', 'class', 'style'].includes(name)) {
                continue;
            }
            
            if (element.hasAttribute(attrName)) {
                const value = element.getAttribute(attrName);
                handler(element, value, data, component);
            }
        }
    }
    
    /**
     * Process an element and all its children with directive handling
     * @param {Node} element - Element or document fragment to process
     * @param {Object} data - Data to use for binding
     * @param {ComponentInstance} component - Component instance
     * @private
     */
    #processElement(element, data, component) {
        // For document fragments, process all child nodes
        if (element.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            Array.from(element.childNodes).forEach(child => {
                this.#processElement(child, data, component);
            });
            return;
        }
        
        // Skip non-element nodes
        if (element.nodeType !== Node.ELEMENT_NODE) return;
        
        // Process this element
        this.#updateElement(element, data, component);
        
        // Process child elements (if this element wasn't removed by directives)
        if (element.parentNode && !element[PRESERVE_NODE]) {
            // Create a static array from childNodes to avoid issues with live collection
            Array.from(element.childNodes).forEach(child => {
                this.#processElement(child, data, component);
            });
        }
    }
    
    /**
     * Set up DOM observer for automatic component initialization
     * @private
     */
    #setupDomObserver() {
        this.#domObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check for component loading attributes
                            if (node.hasAttribute('data-component')) {
                                this.#initializeAutoLoadedComponent(node);
                            }
                            
                            // Check children for components
                            const childComponents = node.querySelectorAll('[data-component]');
                            childComponents.forEach(el => this.#initializeAutoLoadedComponent(el));
                        }
                    });
                }
            }
        });
        
        // Start observing once DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.#domObserver.observe(document.body, { childList: true, subtree: true });
                this.#initializeAutoLoadedComponents();
            });
        } else {
            this.#domObserver.observe(document.body, { childList: true, subtree: true });
            this.#initializeAutoLoadedComponents();
        }
    }
    
    /**
     * Initialize all auto-loaded components in the document
     * @private
     */
    #initializeAutoLoadedComponents() {
        const componentElements = document.querySelectorAll('[data-component]');
        componentElements.forEach(el => this.#initializeAutoLoadedComponent(el));
    }
    
    /**
     * Initialize a single auto-loaded component
     * @param {HTMLElement} element - Element with data-component attribute
     * @private
     */
    #initializeAutoLoadedComponent(element) {
        const componentName = element.getAttribute('data-component');
        const registryEntry = this.#componentRegistry.get(componentName);
        
        if (!registryEntry) {
            console.warn(`Component "${componentName}" not found in registry`);
            return;
        }
        
        // Parse data attributes to get component data
        const data = {};
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-prop-')) {
                const propName = attr.name.replace('data-prop-', '');
                data[propName] = attr.value;
            }
        }
        
        // Check for JSON data
        if (element.hasAttribute('data-props')) {
            try {
                const jsonData = JSON.parse(element.getAttribute('data-props'));
                Object.assign(data, jsonData);
            } catch (error) {
                console.error('Invalid JSON in data-props:', error);
            }
        }
        
        // Create component
        this.createComponent(registryEntry.template, {
            ...registryEntry,
            data: { ...registryEntry.data, ...data }
        }).then(component => {
            // Replace the original element with the component
            element.parentNode.replaceChild(component.element, element);
            
            // Call mounted hook manually since we didn't use mount()
            if (component.hooks.mounted) {
                component.hooks.mounted.call(component.state, component);
            }
        }).catch(error => {
            console.error(`Failed to initialize component "${componentName}":`, error);
        });
    }
    
    /**
     * Add an event handler to an element with component tracking
     * @param {ComponentInstance} component - Component instance
     * @param {HTMLElement} element - Target element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @private
     */
    #addComponentEvent(component, element, event, handler) {
        // Add event listener
        element.addEventListener(event, handler);
        
        // Store handler for cleanup
        if (!this.#eventRegistry.has(component)) {
            this.#eventRegistry.set(component, new Map());
        }
        
        if (!this.#eventRegistry.get(component).has(element)) {
            this.#eventRegistry.get(component).set(element, new Map());
        }
        
        if (!this.#eventRegistry.get(component).get(element).has(event)) {
            this.#eventRegistry.get(component).get(element).set(event, []);
        }
        
        this.#eventRegistry.get(component).get(element).get(event).push(handler);
    }
    
    /**
     * Clean up all event handlers for a component
     * @param {ComponentInstance} component - Component instance
     * @private
     */
    #cleanupComponentEvents(component) {
        if (!this.#eventRegistry.has(component)) return;
        
        const elementMap = this.#eventRegistry.get(component);
        
        for (const [element, events] of elementMap.entries()) {
            for (const [event, handlers] of events.entries()) {
                for (const handler of handlers) {
                    element.removeEventListener(event, handler);
                }
            }
        }
        
        this.#eventRegistry.delete(component);
    }
    
    /**
     * Get appropriate event type for input binding
     * @param {HTMLElement} element - Form element
     * @returns {string} Event type
     * @private
     */
    #getInputEventType(element) {
        const tag = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();
        
        if (tag === 'select' || ['checkbox', 'radio'].includes(type)) {
            return 'change';
        }
        
        return 'input';
    }
    
    /**
     * Get value from a form element
     * @param {HTMLElement} element - Form element
     * @returns {*} Element value
     * @private
     */
    #getElementValue(element) {
        const tag = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();
        
        if (tag === 'input') {
            if (type === 'checkbox') {
                return element.checked;
            } else if (type === 'radio') {
                return element.checked ? element.value : null;
            } else if (type === 'number' || type === 'range') {
                return element.valueAsNumber;
            } else {
                return element.value;
            }
        } else if (tag === 'select') {
            return element.value;
        } else if (tag === 'textarea') {
            return element.value;
        }
        
        return element.textContent;
    }
    
    /**
     * Set value to a form element
     * @param {HTMLElement} element - Form element
     * @param {*} value - Value to set
     * @private
     */
    #setElementValue(element, value) {
        const tag = element.tagName.toLowerCase();
        const type = element.type?.toLowerCase();
        
        if (tag === 'input') {
            if (type === 'checkbox') {
                element.checked = Boolean(value);
            } else if (type === 'radio') {
                element.checked = element.value === String(value);
            } else if (value !== undefined) {
                element.value = value;
            }
        } else if (tag === 'select' || tag === 'textarea') {
            if (value !== undefined) {
                element.value = value;
            }
        } else {
            element.textContent = value !== null ? value : '';
        }
    }
    
    /**
     * Set a nested property value in an object
     * @param {Object} obj - Target object
     * @param {string} path - Property path (e.g. 'user.name')
     * @param {*} value - Value to set
     * @private
     */
    #setNestedValue(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }
        
        current[parts[parts.length - 1]] = value;
    }
    
    /**
     * Sanitize HTML to prevent XSS attacks
     * @param {string} html - HTML string to sanitize
     * @returns {string} Sanitized HTML
     * @private
     */
    #sanitizeHtml(html) {
        // Simple sanitizer - for production use, consider a more robust solution
        const tempDiv = document.createElement('div');
        tempDiv.textContent = html;
        return tempDiv.innerHTML;
    }
    
    /**
     * Render a component into a container
     * @param {string} templatePath - Path to the component template
     * @param {HTMLElement} container - Container element
     * @param {Object} [data={}] - Component data
     * @param {Object} [options={}] - Additional component options
     * @returns {Promise<ComponentInstance>} Component instance
     */
    async renderComponent(templatePath, container, data = {}, options = {}) {
        try {
            if (!container || !(container instanceof HTMLElement)) {
                throw new Error('Container must be a valid HTMLElement');
            }
            
            const component = await this.createComponent(templatePath, {
                data,
                ...options
            });
            
            component.mount(container);
            return component;
        } catch (error) {
            console.error(`Failed to render component ${templatePath}:`, error);
            throw error;
        }
    }
    
    /**
     * Update all data bindings in the document
     * @param {Object} data - Global data to use for updates
     */
    updateBindings(data) {
        // Get all elements with data binding attributes
        const elements = document.querySelectorAll('[data-slot], [data-if], [data-for], [data-bind], [data-attr]');
        
        // Process each element
        elements.forEach(element => {
            // Skip elements that belong to components
            if (this.#belongsToComponent(element)) return;
            
            this.#updateElement(element, data);
        });
    }
    
    /**
     * Check if an element belongs to a component
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} Whether the element belongs to a component
     * @private
     */
    #belongsToComponent(element) {
        let current = element;
        
        while (current) {
            if (current.dataset && current.dataset.component) {
                return true;
            }
            
            if (this.#componentInstances.has(current)) {
                return true;
            }
            
            current = current.parentElement;
        }
        
        return false;
    }
    
    /**
     * Clear the template cache
     */
    clearCache() {
        this.#templateCache.clear();
        this.#compiledTemplateCache.clear();
    }
    
    /**
     * Get statistics about the component loader
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.metrics,
            cacheSize: this.#templateCache.size,
            compiledCacheSize: this.#compiledTemplateCache.size,
            activeComponents: this.#componentInstances.size
        };
    }
}

/**
 * Expression evaluator for data binding
 */
class ExpressionEvaluator {
    constructor() {
        this.cache = new Map();
    }
    
    /**
     * Evaluate an expression with given context
     * @param {string} expr - Expression to evaluate
     * @param {Object} data - Data context
     * @param {Object} [component] - Component instance
     * @returns {*} Evaluated result
     */
    evaluate(expr, data, component) {
        // Handle empty expressions
        if (!expr || !expr.trim()) return undefined;
        
        // Direct property access (most common case)
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
            return data[expr];
        }
        
        // Use simple dot notation directly
        if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(expr) && !expr.includes(' ')) {
            return this.getNestedValue(data, expr);
        }
        
        try {
            // Create cache key
            const cacheKey = `${expr}:${Object.keys(data).sort().join(',')}`;
            
            // Check cache for function
            let fn = this.cache.get(cacheKey);
            
            if (!fn) {
                // Create parameter list and body
                const paramList = Object.keys(data).join(', ');
                
                // Create safe function body with return statement
                const body = `
                    try {
                        return ${expr};
                    } catch (error) {
                        console.error('Expression evaluation error:', error);
                        return undefined;
                    }
                `;
                
                // Create function and cache it
                fn = new Function(paramList, body);
                this.cache.set(cacheKey, fn);
            }
            
            // Execute function with data properties as arguments
            return fn(...Object.values(data));
        } catch (error) {
            console.error(`Error evaluating expression "${expr}":`, error);
            return undefined;
        }
    }
    
    /**
     * Get a nested property value
     * @param {Object} obj - Source object
     * @param {string} path - Property path (e.g. 'user.name')
     * @returns {*} Property value or undefined
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, part) => {
            return current !== undefined && current !== null ? current[part] : undefined;
        }, obj);
    }
}

/**
 * Basic event emitter for component communication
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        
        this.events[event].push(callback);
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }
    
    /**
     * Register a one-time event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     */
    once(event, callback) {
        const onceWrapper = (...args) => {
            callback(...args);
            this.off(event, onceWrapper);
        };
        
        return this.on(event, onceWrapper);
    }
    
    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event handler to remove
     */
    off(event, callback) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event]
            .filter(cb => cb !== callback);
    }
    
    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...*} args - Arguments to pass to handlers
     */
    emit(event, ...args) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event handler for "${event}":`, error);
            }
        });
    }
}

// Create and export singleton instance
const componentLoader = new ComponentLoader();

// Initialize on document load
document.addEventListener('DOMContentLoaded', () => {
    if (IS_DEV) {
        console.debug('Component loader initialized');
    }
});

export default componentLoader;
      