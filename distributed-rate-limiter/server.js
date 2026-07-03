require('dotenv').config();
const express = require('express');
const redis = require('redis');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = Number(process.env.REDIS_PORT);

const app = express();

const client = redis.createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
    }
});

async function connectRedis() {
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await client.connect();
            console.log(`Connected to Redis after ${REDIS_HOST}:${REDIS_PORT}`);
            return;
        } catch (err) {
            console.error(`Redis connection attempt ${attempt}/${maxAttempts} failed:`, err.message);
            if (attempt === maxAttempts) {
                console.error('could not connect to Redis. Exiting.');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

const rateLimitScript = fs.readFileSync(path.join(__dirname, 'rate_limiter.lua'), 'utf8');

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT);
const TIME_WINDOW = parseInt(process.env.TIME_WINDOW);

// Middleware for rate limiting
async function rateLimiter(req, res, next) {
    const ip = req.ip;
    try {
        const allowed = await client.eval(rateLimitScript, {
            keys: [ip],
            arguments: [String(RATE_LIMIT), String(TIME_WINDOW)]
        });
        if (allowed === 1) {
            next();
        } else {
            res.status(429).send('Too Many Requests');
        }
    } catch (err) {
        console.error('Error occurred while evaluating rate limit script:', err);
        res.status(500).send('Internal Server Error');
    }
}

app.use(rateLimiter);

app.get('/', (req, res) => {
    res.status(200).send(`Welcome to the rate-limited API! from ${os.hostname()}`);
});


async function startServer() {
    const PORT = Number(process.env.PORT);
    await connectRedis();
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startServer();