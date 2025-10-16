# Infrastructure Notes

- Production VPS: 31.97.58.72
- Domain: leo.lb-tech.co.uk (A record points to the VPS)

## Convex recommendation
- Use a separate production Convex deployment for isolation from dev.
- Steps:
  1) Create/identify prod deployment in Convex dashboard
  2) Set env vars in prod: CONNECTION_ENCRYPTION_KEY, CONVEX_ADMIN_TOKEN, CLERK_WEBHOOK_SECRET, OPENAI_API_KEY, (optional) QDRANT_URL/QDRANT_API_KEY
  3) Set NEXT_PUBLIC_CONVEX_URL to the prod deployment URL (cloud base): https://valiant-rook-385.convex.cloud
     - HTTP actions/webhooks base: https://valiant-rook-385.convex.site
  4) In the VPS, put the same values into /etc/leo.env and restart the app

## Server provisioning (summary)
- deploy/provision.sh: installs Node (nvm), pnpm, clones repo, installs deps, builds
- deploy/nginx.conf: reverse proxy to :8080
- deploy/systemd-service-example.service: sample service for Next.js server
- deploy/ssl.sh: one-liner to enable TLS with Certbot (nginx)

## App env (server)
- NEXT_PUBLIC_BASE_URL=https://leo.lb-tech.co.uk
- NEXT_PUBLIC_CONVEX_URL=<prod convex url>
- CONNECTION_ENCRYPTION_KEY=<base64 32 bytes>
- CONVEX_ADMIN_TOKEN=<random token>
- OPENAI_API_KEY=sk-...
- (optional) QDRANT_URL, QDRANT_API_KEY
