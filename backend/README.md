# EventPass backend

Independent Node/Express services live in `services/`. Shared backend helpers are in `shared/`, NGINX configuration is in `infra/`, and backend unit checks are in `tests/`.

From the project root, run `npm install` once and `npm run dev:backend`. Start the React app separately with `npm run dev:frontend`, or start both with `npm run dev`. Configuration remains in the root `.env`.
