# simsab-courses

Standalone course marketing + enrollment site, replacing the Maven listing.
Cloudflare Pages hosts the static front end and the API (Pages Functions).
Stripe Checkout takes the payment. Google Sheets holds course/cohort config
and enrollment records — no payment data ever reaches the Sheet.

## 1. Google Sheet

Create one Google Sheet with two tabs, named exactly `Courses` and
`Enrollments`. Row 1 of each is the header row below — paste each block
directly into row 1 (they're tab-separated).

**Courses**
```
course_slug	course_name	description	highlights	cohort_id	start_date	end_date	max_seats	seats_taken	price_eur	price_usd	stripe_price_id_eur	stripe_price_id_usd	status
leading-coordination	Leading Coordination and Collaboration in AI-Accelerated Organisations	Live, two-day program for leaders navigating coordination friction as AI accelerates delivery.	Move conversations forward|Fix team boundaries early|Keep stakeholders aligned|Test your thinking against peers	nov-2026	2026-11-11	2026-11-12	16	0	1200	1300	price_REPLACE_EUR	price_REPLACE_USD	open
```
- `highlights` is pipe-separated (`|`); each segment becomes one bullet.
- `seats_taken` starts at 0 and is updated automatically by the webhook —
  don't edit it by hand while the site is live, or you'll race the webhook.
- `status` must be `open` for a cohort to appear on the site.
- Add one row per cohort. Multiple rows can share the same `course_slug`
  (e.g. a November and a February cohort of the same course) — the course
  page groups them and lets the visitor pick one.

**Enrollments** (written by the webhook, not by you)
```
email	first_name	last_name	price_paid	discount_code	enrollment_date	cohort_id
```

Share the Sheet with your service account's email (below) as an **Editor**.

## 2. Google service account (lets the Worker read/write the Sheet)

1. In Google Cloud Console, create a project (or reuse one), enable the
   **Google Sheets API**.
2. Create a **Service Account**, then create a JSON key for it and download it.
3. From that JSON, you need two values: `client_email` and `private_key`.
4. Share the Google Sheet with `client_email` as an Editor (step 1).

## 3. Stripe

1. For each cohort, create a **Product** in Stripe, then a **Price** for it
   in EUR and another in USD (one-time, not recurring). Copy each Price ID
   into the matching `stripe_price_id_eur` / `stripe_price_id_usd` cell.
2. In **Settings → Payment methods**, enable the methods you want offered
   (card, PayPal, etc.) for your account and each currency you take. The
   checkout code doesn't hardcode payment methods — it shows whatever's
   enabled here.
3. In **Settings → Promotion codes**, create the discount codes you want
   (e.g. 80% off, 100% off) as Coupons, then generate a Promotion Code for
   each. Customers enter these on Stripe's own Checkout page.
4. Under **Developers → Webhooks**, add an endpoint pointing at
   `https://<your-subdomain>/api/webhook`, listening for
   `checkout.session.completed`. Copy the signing secret it gives you.
5. The site validates a discount code before checkout (via `/api/promo`) so
   the visitor sees the reduced price up front, then applies the same code
   server-side when creating the Checkout session (via `/api/checkout`) —
   the code is checked twice, but only ever applied once.

## 4. Cloudflare

```
npm install
npx wrangler login
npx wrangler kv namespace create COURSES_CACHE
```
Paste the returned `id` into `wrangler.toml`.

Set secrets (each prompts for a value, nothing goes in the repo):
```
npx wrangler pages secret put STRIPE_SECRET_KEY
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET
npx wrangler pages secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler pages secret put GOOGLE_PRIVATE_KEY
npx wrangler pages secret put SHEET_ID
```
- `GOOGLE_PRIVATE_KEY` is the full `-----BEGIN PRIVATE KEY-----...` block
  from the JSON key — paste it with literal `\n` for line breaks if your
  terminal collapses it to one line; the code handles either form.
- `SHEET_ID` is the long ID in the Sheet's URL between `/d/` and `/edit`.

Deploy:
```
npx wrangler pages deploy public --project-name=simsab-courses
```

## 5. DNS

In Cloudflare Pages, add a custom domain — a subdomain of simsab.net, e.g.
`courses.simsab.net`. Cloudflare will tell you the CNAME record to add;
since simsab.net's DNS is already on Cloudflare (or wherever you manage
it), add that record and it's usually live within minutes.

## 6. Test before going live

Use Stripe's test mode keys first. Stripe's test cards (e.g.
`4242 4242 4242 4242`, any future date/CVC) let you run a full enrollment
and confirm a row lands in `Enrollments` and `seats_taken` increments.
Switch to live keys (as separate secrets) once that works end to end.

## Front end

`public/course.html`, `css/styles.css`, `js/app.js`, and `js/course.js` are
your own files — I built on top of them rather than the earlier scaffold:
the challenge list and instructor profiles now sit side by side, and the
old static "Upcoming cohorts" section was replaced with a sticky sidebar
(`#enroll`) that holds the live cohort picker, currency toggle, discount
code field, and Enrol button, wired up to `/api/courses`, `/api/promo`,
and `/api/checkout`.

Two things to fill in before this renders correctly:
- The `Courses` sheet needs at least one row with `course_slug` set to
  `leading-coordination` (matching the sidebar's `data-course-slug`) for
  the cohort list and pricing to appear at all.

## Notes / things worth knowing

- Seat limits are a **soft check**: read before checkout, incremented after
  payment. Two people paying in the same instant for the last seat could
  both get in — acceptable at this scale, per your call.
- The course listing is cached for 5 minutes (Cloudflare KV) so normal
  browsing doesn't hit the Sheets API; the webhook clears that cache the
  moment a seat is taken, so it won't show stale availability for long.
- Adding a new course is just adding rows to the `Courses` tab — no code
  changes needed. The site is built to support any number of courses.
- The discount-code text stored in `Enrollments` relies on a Stripe API
  field (`total_details.breakdown.discounts[].discount.promotion_code`)
  that's worth double-checking against a real test payment — if it comes
  back empty, it may need `promotion_code` expanded one level further.

## Git

The project is versioned in the public repository
`simonsablowski/simsab-courses`. The following are not part of the
repository (see `.gitignore`): `node_modules/`, the local Wrangler state in
`.wrangler/`, local secrets in `.dev.vars` and `.env*` files, operating system
files, Git bundles and `.zip` archives.

Commit messages are written in English: short, in the imperative mood and
factual (for example "Add favicons to all pages").

Typical workflow:

```
git pull
git add -A
git commit -m "Describe the change"
git push
```
