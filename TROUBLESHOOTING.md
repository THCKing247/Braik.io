# Troubleshooting

## "An error occurred in the Server Components render" (production)

In production, Next.js hides the real error message to avoid leaking sensitive details. You only see a generic message and an optional `digest` on the error.

**What’s going on:** The error is thrown while rendering a Server Component—usually in the dashboard layout when loading session, Supabase, or team data. The real message is still logged on the **server**.

**How to find the cause:**

1. **Development**  
   Run `npm run dev` and open the failing route (e.g. `/dashboard/playbooks`). The dev overlay will show the real error and stack.

2. **Production**  
   Check your server logs (e.g. Vercel → Project → Logs, or your host’s stdout). Look for:
   - `[dashboard layout] Server Components render failed: <message>`

**Common causes:**

- **Missing Supabase env in production**  
  Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in your deployment (Vercel/host env vars).  
  If they’re missing, `getSupabaseServer()` throws and the layout fails.

- **Supabase/DB errors**  
  Auth or DB calls in the layout can throw (e.g. network, invalid key, missing tables). The server log will show the exact error.

**Reference (digest):**  
If the UI shows a “Reference: …” (digest), use it to match the error in logs or when reporting the issue.

---

## `playbooks` – Failed to load resource: net::ERR_HTTP2_PROTOCOL_ERROR

This usually happens when the **server closes the connection** before the response is sent—often because a Server Component threw and the process crashed or aborted the request.

**What to do:** Fix the underlying Server Components error (see above). Once the layout/page renders without throwing, the request should complete and this HTTP/2 error should stop.
