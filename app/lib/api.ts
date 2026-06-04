// Base URL for the Python backend. Set NEXT_PUBLIC_API_URL in the deployment
// environment (e.g. Vercel) to point at the deployed backend. Falls back to the
// local dev server when unset.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
