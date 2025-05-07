const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Log API key presence (not the actual key)
if (process.env.GEMINI_API_KEY) {
    console.log("✅ GEMINI_API_KEY is set in environment");
} else {
    console.error("❌ GEMINI_API_KEY is not set in environment");
}

// Add debug message
console.log("🚀 Starting server and loading WebSocket implementation");

// Try-catch to ensure we capture any errors during the import
let initWebSocketServer;
try {
    const websocketModule = require("./src/lib/websocket.js");
    initWebSocketServer = websocketModule.initWebSocketServer;
    console.log("✅ WebSocket module loaded successfully");
} catch (error) {
    console.error("❌ Error loading WebSocket module:", error);
    process.exit(1);
}

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Set the body parser limit (100MB)
const bodyParserConfig = {
    limit: "100mb",
};

app.prepare().then(() => {
    const server = createServer((req, res) => {
        // Parse the URL
        const parsedUrl = parse(req.url, true);

        // Set custom headers for larger file uploads
        if (req.method === "POST" && req.url.startsWith("/api/")) {
            // For API routes, especially file uploads
            res.setHeader("x-nextjs-custom-limit", "enabled");
        }

        // Let Next.js handle the request
        handle(req, res, parsedUrl);
    });

    // Initialize WebSocket server with more error handling
    try {
        const io = initWebSocketServer(server);
        console.log("✅ WebSocket server initialized successfully");
    } catch (error) {
        console.error("❌ Error initializing WebSocket server:", error);
    }

    server.listen(process.env.PORT || 3000, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://localhost:${process.env.PORT || 3000}`);
    });
});