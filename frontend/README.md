# InstinctGo frontend

Next.js App Router, React, TypeScript, and Tailwind CSS. Run from the repository root:

```powershell
npm install
npm run dev:frontend
```

Open http://localhost:3000. Environment settings belong in `.env.local`; copy `.env.example`
on first setup. Browser API calls use same-origin `/api/v1/*`. A runtime Next.js handler
uses Vercel's injected `BACKEND_URL`, or `LOCAL_BACKEND_URL` for standalone local development.
`NEXT_PUBLIC_API_URL` is no longer used. See `../docs/vercel-deployment.md` for deployment.

## Structure

- `src/app/`: route pages and layouts.
- `src/components/ui/`: reusable UI components.
- `src/components/three/`: Three.js / React Three Fiber components.
- `src/features/workflows/`: workflow-specific UI and logic.
- `src/hooks/`: shared React hooks.
- `src/lib/`: API client and class-name helpers.
- `src/types/`: shared frontend types.
- `public/`: static assets.

Three.js, `@react-three/fiber`, and `@react-three/drei` are installed. A client-only,
lazy-loaded scene is available as `ScenePreview` from `@/components/three/scene-preview`.
Import it into a page when you start building the 3D interface.

Use `npm run lint:frontend`, `npm run typecheck`, and `npm run build` from the root.

## Noting workspace

Upload a proposal, choose **Convert to text**, review/edit it, then choose **Convert to note**.
New uploads and the sample use the same drafting flow. The original, reviewed text and note
are retained separately for the browser session. Reloading clears the session.

`src/lib/playground/note-draft.ts` creates a local examination note using the format profiles
in `samples/noting-library.json`, including refund, GPF, consultancy and general requests.
Local drafting extracts common labelled or free-form particulars and quotes the request.
Generated notes contain the case facts and examination without boilerplate clarification paragraphs,
conditional closing paragraphs or disclaimer footers.
Procurement notes omit the generic examination/checklist and copied rule-application
paragraphs; those instructions remain in the applicable references. The editor and
Preview note share the document header, signature layout and current draft content.

When the backend reports an available AI provider, `note-service.ts` submits the reviewed text
and supporting text to `/noting/draft` for structured AI drafting. Provider failures fall back
to local drafting. The workspace labels the engine used. Set `OPENAI_API_KEY` in `backend/.env`
to enable AI; credentials stay on the backend. Combined input is limited to 200,000 characters.

The reference panel, source picker and assistant show only provisions selected for
the current proposal, with links to their source PDF pages. A rulebook filter appears
only when the applicable provisions span multiple books. Proposals with no matched
provisions show an empty state instead of unrelated rules. See `samples/README.md`
for source maintenance.

Run the workflow tests with `npm run test:playground --workspace @instinctgo/frontend`.
