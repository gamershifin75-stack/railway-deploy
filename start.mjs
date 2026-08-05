// start.mjs - enhanced startup wrapper for Railway / containers
// - sets MINDSERVER_PORT from PLATFORM PORT
// - logs env and errors so you can see why startup might fail
// - if importing main.js throws, runs a tiny fallback HTTP server so the container stays up and you can inspect /health and the error via logs or browser.

process.env.MINDSERVER_PORT = process.env.PORT || process.env.MINDSERVER_PORT || '8080';

// Helpful logs for Railway
console.log('=== start.mjs invoked ===');
console.log('NODE_VERSION=', process.version);
console.log('PORT (Railway provided) =', process.env.PORT);
console.log('MINDSERVER_PORT=', process.env.MINDSERVER_PORT);
console.log('SKIP_CREATE_AGENTS=', process.env.SKIP_CREATE_AGENTS);
console.log('HOST_PUBLIC=', process.env.HOST_PUBLIC);
console.log('SETTINGS_JSON=', !!process.env.SETTINGS_JSON ? '[present]' : '[not present]');
console.log('ENV keys:', Object.keys(process.env).filter(k => /API|KEY|PORT|HOST|RAILWAY|SETTINGS|SKIP/i.test(k)).sort());

// Catch unhandled failures and ensure logs show them
process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err && (err.stack || err.message || err));
});

// small helper to listen with fallback ports if needed
async function listenWithFallback(server, startPort, host='0.0.0.0', maxAttempts=5) {
    let port = Number(startPort) || 8080;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await new Promise((resolve, reject) => {
                const onError = (err) => { reject(err); };
                const onListening = () => { resolve(); };
                server.once('error', onError);
                server.once('listening', onListening);
                server.listen(port, host);
            });
            console.log(`Fallback server listening on port ${port} (${host}).`);
            return port;
        } catch (err) {
            // Clean up listeners and try next port if address in use
            server.removeAllListeners('error');
            server.removeAllListeners('listening');
            if (err && err.code === 'EADDRINUSE') {
                console.warn(`Port ${port} in use; trying ${port + 1}...`);
                port = port + 1;
                continue;
            }
            console.error('Error while attempting to bind fallback server:', err && (err.stack || err));
            throw err;
        }
    }
    throw new Error('Failed to bind fallback server after multiple attempts');
}

// Try to import and run main.js
(async () => {
    try {
        console.log('Importing main.js ...');
        await import('./main.js');
        console.log('main.js imported successfully. Mindcraft should be running (check logs for "MindServer running").');
        // Keep process alive; main.js creates servers and child processes itself.
    } catch (err) {
        console.error('Error while importing main.js:', err && (err.stack || err.message || err));
        console.error('Starting fallback HTTP server so container stays up for inspection.');

        // Minimal fallback server so the container stays up and you can GET /health and /error
        const http = await import('http');
        const fallbackPort = parseInt(process.env.MINDSERVER_PORT || '8080', 10) || 8080;

        let lastError = String(err && (err.stack || err.message || err));

        const server = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('fallback-ok');
                return;
            }
            if (req.url === '/error') {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(lastError);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<h1>Mindcraft fallback</h1><p>main.js failed to start. See /error for details.</p><pre>${escapeHtml(lastError)}</pre>`);
        });

        try {
            await listenWithFallback(server, fallbackPort, '0.0.0.0', 10);
            console.log('Open /health for quick check and /error to see the import error.');
        } catch (listenErr) {
            console.error('Failed to start fallback server:', listenErr && (listenErr.stack || listenErr));
        }

        function escapeHtml(s) {
            return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }
    }
})();
