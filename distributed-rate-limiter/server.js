require('dotenv').config();
const express = require('express');
const redis = require('redis');
const fs = require('fs');
const path = require('path');

const app = express();
const client = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
});

client.on('error', (err) => {
    console.error('Redis error:', err);
});

async function connectRedis() {
    try {
        await client.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Error connecting to Redis:', err);
        process.exit(1);
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
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await connectRedis();
});