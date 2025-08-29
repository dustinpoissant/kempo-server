export default {
  allowedMimes: {
    html: "text/html",
    htm: "text/html",
    shtml: "text/html",
    css: "text/css",
    xml: "text/xml",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "application/javascript",
    mjs: "application/javascript",
    json: "application/json",
    webp: "image/webp",
    png: "image/png",
    svg: "image/svg+xml",
    svgz: "image/svg+xml",
    ico: "image/x-icon",
    webm: "video/webm",
    mp4: "video/mp4",
    m4v: "video/mp4",
    ogv: "video/ogg",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    pdf: "application/pdf",
    txt: "text/plain",
    webmanifest: "application/manifest+json",
    md: "text/markdown",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    avif: "image/avif",
    wasm: "application/wasm"
  },
  disallowedRegex: [
    "^/\\..*",
    "\\.config$",
    "\\.env$",
    "\\.git/",
    "\\.htaccess$",
    "\\.htpasswd$",
    "^/node_modules/",
    "^/vendor/",
    "\\.log$",
    "\\.bak$",
    "\\.sql$",
    "\\.ini$",
    "password",
    "config\\.php$",
    "wp-config\\.php$",
    "\\.DS_Store$"
  ],
  routeFiles: [
    'GET.js',
    'POST.js',
    'PUT.js',
    'DELETE.js',
    'HEAD.js',
    'OPTIONS.js',
    'PATCH.js',
    'CONNECT.js',
    'TRACE.js',
    'index.js'
  ],
  noRescanPaths: [
    "^\\.well-known/",
    "/favicon\\.ico$",
    "/robots\\.txt$",
    "/sitemap\\.xml$",
    "/apple-touch-icon",
    "/android-chrome-",
    "/browserconfig\\.xml$",
    "/manifest\\.json$",
    "\\.map$",
    "/__webpack_hmr$",
    "/hot-update\\.",
    "/sockjs-node/",
  ],
  maxRescanAttempts: 3,
  customRoutes: {
    // Example: "/vendor/bootstrap.css": "../node_modules/bootstrap/dist/css/bootstrap.min.css"
    // Wildcard example: "kempo/*": "../node_modules/kempo/dust/*"
  },
  middleware: {
    // Built-in middleware configuration
    cors: {
      enabled: false,
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      headers: ["Content-Type", "Authorization"]
    },
    compression: {
      enabled: false,
      threshold: 1024 // Only compress files larger than 1KB
    },
    rateLimit: {
      enabled: false,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      message: "Too many requests"
    },
    security: {
      enabled: true,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block"
      }
    },
    logging: {
      enabled: true,
      includeUserAgent: false,
      includeResponseTime: true
    },
    // Custom middleware files
    custom: [
      // Example: "./middleware/auth.js"
    ]
  },
  cache: {
    enabled: false,                  // Disabled by default - opt-in for performance  
    maxSize: 100,                    // Maximum number of cached modules
    maxMemoryMB: 50,                 // Memory limit for cache in MB
    ttlMs: 300000,                   // Cache TTL (5 minutes default)
    maxHeapUsagePercent: 70,         // Clear cache if heap usage exceeds this
    memoryCheckInterval: 30000,      // Memory check interval (30 seconds)
    watchFiles: true,                // Auto-invalidate on file changes
    enableMemoryMonitoring: true     // Enable automatic memory monitoring
  }
}