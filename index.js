const zlib = require("zlib");

const cache = {}; // Global cache object

// Cache expiration time in milliseconds (one hour)
const CACHE_EXPIRATION_TIME_MS = 60 * 60 * 1000;

function cacheMiddleware(req, res, next) {
    
    function clearExpiredCache() {
        for (let key in cache) {
            if (cache.hasOwnProperty(key) && cache[key].expiration <= Date.now()) {
                delete cache[key];
            }
        }
    }

    // Clear expired cache entries before processing the request
    clearExpiredCache();

    // Check if the requested URL is cached and not expired
    if (cache[req.originalUrl] && cache[req.originalUrl].expiration > Date.now()) {
        const cachedData = cache[req.originalUrl].data;
     
        cache[req.originalUrl].usageCount = (cache[req.originalUrl].usageCount || 0) + 1;
 
        res.set({
            'Content-Type': 'application/json',
            'Content-Length': cachedData.length,
            'Content-Encoding': 'gzip',
            'Cache-Control': `max-age=${Math.floor(CACHE_EXPIRATION_TIME_MS / 1000)}`
        });
        // Send cached data in response
        res.status(200).send(cachedData);
       
    } else {
        // Store original res.send for later use
        const originalSend = res.send;
        // Override res.send to compress and cache the response
        res.send = function (body) {
            if (Buffer.isBuffer(body)) {
                // If body is already a buffer, gzip it
                zlib.gzip(body, { level: 9 }, (err, buffer) => {
                    if (err) {
                        res.status(500).json({ error: 'Compression error' });
                    } else {
                        const expirationTime = Date.now() + CACHE_EXPIRATION_TIME_MS;
                        cache[req.originalUrl] = {
                            data: buffer,
                            expiration: expirationTime,
                            usageCount: 0
                        };

                        res.set({
                            'Content-Type': 'application/json',
                            'Content-Length': buffer.length,
                            'Content-Encoding': 'gzip',
                            'Cache-Control': `max-age=${Math.floor(CACHE_EXPIRATION_TIME_MS / 1000)}`
                        });

                        // Send cached data in response
                        originalSend.call(this, buffer);
              
                    }
                });
            } 
            else if ((typeof body ==='object' || typeof body ==='string') && !Buffer.isBuffer(body) ) { 

                zlib.gzip(body, { level: 9 }, (err, buffer) => {
                    if (err) {
                        res.status(500).json({ error: 'Compression error' });
                    } else {
                        const expirationTime = Date.now() + CACHE_EXPIRATION_TIME_MS;
                        cache[req.originalUrl] = {
                            data: buffer,
                            expiration: expirationTime,
                            usageCount: 0
                        };

                        res.set({
                            'Content-Type': 'application/json',
                            'Content-Length': buffer.length,
                            'Content-Encoding': 'gzip',
                            'Cache-Control': `max-age=${Math.floor(CACHE_EXPIRATION_TIME_MS / 1000)}`
                        });

                        // Send cached data in response
                        originalSend.call(this, buffer);
                    
                    }
                });
            } 
            else {
                // Call original send method for non-buffer responses
                originalSend.apply(res, arguments);
            }
        };
        // Continue to the next middleware or route handler
        next();
    }
}

module.exports = cacheMiddleware;