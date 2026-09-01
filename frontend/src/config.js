// Centralized backend URL.
// Override at runtime by setting VITE_API_BASE in frontend/.env
export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
