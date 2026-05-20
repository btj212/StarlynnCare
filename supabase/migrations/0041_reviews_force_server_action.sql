-- Audit finding H5 — the public `reviews_insert_pending` policy let anyone
-- with the publishable key (i.e. every browser) INSERT rows directly via
-- PostgREST, completely bypassing the validation, rate limit, and honeypot
-- gates in src/app/actions/submitReview.ts. All review writes now go
-- through the service-role server action.

DROP POLICY IF EXISTS "reviews_insert_pending" ON public.reviews;

-- Read-side policy `reviews_select_published` (published-only) is unchanged.
