# Distributed Rate Limiter API Gateway

## Overview

This project demonstrates a distributed API gateway with server-side rate limiting enforced through Redis and Lua scripting. It is designed to protect backend API traffic from excessive request bursts, enforce fair usage policies, and provide a reliable gateway layer for containerized services.

## What it does

- Routes incoming HTTP traffic through Nginx to a Node.js API service.
- Applies per-client rate limiting using Redis as a centralized counter store.
- Uses a Lua script executed by Redis to atomically track request usage and expiration windows.
- Returns `429 Too Many Requests` when a client exceeds the configured rate limit.

## Why it exists

This project solves common API gateway problems:

- Preventing request floods from a single client IP.
- Sharing rate limit state across multiple service instances.
- Providing deterministic, atomic enforcement of rate policies.
- Demonstrating how to combine Docker, Nginx, Node.js, and Redis for a simple distributed gateway.

## How it works

1. Nginx listens on port `3000` and forwards requests to the backend Node.js application.
2. Nginx acts as a load balancer and proxy, routing traffic through the configured upstream block.
3. The Node.js app connects to Redis and loads a Lua rate limiting script.
4. For each request, the middleware uses the client IP as the Redis key.
5. The Lua script checks the current request count and either increments it or rejects the request.
6. Redis stores the counter with an expiration time window, resetting usage after the configured interval.

## Architecture

- `lb` service: `nginx:stable-alpine` as the reverse proxy and load balancer.
- `app` service: Node.js Express application that performs request handling and rate limit checks.
- `redis` service: Redis cache used for shared state and atomic rate limit enforcement.

## Load balancing

The Nginx gateway provides a central entry point and forwards traffic to backend application instances. In this setup, `nginx.conf` defines an `upstream backend` block that can be expanded to include multiple `app` replicas. This pattern:

- distributes requests across backend instances,
- keeps the rate limit state centralized in Redis,
- enables horizontal scaling without changing the rate limiting logic.

In Docker Compose, the `lb` service depends on `app` and routes client traffic to the service name `app`, which can resolve to one or more containers when scaled.

## Technologies used

- Node.js
- Express
- Redis
- Lua scripting
- Nginx
- Docker
- Docker Compose
- dotenv

## Getting started

### Prerequisites

- Docker
- Docker Compose

### Setup

1. Change into the project folder:

```bash
cd distributed-rate-limiter
```

2. Create a `.env` file with the following values:

```bash
cat > .env <<EOF
PORT=3000
REDIS_HOST=redis
REDIS_PORT=6379
RATE_LIMIT=5
TIME_WINDOW=60
EOF
```

3. Start the full stack:

```bash
docker compose up --build
```

## Testing the gateway

Open a separate terminal and run:

```bash
curl -i http://localhost:3000/
```

Send repeated requests to observe rate limiting:

```bash
for i in {1..8}; do curl -i http://localhost:3000/; echo; done
```

After the configured limit is reached, the gateway returns:

```text
HTTP/1.1 429 Too Many Requests
```

## Notes

- The Lua script in `distributed-rate-limiter/rate_limiter.lua` ensures each request count update is atomic.
- The rate limiting window is controlled by `RATE_LIMIT` and `TIME_WINDOW`.
- Nginx provides request routing while the Express app enforces the policy.

## Project structure

- `distributed-rate-limiter/Dockerfile` - builds the Node.js application image.
- `distributed-rate-limiter/docker-compose.yml` - composes Redis, the app, and Nginx.
- `distributed-rate-limiter/nginx.conf` - defines Nginx proxy routing.
- `distributed-rate-limiter/server.js` - Express application and Redis rate limiting middleware.
- `distributed-rate-limiter/rate_limiter.lua` - Redis Lua script implementing the rate limiter.
