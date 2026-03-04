# AI Code Archaeologist Frontend

Premium React + Tailwind intelligence experience for repository analysis.

## Stack

- React + Vite + TypeScript
- TailwindCSS v4 (`@tailwindcss/vite`)
- Lucide icons
- Inter typography

## Run

```bash
npm install
npm run dev
```

## Environment

Create `.env` in `frontend/`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

API calls:
- `POST /analyze`
- `GET /status/{job_id}`
- `GET /wiki/{job_id}`
- `POST /ask/{job_id}`

## Flow

1. Analyze Repository
2. Intelligence Mode Selection
3. Deep View Panel

## Project Structure

```text
src/
  components/
  layouts/
  pages/
  features/
  services/
  hooks/
  types/
```
