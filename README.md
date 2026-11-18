<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d740d859-4d67-46b5-bf68-cf45a7c1876a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` (git-ignored) and set:
   - `VITE_SUPABASE_URL` – your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` – the Supabase **anon** public key

   Never put the `service_role` key in the front-end or in any committed file.
   Without these variables the app renders a blank screen.
3. Run the app (http://localhost:3000):
   `npm run dev`
   (On Windows PowerShell, use `npm.cmd run dev` if `npm.ps1` is blocked.)
4. Production build: `npm run build` (output in `dist/`), preview with `npm run preview`.
   Restart the dev server after changing `.env`.
