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
