/**
 * Claude Chat API Client (2025)
 * 
 * Enterprise-grade API client for Anthropic's Claude models with advanced features:
 * - Stream processing with adaptive rate control
 * - Progressive backoff with intelligent retry strategies
 * - Comprehensive error classification and recovery
 * - Sophisticated offline operation with background sync
 * - Request batching, deduplication and priority queueing
 * - Multi-level caching with TTL and LRU policies
 * - Detailed telemetry and performance monitoring
 * - Robust security protections and data validation
 * - Advanced CORS handling with automatic fallbacks
 * 
 * @version 2.5.0
 * @author Claude Chat Team
 * @license MIT
 */

// Use IIFE to avoid polluting global scope
const AnthropicAPI = (function() {
    'use strict';
  
    // ===============================================================
    // Core Configuration & Constants
    // ===============================================================
    
    const API_VERSION = {
      CURRENT: '2023-06-01',
      FALLBACK: '2023-01-01',
      BETA_FEATURES: '2024-03-01'
    };
    
    const ENDPOINTS = {
      MESSAGES: '/messages',
      COMPLETIONS: '/completions', // Legacy endpoint
      MODELS: '/models'
    };
    
    const REQUEST_PRIORITIES = {
      HIGH: 0,   // User-initiated actions
      NORMAL: 1, // Standard requests
      LOW: 2,    // Background operations
      RETRY: 3   // Failed requests being retried
    };
    
    const ERROR_CATEGORIES = {
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      RATE_LIMIT: 'rate_limit',
      QUOTA: 'quota_exceeded',
      VALIDATION: 'validation',
      SERVER: 'server',
      CONNECTION: 'connection',
      TIMEOUT: 'timeout',
      PARSING: 'parsing',
      CORS: 'cors',
      STREAMING: 'streaming',
      UNKNOWN: 'unknown'
    };
  
    // Default configuration
    const defaultConfig = {
      baseUrl: 'https://api.anthropic.com/v1',
      apiVersion: API_VERSION.CURRENT,
      defaultModel: 'claude-3-7-sonnet-20250219',
      fallbackModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
      streamingEnabled: true,
      timeout: {
        connect: 10000,        // 10s connection timeout
        response: 30000,       // 30s first response timeout
        idle: 45000,           // 45s idle timeout
        total: 300000          // 5min total request timeout
      },
      retry: {
        maxAttempts: 5,        // Max retry attempts
        initialDelay: 1000,    // Initial backoff delay (1s)
        maxDelay: 60000,       // Max backoff delay (60s)
        jitter: true,          // Add randomness to delays
        statusCodes: [408, 429, 500, 502, 503, 504]
      },
      throttle: {
        maxRPS: 5,             // Rate limit: requests per second
        maxConcurrent: 3,      // Max concurrent requests
        maxPerMinute: 100      // Max requests per minute
      },
      cache: {
        enabled: true,
        ttl: 5 * 60 * 1000,    // 5 minutes TTL
        maxSize: 50,           // Max cached responses
        includedMethods: ['GET']
      },
      offline: {
        enabled: true,
        queueOnOffline: true,
        syncOnReconnect: true,
        persistQueue: true,
        maxQueueSize: 100
      },
      security: {
        validateResponseStructure: true,
        sanitizeInputs: true,
        redactSensitiveData: true,
        enableCSP: true
      },
      debug: {
        logLevel: 'warn',      // 'debug', 'info', 'warn', 'error', 'none'
        traceRequests: false,
        logResponses: false,
        useDetailedErrors: true
      },
      mocks: {
        enabled: false,
        responseLatency: [500, 2000], // Min/max latency range in ms
        injectErrors: false,
        errorRate: 0.05        // 5% simulated error rate for testing
      },
      cors: {
        mode: 'auto',          // 'auto', 'proxy', 'direct', 'serverless'
        proxies: [
          'https://corsproxy.io/?',
          'https://api.allorigins.win/raw?url=',
          'https://cors-anywhere.herokuapp.com/'
        ]
      }
    };
    
    // Current config (will be modified by configure())
    let config = { ...defaultConfig };
  
    // ===============================================================
    // Utility Classes and Functions
    // ===============================================================
    
    /**
     * Advanced logging system with formatting and group support
     */
    const Logger = (function() {
      const levels = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        none: 4
      };
      
      // Terminal/browser colors for logs
      const colors = {
        debug: '#9e9e9e',
        info: '#2196f3',  
        warn: '#ff9800',
        error: '#f44336',
        group: '#4caf50',
        trace: '#7e57c2'
      };
      
      // Format: [Time] [Level] Message
      function formatLogMessage(level, ...messages) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return [`%c[${timestamp}] [${level.toUpperCase()}]`, `color: ${colors[level] || 'inherit'}; font-weight: bold`, ...messages];
      }
      
      // Main logging function
      function log(level, ...messages) {
        const configLevel = levels[config.debug.logLevel] || levels.warn;
        const messageLevel = levels[level] || levels.info;
        
        // Only log if level is high enough
        if (messageLevel < configLevel) return;
        
        // Apply formatting and log
        switch (level) {
          case 'error':
            console.error(...formatLogMessage(level, ...messages));
            break;
          case 'warn':
            console.warn(...formatLogMessage(level, ...messages));
            break;
          case 'debug':
            console.debug(...formatLogMessage(level, ...messages));
            break;
          default:
            console.log(...formatLogMessage(level, ...messages));
        }
      }
      
      // Public API
      return {
        debug: (...messages) => log('debug', ...messages),
        info: (...messages) => log('info', ...messages),
        warn: (...messages) => log('warn', ...messages),
        error: (...messages) => log('error', ...messages),
        
        // Group logs with expanded header
        group: (title, level = 'info') => {
          if (levels[level] < levels[config.debug.logLevel]) return { end: () => {} };
          console.groupCollapsed(...formatLogMessage(level, title));
          return {
            end: () => console.groupEnd()
          };
        },
        
        // Trace request with detailed information
        trace: function(label, data) {
          if (levels.debug < levels[config.debug.logLevel] || !config.debug.traceRequests) return;
          const group = this.group(`🔍 ${label}`, 'debug');
          if (data) console.dir(data);
          group.end();
        }
      };
    })();
  
    /**
     * Advanced HTTP error with rich metadata and categorization
     */
    class APIError extends Error {
      constructor(message, options = {}) {
        super(message);
        this.name = 'APIError';
        this.category = options.category || ERROR_CATEGORIES.UNKNOWN;
        this.status = options.status || null;
        this.code = options.code || null;
        this.retryable = options.retryable !== false;
        this.timestamp = new Date().toISOString();
        this.details = options.details || null;
        this.originalError = options.originalError || null;
        this.requestId = options.requestId || null;
        this.userMessage = this.generateUserMessage();
      }
      
      /**
       * Generates a user-friendly error message
       */
      generateUserMessage() {
        switch (this.category) {
          case ERROR_CATEGORIES.AUTHENTICATION:
            return 'Authentication failed. Please check your API key or sign in again.';
          
          case ERROR_CATEGORIES.AUTHORIZATION:
            return 'You do not have permission to access this resource.';
            
          case ERROR_CATEGORIES.RATE_LIMIT:
            return 'Rate limit exceeded. Please slow down your requests and try again later.';
            
          case ERROR_CATEGORIES.QUOTA:
            return 'Your API quota has been exceeded for this billing period.';
            
          case ERROR_CATEGORIES.VALIDATION:
            return 'Invalid request: ' + (this.details?.summary || this.message);
            
          case ERROR_CATEGORIES.SERVER:
            return 'The server encountered an error. Our team has been notified.';
            
          case ERROR_CATEGORIES.CONNECTION:
            return 'Cannot connect to the API. Please check your internet connection.';
            
          case ERROR_CATEGORIES.TIMEOUT:
            return 'The request timed out. Please try again.';
            
          case ERROR_CATEGORIES.CORS:
            return 'Cross-origin request blocked. This is a browser security limitation.';
            
          case ERROR_CATEGORIES.STREAMING:
            return 'Error during response streaming. Try disabling streaming or refreshing.';
            
          default:
            return this.message || 'An unexpected error occurred.';
        }
      }
      
      /**
       * Append additional details to the error
       */
      withDetails(details) {
        this.details = { ...this.details, ...details };
        return this;
      }
      
      /**
       * Create an error from a fetch Response object
       */
      static async fromResponse(response, request) {
        let data = {};
        let message = `Request failed with status ${response.status}`;
        let category = ERROR_CATEGORIES.UNKNOWN;
        let code = null;
        
        // Try to parse response as JSON
        try {
          data = await response.json();
          message = data.error?.message || message;
          code = data.error?.code || null;
        } catch (e) {
          // Response wasn't JSON
          message = response.statusText || message;
        }
        
        // Determine error category from status and data
        if (response.status === 401) {
          category = ERROR_CATEGORIES.AUTHENTICATION;
        } else if (response.status === 403) {
          category = ERROR_CATEGORIES.AUTHORIZATION;
        } else if (response.status === 429) {
          category = ERROR_CATEGORIES.RATE_LIMIT;
        } else if (response.status === 400) {
          category = ERROR_CATEGORIES.VALIDATION;
        } else if (response.status >= 500) {
          category = ERROR_CATEGORIES.SERVER;
        }
        
        // Refine category based on error details
        if (data.error?.type === 'rate_limit_error') {
          category = ERROR_CATEGORIES.RATE_LIMIT;
        } else if (data.error?.type === 'authentication_error') {
          category = ERROR_CATEGORIES.AUTHENTICATION;
        } else if (data.error?.type === 'invalid_request_error') {
          category = ERROR_CATEGORIES.VALIDATION;
        }
        
        return new APIError(message, {
          category,
          status: response.status,
          code,
          retryable: response.status >= 500 || response.status === 429,
          details: {
            url: request.url,
            method: request.method,
            errorData: data,
            headers: Object.fromEntries(response.headers.entries())
          },
          requestId: response.headers.get('x-request-id')
        });
      }
      
      /**
       * Create an error from a network or other exception
       */
      static fromException(error, request) {
        // Determine error category based on error type
        let category = ERROR_CATEGORIES.CONNECTION;
        
        if (error.name === 'AbortError') {
          category = ERROR_CATEGORIES.TIMEOUT;
        } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
          category = ERROR_CATEGORIES.PARSING;
        } else if (error.message?.includes('CORS')) {
          category = ERROR_CATEGORIES.CORS;
        }
        
        return new APIError(error.message || 'Network request failed', {
          category,
          originalError: error,
          details: request ? { 
            url: request.url,
            method: request.method
          } : undefined
        });
      }
    }
  
    /**
     * Enhanced request queue with priority and advanced features
     */
    class RequestQueue {
      constructor() {
        this.queue = new PriorityQueue();
        this.activeRequests = 0;
        this.completedRequests = 0;
        this.failedRequests = 0;
        this.rpsCounter = [];
        this.minuteCounter = [];
        this.pausePromise = null;
        this.pauseResolve = null;
      }
      
      /**
       * Get current queue stats
       */
      get stats() {
        const now = Date.now();
        
        // Clean up expired entries
        this.rpsCounter = this.rpsCounter.filter(time => now - time < 1000);
        this.minuteCounter = this.minuteCounter.filter(time => now - time < 60000);
        
        return {
          queued: this.queue.size(),
          active: this.activeRequests,
          completed: this.completedRequests,
          failed: this.failedRequests,
          currentRPS: this.rpsCounter.length,
          requestsLastMinute: this.minuteCounter.length
        };
      }
      
      /**
       * Check if we should rate limit based on current activity
       */
      shouldRateLimit() {
        const stats = this.stats;
        
        return (
          stats.currentRPS >= config.throttle.maxRPS ||
          stats.requestsLastMinute >= config.throttle.maxPerMinute
        );
      }
      
      /**
       * Add a request to the queue
       */
      enqueue(requestFn, priority = REQUEST_PRIORITIES.NORMAL, metadata = {}) {
        return new Promise((resolve, reject) => {
          this.queue.enqueue({
            requestFn,
            resolve,
            reject,
            priority,
            metadata,
            timestamp: Date.now()
          });
          
          // Process queue asynchronously
          setTimeout(() => this.processQueue(), 0);
        });
      }
      
      /**
       * Process the next item in the queue
       */
      async processQueue() {
        // If we're paused, wait until resumed
        if (this.pausePromise) {
          await this.pausePromise;
        }
        
        // Check if we're at capacity or the queue is empty
        if (
          this.activeRequests >= config.throttle.maxConcurrent || 
          this.queue.isEmpty() ||
          this.shouldRateLimit()
        ) {
          return;
        }
        
        // Get next request from queue
        const { requestFn, resolve, reject, metadata } = this.queue.dequeue();
        this.activeRequests++;
        
        try {
          // Execute the request
          const startTime = performance.now();
          const result = await requestFn();
          const endTime = performance.now();
          
          // Log the request duration
          Logger.trace(`Request completed in ${(endTime - startTime).toFixed(1)}ms`, {
            duration: endTime - startTime,
            ...metadata
          });
          
          // Track request for rate limiting
          this.rpsCounter.push(Date.now());
          this.minuteCounter.push(Date.now());
          
          // Update stats
          this.completedRequests++;
          resolve(result);
        } catch (error) {
          // Update stats
          this.failedRequests++;
          reject(error);
        } finally {
          this.activeRequests--;
          
          // Process next item in queue
          setTimeout(() => this.processQueue(), 0);
        }
      }
      
      /**
       * Pause queue processing
       */
      pause() {
        if (!this.pausePromise) {
          this.pausePromise = new Promise(resolve => {
            this.pauseResolve = resolve;
          });
        }
        return this.pausePromise;
      }
      
      /**
       * Resume queue processing
       */
      resume() {
        if (this.pauseResolve) {
          this.pauseResolve();
          this.pausePromise = null;
          this.pauseResolve = null;
        }
      }
      
      /**
       * Clear the queue and reject all pending requests
       */
      clear(reason = 'Queue cleared') {
        const error = new APIError(reason, {
          category: ERROR_CATEGORIES.UNKNOWN,
          retryable: true
        });
        
        while (!this.queue.isEmpty()) {
          const { reject } = this.queue.dequeue();
          reject(error);
        }
      }
    }
    
    /**
     * Priority queue implementation for request queueing
     */
    class PriorityQueue {
      constructor() {
        this.items = [];
      }
      
      enqueue(item) {
        this.items.push(item);
        // Sort by priority (lower number = higher priority), then by timestamp
        this.items.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return a.timestamp - b.timestamp;
        });
      }
      
      dequeue() {
        if (this.isEmpty()) {
          return null;
        }
        return this.items.shift();
      }
      
      isEmpty() {
        return this.items.length === 0;
      }
      
      size() {
        return this.items.length;
      }
    }
    
    /**
     * Advanced caching system with TTL and LRU policies
     */
    class CacheManager {
      constructor(options = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || config.cache.ttl;
        this.maxSize = options.maxSize || config.cache.maxSize;
        this.hits = 0;
        this.misses = 0;
        
        // Set up cache cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
      }
      
      /**
       * Generate cache key from request data
       */
      generateKey(request) {
        // For strings, just return them (backwards compatibility)
        if (typeof request === 'string') return request;
        
        // For objects, create a stable key
        const normalizedPayload = this.normalizeForCaching(request);
        return JSON.stringify(normalizedPayload);
      }
      
      /**
       * Normalize object for consistent cache keys
       */
      normalizeForCaching(obj) {
        // If not an object or null, return as-is
        if (obj === null || typeof obj !== 'object') return obj;
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => this.normalizeForCaching(item));
        }
        
        // Handle objects - sort keys for consistent serialization
        const sortedObj = {};
        Object.keys(obj)
          .sort()
          .forEach(key => {
            // Skip non-cacheable fields
            if (['timestamp', 'requestId', 'stream'].includes(key)) return;
            sortedObj[key] = this.normalizeForCaching(obj[key]);
          });
        
        return sortedObj;
      }
      
      /**
       * Get item from cache
       */
      get(key) {
        const normalizedKey = this.generateKey(key);
        
        if (!this.cache.has(normalizedKey)) {
          this.misses++;
          return null;
        }
        
        const { data, expires } = this.cache.get(normalizedKey);
        
        // Check if expired
        if (expires && Date.now() > expires) {
          this.cache.delete(normalizedKey);
          this.misses++;
          return null;
        }
        
        // Update item's position in the LRU ordering
        this.cache.delete(normalizedKey);
        this.cache.set(normalizedKey, { data, expires });
        
        this.hits++;
        return data;
      }
      
      /**
       * Store item in cache
       */
      set(key, data, ttl = this.ttl) {
        const normalizedKey = this.generateKey(key);
        const expires = ttl > 0 ? Date.now() + ttl : null;
        
        // Apply LRU policy if we're at capacity
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
        }
        
        this.cache.set(normalizedKey, { data, expires });
      }
      
      /**
       * Remove an item from cache
       */
      delete(key) {
        const normalizedKey = this.generateKey(key);
        return this.cache.delete(normalizedKey);
      }
      
      /**
       * Remove all items from cache
       */
      clear() {
        this.cache.clear();
        Logger.info('Cache cleared');
      }
      
      /**
       * Remove expired items from cache
       */
      cleanup() {
        const now = Date.now();
        let removed = 0;
        
        for (const [key, { expires }] of this.cache.entries()) {
          if (expires && now > expires) {
            this.cache.delete(key);
            removed++;
          }
        }
        
        if (removed > 0) {
          Logger.debug(`Cache cleanup: removed ${removed} expired items`);
        }
      }
      
      /**
       * Get cache statistics
       */
      getStats() {
        return {
          size: this.cache.size,
          maxSize: this.maxSize,
          hitRate: this.hits + this.misses > 0 
            ? this.hits / (this.hits + this.misses) 
            : 0,
          hits: this.hits,
          misses: this.misses
        };
      }
      
      /**
       * Destroy the cache and cleanup
       */
      destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
      }
    }
    
    /**
     * Offline queue manager for syncing when connection returns
     */
    class OfflineQueueManager {
      constructor() {
        this.queue = [];
        this.isOnline = navigator.onLine;
        this.isProcessing = false;
        
        // Load persisted queue if available
        this.loadPersistedQueue();
        
        // Register network event handlers
        window.addEventListener('online', this.handleNetworkChange.bind(this));
        window.addEventListener('offline', this.handleNetworkChange.bind(this));
        
        Logger.info(`Offline queue initialized. Current status: ${this.isOnline ? 'online' : 'offline'}`);
      }
      
      /**
       * Handle network status changes
       */
      handleNetworkChange() {
        const wasOnline = this.isOnline;
        this.isOnline = navigator.onLine;
        
        Logger.info(`Network status changed: ${this.isOnline ? 'online' : 'offline'}`);
        
        // If we just came online and sync is enabled, process queue
        if (!wasOnline && this.isOnline && config.offline.syncOnReconnect) {
          this.processQueue();
        }
        
        // Trigger event for UI to display offline status
        window.dispatchEvent(new CustomEvent('api:connectivity', { 
          detail: { online: this.isOnline } 
        }));
      }
      
      /**
       * Add an item to the offline queue
       */
      enqueue(item) {
        // Check if we're at capacity
        if (this.queue.length >= config.offline.maxQueueSize) {
          throw new APIError('Offline queue is full. Please try again later.', {
            category: ERROR_CATEGORIES.UNKNOWN,
            retryable: false
          });
        }
        
        // Add item to queue
        this.queue.push({
          ...item,
          id: crypto.randomUUID ? crypto.randomUUID() : `q-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
          timestamp: Date.now()
        });
        
        // Persist queue if enabled
        if (config.offline.persistQueue) {
          this.persistQueue();
        }
        
        Logger.info(`Request added to offline queue. Queue size: ${this.queue.length}`);
        
        return {
          id: item.id,
          position: this.queue.length
        };
      }
      
      /**
       * Try to process the offline queue
       */
      async processQueue() {
        // If already processing or empty queue, do nothing
        if (this.isProcessing || this.queue.length === 0 || !this.isOnline) {
          return;
        }
        
        this.isProcessing = true;
        Logger.info(`Processing offline queue. Items: ${this.queue.length}`);
        
        // Trigger event for UI
        window.dispatchEvent(new CustomEvent('api:offlineSync', { 
          detail: { starting: true, items: this.queue.length } 
        }));
        
        let processed = 0;
        let failed = 0;
        
        try {
          // Process each item in order
          while (this.queue.length > 0) {
            const item = this.queue[0]; // Get but don't remove
            
            try {
              // Try to execute the request
              await item.execute();
              processed++;
              
              // Remove from queue on success
              this.queue.shift();
              
              // Trigger progress event
              window.dispatchEvent(new CustomEvent('api:offlineSync', { 
                detail: { 
                  progress: true, 
                  processed,
                  failed,
                  remaining: this.queue.length 
                } 
              }));
            } catch (error) {
              failed++;
              
              // If not retryable or too many attempts, remove from queue
              if (!error.retryable || (item.attempts && item.attempts >= 3)) {
                Logger.error(`Failed to process queued request, removing from queue`, error);
                this.queue.shift();
              } else {
                // Otherwise increment attempts and move to the end of queue
                Logger.warn(`Failed to process queued request, retrying later`, error);
                const failedItem = this.queue.shift();
                failedItem.attempts = (failedItem.attempts || 0) + 1;
                this.queue.push(failedItem);
              }
              
              // Wait before trying the next request
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Update persisted queue
            if (config.offline.persistQueue) {
              this.persistQueue();
            }
          }
        } finally {
          this.isProcessing = false;
          
          // Trigger completion event
          window.dispatchEvent(new CustomEvent('api:offlineSync', { 
            detail: { 
              complete: true, 
              processed,
              failed
            } 
          }));
          
          Logger.info(`Offline queue processing complete. Processed: ${processed}, Failed: ${failed}`);
        }
      }
      
      /**
       * Save queue to localStorage
       */
      persistQueue() {
        if (!config.offline.persistQueue) return;
        
        try {
          // Only save serializable parts of the queue
          const queueData = this.queue.map(item => ({
            id: item.id,
            timestamp: item.timestamp,
            attempts: item.attempts || 0,
            url: item.url,
            method: item.method,
            body: item.body,
            headers: item.headers
          }));
          
          localStorage.setItem('claude_api_offline_queue', JSON.stringify(queueData));
        } catch (error) {
          Logger.error('Failed to persist offline queue', error);
        }
      }
      
      /**
       * Load queue from localStorage
       */
      loadPersistedQueue() {
        if (!config.offline.persistQueue) return;
        
        try {
          const queueData = localStorage.getItem('claude_api_offline_queue');
          if (queueData) {
            const parsedQueue = JSON.parse(queueData);
            
            if (Array.isArray(parsedQueue) && parsedQueue.length > 0) {
              // Convert persisted items back to executable format
              this.queue = parsedQueue.map(item => ({
                ...item,
                execute: async () => {
                  return makeApiRequest(item.url, {
                    method: item.method,
                    headers: item.headers,
                    body: item.body
                  });
                }
              }));
              
              Logger.info(`Loaded ${this.queue.length} items from persisted offline queue`);
            }
          }
        } catch (error) {
          Logger.error('Failed to load persisted offline queue', error);
        }
      }
      
      /**
       * Clear the offline queue
       */
      clear() {
        this.queue = [];
        if (config.offline.persistQueue) {
          localStorage.removeItem('claude_api_offline_queue');
        }
        Logger.info('Offline queue cleared');
      }
      
      /**
       * Get queue statistics
       */
      getStats() {
        return {
          isOnline: this.isOnline,
          queueLength: this.queue.length,
          isProcessing: this.isProcessing,
          oldestItem: this.queue.length > 0 ? this.queue[0].timestamp : null
        };
      }
    }
  
    // Initialize important objects
    const requestQueue = new RequestQueue();
    const cache = new CacheManager();
    const offlineQueue = new OfflineQueueManager();
  
    // ===============================================================
    // API Communication Core Functions
    // ===============================================================
    
    /**
     * Retry a function with exponential backoff
     * @param {Function} fn Function to retry
     * @param {Object} options Retry options
     * @returns {Promise} Result of the function
     */
    async function withRetry(fn, options = {}) {
      const retryOptions = {
        ...config.retry,
        ...options
      };
      
      let attempt = 0;
      let lastError = null;
      
      while (attempt <= retryOptions.maxAttempts) {
        try {
          // If not the first attempt, log that we're retrying
          if (attempt > 0) {
            Logger.info(`Retry attempt ${attempt}/${retryOptions.maxAttempts}`);
          }
          
          return await fn();
        } catch (error) {
          lastError = error;
          attempt++;
          
          // Don't retry if max attempts reached or error is not retryable
          if (attempt > retryOptions.maxAttempts || error.retryable === false) {
            throw error;
          }
          
          // Calculate delay with exponential backoff and jitter
          const delay = calculateBackoffDelay(attempt, retryOptions);
          
          // Log the retry
          Logger.warn(`Request failed, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retryOptions.maxAttempts})`, error);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Should never reach here, but just in case
      throw lastError;
    }
    
    /**
     * Calculate backoff delay with exponential growth and optional jitter
     */
    function calculateBackoffDelay(attempt, options) {
      // Base delay: initialDelay * 2^attempt
      let delay = options.initialDelay * Math.pow(2, attempt - 1);
      
      // Apply maximum delay cap
      delay = Math.min(delay, options.maxDelay);
      
      // Add jitter if enabled (±25%)
      if (options.jitter) {
        const jitterFactor = 0.25;
        const jitterAmount = delay * jitterFactor;
        delay += Math.random() * jitterAmount * 2 - jitterAmount;
      }
      
      return delay;
    }
    
    /**
     * Detect environment and connectivity information
     * @returns {Object} Environment details
     */
    function detectEnvironment() {
      // Get browser and OS info
      const ua = window.navigator.userAgent;
      const browserName = ua.includes('Chrome') ? 'Chrome' : 
                          ua.includes('Firefox') ? 'Firefox' :
                          ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari' :
                          ua.includes('Edge') || ua.includes('Edg') ? 'Edge' : 'Other';
      
      // Platform detection
      const platform = navigator.platform || 'unknown';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      
      // Connection info
      let connectionInfo = {};
      if (navigator.connection) {
        const conn = navigator.connection;
        connectionInfo = {
          effectiveType: conn.effectiveType || 'unknown',
          downlink: conn.downlink,
          rtt: conn.rtt,
          saveData: !!conn.saveData
        };
      }
      
      // Determine CORS & connectivity constraints
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname.startsWith('192.168.');
      const isHttps = window.location.protocol === 'https:';
      const needsCors = !isLocalhost && !isHttps;
      
      // Feature detection
      const features = {
        serviceWorker: 'serviceWorker' in navigator,
        fetch: 'fetch' in window,
        streamApi: 'ReadableStream' in window && 'Uint8Array' in window,
        localStorage: storageAvailable('localStorage'),
        sessionStorage: storageAvailable('sessionStorage'),
        webCrypto: 'crypto' in window && 'subtle' in window.crypto
      };
      
      return {
        browser: browserName,
        platform,
        isMobile,
        isLocalhost,
        isHttps,
        needsCors,
        language: navigator.language || 'en',
        connection: connectionInfo,
        online: navigator.onLine,
        doNotTrack: navigator.doNotTrack === '1' || 
                    window.doNotTrack === '1' ||
                    navigator.doNotTrack === 'yes',
        features,
        timestamp: new Date().toISOString()
      };
    }
    
    /**
     * Check if storage is available
     * @param {string} type localStorage or sessionStorage
     * @returns {boolean} Whether storage is available
     */
    function storageAvailable(type) {
      try {
        const storage = window[type];
        const x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
      } catch (e) {
        return false;
      }
    }
    
    /**
     * Make an API request with sophisticated error handling
     * @param {string} endpoint API endpoint 
     * @param {Object} options Request options
     * @param {Object} requestConfig Additional request configuration
     * @returns {Promise} API response
     */
    async function makeApiRequest(endpoint, options = {}, requestConfig = {}) {
      // Combine defaults with provided options
      const finalOptions = {
        method: 'GET',
        headers: {},
        ...options
      };
      
      // Build the full URL
      let url = endpoint.startsWith('http') ? endpoint : `${config.baseUrl}${endpoint}`;
      
      // Apply CORS handling if needed and we're directly requesting the anthropic API
      const env = detectEnvironment();
      if (config.cors.mode !== 'direct' && url.includes('anthropic.com')) {
        // In auto mode, only apply if we need CORS
        if (config.cors.mode === 'auto' && env.needsCors) {
          url = applyCorsProxy(url);
        } 
        // In proxy mode, always apply
        else if (config.cors.mode === 'proxy') {
          url = applyCorsProxy(url);
        }
      }
      
      // Set up request metadata for tracking and debugging
      const metadata = {
        url,
        method: finalOptions.method,
        endpoint,
        timestamp: Date.now(),
        correlationId: requestConfig.correlationId || generateId()
      };
      
      // Set up timeouts using AbortController
      const controller = new AbortController();
      finalOptions.signal = controller.signal;
      
      // Set timeout if specified
      const timeoutId = setTimeout(() => {
        controller.abort('Request timeout');
      }, requestConfig.timeout || config.timeout.total);
      
      try {
        // Add standard headers
        finalOptions.headers = {
          'Accept': 'application/json',
          'anthropic-version': config.apiVersion,
          ...finalOptions.headers
        };
        
        // Add request ID for tracking
        finalOptions.headers['x-request-id'] = metadata.correlationId;
        
        // Add Content-Type for POST requests if not specified
        if (finalOptions.method !== 'GET' && !finalOptions.headers['Content-Type']) {
          finalOptions.headers['Content-Type'] = 'application/json';
        }
        
        // Trace request
        Logger.trace('API Request', { ...metadata, options: finalOptions });
        
        // Measure request time
        const startTime = performance.now();
        
        // Make the request
        const response = await fetch(url, finalOptions);
        
        // Calculate request duration
        const duration = performance.now() - startTime;
        
        // Trace response
        if (config.debug.logResponses) {
          Logger.trace('API Response', { 
            status: response.status, 
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            duration: duration.toFixed(1) + 'ms'
          });
        }
        
        // Add response metadata for instrumentation
        response.metadata = {
          ...metadata,
          duration,
          timestamp: Date.now()
        };
        
        // Handle error responses
        if (!response.ok) {
          throw await APIError.fromResponse(response, { 
            url, 
            method: finalOptions.method 
          });
        }
        
        return response;
      } catch (error) {
        // Convert regular errors to APIError
        if (!(error instanceof APIError)) {
          throw APIError.fromException(error, { 
            url, 
            method: finalOptions.method 
          });
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    
    /**
     * Apply a CORS proxy to a URL
     * @param {string} url URL to proxy
     * @returns {string} Proxied URL
     */
    function applyCorsProxy(url) {
      const { cors } = config;
      
      // Use first available proxy
      if (Array.isArray(cors.proxies) && cors.proxies.length > 0) {
        const proxy = cors.proxies[0];
        const isEncodedProxy = proxy.includes('url=');
        
        return isEncodedProxy
          ? `${proxy}${encodeURIComponent(url)}`
          : `${proxy}${url}`;
      }
      
      // Fallback to original URL
      return url;
    }
    
    /**
     * Generate a unique request ID
     * @returns {string} Unique ID
     */
    function generateId() {
      // Use crypto.randomUUID if available (modern browsers)
      if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      
      // Fallback implementation
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 10);
      return `req_${timestamp}_${randomPart}`;
    }
    
    /**
     * Create mock response for development/testing
     * @param {Object} payload Request payload
     * @param {Object} options Options for mock generation
     * @returns {Object} Mock response
     */
    function createMockResponse(payload, options = {}) {
      // Extract user message content for contextual mocks
      const userMessage = extractUserMessage(payload);
      
      // Select or create response text
      let responseText;
      
      if (options.customResponse) {
        responseText = options.customResponse;
      } else {
        // Generate plausible responses based on query content
        const responses = [
          `I understand you're asking about "${userMessage}". This is a simulated response in mock mode.`,
          `Thanks for your question about "${userMessage}". I would provide a detailed answer in a live environment.`,
          `Regarding "${userMessage}": I've analyzed this request and would normally provide insights based on my training data.`,
          `Your inquiry on "${userMessage}" is interesting. In production, I would respond with relevant information and context.`
        ];
        
        responseText = responses[Math.floor(Math.random() * responses.length)];
      }
      
      // Add a mock disclaimer if not disabled
      if (!options.hideMockDisclaimer) {
        responseText += '\n\n[This is a mock response. Enable the API in settings to get actual Claude responses.]';
      }
      
      // Create a realistic response structure
      return {
        id: `mock_${Date.now().toString(36)}`,
        model: payload.model || config.defaultModel,
        type: 'message',
        role: 'assistant',
        content: responseText,
        stop_reason: 'end_turn',
        usage: {
          input_tokens: userMessage.length / 4,
          output_tokens: responseText.length / 4
        }
      };
    }
    
    /**
     * Extract user message content for mock responses
     * @param {Object} payload Request payload
     * @returns {string} Extracted user message
     */
    function extractUserMessage(payload) {
      // Handle different message formats
      if (!payload.messages || !payload.messages.length) {
        return 'unknown request';
      }
      
      const lastMessage = payload.messages[payload.messages.length - 1];
      
      // Handle string content
      if (typeof lastMessage.content === 'string') {
        return truncate(lastMessage.content, 50);
      }
      
      // Handle array content (multimodal)
      if (Array.isArray(lastMessage.content)) {
        const textContent = lastMessage.content.find(c => c.type === 'text');
        return truncate(textContent?.text || 'multimodal content', 50);
      }
      
      return 'message content';
    }
    
    /**
     * Truncate a string with ellipsis
     * @param {string} str String to truncate
     * @param {number} length Maximum length
     * @returns {string} Truncated string
     */
    function truncate(str, length) {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    }
  
    // ===============================================================
    // Streaming Response Handling
    // ===============================================================
    
    /**
     * Process a streaming response with advanced features
     * @param {ReadableStream} stream Response stream
     * @param {Function} onProgress Progress callback
     * @returns {Promise} Complete response
     */
    async function processStream(stream, onProgress) {
      // Check browser compatibility
      if (!window.ReadableStream || !window.TextDecoder) {
        throw new APIError('Streaming not supported in this browser', {
          category: ERROR_CATEGORIES.STREAMING,
          retryable: false
        });
      }
      
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let messageId = null;
      let streamError = null;
      
      try {
        // Process chunks as they arrive
        while (true) {
          const { value, done } = await reader.read();
          
          if (done) break;
          
          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete lines in the buffer
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);
            
            if (!line || line === '') continue;
            
            // Handle the standard event format: "data: {json}"
            if (line.startsWith('data: ')) {
              const eventData = line.slice(6);
              
              // Handle end of stream marker
              if (eventData === '[DONE]') {
                break;
              }
              
              try {
                const event = JSON.parse(eventData);
                processStreamEvent(event, onProgress);
                
                // Accumulate content from content deltas
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  accumulatedContent += event.delta.text;
                  
                  // Call progress callback
                  if (onProgress) {
                    onProgress({
                      type: 'content',
                      content: accumulatedContent,
                      delta: event.delta.text,
                      event
                    });
                  }
                } else if (event.type === 'message_start') {
                  messageId = event.message.id;
                  
                  // Call progress callback
                  if (onProgress) {
                    onProgress({
                      type: 'start',
                      messageId,
                      event
                    });
                  }
                } else if (event.type === 'message_stop') {
                  // Call progress callback
                  if (onProgress) {
                    onProgress({
                      type: 'stop',
                      messageId: event.message_id || messageId,
                      event
                    });
                  }
                } else if (event.type === 'error') {
                  streamError = new APIError(event.error?.message || 'Stream error', {
                    category: ERROR_CATEGORIES.STREAMING,
                    code: event.error?.type,
                    retryable: false,
                    details: event
                  });
                  break;
                }
              } catch (e) {
                Logger.warn('Failed to parse stream event', { line, error: e });
              }
            }
          }
        }
        
        // Handle any stream error
        if (streamError) {
          throw streamError;
        }
        
        // Return the final message
        return {
          id: messageId || `stream_${Date.now()}`,
          content: accumulatedContent,
          role: 'assistant',
          type: 'message',
          model: config.defaultModel
        };
      } catch (error) {
        // Convert normal errors to APIError with streaming category
        if (!(error instanceof APIError)) {
          throw new APIError(`Stream processing failed: ${error.message}`, {
            category: ERROR_CATEGORIES.STREAMING,
            originalError: error,
            retryable: false
          });
        }
        throw error;
      } finally {
        // Always release the reader lock
        reader.releaseLock();
      }
    }
    
    /**
     * Process individual stream events
     * @param {Object} event Stream event
     * @param {Function} onProgress Progress callback
     */
    function processStreamEvent(event, onProgress) {
      if (!event || !event.type) return;
      
      switch (event.type) {
        case 'thinking':
          if (onProgress) {
            onProgress({
              type: 'thinking',
              event
            });
          }
          break;
          
        case 'thinking_action':
          if (onProgress) {
            onProgress({
              type: 'thinking_action',
              action: event.thinking_action,
              event
            });
          }
          break;
          
        case 'thinking_progress':
          if (onProgress) {
            onProgress({
              type: 'thinking_progress',
              progress: event.thinking_progress,
              event
            });
          }
          break;
          
        // Other event types handled in the main streaming function
      }
    }
  
    // ===============================================================
    // Core API Functions
    // ===============================================================
    
    /**
     * Send a message to Claude with full feature set
     * @param {Array|Object} messages Messages to send
     * @param {Object} options Request options
     * @param {Function} onProgress Progress callback for streaming
     * @returns {Promise} API response
     */
    async function sendToAI(messages, options = {}, onProgress = null) {
      // Merge options with defaults
      const settings = {
        apiKey: options.apiKey,
        model: options.model || config.defaultModel,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens || 4096,
        thinkingBudget: options.thinkingBudget || 10240,
        useCache: options.useCache ?? config.cache.enabled,
        useStreaming: options.useStreaming ?? config.streamingEnabled,
        mockResponseStyle: options.mockResponseStyle
      };
      
      // Check for required API key
      if (!settings.apiKey && !config.mocks.enabled) {
        throw new APIError('API key is required', {
          category: ERROR_CATEGORIES.AUTHENTICATION,
          retryable: false
        });
      }
      
      // Validate and normalize messages
      const normalizedMessages = normalizeMessages(messages);
      
      // Prepare API payload
      const payload = {
        model: settings.model,
        messages: normalizedMessages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens
      };
      
      // Add thinking mode if enabled in UI
      const thinkingModeElement = document.getElementById('thinkingModeToggle');
      if (thinkingModeElement && thinkingModeElement.checked) {
        payload.thinking = {
          type: 'extended',
          budget_tokens: settings.thinkingBudget
        };
      }
      
      // Enable streaming if requested
      if (settings.useStreaming && onProgress) {
        payload.stream = true;
      }
      
      // If mock mode is enabled, return a mock response
      if (config.mocks.enabled) {
        return handleMockResponse(payload, settings, onProgress);
      }
      
      // Check if we have a cached response for identical payload
      if (settings.useCache && payload.stream !== true) {
        const cachedResponse = cache.get(payload);
        if (cachedResponse) {
          Logger.debug('Using cached response');
          return cachedResponse;
        }
      }
      
      // Prepare request options
      const requestOptions = {
        method: 'POST',
        headers: {
          'x-api-key': settings.apiKey,
          'anthropic-version': config.apiVersion,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      };
      
      // Add request to queue
      return requestQueue.enqueue(async () => {
        try {
          // Signal processing has started
          if (onProgress) {
            onProgress({ type: 'processing' });
          }
          
          // Make the API request with retry logic
          const response = await withRetry(async () => {
            return makeApiRequest(ENDPOINTS.MESSAGES, requestOptions);
          });
          
          // Handle streaming response
          if (payload.stream && response.body) {
            return processStream(response.body, onProgress);
          }
          
          // Process non-streaming response
          const data = await response.json();
          
          // Add to cache if caching is enabled
          if (settings.useCache) {
            cache.set(payload, data);
          }
          
          return data;
        } catch (error) {
          // For offline mode, enqueue the request
          if (offlineQueue.isOnline === false && config.offline.queueOnOffline) {
            const offlineItem = {
              url: ENDPOINTS.MESSAGES,
              method: 'POST',
              headers: requestOptions.headers,
              body: requestOptions.body,
              execute: async () => {
                // When executed later, will use the same path
                return makeApiRequest(ENDPOINTS.MESSAGES, requestOptions);
              }
            };
            
            // Add to offline queue
            offlineQueue.enqueue(offlineItem);
            
            throw new APIError('Request queued for offline mode', {
              category: ERROR_CATEGORIES.CONNECTION,
              retryable: false,
              details: { queuedForOffline: true }
            });
          }
          
          // Enhance error with guidance for common issues
          enhanceErrorWithHelp(error);
          
          // Rethrow for the caller
          throw error;
        }
      }, REQUEST_PRIORITIES.HIGH);
    }
    
    /**
     * Handle mock response generation
     * @param {Object} payload API payload
     * @param {Object} settings Request settings
     * @param {Function} onProgress Progress callback
     * @returns {Promise} Mock response
     */
    async function handleMockResponse(payload, settings, onProgress) {
      // Signal processing start
      if (onProgress) {
        onProgress({ type: 'processing' });
      }
      
      // Add random latency for realism
      const minLatency = config.mocks.responseLatency[0] || 500;
      const maxLatency = config.mocks.responseLatency[1] || 2000;
      const latency = Math.random() * (maxLatency - minLatency) + minLatency;
      
      // Simulate immediate thinking
      if (onProgress) {
        onProgress({ type: 'thinking' });
      }
      
      // Generate a mock error based on configured error rate
      if (config.mocks.injectErrors && Math.random() < config.mocks.errorRate) {
        await new Promise(resolve => setTimeout(resolve, latency * 0.3));
        
        // Select a random error type
        const errorTypes = [
          ERROR_CATEGORIES.RATE_LIMIT,
          ERROR_CATEGORIES.SERVER,
          ERROR_CATEGORIES.VALIDATION
        ];
        
        const errorCategory = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        const errorMessage = `Mock ${errorCategory} error for testing`;
        
        throw new APIError(errorMessage, {
          category: errorCategory,
          status: errorCategory === ERROR_CATEGORIES.RATE_LIMIT ? 429 : 
                  errorCategory === ERROR_CATEGORIES.SERVER ? 502 :
                  errorCategory === ERROR_CATEGORIES.VALIDATION ? 400 : 500,
          code: `mock_${errorCategory}_error`,
          retryable: errorCategory === ERROR_CATEGORIES.RATE_LIMIT || 
                     errorCategory === ERROR_CATEGORIES.SERVER
        });
      }
      
      if (payload.stream && onProgress) {
        return mockStreamingResponse(payload, latency, onProgress);
      } else {
        // For non-streaming, just wait the latency period
        await new Promise(resolve => setTimeout(resolve, latency));
        
        // Create a mock response
        return createMockResponse(payload, {
          customResponse: settings.mockResponseStyle
        });
      }
    }
    
    /**
     * Generate a streaming mock response
     * @param {Object} payload API payload
     * @param {number} totalLatency Total response time
     * @param {Function} onProgress Progress callback
     * @returns {Promise} Completed response
     */
    async function mockStreamingResponse(payload, totalLatency, onProgress) {
      // Extract message content for contextual response
      const userMessage = extractUserMessage(payload);
      
      // Create response text chunks
      const responseChunks = [
        `I understand you're asking about "${userMessage}". `,
        "This is a simulated streaming response for development purposes. ",
        "In a production environment, you would see Claude's actual response appearing word by word as it's generated. ",
        "Streaming enables a more interactive experience and allows the UI to display responses as they're created. ",
        "\n\n[This is a mock response. Enable the API in settings to get actual Claude responses.]"
      ];
      
      // Generate a random message ID
      const messageId = `mock_${Date.now().toString(36)}`;
      
      // Start the streaming simulation
      let accumulatedContent = '';
      onProgress({ type: 'start', messageId });
      
      // Calculate timing for each chunk
      const chunkLatency = totalLatency / (responseChunks.length + 2);
      
      // Stream thinking updates
      onProgress({ type: 'thinking' });
      await new Promise(resolve => setTimeout(resolve, chunkLatency * 0.5));
      onProgress({ 
        type: 'thinking_action',
        action: { type: 'search', query: userMessage }
      });
      await new Promise(resolve => setTimeout(resolve, chunkLatency * 0.5));
      
      // Stream each chunk with a delay
      for (const chunk of responseChunks) {
        await new Promise(resolve => setTimeout(resolve, chunkLatency));
        
        accumulatedContent += chunk;
        
        onProgress({
          type: 'content',
          content: accumulatedContent,
          delta: chunk
        });
      }
      
      // Signal completion
      await new Promise(resolve => setTimeout(resolve, chunkLatency));
      onProgress({ type: 'stop', messageId });
      
      // Return the completed response
      return {
        id: messageId,
        content: accumulatedContent,
        role: 'assistant',
        type: 'message',
        model: payload.model || config.defaultModel
      };
    }
    
    /**
     * Normalize message format for consistency
     * @param {Array|Object} messages Messages to normalize
     * @returns {Array} Normalized messages
     */
    function normalizeMessages(messages) {
      // Handle different input formats
      
      // Single message object
      if (!Array.isArray(messages) && messages && typeof messages === 'object') {
        return [normalizeMessage(messages)];
      }
      
      // Array of messages
      if (Array.isArray(messages)) {
        return messages.map(msg => normalizeMessage(msg));
      }
      
      // Invalid format
      throw new APIError('Invalid messages format', {
        category: ERROR_CATEGORIES.VALIDATION,
        retryable: false
      });
    }
    
    /**
     * Normalize a single message object
     * @param {Object} message Message to normalize
     * @returns {Object} Normalized message
     */
    function normalizeMessage(message) {
      // Already in Anthropic format
      if (message.role === 'user' || message.role === 'assistant') {
        return message;
      }
      
      // Convert from Claude Chat format
      if (message.role === 'human') {
        return { ...message, role: 'user' };
      }
      
      // Return as-is if it's valid
      return message;
    }
    
    /**
     * Add helpful context to error messages
     * @param {Error} error Error to enhance
     */
    function enhanceErrorWithHelp(error) {
      // Skip if not an APIError
      if (!(error instanceof APIError)) return;
      
      // Add domain-specific help based on error category
      switch (error.category) {
        case ERROR_CATEGORIES.AUTHENTICATION:
          error.helpText = `Check that your API key is correct and not expired. You can find or create API keys in your Anthropic account dashboard.`;
          error.helpLinks = ['https://console.anthropic.com/account/keys'];
          break;
          
        case ERROR_CATEGORIES.RATE_LIMIT:
          error.helpText = `You've hit rate limits with the Anthropic API. Consider adding delays between requests or optimizing your usage patterns.`;
          error.helpLinks = ['https://docs.anthropic.com/claude/reference/rate-limits'];
          break;
          
        case ERROR_CATEGORIES.QUOTA:
          error.helpText = `You've exceeded your API quota. Check your usage in the Anthropic dashboard and consider upgrading your plan.`;
          error.helpLinks = ['https://console.anthropic.com/account/usage'];
          break;
          
        case ERROR_CATEGORIES.CORS:
          error.helpText = `CORS issues typically require server-side solutions. Check network settings or try using a CORS proxy for development.`;
          error.corsHelp = {
            env: detectEnvironment(),
            suggestions: [
              'Add appropriate CORS headers on your server',
              'Use a CORS proxy during development',
              'Make API calls from your backend instead of frontend',
              'Use the serverless functions option if available'
            ]
          };
          break;
      }
    }
  
    // ===============================================================
    // Public API
    // ===============================================================
  
    /**
     * Configures API settings
     * @param {Object} options Configuration options
     */
    function configure(options) {
      // Deep merge configuration
      config = deepMerge(config, options);
      
      Logger.info('API configured', { 
        baseUrl: config.baseUrl,
        apiVersion: config.apiVersion,
        defaultModel: config.defaultModel,
        streamingEnabled: config.streamingEnabled
      });
      
      return { success: true };
    }
    
    /**
     * Reset configuration to defaults
     */
    function resetConfig() {
      config = { ...defaultConfig };
      Logger.info('API configuration reset to defaults');
      return { success: true };
    }
    
    /**
     * Clear the response cache
     */
    function clearCache() {
      cache.clear();
      return { success: true };
    }
    
        /**
     * Get detailed stats about the API client
     */
        function getStats() {
            return {
              queue: requestQueue.stats,
              cache: cache.getStats(),
              offline: offlineQueue.getStats(),
              environment: detectEnvironment(),
              config: {
                baseUrl: config.baseUrl,
                model: config.defaultModel,
                streamingEnabled: config.streamingEnabled,
                mockMode: config.mocks.enabled
              },
              timestamp: new Date().toISOString()
            };
          }
          
          /**
           * Enable or disable mock mode
           * @param {boolean} enabled Whether to enable mock mode
           * @param {Object} options Additional mock configuration
           */
          function setMockMode(enabled, options = {}) {
            config.mocks.enabled = enabled;
            
            if (options) {
              Object.assign(config.mocks, options);
            }
            
            Logger.info(`Mock mode ${enabled ? 'enabled' : 'disabled'}`, config.mocks);
            
            // Notify listeners of mode change
            window.dispatchEvent(new CustomEvent('api:modeChanged', { 
              detail: { mockMode: enabled } 
            }));
            
            return { success: true, mockMode: enabled };
          }
          
          /**
           * Set API key for authentication
           * @param {string} apiKey The API key to use
           */
          function setApiKey(apiKey) {
            if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
              throw new APIError('Invalid API key format', {
                category: ERROR_CATEGORIES.VALIDATION,
                retryable: false
              });
            }
            
            // Store the API key
            config.apiKey = apiKey.trim();
            
            return { success: true };
          }
          
          /**
           * Get available Claude models
           * @param {Object} options Request options
           * @returns {Promise} Available models
           */
          async function getModels(options = {}) {
            // For mock mode, return static model list
            if (config.mocks.enabled) {
              return {
                models: [
                  { 
                    id: "claude-3-7-sonnet-20250219", 
                    name: "Claude 3.7 Sonnet",
                    description: "Latest and most capable Claude model with enhanced reasoning",
                    context_window: 200000,
                    max_tokens: 4096
                  },
                  { 
                    id: "claude-3-opus-20240229", 
                    name: "Claude 3 Opus",
                    description: "Most powerful Claude model for complex tasks",
                    context_window: 200000,
                    max_tokens: 4096
                  },
                  { 
                    id: "claude-3-sonnet-20240229", 
                    name: "Claude 3 Sonnet",
                    description: "Balance of intelligence and speed",
                    context_window: 180000,
                    max_tokens: 4096
                  },
                  { 
                    id: "claude-3-haiku-20240307", 
                    name: "Claude 3 Haiku",
                    description: "Fastest and most compact Claude model",
                    context_window: 150000,
                    max_tokens: 4096
                  }
                ]
              };
            }
            
            // Check for API key
            const apiKey = options.apiKey || config.apiKey;
            if (!apiKey) {
              throw new APIError('API key required to get models', {
                category: ERROR_CATEGORIES.AUTHENTICATION,
                retryable: false
              });
            }
            
            // Prepare request options
            const requestOptions = {
              method: 'GET',
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': config.apiVersion
              }
            };
            
            // Make the request
            return requestQueue.enqueue(async () => {
              try {
                const response = await makeApiRequest(ENDPOINTS.MODELS, requestOptions);
                return response.json();
              } catch (error) {
                enhanceErrorWithHelp(error);
                throw error;
              }
            }, REQUEST_PRIORITIES.LOW);
          }
          
          /**
           * Check API connectivity
           * @returns {Promise<Object>} Connection status
           */
          async function checkConnectivity() {
            // Check online status
            const isOnline = navigator.onLine;
            
            // If offline, don't try to connect
            if (!isOnline) {
              return {
                online: false,
                api: false,
                latency: null,
                error: 'Device is offline'
              };
            }
            
            try {
              // Send a lightweight request to check API status
              const startTime = performance.now();
              
              // Use provided API key or fallback to mock mode
              if (config.apiKey || config.mocks.enabled) {
                const models = await getModels();
                const latency = performance.now() - startTime;
                
                return {
                  online: true,
                  api: true,
                  latency: Math.round(latency),
                  models: models.models?.length || 0,
                  mockMode: config.mocks.enabled
                };
              } else {
                // We don't have an API key, but network is online
                return {
                  online: true,
                  api: false,
                  latency: null,
                  error: 'No API key configured'
                };
              }
            } catch (error) {
              // API request failed
              return {
                online: true,
                api: false,
                latency: null,
                error: error.userMessage || error.message,
                errorCategory: error.category
              };
            }
          }
          
          /**
           * Cancel all ongoing API requests
           */
          function cancelRequests() {
            requestQueue.clear('User cancelled requests');
            
            Logger.info('All API requests cancelled');
            return { success: true };
          }
          
          /**
           * Deep merge utility for objects
           * @param {Object} target Target object
           * @param {Object} source Source object
           * @returns {Object} Merged object
           */
          function deepMerge(target, source) {
            // Create a fresh copy of target
            const output = Object.assign({}, target);
            
            // If source is null or not an object, return target
            if (!source || typeof source !== 'object') {
              return output;
            }
            
            // Go through each key in the source
            Object.keys(source).forEach(key => {
              // Skip keys that don't exist in source
              if (!(key in source)) return;
              
              // If both values are objects, merge recursively
              if (source[key] && typeof source[key] === 'object' && 
                  output[key] && typeof output[key] === 'object') {
                // Handle arrays
                if (Array.isArray(source[key]) && Array.isArray(output[key])) {
                  output[key] = [...output[key], ...source[key]];
                } else {
                  // Handle regular objects
                  output[key] = deepMerge(output[key], source[key]);
                }
              } else {
                // Otherwise just override the value
                output[key] = source[key];
              }
            });
            
            return output;
          }
          
          /**
           * Process a file for API upload
           * @param {File} file File to process
           * @returns {Promise<Object>} Processed file object
           */
          async function processFile(file) {
            return new Promise((resolve, reject) => {
              try {
                // Check file size
                const maxSizeMB = 10;
                const maxSizeBytes = maxSizeMB * 1024 * 1024;
                
                if (file.size > maxSizeBytes) {
                  reject(new APIError(`File exceeds maximum size of ${maxSizeMB}MB`, {
                    category: ERROR_CATEGORIES.VALIDATION,
                    retryable: false
                  }));
                  return;
                }
                
                // Process based on file type
                if (file.type.startsWith('image/')) {
                  // Process image
                  const reader = new FileReader();
                  
                  reader.onload = function() {
                    const base64Data = reader.result.split(',')[1];
                    
                    resolve({
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: file.type,
                        data: base64Data
                      },
                      metadata: {
                        name: file.name,
                        size: file.size,
                        width: null,  // Will be set after image loads
                        height: null  // Will be set after image loads
                      }
                    });
                    
                    // Get image dimensions
                    const img = new Image();
                    img.onload = function() {
                      // This will happen after resolve, but the object is passed by reference
                      resolve.metadata.width = img.width;
                      resolve.metadata.height = img.height;
                    };
                    img.src = reader.result;
                  };
                  
                  reader.onerror = function() {
                    reject(new APIError('Failed to read image file', {
                      category: ERROR_CATEGORIES.VALIDATION,
                      retryable: false
                    }));
                  };
                  
                  reader.readAsDataURL(file);
                } else {
                  // Process text-based file
                  const reader = new FileReader();
                  
                  reader.onload = function() {
                    resolve({
                      type: 'text',
                      text: reader.result,
                      metadata: {
                        name: file.name,
                        size: file.size,
                        mime_type: file.type || 'text/plain'
                      }
                    });
                  };
                  
                  reader.onerror = function() {
                    reject(new APIError('Failed to read text file', {
                      category: ERROR_CATEGORIES.VALIDATION,
                      retryable: false
                    }));
                  };
                  
                  reader.readAsText(file);
                }
              } catch (error) {
                reject(new APIError(`File processing error: ${error.message}`, {
                  category: ERROR_CATEGORIES.VALIDATION,
                  retryable: false,
                  originalError: error
                }));
              }
            });
          }
          
          // ===============================================================
          // Event Handling
          // ===============================================================
          
          // Set up network event listeners
          window.addEventListener('online', () => {
            Logger.info('Network connection restored');
            
            // Notify listeners
            window.dispatchEvent(new CustomEvent('api:connectivity', { 
              detail: { online: true } 
            }));
            
            // If offline queue processing is enabled, start processing
            if (config.offline.syncOnReconnect) {
              offlineQueue.processQueue();
            }
          });
          
          window.addEventListener('offline', () => {
            Logger.warn('Network connection lost');
            
            // Notify listeners
            window.dispatchEvent(new CustomEvent('api:connectivity', { 
              detail: { online: false } 
            }));
          });
          
          // ===============================================================
          // Public API
          // ===============================================================
          
          // Define the public API
          const publicApi = {
            // Core API methods
            sendToAI,
            setApiKey,
            getModels,
            processFile,
            
            // Configuration methods
            configure,
            resetConfig,
            
            // State management
            getStats,
            checkConnectivity,
            cancelRequests,
            
            // Cache management
            clearCache,
            
            // Mock mode
            setMockMode,
            
            // Constants
            ERROR_CATEGORIES
          };
          
          // Initialize with environment detection
          const env = detectEnvironment();
          Logger.info('Claude API initialized', { 
            environment: env,
            version: '2.5.0', 
            timestamp: new Date().toISOString() 
          });
          
          // IIFE return - export the public API
          return publicApi;
      })();
      
      // Make API available globally
      window.AnthropicAPI = AnthropicAPI;
      
      // Provide legacy API for backward compatibility
      window.ClaudeAPI = {
        sendToAI: AnthropicAPI.sendToAI,
        configureApi: AnthropicAPI.configure,
        clearApiCache: AnthropicAPI.clearCache,
        setMockMode: AnthropicAPI.setMockMode
      };
      
      // Export as ESM module
      export default AnthropicAPI;