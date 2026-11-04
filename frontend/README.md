# InstinctGo frontend

Next.js App Router, React, TypeScript, and Tailwind CSS. Run from the repository root:

```powershell
npm install
npm run dev:frontend
```

Open http://localhost:3000. Environment settings belong in `.env.local`; copy `.env.example`
on first setup. `NEXT_PUBLIC_API_URL` points to the FastAPI versioned API.

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
Local drafting extracts common labelled or free-form particulars and quotes the request;
missing facts are left for clarification. It is a deterministic draft, not an AI-generated summary.

When the backend reports an available AI provider, `note-service.ts` submits the reviewed text
and supporting text to `/noting/draft` for structured AI drafting. Provider failures fall back
to local drafting. The workspace labels the engine used. Set `OPENAI_API_KEY` in `backend/.env`
to enable AI; credentials stay on the backend. Combined input is limited to 200,000 characters.

The supplied GPF and Consultancy Service rulebooks are selected by the proposal's subject and
institution. Applied entries link to the correct original PDF page. Consultancy service-tax
wording is flagged for transaction-date verification. Notes with no matching rule identify
the required policy. See `samples/README.md` for source maintenance.

Run the workflow tests with `npm run test:playground --workspace @instinctgo/frontend`.
