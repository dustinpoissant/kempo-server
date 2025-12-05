export default {
  allowedMimes: {
    html: { mime: "text/html", encoding: "utf8" },
    htm: { mime: "text/html", encoding: "utf8" },
    shtml: { mime: "text/html", encoding: "utf8" },
    css: { mime: "text/css", encoding: "utf8" },
    xml: { mime: "text/xml", encoding: "utf8" },
    gif: { mime: "image/gif", encoding: "binary" },
    jpeg: { mime: "image/jpeg", encoding: "binary" },
    jpg: { mime: "image/jpeg", encoding: "binary" },
    js: { mime: "application/javascript", encoding: "utf8" },
    mjs: { mime: "application/javascript", encoding: "utf8" },
    json: { mime: "application/json", encoding: "utf8" },
    webp: { mime: "image/webp", encoding: "binary" },
    png: { mime: "image/png", encoding: "binary" },
    svg: { mime: "image/svg+xml", encoding: "utf8" },
    svgz: { mime: "image/svg+xml", encoding: "utf8" },
    ico: { mime: "image/x-icon", encoding: "binary" },
    webm: { mime: "video/webm", encoding: "binary" },
    mp4: { mime: "video/mp4", encoding: "binary" },
    m4v: { mime: "video/mp4", encoding: "binary" },
    ogv: { mime: "video/ogg", encoding: "binary" },
    mp3: { mime: "audio/mpeg", encoding: "binary" },
    ogg: { mime: "audio/ogg", encoding: "binary" },
    wav: { mime: "audio/wav", encoding: "binary" },
    woff: { mime: "font/woff", encoding: "binary" },
    woff2: { mime: "font/woff2", encoding: "binary" },
    ttf: { mime: "font/ttf", encoding: "binary" },
    otf: { mime: "font/otf", encoding: "binary" },
    eot: { mime: "application/vnd.ms-fontobject", encoding: "binary" },
    pdf: { mime: "application/pdf", encoding: "binary" },
    txt: { mime: "text/plain", encoding: "utf8" },
    webmanifest: { mime: "application/manifest+json", encoding: "utf8" },
    md: { mime: "text/markdown", encoding: "utf8" },
    csv: { mime: "text/csv", encoding: "utf8" },
    doc: { mime: "application/msword", encoding: "binary" },
    docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", encoding: "binary" },
    xls: { mime: "application/vnd.ms-excel", encoding: "binary" },
    xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", encoding: "binary" },
    ppt: { mime: "application/vnd.ms-powerpoint", encoding: "binary" },
    pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", encoding: "binary" },
    avif: { mime: "image/avif", encoding: "binary" },
    wasm: { mime: "application/wasm", encoding: "binary" }
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