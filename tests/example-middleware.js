// Example custom middleware file
// This would be placed in your project directory and referenced in config

export default async function authMiddleware(req, res, next) {
  // Example: Check for API key in headers
  const apiKey = req.headers['x-api-key'];
  
  // Skip auth for public routes
  if (req.url.startsWith('/public/')) {
    return await next();
  }
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  
  // Add user info to request for downstream use
  req.user = { authenticated: true, apiKey };
  
  await next();
}
