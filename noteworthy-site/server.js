const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Set the body parser limit (100MB)
const bodyParserConfig = {
  limit: '100mb',
};

app.prepare().then(() => {
  createServer((req, res) => {
    // Parse the URL
    const parsedUrl = parse(req.url, true);
    
    // Set custom headers for larger file uploads
    if (req.method === 'POST' && req.url.startsWith('/api/')) {
      // For API routes, especially file uploads
      res.setHeader('x-nextjs-custom-limit', 'enabled');
    }
    
    // Let Next.js handle the request
    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 3000, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${process.env.PORT || 3000}`);
  });
});
