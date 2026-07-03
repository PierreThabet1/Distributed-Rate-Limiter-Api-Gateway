require('dotenv').config();
const express = require('express');
const redis = require('redis');
const fs = require('fs');
const path = require('path');

const app = express();
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = Number(process.env.REDIS_PORT);
const client = redis.createClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
    }
});

client.on('error', (err) => {
    console.error('Redis error:', err);
});

async function connectRedis() {
    const maxAttempts = 10;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await client.connect();
            console.log(`Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
            return;
        } catch (err) {
            console.error(`Redis connection attempt ${attempt}/${maxAttempts} failed: `, err);
            if (attempt === maxAttempts) {
                console.error('Max Redis connection attempts reached. Exiting...');
                process.exit(1);
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
        }
    }
}


const rateLimitScript = fs.readFileSync(path.join(__dirname, 'rate_limiter.lua'), 'utf8');

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT);
const TIME_WINDOW = parseInt(process.env.TIME_WINDOW);

// Middleware to check rate limit
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
            res.status(429).send('Too Many Requests. Please try again later.');
        }
    } catch (err) {
        console.error('Error checking rate limit:', err);
        res.status(500).send('Internal Server Error');
    }
}

app.use(rateLimiter);

app.get('/', (req, res) => {
    res.status(200).send('Welcome to the Rate Limited API!');
});

const PORT = process.env.PORT;
async function startServer() {
    await connectRedis();
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startServer();