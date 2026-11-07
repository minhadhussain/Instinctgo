# InstinctGo

Turn manual business processes into agentic workflows.

## Stack

- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic.
- **AI:** LangGraph + LangChain OpenAI structured workflow planning.
- **Jobs/data:** ARQ, Redis, PostgreSQL; SQLite for immediate local development.
- **Documents:** PDF, DOCX, Markdown, and plain-text extraction.
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS.
- **3D:** Three.js, React Three Fiber, and Drei.

```text
instinctgo/
├── backend/
│   ├── app/
│   │   ├── api/            # Versioned HTTP endpoints
│   │   ├── agents/         # LangGraph, agent state, prompts
│   │   ├── core/           # Configuration and logging
│   │   ├── db/             # Database sessions and metadata
│   │   ├── ingestion/      # Document parsers
│   │   ├── integrations/   # External business systems
│   │   ├── models/         # Database entities
│   │   ├── repositories/   # Persistence queries
│   │   ├── schemas/        # Request/response validation
│   │   ├── services/       # Business logic
│   │   ├── tools/          # Agent-callable actions
│   │   └── workers/        # Background jobs
│   ├── migrations/
│   ├── storage/uploads/
│   ├── tests/
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/app/
│   ├── src/components/     # UI and 3D components
│   ├── src/features/
│   ├── src/hooks/
│   ├── src/lib/
│   └── src/types/
└── docs/                   # Architecture notes
```

## Quick start

Requirements: Python 3.12 (selected by `backend/.python-version`), uv, Node.js 22.19+, and npm 10+.

Dependencies and local environment files are created during initial setup. To reinstall:

```powershell
uv sync --project backend --locked
npm ci
```

For a fresh checkout, copy `backend/.env.example` to `backend/.env` and
`frontend/.env.example` to `frontend/.env.local` once.

Initialize the database on first setup, then start both the backend and frontend:

```powershell
npm run db:migrate
npm run dev
```

- Frontend: **http://localhost:3000**
- API docs: **http://localhost:8000/docs**

On Windows, you can also double-click `start-dev.cmd` in the project root.
It starts both servers from the correct folder and keeps startup errors visible.
Leave the terminal window open while using the website.

Both servers support hot reload. Press `Ctrl+C` to stop both. Logs are labeled
`backend` and `frontend`; if either server exits, the other is stopped too.
For individual servers, use `npm run dev:backend` or `npm run dev:frontend`.

Set `OPENAI_API_KEY` in `backend/.env` to use AI drafting. Database-backed workflow
creation/listing and health endpoints run without an AI key.

## Checks

```powershell
npm run lint:backend
npm run lint:frontend
npm run typecheck
npm run build
```

See [backend setup](backend/README.md), [frontend setup](frontend/README.md), and the
[full system architecture](docs/architecture.md) for systems, data flows, API contracts,
storage, AI drafting, and deployment details. PostgreSQL and Redis clients are installed;
configure an existing service when those features are needed.

For a plain-language walkthrough and technical explanation of local note generation,
see [How the offline noting system works](docs/offline-noting-system.md).

## Vercel deployment

The root `vercel.json` deploys a public Next.js `frontend` and an internal FastAPI `backend`
as one project. The frontend's `/api/v1/*` route uses Vercel's runtime `BACKEND_URL` binding;
the browser always uses the site's own domain. Vercel hosts both services independently of
your computer. Import the repository with Root Directory `.`.

See [deployment setup, environment variables and verification](docs/vercel-deployment.md).
