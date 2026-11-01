# Architecture

```text
Manual process / business documents
                |
         Next.js frontend
                |
          FastAPI routes
                |
       Pydantic validation
                |
       Application services ------> ARQ jobs / Redis
            |       |                    |
            |       +-------> LangGraph planner ---> LLM provider
            |
       Repositories
            |
       SQLAlchemy
            |
   SQLite (local) / PostgreSQL
```

## Boundaries

HTTP routes handle transport concerns. Services own business logic and transactions.
Repositories contain persistence queries. Schemas define the shared shape of drafts
for API calls, model-generated structured output, and database reads.

Agent orchestration lives separately from HTTP and storage. The initial graph has one
planning node, with room for extraction, classification, enrichment, and validation nodes.
Business actions belong in `tools/`; external API details belong in `integrations/`.

Document parsers are synchronous utilities intended for background execution. The current
API accepts process descriptions directly. Background drafting is available through ARQ;
jobs use their UUID job ID as a stable persistence ID across retries.

## Dependency ownership

- `backend/pyproject.toml` + `backend/uv.lock`: backend dependencies and development tools.
- `frontend/package.json`: frontend dependencies.
- Root `package-lock.json`: reproducible npm workspace installation.

## Next features

1. Process/document intake UI and upload API.
2. Workflow editor and draft revisions.
3. Business integration adapters and typed tools.
4. Durable workflow execution, progress events, and run history.
5. Accounts, organization ownership, and access controls.
