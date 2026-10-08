# simsab-courses

Course site for [courses.simsab.net](https://courses.simsab.net). It lists the
live online courses and lets visitors book a seat through Stripe Checkout.
Cloudflare Pages hosts the static pages and the API (Pages Functions). Stripe
is the only data source: each cohort is a Stripe product, and its metadata
holds the dates, times and seat counts.

## Structure

```
public/                 Static site (pages_build_output_dir in wrangler.toml)
  index.html            Course overview, filled from /api/courses
  <course-slug>.html    One page per course, with the enrolment sidebar
  legal-notice.html     Impressum (German)
  privacy-policy.html   Datenschutzerklärung (German)
  success.html          Shown after a completed checkout
  css/, js/, fonts/     Styles, scripts and self-hosted fonts (SIL OFL)
  img/                  Instructor photos
functions/api/
  courses.js            GET  /api/courses   open cohorts from Stripe, cached in KV
  checkout.js           POST /api/checkout  creates a Stripe Checkout session
  webhook.js            POST /api/webhook   counts a seat after a completed checkout
functions/_lib/         Shared helpers (JSON responses, Stripe API, signature check)
screenshots/            Screenshots of the booking flow in the Stripe sandbox
backup/                 Earlier versions of the front end
```

## Courses in Stripe

Each cohort is one Stripe product with one active one-time price in EUR. The
price is net, with tax behaviour set to "exclusive". The site shows the gross
price for German customers (19% VAT) and the net price below it. Stripe Tax
calculates the exact VAT at checkout.

The product name and description appear on the overview page, in the checkout
and on the invoice. The product needs this metadata:

| Key | Example | Notes |
|---|---|---|
| `course_slug` | `conflict-to-collaboration` | must match the page file name in `public/` |
| `cohort_id` | `ctc-jan-2027` | unique per cohort |
| `status` | `open` | only open cohorts appear on the site |
| `max_seats` | `16` | |
| `seats_taken` | `0` | increased by the webhook after each booking |
| `start_date`, `end_date` | `2027-01-13` | format YYYY-MM-DD |
| `start_time`, `end_time` | `09:00`, `17:00` | Berlin time; the site shows CET or CEST |
| `highlights` | `Difficult Conversations\|De-escalation` | separated by `\|`, shown on the overview |
| `flagship` | `true` | optional, highlights the course card |

The webhook sets `status` to `closed` when `max_seats` is reached. Seat limits
are a soft check: two people who pay for the last seat at the same moment can
both get in.

To add a course, create the Stripe product with its price and metadata, and add
a page `public/<course_slug>.html` based on an existing course page.

## Checkout

`/api/checkout` creates a Stripe Checkout session with:

- automatic tax (Stripe Tax) and a required billing address
- optional company name and VAT ID; Stripe applies reverse charge for valid EU
  VAT IDs
- an invoice after payment, which Stripe emails together with the receipt
- promotion codes
- participant first and last name as custom fields
- acceptance of the terms and conditions, only if `REQUIRE_TERMS=true` is set
  (this also needs the terms URL in Stripe, and `TERMS_URL` in
  `public/js/course.js` to show the link on the course pages)

Payment methods are configured in the Stripe Dashboard. Methods with delayed
payment confirmation (SEPA Direct Debit, bank transfers) are switched off,
because the webhook counts a seat as soon as the checkout is completed.

Group bookings are handled by email (contact@simsab.net) with a manual invoice
in Stripe. Increase `seats_taken` by hand when such a booking is paid.

## Cloudflare

Secrets are set in the Cloudflare Pages project, never in the repository:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- optional: `REQUIRE_TERMS` (`true` or not set)

The KV namespace `COURSES_CACHE` (see `wrangler.toml`) caches the course list
for five minutes. The webhook clears the cache after each booking. After
changes in Stripe, delete the key `courses` in the namespace or wait five
minutes.

The Stripe webhook endpoint is `https://courses.simsab.net/api/webhook`,
listening to `checkout.session.completed`.

## Local development

```
npm install
npm run dev
```

`npm run dev` starts `wrangler pages dev public`. Local secrets go into
`.dev.vars` (not part of the repository), for example
`STRIPE_SECRET_KEY=sk_test_...`. Use Stripe sandbox keys locally.

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
