# Deploy InstinctGo on Vercel

Deploy this repository as **one Vercel project**, with the project Root Directory set to
the repository root (`.`). The root `vercel.json` defines two independently built services:

| Service | Root | Public routing | Calls |
| --- | --- | --- | --- |
| `frontend` | `frontend` | All paths, including the `/api/v1/*` gateway | `backend`, via the `BACKEND_URL` binding |
| `backend` | `backend` | Internal; no direct public rewrite | OpenAI when configured; managed Postgres for saved workflows |

The browser requests `/api/v1/...` on the same origin as the site. A Next.js **Node.js route
handler** forwards the request to `BACKEND_URL`, preserving `/api/v1/...`, query strings,
JSON bodies and API status codes. The binding is read per request, not during builds or in
middleware. Vercel generates it separately for production, previews and `vercel dev`.
Do **not** set `BACKEND_URL` yourself or put it in a `NEXT_PUBLIC_*` variable.

The backend's lack of a direct rewrite does not make the frontend's API gateway private:
visitors can call `/api/v1/*` through the frontend. No application authentication is added
by a service binding.

## Deploy from GitHub

1. Push this configuration to GitHub and import the repository into Vercel.
2. Leave **Root Directory** at the repository root, not `frontend` or `backend`.
3. Let `vercel.json` configure the services. Remove project-level overrides for framework,
   install/build commands and output directory if this was previously a frontend-only project.
4. Add the environment variables below to the appropriate production/preview environments.
5. Deploy. Vercel builds and runs both services on its infrastructure; your computer can be off.

You can also link and deploy from the repository root with a current Vercel CLI:

```powershell
npx vercel@latest link
npx vercel@latest deploy
# After checking the preview:
npx vercel@latest deploy --prod
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `APP_ENV=production` | Backend environment label |
| `OPENAI_API_KEY` | Enables AI note/workflow drafting. Without it, the noting workspace uses local drafting. |
| `OPENAI_MODEL=gpt-4.1-mini` | Optional model override |
| `AI_TIMEOUT_SECONDS=60` | Default AI timeout; the frontend noting client waits up to 70 seconds |
| `DATABASE_URL` | Managed `postgresql+asyncpg://...` connection string for database-backed workflow APIs |

Keep `API_V1_PREFIX` at its default `/api/v1`, matching the frontend gateway. No
`NEXT_PUBLIC_API_URL`, public backend hostname or deployment-specific CORS origin is needed.
The old `NEXT_PUBLIC_API_URL` setting is no longer used. Configure provider secrets in Vercel,
not in tracked files. Local environment files are excluded from CLI deployments.

### Persistence

The noting workspace retains documents and edits in the visitor's browser session, as before.
It does not need a database to extract text, draft notes, preview rules or export documents.

Saved-workflow API operations need managed Postgres. Local SQLite cannot provide persistent
storage across Vercel instances; when Vercel has no managed database configured, those endpoints
return a descriptive 503 while noting and liveness continue to work. Apply migrations to the
configured database separately, once per environment:

```powershell
# Set DATABASE_URL for the intended managed database in this shell first.
uv run --directory backend alembic upgrade head
```

Use separate preview and production databases. Supply the provider's required TLS settings in
the asyncpg-compatible connection configuration. `REDIS_URL` and the optional ARQ worker are
not needed by the current noting workspace; the worker is a separate long-running process and
is not one of these two request-driven services.

## Builds and source files

- Frontend: npm workspaces install dependencies using the root lockfile. `npm run build` in
  `frontend/` also prepares same-origin OCR/PDF workers and the served proposal/rule PDFs.
- Backend: `.python-version` selects Python 3.12, supported by Vercel. The application entrypoint
  is `app.main:app`. `python scripts/prepare-vercel.py` copies the reviewed library, source
  manifest, all four registered rule PDFs and note-format PDF into `backend/resources/noting/`.
  Rule hashes are checked against the committed source manifest before packaging. These
  generated files are included in the function bundle, so it needs no repository-relative files
  outside its service at runtime.
- Function duration is 120 seconds for the backend and Next.js gateway. Bindings are not needed
  to build either service. Database connections are lazy and do not create files on startup.

## Verify locally

Use Vercel's local runner to exercise both services with real, automatically generated bindings:

```powershell
npx vercel@latest dev --local --listen 3100
```

`--local` avoids requiring a linked project; it does not pull cloud environment variables.
For a linked project with Vercel environment settings, use `npx vercel@latest dev`.
On an existing Windows checkout, stop the standalone backend before the first run so the CLI
can update `backend/.venv` from Python 3.11 to 3.12. Alternatively, validate from a fresh checkout.

Check:

- `/` loads the workspace and its assets.
- `/api/v1/health` returns 200 via the frontend-to-backend binding.
- `/api/v1/noting/capabilities` returns provider availability.
- `/api/v1/noting/draft` accepts reviewed proposal JSON (503 is expected without an AI key).
- A fresh uploaded proposal converts to text and a note, with the registered rulebooks accessible and applicable provisions selected automatically.
- `/api/v1/health/ready` succeeds once the managed database is configured.

For standalone local development, `npm run dev` still starts Next.js and FastAPI. Only in this
mode, the gateway uses `LOCAL_BACKEND_URL` or defaults to `http://127.0.0.1:8000` server-side.
On Vercel, an absent binding returns 503 instead of falling back to localhost.

Checks:

```powershell
npm run test:deployment --workspace @instinctgo/frontend
npm run test:playground --workspace @instinctgo/frontend
uv run --directory backend pytest -q
npm run lint:frontend
npm run lint:backend
npm run build
```
