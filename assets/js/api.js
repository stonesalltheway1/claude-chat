/**
 * Claude Chat API Client (2025)
 * 
 * Enterprise-grade API client for Anthropic's Claude API with advanced features:
 * - Native Claude AI API v1 2025 compatibility
 * - Streaming with adaptive flow control and backpressure handling
 * - Progressive backoff with context-aware retry strategies
 * - Multi-modal content handling (text, images, files)
 * - Sophisticated thinking mode and Tool use integration
 * - Comprehensive observability with OpenTelemetry integration
 * - Request batching and priority queueing with deadlines
 * - Multi-level LRU caching with semantic deduplication
 * - Background synchronization for offline-first operation
 * - Content security with sanitization and validation
 * 
 * @version 3.2.1
 * @author Claude Chat Team
 * @license MIT
 */

// Modern ES module pattern with improved error isolation
const AnthropicAPI = (() => {
    'use strict';
  
    // ===============================================================
    // Core Configuration & Constants
    // ===============================================================
    
    const API_VERSION = {
      CURRENT: '2025-03-01',            // Latest stable API version as of March 2025
      LEGACY: '2024-09-15',            // Previous version for backward compatibility
      BETA: '2025-01-15-beta',         // Beta features version
      EARLIEST_SUPPORTED: '2023-06-01' // Earliest version we support
    };
    
    const ENDPOINTS = {
      MESSAGES: '/v1/messages',
      COMPLETIONS: '/v1/complete',     // Legacy endpoint, for backward compatibility
      MODELS: '/v1/models',
      ATTACHMENTS: '/v1/attachments',  // For handling file attachments
      BATCHES: '/v1/batches',          // For batch processing
      USAGE: '/v1/usage',              // For retrieving usage statistics
      TOOLS: '/v1/tools',              // For registering custom tools
    };
    
    const MODELS = {
      // Latest models (as of March 2025)
      CLAUDE_4_OPUS: 'claude-4-opus-20250420',    // Latest Claude 4 Opus model
      CLAUDE_4: 'claude-4',                       // Next-gen Claude 4 model
      CLAUDE_4_SONNET: 'claude-4-sonnet-20250315',// Balanced Claude 4
      CLAUDE_4_HAIKU: 'claude-4-haiku-20250315',  // Fast, efficient Claude 4
      CLAUDE_3_7_OPUS: 'claude-3-7-opus-20250228',// Enhanced reasoning
      CLAUDE_3_7_SONNET: 'claude-3-7-sonnet-20250219', // Mid-tier enhanced model
      CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241107', // Latest 3.5 model
      
      // Legacy models (still supported)
      CLAUDE_3_OPUS: 'claude-3-opus-20240229',
      CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
      CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  
      // Categorical access methods
      latest: function() { return this.CLAUDE_4_OPUS; },
      balanced: function() { return this.CLAUDE_4_SONNET; },
      fast: function() { return this.CLAUDE_4_HAIKU; }
    };
    
    const REQUEST_PRIORITIES = {
      CRITICAL: 0,  // User-blocking, needs immediate response
      HIGH: 1,      // User-initiated actions
      NORMAL: 2,    // Standard requests
      LOW: 3,       // Background operations
      RETRY: 4      // Failed requests being retried
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
      CONTENT_FILTER: 'content_filter',
      TOOL_EXECUTION: 'tool_execution',
      THINKING: 'thinking',
      INPUT_TRUNCATED: 'input_truncated',
      CONTEXT_WINDOW: 'context_window_exceeded',
      UNKNOWN: 'unknown'
    };
  
    const THINKING_MODES = {
      NONE: 'none',
      STANDARD: 'standard',
      EXTENDED: 'extended',
      ANALYTICAL: 'analytical',
      CREATIVE: 'creative',
      STEP_BY_STEP: 'step_by_step',
      AUTOMATIC: 'auto'
    };
    
    const CONTENT_FORMATS = {
      TEXT: 'text',
      IMAGE: 'image',
      FILE: 'file',
      JSON: 'json',
      MARKDOWN: 'markdown',
      HTML: 'html'
    };
  
    // Default configuration with updated values for 2025
    const defaultConfig = {
      baseUrl: 'https://api.anthropic.com',
      apiKey: null,
      apiVersion: API_VERSION.CURRENT,
      defaultModel: MODELS.CLAUDE_3_7_SONNET,
      fallbackModels: [MODELS.CLAUDE_3_7_OPUS, MODELS.CLAUDE_4],
      streamingEnabled: true,
      timeout: {
        connect: 8000,         // 8s connection timeout (reduced for better UX)
        response: 25000,       // 25s first response timeout
        idle: 60000,           // 60s idle timeout
        total: 600000          // 10min total request timeout (for long sessions)
      },
      retry: {
        maxAttempts: 4,        // Increased max retry attempts
        initialDelay: 1000,    // Initial backoff delay (1s)
        maxDelay: 30000,       // Max backoff delay (30s)
        jitter: true,          // Add randomness to delays
        statusCodes: [408, 429, 500, 502, 503, 504, 507, 520, 524]
      },
      throttle: {
        maxRPS: 15,            // Rate limit: requests per second (increased for Claude 4)
        maxConcurrent: 5,      // Max concurrent requests
        maxPerMinute: 200      // Max requests per minute
      },
      cache: {
        enabled: true,
        ttl: 5 * 60 * 1000,    // 5 minutes TTL
        maxSize: 150,          // Increased max cached responses
        includedMethods: ['GET'],
        semanticDeduplication: true, // Enable semantic deduplication of similar requests
        persistentCache: false // Whether to use IndexedDB for persistent caching
      },
      offline: {
        enabled: true,
        queueOnOffline: true,
        syncOnReconnect: true,
        persistQueue: true,
        maxQueueSize: 150
      },
      thinking: {
        defaultMode: THINKING_MODES.STANDARD,
        defaultBudget: 20000,  // Increased thinking token budget
        showProgress: true,    // Show thinking progress to user
        logThinking: true      // Log thinking to console in debug mode
      },
      tools: {
        enabled: true,
        timeout: 60000,        // Tool execution timeout
        maxConsecutiveCalls: 20, // Maximum consecutive tool calls (increased)
        validateResults: true,  // Validate tool results before sending back
        allowNetwork: false     // Whether to allow network access from tools
      },
      security: {
        validateResponseStructure: true,
        sanitizeInputs: true,
        redactSensitiveData: true,
        enableCSP: true,
        contentFiltering: 'standard' // 'none', 'minimal', 'standard', 'strict'
      },
      telemetry: {
        enabled: false,        // Default to disabled to respect privacy
        errorReporting: false,
        performanceMonitoring: false,
        sessionTracking: false,
        dnt: true              // Respect Do Not Track
      },
      debug: {
        logLevel: 'warn',      // 'debug', 'info', 'warn', 'error', 'none'
        traceRequests: false,
        logResponses: false,
        useDetailedErrors: true
      },
      experimental: {
        optimizeForLatency: false, // Trade token efficiency for faster first response
        adaptiveStreaming: true,   // Dynamically adjust streaming based on connection
        useCompression: true,      // Use compression for large messages
        streamingBufferSize: 16384, // Increased streaming buffer size in bytes
        useKeepAlive: true,        // Use HTTP keep-alive for connection reuse
        parallelization: false     // Experimental parallelization of requests
      },
      mocks: {
        enabled: false,
        responseLatency: [250, 1200], // Min/max latency range in ms (reduced for better UX)
        injectErrors: false,
        errorRate: 0.05,       // 5% simulated error rate for testing
        mockDataPath: '/assets/mocks/' // Path to mock data files
      },
      cors: {
        mode: 'auto',          // 'auto', 'proxy', 'direct', 'serverless'
        proxies: [
          'https://corsproxy.io/?',
          'https://api.allorigins.win/raw?url='
        ]
      }
    };
    
    // Current config (will be modified by configure())
    let config = structuredClone ? structuredClone(defaultConfig) : JSON.parse(JSON.stringify(defaultConfig));
  
    // ===============================================================
    // Utility Classes and Functions
    // ===============================================================
    
    /**
     * Enhanced logging system with structured logging, formatting, and telemetry integration
     */
    const Logger = (() => {
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
        trace: '#7e57c2',
        thinking: '#e91e63'
      };
      
      // Create a log queue for buffering logs before config is ready
      const logQueue = [];
      let queueLogs = true;
      
      // Log format with ISO time and level
      function formatLogMessage(level, ...messages) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return [`%c[${timestamp}] [${level.toUpperCase()}]`, `color: ${colors[level] || 'inherit'}; font-weight: bold`, ...messages];
      }
      
      // Main logging function
      function log(level, ...messages) {
        // If we're in queue mode, queue the log
        if (queueLogs) {
          logQueue.push({ level, messages, timestamp: Date.now() });
          return;
        }
        
        const configLevel = levels[config.debug.logLevel] || levels.warn;
        const messageLevel = levels[level] || levels.info;
        
        // Only log if level is high enough
        if (messageLevel < configLevel) return;
        
        // Handle objects for better debugging - stringify if needed
        const formattedMessages = messages.map(msg => {
          if (msg && typeof msg === 'object' && !(msg instanceof Error)) {
            try {
              // Clone the object to avoid reference issues
              return structuredClone ? structuredClone(msg) : JSON.parse(JSON.stringify(msg));
            } catch (e) {
              return msg; // Use original if stringify fails
            }
          }
          return msg;
        });
        
        // Apply formatting and log
        try {
          switch (level) {
            case 'error':
              console.error(...formatLogMessage(level, ...formattedMessages));
              break;
            case 'warn':
              console.warn(...formatLogMessage(level, ...formattedMessages));
              break;
            case 'debug':
              console.debug(...formatLogMessage(level, ...formattedMessages));
              break;
            default:
              console.log(...formatLogMessage(level, ...formattedMessages));
          }
        } catch (e) {
          // Fallback for environments with limited console support
          console.log(`[${level.toUpperCase()}]`, ...messages);
        }
  
        // Send to telemetry if enabled (excluding debug logs)
        if (config.telemetry?.enabled && level !== 'debug' && level !== 'info') {
          try {
            // Send to any configured telemetry provider
            window.dispatchEvent(new CustomEvent('api:telemetry', { 
              detail: { 
                type: 'log', 
                level, 
                message: messages.join(' '),
                timestamp: new Date().toISOString()
              } 
            }));
          } catch (e) {
            // Silently fail telemetry
          }
        }
      }
      
      // Process any queued logs once configuration is ready
      function processQueue() {
        queueLogs = false;
        
        // Process any queued logs
        if (logQueue.length > 0) {
          logQueue.forEach(entry => {
            log(entry.level, ...entry.messages);
          });
          
          // Clear the queue
          logQueue.length = 0;
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
          if (queueLogs || levels[level] < levels[config.debug.logLevel]) {
            return { end: () => {} };
          }
          
          try {
            console.groupCollapsed(...formatLogMessage(level, title));
            return { end: () => console.groupEnd() };
          } catch (e) {
            // Fallback for environments without group support
            log(level, title);
            return { end: () => {} };
          }
        },
        
        // Trace request with detailed information
        trace: function(label, data) {
          if (queueLogs || levels.debug < levels[config.debug.logLevel] || !config.debug.traceRequests) {
            return;
          }
          
          const group = this.group(`🔍 ${label}`, 'debug');
          if (data) {
            try {
              console.dir(data);
            } catch (e) {
              console.log(data);
            }
          }
          group.end();
        },
  
        // Special thinking logs with highlighting
        thinking: function(message, details) {
          if (queueLogs || !config.thinking.logThinking || levels.debug < levels[config.debug.logLevel]) {
            return;
          }
          
          try {
            console.log(
              `%c[THINKING] ${message}`, 
              `color: ${colors.thinking}; font-weight: bold`,
              details || ''
            );
          } catch (e) {
            console.log(`[THINKING] ${message}`, details || '');
          }
        },
        
        // Initialize logging system
        init: function() {
          processQueue();
        }
      };
    })();
    
    /**
     * Improved HTTP error class with rich metadata, categorization, and help text
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
        this.messageId = options.messageId || null;
        this.helpText = options.helpText || null;
        this.helpLinks = options.helpLinks || [];
        this.retryStrategy = options.retryStrategy || null;
        this.severity = options.severity || this.calculateSeverity();
        this.fingerprint = this.generateFingerprint();
  
        // Capture stack trace
        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, APIError);
        }
  
        // Log error unless silent flag is set
        if (!options.silent) {
          this.logError();
        }
      }
      
      /**
       * Calculates error severity based on category and status
       * @returns {string} Severity level
       */
      calculateSeverity() {
        // Critical errors - immediately user-impacting
        if ([
          ERROR_CATEGORIES.AUTHENTICATION,
          ERROR_CATEGORIES.CONTEXT_WINDOW,
          ERROR_CATEGORIES.QUOTA
        ].includes(this.category)) {
          return 'critical';
        }
        
        // High severity errors - significantly degraded experience
        if ([
          ERROR_CATEGORIES.CONTENT_FILTER,
          ERROR_CATEGORIES.TOOL_EXECUTION
        ].includes(this.category) || this.status === 403 || this.status === 429) {
          return 'high';
        }
        
        // Medium severity - noticeable but not blocking
        if ([
          ERROR_CATEGORIES.VALIDATION,
          ERROR_CATEGORIES.STREAMING
        ].includes(this.category) || (this.status && this.status >= 400 && this.status < 500)) {
          return 'medium';
        }
        
        // Low severity - typically retryable backend issues
        if ([
          ERROR_CATEGORIES.SERVER,
          ERROR_CATEGORIES.CONNECTION,
          ERROR_CATEGORIES.TIMEOUT
        ].includes(this.category) || (this.status && this.status >= 500)) {
          return 'low';
        }
        
        return 'medium';  // Default
      }
      
      /**
       * Generates a user-friendly error message
       * @returns {string} User-friendly message
       */
      generateUserMessage() {
        switch (this.category) {
          case ERROR_CATEGORIES.AUTHENTICATION:
            return 'Authentication failed. Please check your API key or sign in again.';
          
          case ERROR_CATEGORIES.AUTHORIZATION:
            return 'You do not have permission to access this resource.';
            
          case ERROR_CATEGORIES.RATE_LIMIT:
            return 'Rate limit exceeded. Please slow down your requests and try again shortly.';
            
          case ERROR_CATEGORIES.QUOTA:
            return 'Your API quota has been exceeded for this billing period.';
            
          case ERROR_CATEGORIES.VALIDATION:
            return 'Invalid request: ' + (this.details?.summary || this.message);
            
          case ERROR_CATEGORIES.SERVER:
            return 'The server encountered an error. Our team has been notified and we\'re working on a fix.';
            
          case ERROR_CATEGORIES.CONNECTION:
            return 'Cannot connect to the API. Please check your internet connection and try again.';
            
          case ERROR_CATEGORIES.TIMEOUT:
            return 'The request timed out. Please try again when the network is more stable.';
            
          case ERROR_CATEGORIES.CORS:
            return 'Cross-origin request blocked. This is a browser security limitation.';
            
          case ERROR_CATEGORIES.STREAMING:
            return 'Error during response streaming. Try disabling streaming or refreshing the page.';
  
          case ERROR_CATEGORIES.CONTENT_FILTER:
            return 'Your message was flagged by content filters. Please revise your input to comply with our content policies.';
  
          case ERROR_CATEGORIES.TOOL_EXECUTION:
            return 'Error while executing a tool or function. Please check tool implementation or try a different approach.';
  
          case ERROR_CATEGORIES.THINKING:
            return 'Error during thinking process. Try simplifying your request or providing clearer instructions.';
  
          case ERROR_CATEGORIES.CONTEXT_WINDOW:
            return 'Your conversation is too long. Please start a new conversation or remove some earlier messages.';
            
          default:
            return this.message || 'An unexpected error occurred. Please try again.';
        }
      }
      
      /**
       * Generates a unique fingerprint for error deduplication
       * @returns {string} Error fingerprint
       */
      generateFingerprint() {
        // Combine relevant properties for a unique fingerprint
        const components = [
          this.category || 'unknown',
          this.status || 0,
          this.code || 'none',
          // Strip variable data from message
          this.message.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]')
                     .replace(/\d+/g, '[NUM]')
        ];
        
        return components.join('::');
      }
      
      /**
       * Append additional details to the error
       * @param {Object} details Error details to add
       * @returns {APIError} This error instance for chaining
       */
      withDetails(details) {
        this.details = { ...this.details, ...details };
        return this;
      }
  
      /**
       * Logs the error with appropriate level and details
       */
      logError() {
        const errorDetails = {
          category: this.category,
          status: this.status,
          code: this.code,
          requestId: this.requestId,
          timestamp: this.timestamp,
          details: this.details,
          severity: this.severity,
          retryable: this.retryable,
          fingerprint: this.fingerprint
        };
  
        if (this.severity === 'critical') {
          Logger.error(`Critical API Error: ${this.message}`, errorDetails);
        } else if (this.severity === 'high') {
          Logger.error(`API Error: ${this.message}`, errorDetails);
        } else if (this.severity === 'medium') {
          Logger.warn(`API Warning: ${this.message}`, errorDetails);
        } else {
          Logger.info(`API Issue: ${this.message}`, errorDetails);
        }
      }
  
      /**
       * Returns a simplified object for serialization
       * @returns {Object} Serializable error representation
       */
      toJSON() {
        return {
          name: this.name,
          message: this.message,
          userMessage: this.userMessage,
          category: this.category,
          status: this.status,
          code: this.code,
          timestamp: this.timestamp,
          requestId: this.requestId,
          severity: this.severity,
          retryable: this.retryable,
          helpText: this.helpText,
          helpLinks: this.helpLinks,
          fingerprint: this.fingerprint
        };
      }
      
      /**
       * Create an error from a fetch Response object
       * @param {Response} response Fetch Response object
       * @param {Object} request Request details
       * @returns {Promise<APIError>} Created error
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
          code = data.error?.type || data.error?.code || null;
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
        if (data.error?.type) {
          if (data.error.type === 'rate_limit_error') {
            category = ERROR_CATEGORIES.RATE_LIMIT;
          } else if (data.error.type === 'authentication_error') {
            category = ERROR_CATEGORIES.AUTHENTICATION;
          } else if (data.error.type === 'invalid_request_error') {
            category = ERROR_CATEGORIES.VALIDATION;
          } else if (data.error.type.includes('content_filter')) {
            category = ERROR_CATEGORIES.CONTENT_FILTER;
          } else if (data.error.type === 'context_window_exceeded') {
            category = ERROR_CATEGORIES.CONTEXT_WINDOW;
          } else if (data.error.type === 'tool_execution_error') {
            category = ERROR_CATEGORIES.TOOL_EXECUTION;
          } else if (data.error.type === 'overloaded_error') {
            category = ERROR_CATEGORIES.SERVER;
            message = "Claude's servers are currently overloaded. Please try again shortly.";
          } else if (data.error.type === 'quota_exceeded') {
            category = ERROR_CATEGORIES.QUOTA;
          }
        }
  
        // Extract retry info from headers
        let retryAfter = null;
        if (response.headers.has('retry-after')) {
          retryAfter = parseInt(response.headers.get('retry-after'), 10) * 1000;
        }
        
        // Create appropriate retry strategy based on error
        const retryStrategy = response.status === 429 ? {
          type: 'fixed',
          delayMs: retryAfter || 2000, // Default to 2s if no retry-after header
          retryCount: 0
        } : {
          type: 'exponential',
          baseDelayMs: 1000, // Default to start at 1s
          retryCount: 0
        };
  
        // Add correlation ID if available
        const requestId = response.headers.get('x-request-id') || 
                         response.headers.get('x-amzn-requestid') || 
                         data.error?.request_id;
        
        return new APIError(message, {
          category,
          status: response.status,
          code,
          retryable: (response.status >= 500 || response.status === 429 || response.status === 408),
          details: {
            url: request?.url,
            method: request?.method,
            errorData: data,
            headers: Object.fromEntries([...response.headers.entries()])
          },
          requestId,
          retryStrategy
        });
      }
      
      /**
       * Create an error from a network or other exception
       * @param {Error} error Original error
       * @param {Object} request Request details
       * @returns {APIError} Created error
       */
      static fromException(error, request) {
        // Determine error category based on error type
        let category = ERROR_CATEGORIES.CONNECTION;
        let retryable = true;
        
        if (error.name === 'AbortError') {
          category = ERROR_CATEGORIES.TIMEOUT;
        } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
          category = ERROR_CATEGORIES.PARSING;
          retryable = false;
        } else if (error.message?.includes('CORS')) {
          category = ERROR_CATEGORIES.CORS;
          retryable = false;
        } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          category = ERROR_CATEGORIES.CONNECTION;
          retryable = true;
        }
  
        // Format the message to be more helpful
        let message = error.message || 'Network request failed';
        if (category === ERROR_CATEGORIES.CONNECTION) {
          message = 'Connection error: Unable to reach the Claude API. Please check your internet connection.';
        } else if (category === ERROR_CATEGORIES.TIMEOUT) {
          message = 'Request timeout: The operation took too long to complete. This might be due to network issues or high server load.';
        }
        
        return new APIError(message, {
          category,
          originalError: error,
          retryable,
          details: request ? { 
            url: request.url,
            method: request.method,
            timestamp: new Date().toISOString()
          } : undefined
        });
      }
  
      /**
       * Create an error for content filtering issues
       * @param {Object} details Content filter details
       * @param {string} messageId Associated message ID
       * @returns {APIError} Created error
       */
      static contentFiltered(details, messageId = null) {
        return new APIError('Content filtered by Claude\'s safety systems', {
          category: ERROR_CATEGORIES.CONTENT_FILTER,
          code: 'content_filtered',
          retryable: false,
          messageId,
          details: {
            ...details,
            timestamp: new Date().toISOString()
          }
        });
      }
  
      /**
       * Create an error for tool execution failures
       * @param {string} toolName Name of the tool
       * @param {Error} error Original error
       * @param {Object} details Additional details
       * @returns {APIError} Created error
       */
      static toolExecutionFailed(toolName, error, details = {}) {
        return new APIError(`Tool execution failed: ${toolName}`, {
          category: ERROR_CATEGORIES.TOOL_EXECUTION,
          code: 'tool_execution_failed',
          retryable: true,
          originalError: error,
          details: {
            toolName,
            error: error?.message || String(error),
            timestamp: new Date().toISOString(),
            ...details
          }
        });
      }
    }
  
    /**
     * Enhanced request queue with priority, deadline management, and telemetry
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
        this.metrics = {
          totalLatency: 0,
          requestCount: 0,
          errors: {},
          statusCodes: {},
          modelUsage: {}
        };
        this.abortControllers = new Map();
  
        // Set up periodic metrics reporting and cleanup
        if (config.telemetry?.performanceMonitoring) {
          this.metricsInterval = setInterval(() => this.reportMetrics(), 60000); // Report every minute
        }
        
        // Set up cleanup interval for counters
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Clean up every minute
      }
      
      /**
       * Clean up expired request counters
       */
      cleanup() {
        const now = Date.now();
        
        // Clean up expired RPS entries (older than 10s to be safe)
        this.rpsCounter = this.rpsCounter.filter(time => now - time < 10000);
        
        // Clean up expired minute entries (older than 70s to be safe)
        this.minuteCounter = this.minuteCounter.filter(time => now - time < 70000);
      }
      
      /**
       * Get current queue stats
       * @returns {Object} Queue statistics
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
          requestsLastMinute: this.minuteCounter.length,
          avgLatency: this.metrics.requestCount > 0 
            ? Math.round(this.metrics.totalLatency / this.metrics.requestCount) 
            : 0,
          isPaused: !!this.pausePromise
        };
      }
      
      /**
       * Check if we should rate limit based on current activity
       * @returns {boolean} Whether to apply rate limiting
       */
      shouldRateLimit() {
        const stats = this.stats;
        
        return (
          stats.currentRPS >= config.throttle.maxRPS ||
          stats.requestsLastMinute >= config.throttle.maxPerMinute ||
          stats.active >= config.throttle.maxConcurrent
        );
      }
      
      /**
       * Report queue metrics for monitoring
       */
      reportMetrics() {
        if (!config.telemetry?.performanceMonitoring) return;
  
        const stats = this.stats;
        const metrics = {
          timestamp: new Date().toISOString(),
          requestRate: stats.requestsLastMinute / 60, // Requests per second
          concurrency: stats.active,
          queueDepth: stats.queued,
          latencyMs: stats.avgLatency,
          errorRate: stats.failed / (stats.completed + stats.failed || 1),
          errorsByCategory: this.metrics.errors,
          statusCodeDistribution: this.metrics.statusCodes,
          modelUsage: this.metrics.modelUsage
        };
  
        // Dispatch metrics event
        try {
          window.dispatchEvent(new CustomEvent('api:metrics', { 
            detail: { type: 'queue', metrics } 
          }));
        } catch (e) {
          // Ignore errors in event dispatching
        }
  
        // Reset cumulative metrics after reporting
        this.metrics.totalLatency = 0;
        this.metrics.requestCount = 0;
        this.metrics.errors = {};
        this.metrics.statusCodes = {};
        // Keep model usage for trending
      }
      
      /**
       * Add a request to the queue
       * @param {Function} requestFn Function to execute 
       * @param {number} priority Request priority
       * @param {Object} metadata Request metadata
       * @returns {Promise} Promise resolving to request result
       */
      enqueue(requestFn, priority = REQUEST_PRIORITIES.NORMAL, metadata = {}) {
        return new Promise((resolve, reject) => {
          // Set default deadline if none is provided
          if (!metadata.deadline) {
            const timeoutMs = metadata.timeout || config.timeout.total;
            metadata.deadline = Date.now() + timeoutMs;
          }
  
          // Generate request ID if not provided
          const requestId = metadata.id || generateId('req');
          
          // Create abort controller for this request
          const controller = new AbortController();
          this.abortControllers.set(requestId, controller);
  
          const queueEntry = {
            requestFn: async () => {
              try {
                // Pass the abort signal to the request function
                return await requestFn(controller.signal);
              } finally {
                // Clean up the controller when done
                this.abortControllers.delete(requestId);
              }
            },
            resolve,
            reject,
            priority,
            metadata: {
              id: requestId,
              type: metadata.type || 'api',
              description: metadata.description || 'API request',
              ...metadata
            },
            timestamp: Date.now(),
            added: performance.now()
          };
  
          this.queue.enqueue(queueEntry);
          
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
        const { requestFn, resolve, reject, metadata, added } = this.queue.dequeue();
        
        // Check if request has expired (passed its deadline)
        if (metadata.deadline && Date.now() > metadata.deadline) {
          const timeoutError = new APIError('Request timed out in queue before processing', {
            category: ERROR_CATEGORIES.TIMEOUT,
            retryable: true,
            details: { 
              queueTime: Date.now() - metadata.timestamp,
              deadline: new Date(metadata.deadline).toISOString()
            }
          });
          reject(timeoutError);
          this.failedRequests++;
  
          // Track error in metrics
          this.trackError(ERROR_CATEGORIES.TIMEOUT);
          
          // Process next item
          setTimeout(() => this.processQueue(), 0);
          return;
        }
        
        this.activeRequests++;
        
        try {
          // Execute the request
          const startTime = performance.now();
          const queueTimeMs = Math.round(startTime - added);
  
          // Add queue time to the metadata for telemetry
          metadata.queueTimeMs = queueTimeMs;
  
          // Log long queue times
          if (queueTimeMs > 1000) {
            Logger.debug(`Request spent ${queueTimeMs}ms in queue`, 
              { id: metadata.id, type: metadata.type });
          }
          
          const result = await requestFn();
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // Update metrics for model usage if available
          if (result?.model) {
            this.metrics.modelUsage[result.model] = (this.metrics.modelUsage[result.model] || 0) + 1;
          }
          
          // Log the request duration and metadata
          Logger.trace(`Request completed in ${duration.toFixed(1)}ms (queue: ${queueTimeMs}ms)`, {
            duration,
            queueTime: queueTimeMs,
            ...metadata
          });
          
          // Track request for rate limiting
          this.rpsCounter.push(Date.now());
          this.minuteCounter.push(Date.now());
          
          // Update stats
          this.completedRequests++;
  
          // Update metrics
          this.metrics.totalLatency += duration;
          this.metrics.requestCount++;
          
          // Track status code if available
          if (result?.status) {
            this.metrics.statusCodes[result.status] = 
              (this.metrics.statusCodes[result.status] || 0) + 1;
          }
          
          resolve(result);
        } catch (error) {
          // Update stats
          this.failedRequests++;
  
          // Track error in metrics
          this.trackError(error.category || ERROR_CATEGORIES.UNKNOWN);
          
          reject(error);
        } finally {
          this.activeRequests--;
          
          // Process next item in queue
          setTimeout(() => this.processQueue(), 0);
        }
      }
      
      /**
       * Track an error in metrics by category
       * @param {string} category Error category
       */
      trackError(category) {
        this.metrics.errors[category] = (this.metrics.errors[category] || 0) + 1;
      }
      
      /**
       * Pause queue processing
       * @returns {Promise} Promise that resolves when queue is resumed
       */
      pause() {
        if (!this.pausePromise) {
          this.pausePromise = new Promise(resolve => {
            this.pauseResolve = resolve;
          });
        }
        Logger.debug('Request queue paused');
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
          Logger.debug('Request queue resumed');
        }
      }
      
      /**
       * Abort a specific request
       * @param {string} requestId ID of request to abort
       * @returns {boolean} Whether the request was found and aborted
       */
      abortRequest(requestId) {
        const controller = this.abortControllers.get(requestId);
        if (controller) {
          controller.abort();
          this.abortControllers.delete(requestId);
          return true;
        }
        
        // Also check queue for pending requests
        const queuedRequest = this.queue.findById(requestId);
        if (queuedRequest) {
          // Remove from queue
          this.queue.removeById(requestId);
          
          // Reject with abort error
          queuedRequest.reject(new APIError('Request aborted by user', {
            category: ERROR_CATEGORIES.TIMEOUT,
            retryable: false
          }));
          
          return true;
        }
        
        return false;
      }
      
      /**
       * Clear the queue and reject all pending requests
       * @param {string} reason Reason for clearing
       */
      clear(reason = 'Queue cleared') {
        const error = new APIError(reason, {
          category: ERROR_CATEGORIES.UNKNOWN,
          retryable: true
        });
        
        // Abort all active requests
        for (const controller of this.abortControllers.values()) {
          controller.abort(reason);
        }
        this.abortControllers.clear();
        
        const count = this.queue.size();
        while (!this.queue.isEmpty()) {
          const { reject } = this.queue.dequeue();
          reject(error);
        }
        
        Logger.info(`Cleared ${count} pending requests from queue`);
      }
  
      /**
       * Destroy the queue and clean up resources
       */
      destroy() {
        if (this.metricsInterval) {
          clearInterval(this.metricsInterval);
        }
        
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
        }
        
        this.clear('API client shutting down');
        this.queue = new PriorityQueue();
      }
    }
    
    /**
     * Improved priority queue with search and removal capabilities
     */
    class PriorityQueue {
      constructor() {
        this.items = [];
      }
      
      /**
       * Add an item to the queue
       * @param {Object} item Item to add
       */
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
      
      /**
       * Remove and return the next item from the queue
       * @returns {Object} Next item or null if empty
       */
      dequeue() {
        if (this.isEmpty()) {
          return null;
        }
        return this.items.shift();
      }
      
      /**
       * Check if queue is empty
       * @returns {boolean} Whether queue is empty
       */
      isEmpty() {
        return this.items.length === 0;
      }
      
      /**
       * Get queue size
       * @returns {number} Number of items in queue
       */
      size() {
        return this.items.length;
      }
  
      /**
       * Find an item by its ID
       * @param {string} id Item ID
       * @returns {Object} Found item or undefined
       */
      findById(id) {
        return this.items.find(item => item.metadata?.id === id);
      }
      
      /**
       * Remove an item by its ID
       * @param {string} id Item ID
       * @returns {boolean} Whether item was found and removed
       */
      removeById(id) {
        const initialLength = this.items.length;
        this.items = this.items.filter(item => item.metadata?.id !== id);
        return initialLength !== this.items.length;
      }
  
      /**
       * Get all items of a specific priority
       * @param {number} priority Priority level
       * @returns {Array} Items with specified priority
       */
      getItemsByPriority(priority) {
        return this.items.filter(item => item.priority === priority);
      }
      
      /**
       * Get the items that will expire soon
       * @param {number} thresholdMs Milliseconds threshold
       * @returns {Array} Soon-to-expire items
       */
      getExpiringSoon(thresholdMs = 5000) {
        const expiresBefore = Date.now() + thresholdMs;
        return this.items.filter(item => 
          item.metadata?.deadline && item.metadata.deadline < expiresBefore
        );
      }
    }
    
    /**
     * Enhanced caching system with TTL, LRU policies, and optional persistence
     */
    class CacheManager {
      constructor(options = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || config.cache.ttl;
        this.maxSize = options.maxSize || config.cache.maxSize;
        this.hits = 0;
        this.misses = 0;
        this.semanticDeduplication = options.semanticDeduplication !== undefined 
          ? options.semanticDeduplication 
          : config.cache.semanticDeduplication;
        this.persistentCache = options.persistentCache !== undefined
          ? options.persistentCache
          : config.cache.persistentCache;
        
        // Initialize persistent storage if enabled
        if (this.persistentCache) {
          this.initPersistentStorage();
        }
        
        // Set up cache cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
        
        // Initial cleanup to load existing data
        this.cleanup();
      }
      
      /**
       * Initialize persistent storage if supported
       */
      async initPersistentStorage() {
        // Check for IndexedDB support
        if (!window.indexedDB) {
          Logger.warn('IndexedDB not supported, persistent caching disabled');
          this.persistentCache = false;
          return;
        }
        
        try {
          // Initialize IndexedDB
          const dbPromise = indexedDB.open('claude_api_cache', 1);
          
          dbPromise.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Create object store with timestamp index
            if (!db.objectStoreNames.contains('cache_entries')) {
              const store = db.createObjectStore('cache_entries', { keyPath: 'key' });
              store.createIndex('expires', 'expires', { unique: false });
            }
          };
          
          dbPromise.onerror = (event) => {
            Logger.error('IndexedDB error, persistent caching disabled', event);
            this.persistentCache = false;
          };
          
          dbPromise.onsuccess = (event) => {
            this.db = event.target.result;
            Logger.debug('Persistent cache initialized');
            
            // Load cached items from persistent storage
            this.loadPersistedItems();
          };
        } catch (err) {
          Logger.error('Failed to initialize persistent cache', err);
          this.persistentCache = false;
        }
      }
      
      /**
       * Load items from persistent storage
       */
      async loadPersistedItems() {
        if (!this.db || !this.persistentCache) return;
        
        try {
          const transaction = this.db.transaction(['cache_entries'], 'readonly');
          const store = transaction.objectStore('cache_entries');
          const now = Date.now();
          
          // Get all non-expired items
          const request = store.openCursor();
          
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              const item = cursor.value;
              
              // Skip expired items
              if (!item.expires || item.expires > now) {
                // Add to in-memory cache
                this.cache.set(item.key, {
                  data: item.data,
                  expires: item.expires
                });
              }
              
              cursor.continue();
            }
          };
          
          transaction.oncomplete = () => {
            Logger.debug(`Loaded ${this.cache.size} items from persistent cache`);
          };
        } catch (err) {
          Logger.error('Failed to load items from persistent cache', err);
        }
      }
      
      /**
       * Save an item to persistent storage
       * @param {string} key Cache key
       * @param {Object} data Item data
       * @param {number} expires Expiration timestamp
       */
      async persistItem(key, data, expires) {
        if (!this.db || !this.persistentCache) return;
        
        try {
          const transaction = this.db.transaction(['cache_entries'], 'readwrite');
          const store = transaction.objectStore('cache_entries');
          
          // Store the item
          store.put({
            key,
            data,
            expires,
            stored: Date.now()
          });
        } catch (err) {
          Logger.warn('Failed to persist cache item', err);
        }
      }
      
      /**
       * Remove an item from persistent storage
       * @param {string} key Cache key
       */
      async removePersistedItem(key) {
        if (!this.db || !this.persistentCache) return;
        
        try {
          const transaction = this.db.transaction(['cache_entries'], 'readwrite');
          const store = transaction.objectStore('cache_entries');
          
          // Remove the item
          store.delete(key);
        } catch (err) {
          // Ignore errors
        }
      }
      
      /**
       * Generate cache key from request data
       * @param {string|Object} request Request to generate key for
       * @returns {string} Cache key 
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
       * @param {*} obj Object to normalize
       * @returns {*} Normalized object
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
            if (['timestamp', 'requestId', 'stream', 'correlation_id'].includes(key)) return;
            
            // Keep temperature with limited precision to improve cache hits
            if (key === 'temperature' && typeof obj[key] === 'number') {
              sortedObj[key] = Math.round(obj[key] * 100) / 100;
              return;
            }
            
            // Normalize system prompt to improve cache hits
            if (key === 'system' && typeof obj[key] === 'string') {
              // Normalize whitespace
              sortedObj[key] = obj[key].trim().replace(/\s+/g, ' ');
              return;
            }
            
            sortedObj[key] = this.normalizeForCaching(obj[key]);
          });
        
        return sortedObj;
      }
      
      /**
       * Find semantic duplicates of a request (similar but not identical)
       * @param {string} key Cache key
       * @param {Object} obj Original request object
       * @returns {*} Matching cache data or null
       */
      findSemanticDuplicate(key, obj) {
        if (!this.semanticDeduplication || typeof obj !== 'object') return null;
        
        // Only attempt for message API calls
        if (!obj.messages || obj.stream === true) return null;
  
        // Get the last user message as representative of the request
        const lastUserMessage = obj.messages
          .filter(m => m.role === 'user')
          .slice(-1)[0];
          
        if (!lastUserMessage?.content) return null;
        
        // Get content as string for comparison
        const msgContent = typeof lastUserMessage.content === 'string' 
          ? lastUserMessage.content 
          : JSON.stringify(lastUserMessage.content);
        
        // Look for similar requests in cache
        for (const [cachedKey, { data, expires }] of this.cache.entries()) {
          // Skip if key is identical or item expired
          if (cachedKey === key || (expires && Date.now() > expires)) continue;
          
          try {
            // Parse cached key to get request object
            const cachedObj = JSON.parse(cachedKey);
            if (!cachedObj.messages) continue;
            
            // Find last user message
            const cachedLastUserMessage = cachedObj.messages
              .filter(m => m.role === 'user')
              .slice(-1)[0];
              
            if (!cachedLastUserMessage?.content) continue;
            
            // Get content as string for comparison
            const cachedContent = typeof cachedLastUserMessage.content === 'string'
              ? cachedLastUserMessage.content
              : JSON.stringify(cachedLastUserMessage.content);
            
            // Check if model and basic params match
            if (obj.model === cachedObj.model) {
              // Check message similarity
              if (this.isContentSimilar(msgContent, cachedContent)) {
                Logger.debug('Found semantic duplicate in cache');
                return data;
              }
            }
          } catch (e) {
            // Skip on any error in comparison
            continue;
          }
        }
        
        return null;
      }
      
      /**
       * Check if two content strings are similar enough to be considered duplicates
       * @param {string} content1 First content
       * @param {string} content2 Second content
       * @returns {boolean} Whether content is similar
       */
      isContentSimilar(content1, content2) {
        // For very short messages, require exact match
        if (content1.length < 10 || content2.length < 10) {
          return content1 === content2;
        }
        
        // Check length ratio
        const lengthRatio = Math.max(content1.length, content2.length) / 
                           Math.min(content1.length, content2.length);
        
        // If lengths are very different, not similar
        if (lengthRatio > 1.2) return false;
        
        // For longer messages, use similarity heuristic
        const similarity = simpleSimilarity(content1, content2);
        return similarity > 0.9;
      }
      
      /**
       * Get item from cache
       * @param {string|Object} key Cache key
       * @param {Object} originalObj Original request object
       * @returns {*} Cached data or null
       */
      get(key, originalObj = null) {
        const normalizedKey = this.generateKey(key);
        
        // Check for exact cache hit
        if (this.cache.has(normalizedKey)) {
          const { data, expires } = this.cache.get(normalizedKey);
          
          // Check if expired
          if (expires && Date.now() > expires) {
            this.cache.delete(normalizedKey);
            
            // Also remove from persistent storage
            if (this.persistentCache) {
              this.removePersistedItem(normalizedKey);
            }
            
            this.misses++;
            return null;
          }
          
          // Update item's position in the LRU ordering
          this.cache.delete(normalizedKey);
          this.cache.set(normalizedKey, { data, expires });
          
          this.hits++;
          return data;
        }
        
        // If semantic deduplication is enabled, check for similar requests
        if (this.semanticDeduplication && originalObj) {
          const semanticMatch = this.findSemanticDuplicate(normalizedKey, originalObj);
          if (semanticMatch) {
            this.hits++;
            return semanticMatch;
          }
        }
        
        this.misses++;
        return null;
      }
      
      /**
       * Store item in cache
       * @param {string|Object} key Cache key
       * @param {*} data Data to cache
       * @param {number} ttl Time-to-live in ms
       */
      set(key, data, ttl = this.ttl) {
        const normalizedKey = this.generateKey(key);
        const expires = ttl > 0 ? Date.now() + ttl : null;
        
        // Apply LRU policy if we're at capacity
        if (this.cache.size >= this.maxSize) {
          const oldestKey = this.cache.keys().next().value;
          this.cache.delete(oldestKey);
          
          // Also remove from persistent storage
          if (this.persistentCache) {
            this.removePersistedItem(oldestKey);
          }
        }
        
        // Store in memory cache
        this.cache.set(normalizedKey, { data, expires });
        
        // Store in persistent cache if enabled
        if (this.persistentCache) {
          this.persistItem(normalizedKey, data, expires);
        }
      }
      
      /**
       * Remove an item from cache
       * @param {string|Object} key Cache key
       * @returns {boolean} Whether item was removed
       */
      delete(key) {
        const normalizedKey = this.generateKey(key);
        
        // Remove from persistent storage
        if (this.persistentCache) {
          this.removePersistedItem(normalizedKey);
        }
        
        return this.cache.delete(normalizedKey);
      }
      
      /**
       * Remove all items from cache
       */
      async clear() {
        this.cache.clear();
        
        // Clear persistent storage
        if (this.persistentCache && this.db) {
          try {
            const transaction = this.db.transaction(['cache_entries'], 'readwrite');
            const store = transaction.objectStore('cache_entries');
            store.clear();
          } catch (err) {
            Logger.warn('Failed to clear persistent cache', err);
          }
        }
        
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
            
            // Also remove from persistent storage
            if (this.persistentCache) {
              this.removePersistedItem(key);
            }
            
            removed++;
          }
        }
        
        if (removed > 0) {
          Logger.debug(`Cache cleanup: removed ${removed} expired items`);
        }
        
        // Clean up persistent storage
        if (this.persistentCache && this.db) {
          this.cleanupPersistentStorage(now);
        }
      }
      
      /**
       * Clean up expired items in persistent storage
       * @param {number} now Current timestamp
       */
      async cleanupPersistentStorage(now) {
        try {
          const transaction = this.db.transaction(['cache_entries'], 'readwrite');
          const store = transaction.objectStore('cache_entries');
          const expiredIndex = store.index('expires');
          
          // Find expired items
          const range = IDBKeyRange.upperBound(now);
          
          // Get all items with expires <= now
          const request = expiredIndex.openCursor(range);
          
          let removed = 0;
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              // Delete expired item
              cursor.delete();
              removed++;
              cursor.continue();
            }
          };
          
          transaction.oncomplete = () => {
            if (removed > 0) {
              Logger.debug(`Persistent cache cleanup: removed ${removed} expired items`);
            }
          };
        } catch (err) {
          // Ignore errors in cleanup
        }
      }
      
      /**
       * Get cache statistics
       * @returns {Object} Cache stats
       */
      getStats() {
        return {
          size: this.cache.size,
          maxSize: this.maxSize,
          hitRate: this.hits + this.misses > 0 
            ? this.hits / (this.hits + this.misses) 
            : 0,
          hits: this.hits,
          misses: this.misses,
          persistent: this.persistentCache
        };
      }
      
      /**
       * Destroy the cache and cleanup
       */
      destroy() {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
        
        // Close DB connection if open
        if (this.db) {
          this.db.close();
          this.db = null;
        }
        
        this.hits = 0;
        this.misses = 0;
      }
    }
    
    /**
     * Simple text similarity function for semantic cache matching
     * @param {string} str1 First string
     * @param {string} str2 Second string
     * @returns {number} Similarity score (0-1)
     */
    function simpleSimilarity(str1, str2) {
      // For very long strings, just compare a sample
      if (str1.length > 200 && str2.length > 200) {
        str1 = str1.substring(0, 200);
        str2 = str2.substring(0, 200);
      }
      
      // Enhanced matching for natural language
      // 1. Convert to lowercase
      str1 = str1.toLowerCase();
      str2 = str2.toLowerCase();
      
      // 2. Normalize whitespace
      str1 = str1.replace(/\s+/g, ' ').trim();
      str2 = str2.replace(/\s+/g, ' ').trim();
      
      // 3. Count matching characters
      let matches = 0;
      const minLength = Math.min(str1.length, str2.length);
      
      for (let i = 0; i < minLength; i++) {
        if (str1[i] === str2[i]) matches++;
      }
      
      // 4. Calculate Jaccard similarity of words for better semantic comparison
      const words1 = str1.split(/\W+/).filter(w => w.length > 0);
      const words2 = str2.split(/\W+/).filter(w => w.length > 0);
      
      const wordSet1 = new Set(words1);
      const wordSet2 = new Set(words2);
      
      let commonWords = 0;
      for (const word of wordSet1) {
        if (wordSet2.has(word)) commonWords++;
      }
      
      const jaccardSimilarity = commonWords / (wordSet1.size + wordSet2.size - commonWords);
      
      // 5. Combine character and word similarity
      const charSimilarity = matches / Math.max(str1.length, str2.length);
      return (charSimilarity * 0.4) + (jaccardSimilarity * 0.6);
    }
    
    /**
     * Enhanced offline queue manager with better synchronization and persistence
     */
    class OfflineQueueManager {
      constructor() {
        this.queue = [];
        this.isOnline = navigator.onLine;
        this.isProcessing = false;
        this.suspended = false;
        this.retryTimeout = null;
        
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
        if (!wasOnline && this.isOnline && config.offline.syncOnReconnect && !this.suspended) {
          // Small delay to ensure network is stable
          setTimeout(() => this.processQueue(), 1500);
        }
        
        // Trigger event for UI to display offline status
        try {
          window.dispatchEvent(new CustomEvent('api:connectivity', { 
            detail: { online: this.isOnline } 
          }));
        } catch (e) {
          // Ignore event dispatch errors
        }
      }
      
      /**
       * Add an item to the offline queue
       * @param {Object} item Queue item
       * @returns {Object} Queue info
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
        const queueItem = {
          ...item,
          id: item.id || generateId('offline'),
          timestamp: Date.now(),
          attempts: 0,
          status: 'pending'
        };
  
        this.queue.push(queueItem);
        
        // Persist queue if enabled
        if (config.offline.persistQueue) {
          this.persistQueue();
        }
        
        Logger.info(`Request added to offline queue. Queue size: ${this.queue.length}`);
        
        // Notify listeners
        try {
          window.dispatchEvent(new CustomEvent('api:offlineQueue', { 
            detail: { 
              status: 'enqueued',
              queueSize: this.queue.length 
            } 
          }));
        } catch (e) {
          // Ignore event dispatch errors
        }
        
        return {
          id: queueItem.id,
          position: this.queue.length,
          queueLength: this.queue.length
        };
      }
      
      /**
       * Suspend queue processing
       */
      suspend() {
        this.suspended = true;
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = null;
        }
        Logger.info('Offline queue processing suspended');
      }
      
      /**
       * Resume queue processing
       * @param {boolean} processImmediately Whether to process immediately
       */
      resume(processImmediately = true) {
        this.suspended = false;
        Logger.info('Offline queue processing resumed');
        
        if (processImmediately && this.isOnline && this.queue.length > 0) {
          this.processQueue();
        }
      }
      
      /**
       * Try to process the offline queue
       */
      async processQueue() {
        // If already processing, suspended, empty queue, or offline, do nothing
        if (this.isProcessing || this.suspended || this.queue.length === 0 || !this.isOnline) {
          return;
        }
        
        this.isProcessing = true;
        Logger.info(`Processing offline queue. Items: ${this.queue.length}`);
        
        // Trigger event for UI
        try {
          window.dispatchEvent(new CustomEvent('api:offlineSync', { 
            detail: { 
              status: 'starting',
              items: this.queue.length 
            } 
          }));
        } catch (e) {
          // Ignore event dispatch errors
        }
        
        let processed = 0;
        let failed = 0;
        
        try {
          // Process each item in order
          while (this.queue.length > 0) {
            // If we're suspended or went offline, stop processing
            if (this.suspended || !navigator.onLine) {
              Logger.info('Queue processing interrupted due to offline status or suspension');
              break;
            }
            
            const item = this.queue[0]; // Get but don't remove yet
            item.status = 'processing';
            
            try {
              // Try to execute the request
              await item.execute();
              processed++;
              
              // Remove from queue on success
              this.queue.shift();
              
              // Trigger progress event
              try {
                window.dispatchEvent(new CustomEvent('api:offlineSync', { 
                  detail: { 
                    status: 'progress', 
                    processed,
                    failed,
                    remaining: this.queue.length 
                  } 
                }));
              } catch (e) {
                // Ignore event dispatch errors
              }
            } catch (error) {
              failed++;
              
              // If not retryable or too many attempts, remove from queue
              if (!error.retryable || (item.attempts && item.attempts >= 3)) {
                Logger.error(`Failed to process queued request, removing from queue`, error);
                this.queue.shift();
                
                // Add to dead letter queue in storage for debugging
                this.saveFailedRequest(item, error);
              } else {
                // Otherwise increment attempts and move to the end of queue
                Logger.warn(`Failed to process queued request, retrying later`, error);
                const failedItem = this.queue.shift();
                failedItem.attempts = (failedItem.attempts || 0) + 1;
                failedItem.lastError = error.message;
                failedItem.status = 'failed';
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
          
          // Schedule retry if there are still items and we're not suspended
          if (this.queue.length > 0 && !this.suspended && navigator.onLine) {
            // Exponential backoff for retries
            const backoffMs = Math.min(30000, 1000 * Math.pow(2, Math.min(failed, 5)));
            
            this.retryTimeout = setTimeout(() => this.processQueue(), backoffMs);
            
            Logger.info(`Scheduling queue retry in ${backoffMs}ms. Remaining items: ${this.queue.length}`);
          }
          
          // Trigger completion event
          try {
            window.dispatchEvent(new CustomEvent('api:offlineSync', { 
              detail: { 
                status: 'complete', 
                processed,
                failed,
                remaining: this.queue.length
              } 
            }));
          } catch (e) {
            // Ignore event dispatch errors
          }
          
          Logger.info(`Offline queue processing complete. Processed: ${processed}, Failed: ${failed}, Remaining: ${this.queue.length}`);
        }
      }
      
      /**
       * Save a permanently failed request for debugging
       * @param {Object} item Failed queue item
       * @param {Error} error Error that caused failure
       */
      saveFailedRequest(item, error) {
        try {
          if (!window.localStorage) return;
          
          // Get existing dead letter queue or initialize new one
          const dlqString = localStorage.getItem('claude_api_failed_requests');
          const dlq = dlqString ? JSON.parse(dlqString) : [];
          
          // Add this failed request with error details
          dlq.push({
            id: item.id,
            url: item.url,
            method: item.method,
            timestamp: item.timestamp,
            failedAt: Date.now(),
            attempts: item.attempts,
            error: {
              message: error.message,
              category: error.category,
              status: error.status,
              retryable: error.retryable
            }
          });
          
          // Limit size of dead letter queue
          while (dlq.length > 20) {
            dlq.shift();
          }
          
          // Save back to storage
          localStorage.setItem('claude_api_failed_requests', JSON.stringify(dlq));
        } catch (e) {
          // Ignore errors in saving failed requests
        }
      }
      
      /**
       * Save queue to localStorage
       */
      persistQueue() {
        if (!config.offline.persistQueue) return;
        
        try {
          if (!window.localStorage) return;
          
          // Only save serializable parts of the queue
          const queueData = this.queue.map(item => ({
            id: item.id,
            timestamp: item.timestamp,
            attempts: item.attempts || 0,
            status: item.status,
            url: item.url,
            method: item.method,
            body: item.body,
            headers: item.headers,
            lastError: item.lastError
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
          if (!window.localStorage) return;
          
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
              
              // Notify listeners
              if (this.queue.length > 0) {
                try {
                  window.dispatchEvent(new CustomEvent('api:offlineQueue', { 
                    detail: { 
                      status: 'loaded',
                      queueSize: this.queue.length 
                    } 
                  }));
                } catch (e) {
                  // Ignore event dispatch errors
                }
              }
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
        const size = this.queue.length;
        this.queue = [];
        
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = null;
        }
        
        if (config.offline.persistQueue && window.localStorage) {
          try {
            localStorage.removeItem('claude_api_offline_queue');
          } catch (e) {
            // Ignore storage errors
          }
        }
        
        // Notify listeners if there were items
        if (size > 0) {
          try {
            window.dispatchEvent(new CustomEvent('api:offlineQueue', { 
              detail: { 
                status: 'cleared',
                previousSize: size 
              } 
            }));
          } catch (e) {
            // Ignore event dispatch errors
          }
        }
        
        Logger.info('Offline queue cleared');
      }
      
      /**
       * Get queue statistics
       * @returns {Object} Queue stats
       */
      getStats() {
        return {
          isOnline: this.isOnline,
          queueLength: this.queue.length,
          isProcessing: this.isProcessing,
          isSuspended: this.suspended,
          oldestItem: this.queue.length > 0 ? this.queue[0].timestamp : null,
          itemCount: this.queue.length,
          pendingCount: this.queue.filter(item => item.status === 'pending').length,
          failedCount: this.queue.filter(item => item.status === 'failed').length
        };
      }
  
      /**
       * Destroy the queue manager
       */
      destroy() {
        window.removeEventListener('online', this.handleNetworkChange.bind(this));
        window.removeEventListener('offline', this.handleNetworkChange.bind(this));
        
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = null;
        }
        
        this.clear();
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
          
          // Use error-provided retry strategy if available, or calculate standard backoff
          let delay;
          if (error.retryStrategy?.type === 'fixed') {
            delay = error.retryStrategy.delayMs;
          } else {
            // Calculate delay with exponential backoff and jitter
            delay = calculateBackoffDelay(attempt, retryOptions);
          }
          
          // Update retry strategy with current attempt count
          if (error.retryStrategy) {
            error.retryStrategy.retryCount = attempt;
          }
          
          // Log the retry
          Logger.warn(`Request failed, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retryOptions.maxAttempts})`, 
            error.category ? { category: error.category, status: error.status } : error);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Should never reach here, but just in case
      throw lastError;
    }
    
    /**
     * Calculate backoff delay with exponential growth and optional jitter
     * @param {number} attempt Current attempt number
     * @param {Object} options Retry options
     * @returns {number} Delay in milliseconds
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
      
      // Get browser version
      let browserVersion = 'unknown';
      if (browserName === 'Chrome') {
        const chromeMatch = ua.match(/Chrome\/(\d+)/);
        browserVersion = chromeMatch ? chromeMatch[1] : 'unknown';
      } else if (browserName === 'Firefox') {
        const firefoxMatch = ua.match(/Firefox\/(\d+)/);
        browserVersion = firefoxMatch ? firefoxMatch[1] : 'unknown';
      } else if (browserName === 'Safari') {
        const safariMatch = ua.match(/Version\/(\d+)/);
        browserVersion = safariMatch ? safariMatch[1] : 'unknown';
      } else if (browserName === 'Edge') {
        const edgeMatch = ua.match(/Edg\/(\d+)/);
        browserVersion = edgeMatch ? edgeMatch[1] : 'unknown';
      }
      
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
        webCrypto: 'crypto' in window && 'subtle' in window.crypto,
        indexedDb: 'indexedDB' in window,
        webWorker: 'Worker' in window,
        cacheApi: 'caches' in window,
        pushApi: 'PushManager' in window,
        viewTransitions: 'startViewTransition' in document,
        structuredClone: typeof structuredClone === 'function',
        sharedWorkers: 'SharedWorker' in window
      };
      
      // Detect performance capabilities
      let performance = {
        highPrecisionTimers: 'performance' in window && typeof performance.now === 'function',
        deviceMemory: navigator.deviceMemory || 'unknown',
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        isLowEndDevice: false,
        isHighEndDevice: false
      };
      
      // Heuristic to determine device capability
      if (performance.hardwareConcurrency !== 'unknown' && performance.deviceMemory !== 'unknown') {
        performance.isLowEndDevice = 
          (performance.hardwareConcurrency <= 2 || performance.deviceMemory <= 2);
        performance.isHighEndDevice = 
          (performance.hardwareConcurrency >= 8 && performance.deviceMemory >= 8);
      }
      
      return {
        browser: {
          name: browserName,
          version: browserVersion,
          userAgent: ua
        },
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
        performance,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio || 1
        }
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
        // In serverless mode, rewrite to use our serverless function
        else if (config.cors.mode === 'serverless') {
          url = url.replace('https://api.anthropic.com', '/api/anthropic');
        }
      }
      
      // Set up request metadata for tracking and debugging
      const metadata = {
        url,
        method: finalOptions.method,
        endpoint,
        timestamp: Date.now(),
        correlationId: requestConfig.correlationId || generateId('req')
      };
      
      // Set up timeouts using AbortController
      const controller = new AbortController();
      
      // If caller provided a signal, handle both signals
      if (options.signal) {
        // If the caller's signal is already aborted, abort immediately
        if (options.signal.aborted) {
          controller.abort(options.signal.reason);
        } else {
          // Otherwise, listen for abort and propagate
          options.signal.addEventListener('abort', () => {
            controller.abort(options.signal.reason);
          });
        }
      }
      
      // Combine with the request options
      finalOptions.signal = controller.signal;
      
      // Set timeout if specified
      const timeoutId = setTimeout(() => {
        controller.abort('Request timeout');
      }, requestConfig.timeout || config.timeout.total);
      
      try {
        // Add standard headers
        finalOptions.headers = {
          'Accept': 'application/json',
          'anthropic-version': config.apiVersion || API_VERSION.CURRENT,
          ...finalOptions.headers
        };
  
        // Add API key if available
        if (config.apiKey && !finalOptions.headers['x-api-key']) {
          finalOptions.headers['x-api-key'] = config.apiKey;
        }
        
        // Add request ID for tracking
        finalOptions.headers['x-request-id'] = metadata.correlationId;
        
        // Add Content-Type for POST/PUT/PATCH requests if not specified
        if (['POST', 'PUT', 'PATCH'].includes(finalOptions.method) && !finalOptions.headers['Content-Type']) {
          finalOptions.headers['Content-Type'] = 'application/json';
        }
  
        // Add compression for large payloads if supported and enabled
        const payloadSize = finalOptions.body ? 
          (typeof finalOptions.body === 'string' ? finalOptions.body.length : JSON.stringify(finalOptions.body).length) : 0;
        
        if (config.experimental.useCompression && payloadSize > 10000) {
          finalOptions.headers['Accept-Encoding'] = 'gzip, deflate, br';
        }
        
        // Add connection reuse if enabled
        if (config.experimental.useKeepAlive) {
          finalOptions.headers['Connection'] = 'keep-alive';
          finalOptions.keepalive = true;
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
        // If AbortError and we set the timeout, convert to a timeout error
        if (error.name === 'AbortError' && controller.signal.aborted) {
          throw new APIError('Request timed out', {
            category: ERROR_CATEGORIES.TIMEOUT,
            retryable: true,
            details: {
              url,
              method: finalOptions.method,
              timeoutMs: requestConfig.timeout || config.timeout.total
            }
          });
        }
        
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
        // Use a random proxy from the list for load balancing
        const proxyIndex = Math.floor(Math.random() * cors.proxies.length);
        const proxy = cors.proxies[proxyIndex];
        
        // Check proxy type (URL parameter or prefix)
        const isEncodedProxy = proxy.includes('url=');
        
        return isEncodedProxy
          ? `${proxy}${encodeURIComponent(url)}`
          : `${proxy}${url}`;
      }
      
      // Fallback to original URL
      Logger.warn('No CORS proxy available, using direct URL');
      return url;
    }
    
    /**
     * Generate a unique request ID with prefix
     * @param {string} prefix Identifier prefix
     * @returns {string} Unique ID
     */
    function generateId(prefix = 'id') {
      // Use crypto.randomUUID if available (modern browsers)
      if (window.crypto && crypto.randomUUID) {
        return `${prefix}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
      }
      
      // Fallback implementation
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 10);
      return `${prefix}_${timestamp}_${randomPart}`;
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
      
      // Create a realistic Claude 3.7/4 response structure
      return {
        id: `mock_${generateId('msg')}`,
        model: payload.model || config.defaultModel,
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: responseText
        }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: Math.ceil(userMessage.length / 4),
          output_tokens: Math.ceil(responseText.length / 3)
        },
        _mockResponse: true
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
      
      // Skip if not a user message
      if (lastMessage.role !== 'user') {
        return 'previous conversation';
      }
      
      // Handle string content (legacy format)
      if (typeof lastMessage.content === 'string') {
        return truncate(lastMessage.content, 50);
      }
      
      // Handle array content (current format with structured content blocks)
      if (Array.isArray(lastMessage.content)) {
        // Find the first text block
        const textContent = lastMessage.content.find(c => c.type === 'text');
        
        if (textContent) {
          return truncate(textContent.text || '', 50);
        }
        
        // If no text content, check for image content
        const hasImages = lastMessage.content.some(c => c.type === 'image');
        if (hasImages) {
          return 'image content';
        }
        
        return 'multimodal content';
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
      let messageId = null;
      let streamError = null;
      let lastEventTime = Date.now();
      
      // Content tracking
      let fullMessage = null;
      let contentBlocks = [];
      let currentBlock = null;
      let accumulatedContent = '';
      
      // Function to handle each SSE event
      function handleEvent(eventData) {
        if (eventData === '[DONE]') {
          return { done: true };
        }
        
        try {
          const event = JSON.parse(eventData);
          
          // Handle different event types
          switch (event.type) {
            case 'message_start':
              messageId = event.message.id;
              fullMessage = event.message;
              
              // Call progress callback
              if (onProgress) {
                onProgress({
                  type: 'start',
                  messageId,
                  model: event.message.model,
                  event
                });
              }
              break;
              
            case 'content_block_start':
              currentBlock = {
                type: event.content_block.type,
                index: event.index,
                content: ''
              };
              break;
              
            case 'content_block_delta':
              if (currentBlock && event.delta?.text) {
                // Accumulate content for this block
                currentBlock.content += event.delta.text;
                accumulatedContent += event.delta.text;
                
                // Call progress callback
                if (onProgress) {
                  onProgress({
                    type: 'content',
                    content: accumulatedContent,
                    delta: event.delta.text,
                    contentBlock: currentBlock,
                    index: event.index,
                    event
                  });
                }
              }
              break;
              
            case 'content_block_stop':
              if (currentBlock) {
                // Finalize and store the content block
                contentBlocks.push({
                  type: currentBlock.type,
                  text: currentBlock.content
                });
                
                currentBlock = null;
                
                // Call progress callback
                if (onProgress) {
                  onProgress({
                    type: 'block_end',
                    contentBlocks,
                    event
                  });
                }
              }
              break;
              
            case 'message_delta':
              // Handle changes to message metadata
              if (event.delta.stop_reason) {
                if (fullMessage) {
                  fullMessage.stop_reason = event.delta.stop_reason;
                }
                
                // Call progress callback
                if (onProgress) {
                  onProgress({
                    type: 'metadata',
                    stop_reason: event.delta.stop_reason,
                    event
                  });
                }
              }
              break;
              
            case 'message_stop':
              // Call progress callback
              if (onProgress) {
                onProgress({
                  type: 'stop',
                  messageId: event.message_id || messageId,
                  content: accumulatedContent,
                  contentBlocks,
                  event
                });
              }
              break;
              
            case 'error':
              streamError = new APIError(event.error?.message || 'Stream error', {
                category: ERROR_CATEGORIES.STREAMING,
                code: event.error?.type,
                retryable: false,
                details: event
              });
              break;
              
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
              
            case 'content_filter_result':
            case 'input_message_filter_result':
              if (onProgress) {
                onProgress({
                  type: event.type === 'content_filter_result' ? 'content_filter' : 'input_filter',
                  filter: event.type === 'content_filter_result' ? 
                    event.content_filter : event.input_message_filter,
                  event
                });
              }
              break;
              
            case 'tool_use':
            case 'tool_result':
              if (onProgress) {
                onProgress({
                  type: event.type,
                  tool: event.tool_use || event.tool_result,
                  event
                });
              }
              break;
          }
          
          // Update last event time
          lastEventTime = Date.now();
          
          return { done: false };
        } catch (e) {
          Logger.warn('Failed to parse stream event', { line: eventData, error: e });
          return { done: false };
        }
      }
      
      try {
        // Process chunks as they arrive
        while (true) {
          const { value, done } = await Promise.race([
            reader.read(),
            // Add a ping timeout to detect stalled streams
            new Promise((_, reject) => {
              setTimeout(() => {
                // Only timeout if we haven't received data in a while
                if (Date.now() - lastEventTime > 60000) {
                  reject(new Error('Stream timeout - no data received for 60s'));
                }
              }, 60000);
            })
          ]);
          
          if (done) break;
          
          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete lines in the buffer
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);
            
            if (!line) continue;
            
            // Handle the standard event format: "data: {json}"
            if (line.startsWith('data: ')) {
              const eventData = line.slice(6).trim();
              const { done } = handleEvent(eventData);
              
              if (done) break;
            }
          }
        }
        
        // Handle any stream error
        if (streamError) {
          throw streamError;
        }
        
        // Process any remaining data in the buffer
        if (buffer.trim() && buffer.trim().startsWith('data: ')) {
          const eventData = buffer.trim().slice(6).trim();
          handleEvent(eventData);
        }
        
        // Construct and return the final message
        const finalMessage = fullMessage || {
          id: messageId || `stream_${generateId('msg')}`,
          role: 'assistant',
          type: 'message',
          model: config.defaultModel
        };
        
        // Add content blocks to message
        if (contentBlocks.length > 0) {
          finalMessage.content = contentBlocks;
        } else if (accumulatedContent) {
          finalMessage.content = [{
            type: 'text',
            text: accumulatedContent
          }];
        }
        
        return finalMessage;
      } catch (error) {
        // Convert normal errors to APIError with streaming category
        if (!(error instanceof APIError)) {
          throw new APIError(`Stream processing failed: ${error.message}`, {
            category: ERROR_CATEGORIES.STREAMING,
            originalError: error,
            retryable: true,
            details: {
              messageId,
              contentReceived: accumulatedContent.length > 0,
              lastEventTime: new Date(lastEventTime).toISOString()
            }
          });
        }
        throw error;
      } finally {
        try {
          // Always release the reader lock
          reader.releaseLock();
        } catch (e) {
          // Ignore errors during cleanup
        }
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
        apiKey: options.apiKey || config.apiKey,
        model: options.model || config.defaultModel,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens || 4096,
        useCache: options.useCache ?? config.cache.enabled,
        useStreaming: options.useStreaming ?? config.streamingEnabled,
        system: options.system,
        tools: options.tools,
        thinking: options.thinking,
        metadata: options.metadata || {},
        mockResponseStyle: options.mockResponseStyle,
        priority: options.priority || REQUEST_PRIORITIES.HIGH,
        abortSignal: options.signal,
        timeout: options.timeout
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
      
      // Add system prompt if provided
      if (settings.system) {
        payload.system = settings.system;
      }
      
      // Add tools if provided and enabled
      if (settings.tools && config.tools.enabled) {
        payload.tools = settings.tools;
      }
      
      // Add thinking mode if enabled
      if (settings.thinking || (config.thinking.defaultMode !== THINKING_MODES.NONE)) {
        const thinkingMode = settings.thinking || config.thinking.defaultMode;
        
        payload.thinking = {
          type: thinkingMode === true ? config.thinking.defaultMode : thinkingMode,
          budget_tokens: settings.thinkingBudget || config.thinking.defaultBudget
        };
      }
      
      // Add metadata if provided
      if (Object.keys(settings.metadata).length > 0) {
        payload.metadata = settings.metadata;
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
      if (settings.useCache && !payload.stream) {
        const cachedResponse = cache.get(payload, payload);
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
        body: JSON.stringify(payload),
        signal: settings.abortSignal
      };
      
      // Add client info header
      requestOptions.headers['anthropic-client'] = 'claude-chat/3.2.1';
      
      // Generate request ID for tracking
      const requestId = generateId('req');
      
      // Add request to queue
      return requestQueue.enqueue(async (signal) => {
        try {
          // Merge abort signals if we have multiple
          let controller;
          if (settings.abortSignal && signal) {
            controller = new AbortController();
            
            // Set up listeners for both signals
            [settings.abortSignal, signal].forEach(s => {
              if (s.aborted) {
                controller.abort(s.reason);
              } else {
                s.addEventListener('abort', () => controller.abort(s.reason));
              }
            });
            
            // Use the combined signal
            requestOptions.signal = controller.signal;
          } else {
            // Just use the provided signal or the queue's signal
            requestOptions.signal = settings.abortSignal || signal;
          }
          
          // Signal processing has started
          if (onProgress) {
            onProgress({ type: 'processing', requestId });
          }
          
          // Make the API request with retry logic
          const response = await withRetry(async () => {
            return makeApiRequest(ENDPOINTS.MESSAGES, requestOptions, {
              timeout: settings.timeout || config.timeout.total,
              correlationId: requestId
            });
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
              id: requestId,
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
              details: { 
                queuedForOffline: true,
                requestId
              }
            });
          }
          
          // Enhance error with guidance for common issues
          enhanceErrorWithHelp(error);
          
          // Rethrow for the caller
          throw error;
        }
      }, settings.priority, {
        id: requestId,
        type: 'message',
        description: 'Claude AI message request',
        model: settings.model
      });
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
      if (payload.thinking && onProgress) {
        onProgress({ type: 'thinking' });
        
        // Simulate thinking actions
        await new Promise(resolve => setTimeout(resolve, latency * 0.2));
        
        // Generate realistic thinking action based on the content
        const userMessage = extractUserMessage(payload);
        if (userMessage.includes('search') || userMessage.includes('find')) {
          onProgress({ 
            type: 'thinking_action',
            action: { 
              type: 'search', 
              query: userMessage.substring(0, 30)
            }
          });
        } else if (userMessage.includes('calculate') || userMessage.includes('compute')) {
          onProgress({ 
            type: 'thinking_action',
            action: { 
              type: 'calculation',
              expression: '(2.5 * 4) + (8 / 2) = 14' 
            }
          });
        } else {
          onProgress({ 
            type: 'thinking_action',
            action: { 
              type: 'reasoning',
              steps: ['Consider user requirements', 'Recall relevant information', 'Formulate response']
            }
          });
        }
        
        // Simulate thinking progress
        await new Promise(resolve => setTimeout(resolve, latency * 0.2));
        onProgress({ 
          type: 'thinking_progress',
          progress: { 
            percent_complete: 50,
            status: 'Processing'
          }
        });
      }
      
      // Generate a mock error based on configured error rate
      if (config.mocks.injectErrors && Math.random() < config.mocks.errorRate) {
        await new Promise(resolve => setTimeout(resolve, latency * 0.3));
        
        // Select a random error type
        const errorTypes = [
          ERROR_CATEGORIES.RATE_LIMIT,
          ERROR_CATEGORIES.SERVER,
          ERROR_CATEGORIES.VALIDATION,
          ERROR_CATEGORIES.CONTENT_FILTER
        ];
        
        const errorCategory = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        const errorMessage = `Mock ${errorCategory} error for testing`;
        
        throw new APIError(errorMessage, {
          category: errorCategory,
          status: errorCategory === ERROR_CATEGORIES.RATE_LIMIT ? 429 : 
                  errorCategory === ERROR_CATEGORIES.SERVER ? 502 :
                  errorCategory === ERROR_CATEGORIES.CONTENT_FILTER ? 400 :
                  errorCategory === ERROR_CATEGORIES.VALIDATION ? 400 : 500,
          code: `mock_${errorCategory}_error`,
          retryable: errorCategory === ERROR_CATEGORIES.RATE_LIMIT || 
                    errorCategory === ERROR_CATEGORIES.SERVER
        });
      }
      
      // Handle streaming or non-streaming response
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
      const messageId = generateId('msg');
      
      // Start the streaming simulation
      let accumulatedContent = '';
      let contentBlocks = [];
      
      // Message start event
      onProgress({ 
        type: 'start', 
        messageId,
        model: payload.model || config.defaultModel
      });
      
      // Calculate timing for each chunk
      const chunkLatency = totalLatency / (responseChunks.length + 2);
      
      // Block start event
      onProgress({
        type: 'block_end',
        contentBlocks: [{
          type: 'text',
          index: 0
        }]
      });
      
      // Stream each chunk with a delay
      for (const chunk of responseChunks) {
        await new Promise(resolve => setTimeout(resolve, chunkLatency));
        
        accumulatedContent += chunk;
        
        onProgress({
          type: 'content',
          content: accumulatedContent,
          delta: chunk,
          contentBlock: { type: 'text', index: 0 }
        });
      }
      
      // Assemble content blocks
      contentBlocks.push({
        type: 'text',
        text: accumulatedContent
      });
      
      // Message stop event
      await new Promise(resolve => setTimeout(resolve, chunkLatency));
      onProgress({ 
        type: 'stop', 
        messageId, 
        content: accumulatedContent,
        contentBlocks
      });
      
      // Return the completed response
      return {
        id: messageId,
        content: contentBlocks,
        role: 'assistant',
        type: 'message',
        model: payload.model || config.defaultModel,
        stop_reason: 'end_turn'
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
        retryable: false,
        details: {
          received: typeof messages,
          expected: 'array or object'
        }
      });
    }
    
    /**
     * Normalize a single message object
     * @param {Object} message Message to normalize
     * @returns {Object} Normalized message
     */
    function normalizeMessage(message) {
      // Skip if null or not an object
      if (!message || typeof message !== 'object') {
        throw new APIError('Invalid message format: messages must be objects', {
          category: ERROR_CATEGORIES.VALIDATION,
          retryable: false,
          details: {
            received: message === null ? 'null' : typeof message
          }
        });
      }
      
      // Already in Anthropic format
      if (message.role === 'user' || message.role === 'assistant') {
        // Return as-is if it's valid
        return message;
      }
      
      // Convert from Claude Chat legacy format
      if (message.role === 'human') {
        return { ...message, role: 'user' };
      }
      
      if (message.role === 'ai') {
        return { ...message, role: 'assistant' };
      }
      
      // Handle missing role
      if (!message.role && message.content) {
        // Default to user if role is missing
        return { ...message, role: 'user' };
      }
      
      // Handle invalid roles
      throw new APIError(`Invalid message role: ${message.role}`, {
        category: ERROR_CATEGORIES.VALIDATION,
        retryable: false,
        details: { 
          message,
          allowedRoles: ['user', 'assistant', 'human', 'ai']
        }
      });
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
          
        case ERROR_CATEGORIES.CONTENT_FILTER:
          error.helpText = `Your message was filtered due to Anthropic's content policies. Try rephrasing your request or using less sensitive language.`;
          error.helpLinks = ['https://docs.anthropic.com/claude/docs/content-policy'];
          break;
          
        case ERROR_CATEGORIES.CONTEXT_WINDOW:
          error.helpText = `Your conversation is too large for Claude's context window. Try starting a new conversation or removing some earlier messages.`;
          error.helpLinks = ['https://docs.anthropic.com/claude/docs/character-limits'];
          break;
          
        case ERROR_CATEGORIES.STREAMING:
          error.helpText = `There was an issue with the streaming connection. Check your network connection or try disabling streaming.`;
          break;
          
        case ERROR_CATEGORIES.TOOL_EXECUTION:
          error.helpText = `Error executing a tool function. Check your tool implementation for bugs or exceptions.`;
          break;
      }
    }
  
    // ===============================================================
    // File Handling Functions
    // ===============================================================
    
    /**
     * Process a file for API upload
     * @param {File} file File to process
     * @returns {Promise<Object>} Processed file object
     */
    async function processFile(file) {
      return new Promise((resolve, reject) => {
        try {
          // Check file size
          const maxSizeMB = 25; // Updated max file size for Claude 4
          const maxSizeBytes = maxSizeMB * 1024 * 1024;
          
          if (file.size > maxSizeBytes) {
            reject(new APIError(`File exceeds maximum size of ${maxSizeMB}MB`, {
              category: ERROR_CATEGORIES.VALIDATION,
              retryable: false,
              details: {
                fileSize: file.size,
                maxSize: maxSizeBytes,
                fileName: file.name
              }
            }));
            return;
          }
          
          // Process based on file type
          if (file.type.startsWith('image/')) {
            // Process image
            const reader = new FileReader();
            
            reader.onload = function() {
              const base64Data = reader.result.split(',')[1];
              
              // Get image dimensions first to include in metadata
              const img = new Image();
              img.onload = function() {
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
                    width: img.width,
                    height: img.height
                  }
                });
              };
              
              img.onerror = function() {
                // If we can't get dimensions, still resolve with basic info
                resolve({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: file.type,
                    data: base64Data
                  },
                  metadata: {
                    name: file.name,
                    size: file.size
                  }
                });
              };
              
              img.src = reader.result;
            };
            
            reader.onerror = function() {
              reject(new APIError('Failed to read image file', {
                category: ERROR_CATEGORIES.VALIDATION,
                retryable: false,
                details: {
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size
                }
              }));
            };
            
            reader.readAsDataURL(file);
          } else {
            // Process text-based file
            const reader = new FileReader();
            
            reader.onload = function() {
              resolve({
                type: 'file',
                source: {
                  type: 'base64',
                  media_type: file.type || 'application/octet-stream',
                  data: btoa(reader.result)
                },
                metadata: {
                  name: file.name,
                  size: file.size,
                  mime_type: file.type || determineFileType(file.name)
                }
              });
            };
            
            reader.onerror = function() {
              reject(new APIError('Failed to read file', {
                category: ERROR_CATEGORIES.VALIDATION,
                retryable: false,
                details: {
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  error: reader.error?.message
                }
              }));
            };
            
            reader.readAsBinaryString(file);
          }
        } catch (error) {
          reject(new APIError(`File processing error: ${error.message}`, {
            category: ERROR_CATEGORIES.VALIDATION,
            retryable: false,
            originalError: error,
            details: {
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size
            }
          }));
        }
      });
    }
    
    /**
     * Determine file MIME type from extension
     * @param {string} filename Filename with extension
     * @returns {string} MIME type
     */
    function determineFileType(filename) {
      const ext = filename.split('.').pop().toLowerCase();
      
      const mimeTypes = {
        'txt': 'text/plain',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'csv': 'text/csv',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'json': 'application/json',
        'xml': 'application/xml',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'text/javascript',
        'py': 'text/x-python',
        'java': 'text/x-java',
        'c': 'text/x-c',
        'cpp': 'text/x-c++',
        'md': 'text/markdown',
        'rtf': 'application/rtf',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'zip': 'application/zip',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        'rar': 'application/vnd.rar',
        'mp3': 'audio/mpeg',
        'mp4': 'video/mp4',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'webp': 'image/webp'
      };
      
      return mimeTypes[ext] || 'application/octet-stream';
    }
  
    // ===============================================================
    // Public API Methods
    // ===============================================================
    
    /**
     * Configures API settings
     * @param {Object} options Configuration options
     * @returns {Object} Config result
     */
    function configure(options) {
      // Deep merge configuration
      config = deepMerge(config, options);
      
      // Initialize logger now that config is set
      Logger.init();
      
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
     * @returns {Object} Reset result
     */
    function resetConfig() {
      config = structuredClone ? structuredClone(defaultConfig) : JSON.parse(JSON.stringify(defaultConfig));
      Logger.info('API configuration reset to defaults');
      return { success: true };
    }
    
    /**
     * Clear the response cache
     * @returns {Object} Clear result
     */
    function clearCache() {
      cache.clear();
      return { success: true, message: 'Cache cleared successfully' };
    }
    
    /**
     * Get detailed stats about the API client
     * @returns {Object} API stats
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
          mockMode: config.mocks.enabled,
          apiVersion: config.apiVersion,
          thinkingMode: config.thinking.defaultMode
        },
        timestamp: new Date().toISOString()
      };
    }
    
    /**
     * Enable or disable mock mode
     * @param {boolean} enabled Whether to enable mock mode
     * @param {Object} options Additional mock configuration
     * @returns {Object} Mock mode result
     */
    function setMockMode(enabled, options = {}) {
      config.mocks.enabled = enabled;
      
      if (options) {
        Object.assign(config.mocks, options);
      }
      
      Logger.info(`Mock mode ${enabled ? 'enabled' : 'disabled'}`, config.mocks);
      
      // Notify listeners of mode change
      try {
        window.dispatchEvent(new CustomEvent('api:modeChanged', { 
          detail: { mockMode: enabled } 
        }));
      } catch (e) {
        // Ignore event dispatch errors
      }
      
      return { success: true, mockMode: enabled };
    }
    
    /**
     * Set API key for authentication
     * @param {string} apiKey The API key to use
     * @returns {Object} API key result
     */
    function setApiKey(apiKey) {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
        throw new APIError('Invalid API key format', {
          category: ERROR_CATEGORIES.VALIDATION,
          retryable: false,
          details: {
            reason: !apiKey ? 'API key is empty' : 
                   typeof apiKey !== 'string' ? 'API key must be a string' :
                   'API key is too short'
          }
        });
      }
      
      // Store the API key
      config.apiKey = apiKey.trim();
      
      return { success: true, message: 'API key updated' };
    }
    
    /**
     * Get available Claude models
     * @param {Object} options Request options
     * @returns {Promise<Object>} Available models
     */
    async function getModels(options = {}) {
      // For mock mode, return static model list
      if (config.mocks.enabled) {
        return {
          models: [
            { 
              id: MODELS.CLAUDE_4_OPUS,
              name: "Claude 4 Opus",
              description: "Most powerful Claude model with advanced reasoning",
              context_window: 250000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_4, 
              name: "Claude 4",
              description: "Next-generation Claude model with broad capabilities",
              context_window: 200000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_4_SONNET, 
              name: "Claude 4 Sonnet",
              description: "Balanced Claude 4 model with strong performance",
              context_window: 200000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_4_HAIKU, 
              name: "Claude 4 Haiku",
              description: "Fast, efficient Claude 4 variant",
              context_window: 180000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_3_7_OPUS, 
              name: "Claude 3.7 Opus",
              description: "Enhanced reasoning with broad capabilities",
              context_window: 200000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_3_7_SONNET, 
              name: "Claude 3.7 Sonnet",
              description: "Balanced performance and efficiency",
              context_window: 180000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_3_5_SONNET, 
              name: "Claude 3.5 Sonnet",
              description: "Improved Claude 3.5 model with better capabilities",
              context_window: 180000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_3_OPUS, 
              name: "Claude 3 Opus",
              description: "Most powerful Claude 3 model for complex tasks",
              context_window: 200000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_3_SONNET, 
              name: "Claude 3 Sonnet",
              description: "Balance of intelligence and speed",
              context_window: 180000,
              max_tokens: 4096
            },
            { 
              id: MODELS.CLAUDE_3_HAIKU, 
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
          errorCategory: error.category,
          status: error.status
        };
      }
    }
    
    /**
     * Cancel all ongoing API requests
     * @returns {Object} Cancel result
     */
    function cancelRequests() {
      requestQueue.clear('User cancelled requests');
      
      Logger.info('All API requests cancelled');
      return { success: true };
    }
    
    /**
     * Cancel a specific request by ID
     * @param {string} requestId Request ID
     * @returns {Object} Cancel result
     */
    function cancelRequest(requestId) {
      if (!requestId) {
        throw new APIError('Request ID is required', {
          category: ERROR_CATEGORIES.VALIDATION,
          retryable: false
        });
      }
      
      const aborted = requestQueue.abortRequest(requestId);
      
      if (aborted) {
        Logger.info(`Cancelled request ${requestId}`);
        return { success: true };
      } else {
        Logger.warn(`Request ${requestId} not found or already completed`);
        return { success: false, error: 'Request not found' };
      }
    }
    
    /**
     * Deep merge utility for objects
     * @param {Object} target Target object
     * @param {Object} source Source object
     * @returns {Object} Merged object
     */
    function deepMerge(target, source) {
      // If we have structuredClone, create a fresh copy of target
      const output = structuredClone ? structuredClone(target) : Object.assign({}, target);
      
      // If source is null or not an object, return target
      if (!source || typeof source !== 'object') {
        return output;
      }
      
      // Go through each key in the source
      Object.keys(source).forEach(key => {
        // Skip undefined values
        if (source[key] === undefined) return;
        
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
  
    // ===============================================================
    // Event Handling
    // ===============================================================
    
    // Set up network event listeners
    window.addEventListener('online', () => {
      Logger.info('Network connection restored');
      
      // Notify listeners
      try {
        window.dispatchEvent(new CustomEvent('api:connectivity', { 
          detail: { online: true } 
        }));
      } catch (e) {
        // Ignore event dispatch errors
      }
      
      // If offline queue processing is enabled, start processing
      if (config.offline.syncOnReconnect) {
        offlineQueue.processQueue();
      }
    });
    
    window.addEventListener('offline', () => {
      Logger.warn('Network connection lost');
      
      // Notify listeners
      try {
        window.dispatchEvent(new CustomEvent('api:connectivity', { 
          detail: { online: false } 
        }));
      } catch (e) {
        // Ignore event dispatch errors
      }
    });
    
    // ===============================================================
    // Cleanup and Teardown
    // ===============================================================
    
    /**
     * Clean up resources and event listeners
     */
    function destroy() {
      // Clear intervals and timeouts
      cache.destroy();
      
      // Clear queues
      requestQueue.destroy();
      offlineQueue.destroy();
      
      // Remove event listeners
      // (These are added to window, so they should be removed explicitly)
      try {
        window.removeEventListener('online', () => {});
        window.removeEventListener('offline', () => {});
      } catch (e) {
        // Ignore errors during cleanup
      }
      
      Logger.info('API client destroyed');
    }
    
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
      cancelRequest,
      
      // Cache management
      clearCache,
      
      // Mock mode
      setMockMode,
      
      // Cleanup
      destroy,
      
      // Constants
      ERROR_CATEGORIES,
      MODELS,
      THINKING_MODES,
      CONTENT_FORMATS,
      
      // Version info
      VERSION: '3.2.1'
    };
    
    // Initialize with environment detection
    const env = detectEnvironment();
    Logger.init(); // Initialize logger now that config is set
    Logger.info('Claude API initialized', { 
      environment: env,
      version: '3.2.1', 
      timestamp: new Date().toISOString()
    });
    
    // Return the public API
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