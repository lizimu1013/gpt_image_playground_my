# Sub2API Playground Integration And Evolution Plan

## Goal

Build GPT Image Playground in two forms:

- Embedded mode inside Sub2API, where a user clicks the image generation menu and Sub2API injects the selected API key.
- Standalone product mode, where Playground can later become a polished public product with its own landing page, history, templates, and eventually user management.

The near-term priority is to avoid impacting the live Sub2API service while validating the deployment path.

## Current Live Boundary

Production `api.muchu.cloud` currently routes all traffic through Nginx to the live Sub2API service:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
}
```

Sub2API's existing launcher route is `/playground`. The launcher iframe points to `/playground/`.

This creates a useful minimum-change deployment split:

- `/playground` stays handled by Sub2API as the embedded launcher.
- `/playground/` is handled by the standalone Playground app.

If `/playground/` is not routed to the standalone app, it falls back to Sub2API and creates a recursive iframe loop.

## Phase 1: Minimum Production-Safe Integration

Keep both repositories mostly unchanged. Deploy Playground as a separate service on the same server, only bound to localhost.

Example service shape:

```bash
docker run -d --name gpt-image-playground \
  -p 127.0.0.1:4180:80 \
  -e DEFAULT_API_URL=https://api.muchu.cloud/v1 \
  -e ENABLE_API_PROXY=false \
  gpt-image-playground:latest
```

Then add a more specific Nginx route before the existing `location /`:

```nginx
location ^~ /playground/ {
    proxy_pass http://127.0.0.1:4180/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}
```

Expected behavior:

- `https://api.muchu.cloud/playground` opens the Sub2API launcher.
- The launcher selects a Sub2API user API key and creates an iframe URL.
- The iframe loads `https://api.muchu.cloud/playground/?ui_mode=embedded&apiUrl=...&apiKey=...`.
- Nginx sends `/playground/` traffic to Playground.
- Playground uses the injected `apiUrl` and `apiKey` for image generation.

## Phase 1 Remote Validation Without Affecting Live Traffic

Before touching the live `api.muchu.cloud` server block:

1. Start Playground on localhost only:

```bash
docker run -d --name gpt-image-playground-canary \
  -p 127.0.0.1:4180:80 \
  -e DEFAULT_API_URL=https://api.muchu.cloud/v1 \
  -e ENABLE_API_PROXY=false \
  gpt-image-playground:latest
```

2. Verify from the server:

```bash
curl -i http://127.0.0.1:4180/
```

Expected: `200 OK`.

3. Add a temporary localhost-only Nginx test server:

```nginx
server {
    listen 127.0.0.1:18081;

    location ^~ /playground/ {
        proxy_pass http://127.0.0.1:4180/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

4. Open an SSH tunnel from a local machine:

```bash
ssh -L 18081:127.0.0.1:18081 root@43.166.2.176
```

5. Open locally:

```text
http://127.0.0.1:18081/playground
```

Pass criteria:

- No recursive iframe loop.
- The iframe loads Playground UI.
- The generated iframe URL contains `ui_mode=embedded`.
- The selected Sub2API API key is present in the embedded Playground configuration.
- API requests go to `https://api.muchu.cloud/v1` with the Sub2API user key.

Only after this passes should the production `api.muchu.cloud` Nginx block be updated.

## Phase 2: Standalone Landing Page

Add a landing page to Playground for non-embedded users.

Mode detection:

```ts
const isEmbedded = new URLSearchParams(window.location.search).get('ui_mode') === 'embedded'
```

Routing behavior:

- Embedded mode: show the generation workspace directly.
- Non-embedded mode: show a polished landing page first.

Suggested entry behavior:

- `https://api.muchu.cloud/playground/` shows the landing page.
- `https://api.muchu.cloud/playground/?ui_mode=embedded&...` skips the landing page and opens the workspace.
- A landing page CTA can switch to the workspace, for example with `?mode=app`.

The landing page can include:

- Product headline and examples.
- Quick start button.
- API key configuration entry.
- Model and feature highlights.
- Links to docs or Sub2API pricing.

## Phase 3: Dedicated Playground Domain

Move standalone product traffic to a clearer domain:

- `api.muchu.cloud`: Sub2API and API gateway.
- `image.muchu.cloud`: public Playground product.

Sub2API can still embed the app:

```text
https://image.muchu.cloud/?ui_mode=embedded&apiUrl=https://api.muchu.cloud/v1&apiKey=...
```

Required Sub2API/Nginx adjustments:

- Allow `frame-src https://image.muchu.cloud` in CSP if CSP is enforced.
- Allow CORS from `https://image.muchu.cloud` to `https://api.muchu.cloud/v1` if direct browser calls are used.

## Phase 4: Standalone User System

If Playground becomes a real public product with accounts, history, and saved assets, split ownership clearly:

- Sub2API remains the API gateway, quota, billing, channel, group, and API key system.
- Playground owns product UX, image history, templates, saved prompts, albums, and user-facing creative workflows.

Recommended architecture:

- Playground frontend: `image.muchu.cloud`
- Playground backend: manages login, sessions, image history, and template data.
- Sub2API: source of truth for API access, quota, and billing.

Do not duplicate Sub2API's gateway and billing logic inside Playground.

Possible account models:

1. Bring-your-own-key:
   - User logs into Playground or uses it anonymously.
   - User manually enters a Sub2API-compatible API key.
   - Fastest to ship, weakest product experience.

2. Bound Sub2API account:
   - User logs into Playground.
   - Playground backend binds or creates a Sub2API API key for that user.
   - Browser does not need to see long-lived keys.

3. Short-lived embed/session token:
   - Sub2API or Playground backend issues a short-lived token.
   - Playground exchanges it server-side for an API call.
   - Better security for embedded and standalone authenticated flows.

## Key Security Notes

The current minimum integration can pass `apiKey` in the iframe URL because it is simple and already matches the existing launcher behavior. For production hardening, avoid long-lived keys in URLs.

Preferred later options:

- Parent-to-iframe `postMessage` for embedded configuration.
- Short-lived embed tokens.
- Playground backend proxy that keeps long-lived keys server-side.

## Recommended Roadmap

1. Keep repositories separated.
2. Deploy Playground locally on the server at `127.0.0.1:4180`.
3. Validate with a localhost-only Nginx canary on `127.0.0.1:18081`.
4. Add production `/playground/` route after canary validation.
5. Add non-embedded landing page to Playground.
6. Move public standalone product to `image.muchu.cloud`.
7. Add Playground backend and user system only after the standalone product direction is proven.

