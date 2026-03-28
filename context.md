# SlotMe — Developer Context

# Last updated: v1.10.0 — pre-2.0 planning (COMPLETE)

---

## Stack

- Frontend: React + Vite → Vercel (Luxon for timezone math, React Hot Toast, jwtDecode)
- Backend: Flask + SQLAlchemy → Render
- Database: PostgreSQL (Render managed), SQLite locally
- Auth: JWT via flask_jwt_extended
  Access: 15min | Refresh: 30 days (set in app.py — config.py values DEAD)
- Payments: Stripe subscriptions (stripe_routes.py + stripe_utils.py)
- Email: Brevo SMTP (email_utils.py raw layer + email_service.py business logic)
  All mail from: "SlotMe Support <support@slotme.xyz>" ← hardcoded
- Storage: AWS S3 (s3_routes.py + s3_utils.py)
- SMS: Twilio — NOT INTEGRATED (2.0 target, Pro only)

---

## Domain Migration Checklist (slotme.xyz → slotme.io)

1. Update FRONTEND_URL + BACKEND_ORIGIN env vars (Vercel + Render)
2. Find/replace "slotme.xyz" in: email_service.py, email_utils.py, booking_routes.py
3. Update From: support@slotme.xyz → support@slotme.io in email_utils.py
4. Re-verify Brevo sender domain
5. Update Stripe webhook URL in Stripe dashboard
6. Confirm ALLOWED_ORIGINS in config.py has no hardcoded .xyz refs
7. Update WhySlotMe.jsx pricing copy (currently hardcodes old tier names)

---

## Current Version

v1.10.0 (main branch)

---

## Business Model — 2.0 Decision (FINAL)

**"$20/mo flat. SlotMe takes 0% of transactions."**

- SlotMe Free: $0 — freelancer collects payments themselves (cash/Venmo/Zelle)
- SlotMe Premium: $20/mo — payment processing via Stripe Connect, 0% platform fee

**How it works:**

- Premium freelancer connects their own Stripe account via Stripe Connect OAuth
- Customer pays at booking → money goes directly to freelancer's Stripe account
- Stripe takes ~2.9% + 30¢ from the freelancer (standard)
- SlotMe takes $0 platform fee
- Freelancer controls payout schedule through their own Stripe dashboard

**Why this works competitively:**

- Square Appointments: 2.6% per transaction. $5k/mo = $130/mo to Square.
- SlotMe Premium: $20/mo flat. A barber doing $5k/mo SAVES $110/mo vs Square.

**Trial:** 30-day free trial, no credit card required. Already implemented in stripe_routes.py.

**Sustainability:** Start at 0% fees. Introduce 0.5% nominal fee or raise subscription at 1,000+ active users.

**Legal:** Form LLC before 50 paying customers. SlotMe is not a payment processor — Stripe is. Freelancer is merchant of record. Refunds handled by freelancer through their own Stripe.

---

## Tiers — CURRENT (pre-2.0)

| Tier  | Price  | Stripe Price ID (LIVE)         |
| ----- | ------ | ------------------------------ |
| free  | $0     | N/A                            |
| pro   | $5/mo  | price_1Ra4Q7Cao129FRPLhW781Pum |
| elite | $10/mo | price_1Ra4SSCao129FRPLofSSMdhl |

- 30-day free trial on all paid plans
- Upgrade.jsx shows "50% OFF FOREVER" ($5/$10 shown as $10/$20 struck through)
- PRICE_TO_TIER map exists in TWO places — keep in sync:
  - stripe_routes.py (live prices — webhooks) ← SOURCE OF TRUTH
  - stripe_utils.py (sandbox prices — used in delete_finalize, stale)

---

## Tiers — TARGET (SlotMe 2.0)

| Tier | Price  | Notes                                           |
| ---- | ------ | ----------------------------------------------- |
| free | $0     | Full platform, freelancer collects own payments |
| pro  | $20/mo | Stripe Connect — platform handles deposits      |

### 2.0 full migration checklist:

**Backend:**

- [ ] Create $20/mo price in Stripe → get new price ID
- [ ] Add to PRICE_TO_TIER in stripe_routes.py AND stripe_utils.py
- [ ] Remove "elite" from: features.py, stripe_routes.py PRICE_TO_TIER
- [ ] features.py: update analytics/csv_export/custom_url → ["pro"] only
- [ ] features.py: add sms_reminders → ["pro"]
- [ ] features.py: remove scan, priority_support (elite-only, gone)
- [ ] middleware.py: use get_effective_tier(freelancer) instead of freelancer.tier
- [ ] freelancer_routes.py: fix /freelancer-info to return get_effective_tier()
- [ ] freelancer_routes.py: fix /freelancer/reply raw elite check → @require_tier
- [ ] freelancer_routes.py: update is_verified → tier in ["pro"] only
- [ ] freelancer_routes.py add_addon: remove elite branch, pro = unlimited
- [ ] middleware.py: add /freelancer/delete-confirm + /freelancer/delete-finalize to open_prefixes
- [ ] auth_routes.py: fix reset_serializer hardcoded secret (security critical)
- [ ] seed_helpers.py: update Jade + Monty to pro tier (Monty = Tom's real account)
- [ ] dev_routes.py: update tier validation to ["free", "pro"] only

**Frontend:**

- [ ] tiers.js: emailReminders → "free", smsReminders stays "pro"
- [ ] tiers.js: remove earlyAccess, calendarSync, scan entries
- [ ] Upgrade.jsx: full redesign — 2 tiers, no founder banner, 30-day trial CTA
- [ ] TierGateModal.jsx: "Upgrade to ELITE" → "Upgrade to PRO", link #elite → #pro
- [ ] TierStatusCard.jsx: remove elite entry, change click target to #pro
- [ ] FreelancerAdmin.jsx: remove "Upgrade to ELITE for unlimited" add-on message
- [ ] FreelancerAdmin.jsx: update AccordionSection onTierBlocked toast target
- [ ] Navbar.jsx: decide — remove Priority Support link or move to pro
- [ ] Settings.jsx: Subscription section already conditioned on tier !== "free" ✅
- [ ] CRM.jsx: update canExport check (remove elite), update upgrade link #elite → #pro
- [ ] WhySlotMe.jsx: update pricing copy — remove "Elite ($40/mo)" reference
- [ ] Home.jsx: update "coming soon" bullet once SMS reminders ship

---

## Tier Enforcement — Full Stack Flow

### Backend (per request):

1. Request → middleware.py load_freelancer()
2. JWT verified → g.freelancer = Freelancer from DB
3. g.user = { id, freelancer_id, tier, email }
   ⚠️ BUG: tier = freelancer.tier (raw) — not get_effective_tier()
   Risk: cancelled subscriber keeps access until webhook fires
   Fix: middleware.py → normalize_tier(get_effective_tier(freelancer))
4. @require_auth → checks g.user and g.freelancer exist
5. @require_tier("feature_key") → checks g.user["tier"] vs features.py FEATURES dict
6. Some routes bypass with raw tier checks (/freelancer/reply ← BUG)
7. GET /auth/me/features → full feature map for logged-in user

### /freelancer-info (GET) — most-used auth endpoint:

- Called by: RequireTier.jsx, FreelancerAdmin.jsx, Settings.jsx, Upgrade.jsx
- Returns raw f.tier ← same bug as middleware
- Fix: return get_effective_tier(f) instead

### /freelancer/me (GET) — Settings.jsx only:

- Returns: id, first_name, last_name, email, phone, business_name, tier, show_footer_navbar

### Frontend tier data flow:

1. Login → access_token + freelancer_id stored in localStorage
2. FreelancerAdmin fetchFreelancerDetails → /freelancer-info →
   setFreelancer(data) + localStorage.setItem("freelancer", JSON.stringify(data))
3. FreelancerContext reads localStorage on mount via getStoredFreelancer()
4. All pages read tier from context (potentially stale between sessions)
5. RequireTier.jsx hits /freelancer-info fresh on each mount → authoritative
6. hasTierAccess(tier, needed) from tiers.js → UI decisions
7. TierGateModal shown on denied access

---

## Key Files

### Backend

| File                                | Purpose                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| backend/app.py                      | Entry point, blueprints, CORS, daemon threads                      |
| backend/config.py                   | FRONTEND_URL, ALLOWED_ORIGINS, RESERVED_ROUTES, name_pool          |
| backend/models/**init**.py          | All DB models                                                      |
| backend/utils/middleware.py         | JWT auth, g.user + g.freelancer, open routes perimeter             |
| backend/utils/decorators.py         | @require_auth, @require_tier(feature_or_tier)                      |
| backend/utils/tier_utils.py         | has_paid_access(), get_effective_tier() ← use everywhere           |
| backend/utils/features.py           | FEATURES dict, is_feature_enabled(), all_features_for_tier()       |
| backend/utils/jwt_utils.py          | serializer (FLASK_SECRET_KEY env var)                              |
| backend/utils/stripe_utils.py       | cancel_subscription(), get_active_subscription_for_customer()      |
| backend/utils/timezone_utils.py     | US_TIMEZONES whitelist, utc_to_timezone, format helpers            |
| backend/utils/time_utils.py         | Single function: utc_today() → date                                |
| backend/utils/slug_utils.py         | generate_unique_slug() — 12-char alphanumeric, DB uniqueness check |
| backend/utils/navigation_utils.py   | is_valid_public_slug() — regex + DB check for custom URL routing   |
| backend/utils/s3_utils.py           | generate_presigned_url() for profile photo uploads                 |
| backend/routes/auth_routes.py       | Login, signup, verify, refresh, password reset, email change       |
| backend/routes/booking_routes.py    | All booking CRUD, confirm, cancel, ICS, CSV export                 |
| backend/routes/freelancer_routes.py | 30+ routes: profile, slots, services, addons, analytics, delete    |
| backend/routes/stripe_routes.py     | Checkout, webhook (5 events), cancel, sync                         |
| backend/routes/s3_routes.py         | POST /s3/upload-url — presigned URL for profile photo upload       |
| backend/routes/onboarding_routes.py | 3 routes: GET /status, POST /mark-step/<id>, POST /dismiss         |
| backend/routes/reminder_routes.py   | ← EMPTY SHELL. Zero routes.                                        |
| backend/routes/public_routes.py     | Single route: POST /feedback                                       |
| backend/routes/dev_routes.py        | Dev-only: seed, reset-db, update-demos, CRUD, login                |
| backend/services/email_service.py   | 6 business-logic email functions                                   |
| backend/email_utils.py              | Raw SMTP — send_branded_customer_reply = workhorse                 |
| backend/services/booking_service.py | Single util: clear_inherited_blocks()                              |
| backend/dev/seed_helpers.py         | seed_freelancer(), add_appointment(), timezone conversion          |

### Backend — Dead/Broken Utilities (do not use)

| File                         | Status                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| backend/utils/rate_limit.py  | Dead — ip_attempts already in config.py, this file unused      |
| backend/utils/token_utils.py | Broken stub — references URLSafeTimedSerializer without import |

### Frontend

| File                                             | Purpose                                                    |
| ------------------------------------------------ | ---------------------------------------------------------- |
| frontend/src/App.jsx                             | All routes, session expiry, cross-tab sync                 |
| frontend/src/context/FreelancerContext.jsx       | Global state, reads localStorage on mount                  |
| frontend/src/utils/tiers.js                      | TIERS, FEATURES_BY_TIER, hasTierAccess()                   |
| frontend/src/utils/axiosInstance.js              | Axios + auto-refresh + dev token handling                  |
| frontend/src/utils/constants.js                  | API_BASE, PUBLIC_SAFE_PATHS                                |
| frontend/src/utils/getStoredFreelancer.js        | Safe localStorage read with error handling                 |
| frontend/src/utils/setStoredFreelancer.js        | localStorage write — use this, not direct setItem          |
| frontend/src/utils/timezoneHelpers.js            | Full timezone util library — see section below             |
| frontend/src/utils/jwt.js                        | isTokenExpired() via jwtDecode — used in Settings          |
| frontend/src/utils/navigation.js                 | setNavigator() + redirectToAuth() — React Router nav       |
| frontend/src/utils/validatePassword.js           | 5-rule password validator — must stay in sync with backend |
| frontend/src/utils/tokenChannel.js               | BroadcastChannel for cross-tab session sync                |
| frontend/src/utils/toast.jsx                     | showToast() — swipeable, color-coded toast system          |
| frontend/src/utils/cropCanvas.js                 | Canvas crop util for profile photo upload                  |
| frontend/src/components/Auth/RequireTier.jsx     | Tier gate — hits /freelancer-info live on mount            |
| frontend/src/components/Modals/TierGateModal.jsx | Upgrade prompt — hardcodes "ELITE" ← 2.0 update            |
| frontend/src/components/Cards/TierStatusCard.jsx | Tier badge — hardcodes 3 tiers ← 2.0 update                |
| frontend/src/components/Layout/Navbar.jsx        | Nav links, logout, freelancer context reads                |
| frontend/src/pages/FreelancerAdmin.jsx           | Main dashboard — slots, services, addons, branding         |
| frontend/src/pages/Settings.jsx                  | Account settings, subscription management                  |
| frontend/src/pages/Booking.jsx                   | Public booking page — service, slot, form                  |
| frontend/src/pages/CRM.jsx                       | Appointment management — filter, cancel, CSV export        |
| frontend/src/pages/Auth.jsx                      | Login + signup — sets all localStorage keys on login       |
| frontend/src/pages/FreelancerAnalytics.jsx       | Analytics charts — gated by RequireTier in App.jsx         |
| frontend/src/pages/UpgradeSuccess.jsx            | Post-payment — uses rawAxios for session verify            |
| frontend/src/pages/Upgrade.jsx                   | Upgrade page — 3 tiers, 2.0 redesign needed                |
| frontend/src/pages/Home.jsx                      | Marketing home — minimal, links to auth + why              |
| frontend/src/pages/WhySlotMe.jsx                 | Marketing page — ⚠️ hardcodes old pricing copy             |

---

## Security Issues

### 🔴 Critical — fix before 2.0 launch:

- auth_routes.py: `reset_serializer = URLSafeTimedSerializer("RESET_SECRET_KEY")`
  Hardcoded string — anyone with source access can forge password reset tokens.
  Fix: `URLSafeTimedSerializer(os.getenv("SECRET_KEY"))`

### 🟡 Medium:

- Two serializers, two env vars, neither validated at startup:
  - jwt_utils.py → FLASK_SECRET_KEY (falls back to "changeme")
  - booking_routes.py → SECRET_KEY
- middleware.py uses freelancer.tier not get_effective_tier()
- /freelancer-info returns raw f.tier
- /freelancer/reply: raw `tier != "elite"` check instead of @require_tier
- /freelancer/delete-confirm + /freelancer/delete-finalize NOT in middleware open_prefixes
- /s3/upload-url has NO auth decorator — any caller with a valid freelancer_id can get a presigned S3 URL

### 🟡 Tech Debt:

- booking_routes.py duplicate import block at top
- config.py: name_pool[], ip_attempts, dead JWT constants
- stripe_utils.py PRICE_TO_TIER has sandbox IDs (not live)
- FreelancerAdmin.jsx writes localStorage directly (use setStoredFreelancer())
- UpgradeSuccess.jsx writes localStorage directly (use setStoredFreelancer())
- Booking.jsx duplicate "missing-freelancer" error block — renders same JSX twice
- customer_timezone sent at booking but not stored in Appointment model
- rate_limit.py: dead file — ip_attempts duplicated from config.py
- token_utils.py: broken stub, unused
- validatePassword.js (frontend) must stay in sync with is_strong_password() in auth_routes.py — same 5 rules, duplicated
- UpgradeSuccess.jsx has dead commented-out TODO block at bottom of file

---

## Timezone System

### US-only whitelist (7 timezones) — defined in BOTH:

- `backend/utils/timezone_utils.py` → US_TIMEZONES dict
- `frontend/src/utils/timezoneHelpers.js` → US_TIMEZONES dict
  Both must stay in sync if adding new timezones.

### Backend (timezone_utils.py) key functions:

- `utc_to_timezone(utc_dt, target_tz)` → converts UTC datetime to target tz
- `timezone_to_utc(local_dt, source_tz)` → converts local to UTC
- `format_time_for_display(utc_dt, display_tz)` → "Tue, Oct 14 — 2:30 PM (EDT)"
- `get_freelancer_timezone(freelancer)` → safe getter with fallback
- `validate_timezone(tz_name)` → checks against US_TIMEZONES whitelist
- Used by: email_service.py (appointment confirmations)

### Frontend (timezoneHelpers.js) key functions:

- `getUserTimezone()` → reads localStorage("user_timezone"), falls back to browser
  ⚠️ This is the CUSTOMER's timezone (for Booking.jsx), not the freelancer's
- `isSlotInPast(slot, freelancerTimezone)` → compares slot UTC to now in target tz
- `isSlotOnDate(slot, selectedDate, timezone)` → compares slot UTC to calendar date
- `formatSlotTimeParts(slot, freelancerTimezone)` → {formattedTime, abbreviation}
- `formatSlotDate(slot, freelancerTimezone)` → "Wed, Oct 14"
- Internal: `parseSlotToUTCDateTime(slot)` → tries time_24h first, then time_12h fallback
- Used by: Booking.jsx, FreelancerAdmin.jsx, CRM.jsx

### Slot timezone rules:

- TimeSlot.timezone frozen at creation = freelancer.timezone at that moment
- Appointment.freelancer_timezone frozen at booking time
- All DB times stored as UTC; displayed in frozen timezone
- Self-healing: get_public_time_slots auto-fixes NULL timezone slots

---

## Onboarding System

### Backend: backend/routes/onboarding_routes.py

- GET /onboarding/status → returns { completed, steps_completed }
- POST /onboarding/mark-step/<id> → marks step 1-7 complete
- POST /onboarding/dismiss → sets onboarding_completed = True
- All routes require JWT auth (not public)
- Uses flag_modified() to force SQLAlchemy to detect JSON dict changes

### 7 onboarding steps (from seed + admin logic):

1-6: Setup tasks (branding, services, slots, etc.)
7: Copy booking link (marked from FreelancerAdmin.jsx via axios.post("/onboarding/mark-step/7"))

### DB fields on Freelancer:

- onboarding_completed: Boolean
- onboarding_steps_completed: JSON dict {"step1": true, "step7": true, ...}

### Frontend: OnboardingBanner component in FreelancerAdmin.jsx

- Checks steps_completed, shows progress, allows dismissal
- onJumpTo() scrolls to accordion section by ID with glow effect

---

## Freelancer Routes — Full Inventory (freelancer_routes.py)

### Public (no auth):

- GET /freelancer/slots/<id> → booking page time slots
- GET /freelancer/public-info/<id> → public profile data
- GET /freelancers/<id> → profile page data
- GET /freelancer/questions/<id> → custom booking questions
- GET /freelancer/addons/<id> → enabled add-ons for customers
- GET /<custom_url> → custom URL redirect

### Authenticated:

- GET /freelancer-info → full profile ← returns raw tier BUG
- GET /freelancer/me → minimal (Settings.jsx only)
- PATCH /freelancer/branding → profile fields update
- PATCH /freelancer/account → email, password, phone, custom_url
- DELETE /freelancer/account → immediate delete (legacy)
- GET/POST/PATCH/DELETE /freelancer/services → service CRUD
- GET /freelancer/analytics → @require_tier("analytics")
- POST /freelancer/priority-support → @require_tier("priority_support")
- POST /freelancer/reply → raw `tier != "elite"` ← BUG
- GET/PATCH /freelancer/questions → custom questions CRUD
- GET/POST/PATCH/DELETE /freelancer/addons → add-on CRUD (inline tier gate)
- POST /freelancer/batch-slots-v2 → bulk slot creation
- POST /freelancer/delete-initiate → step 1: verify + send email
- GET /freelancer/delete-confirm/<token> → step 2 ← needs middleware whitelist
- POST /freelancer/delete-finalize/<token> → step 3 ← needs middleware whitelist

### Add-on inline tier gate (freelancer_routes.py — NOT features.py):

- free: 0 add-ons (hard block)
- pro: max 5 add-ons
- elite: unlimited
- 2.0: free=0, pro=unlimited (remove elite branch)

---

## CRM.jsx — Notable Details

- canExport = `tier === "pro" || tier === "elite"` ← hardcoded, needs 2.0 update
- Upgrade pill links to `/upgrade#elite?need=pro` ← needs #elite → #pro update
- availableDates = dates WITH appointments (opposite of Booking.jsx green dates)
- Uses timezoneHelpers for slot time formatting
- Timezone filter, service filter, status filter, time-of-day filter
- cancelAppointmentById(id) is the correct cancel pattern (accepts ID directly)
- crm_show_filters persisted to localStorage

---

## Frontend — UI Components with Elite References (2.0 update needed)

### TierGateModal.jsx:

- Button: "Upgrade to ELITE" → "Upgrade to PRO"
- Link hash: #elite → #pro

### TierStatusCard.jsx:

- tierDisplay/colorClass: remove elite entry (metallic-elite CSS class)
- onClick: navigates to /upgrade#elite → /upgrade#pro

### FreelancerAdmin.jsx:

- Add-on counter: "Upgrade to ELITE for unlimited" → remove message
- onTierBlocked toast: /upgrade#elite → fix hash

### CRM.jsx:

- canExport: remove `|| tier === "elite"` → pro only
- Upgrade pill href: #elite → #pro

### Navbar.jsx:

- "Priority Support" link: 2.0 decision needed (remove or move to pro)

### WhySlotMe.jsx:

- Features grid text: "Pro ($20/mo) and Elite ($40/mo) tiers" → update copy

### Settings.jsx:

- Already conditioned on `tier !== "free"` ✅ no change needed

---

## LocalStorage Keys (frontend)

| Key                      | Set by                                  | Used by                       |
| ------------------------ | --------------------------------------- | ----------------------------- |
| access_token             | Login (Auth.jsx), axiosInstance refresh | axiosInstance, all API calls  |
| refresh_token            | Login (Auth.jsx)                        | axiosInstance on 401          |
| freelancer_id            | Login (Auth.jsx)                        | Navbar (fallback)             |
| freelancer_logged_in     | Login (Auth.jsx)                        | Navbar (show/hide links)      |
| freelancer               | FreelancerAdmin, UpgradeSuccess         | FreelancerContext on mount    |
| dev_access_token         | Dev login                               | axiosInstance (dev routes)    |
| dev_logged_in            | Dev login                               | Navbar                        |
| admin_selected_date      | FreelancerAdmin date picker             | FreelancerAdmin               |
| admin_show_filters       | FreelancerAdmin filter toggle           | FreelancerAdmin               |
| date_sync_enabled        | FreelancerAdmin sync toggle             | FreelancerAdmin               |
| slot_tab                 | FreelancerAdmin slot tab                | FreelancerAdmin               |
| last_booking_time        | Booking.jsx on submit                   | Booking.jsx cooldown (90s)    |
| user_timezone            | timezoneHelpers.js                      | Booking.jsx (customer tz)     |
| crm_show_filters         | CRM.jsx filter toggle                   | CRM.jsx                       |
| onboarding_step6_visited | Booking.jsx (onboarding)                | Booking.jsx back-button logic |
| onboarding_completed     | Dev/local                               | Booking.jsx onboarding banner |

Note: Auth.jsx clears dev_logged_in + dev_access_token on freelancer login (cross-mode cleanup).

clearFreelancer() removes: freelancer, access_token, refresh_token,
freelancer_logged_in, freelancer_id, freelancerDetails_updated, client_id

⚠️ Inconsistency: FreelancerAdmin.jsx and UpgradeSuccess.jsx write localStorage directly.
Standardize on setStoredFreelancer().

---

## Booking Flow (complete)

### Public (customer):

1. POST /book → Appointment(pending), 15min confirmation email
2. GET /confirm-booking/<token> → validate, check slot + time hasn't passed
3. Confirmed → is_booked=True, inherited blocks marked, emails to both parties
4. Redirect → /booking-confirmed?appointment_id=X

### Internal (freelancer from CRM):

- POST /appointments/internal → straight to confirmed, no email step

### Cancellation:

- Customer: UUID cancel_token (never expires) → GET redirect → POST execute
- Freelancer: PATCH /appointments/<id> {status: "cancelled"}
- Both: clear_inherited_blocks() + cancellation emails to both

### Anti-abuse:

- Honeypot "website" field
- IP rate limit: 2/3min dev, 2/10min prod — backend via config.ip_attempts
- Client cooldown: 90s via localStorage("last_booking_time") — separate from backend
- Max 3 bookings per email per day per freelancer
- Duplicate slot detection
- Slot freshness re-fetch on submit (race condition protection)

### Booking.jsx notable details:

- Phone REQUIRED at booking ✅ Twilio fully unblocked
- customer_timezone sent in payload but NOT stored (silently dropped)
  → Add Appointment.customer_timezone col in 2.0 for customer-tz reminders
- getUserTimezone() detects customer's browser timezone (not freelancer's)
- Duplicate "missing-freelancer" 404 block — harmless dead code
- timezoneHelpers.js: isSlotInPast(), isSlotOnDate(), formatSlotTimeParts()

---

## Auth Flow

### Login: POST /auth

- 5 attempts/min per IP (in-memory dict, resets on server restart)
- Requires email_confirmed=True
- Returns: access_token + refresh_token + freelancer_id
- Sets localStorage: access_token, refresh_token, freelancer_id, freelancer_logged_in
- Also clears dev_logged_in + dev_access_token if present (cross-mode cleanup)

### Serializer map:

| Use case        | File           | Secret                | Salt              | Expiry |
| --------------- | -------------- | --------------------- | ----------------- | ------ |
| Email verify    | jwt_utils.py   | FLASK_SECRET_KEY      | "email-confirm"   | 1hr    |
| Password reset  | auth_routes.py | "RESET_SECRET_KEY" ⚠️ | "password-reset"  | 1hr    |
| Email change    | jwt_utils.py   | FLASK_SECRET_KEY      | "email-change"    | 1hr    |
| Booking confirm | booking_routes | SECRET_KEY            | "booking-confirm" | 15min  |

---

## Email System

### Architecture:

- email_utils.py = raw SMTP (Brevo creds, smtplib)
- email_service.py = business logic → calls email_utils
- All from: "SlotMe Support <support@slotme.xyz>"

### email_service.py:

1. send_booking_confirmation_email(appointment) → customer
2. send_freelancer_booking_notification(appointment) → freelancer
3. send_freelancer_cancellation_notification(appointment) → freelancer
4. send_customer_cancellation_confirmation(appointment, cancelled_by) → customer
5. send_delete_confirmation_email(freelancer, token) → freelancer
6. send_html_email(to, subject, html) → generic HTML sender

### email_utils.py:

1. send_branded_customer_reply(subject, body, email) ← PRIMARY WORKHORSE
2. send_priority_support_ticket(subject, body, sender_email)
3. send_feedback_submission(to, subject, body)
4. send_verification_email(to_email, token)
5. send_password_reset_email(to_email, token)
6. send_email_change_confirmation(to_email, token)

### 2.0 add to email_service.py:

- send_appointment_reminder(appointment, hours_before)

---

## Background Jobs (daemon threads — no APScheduler, no n8n)

### Pattern:

```python
def start_X_loop():
    def run():
        with app.app_context():
            while True:
                do_work()
                time.sleep(INTERVAL)
    threading.Thread(target=run, daemon=True).start()
```

### Existing: purge_old_pending() every 120s

- Cancels Appointment(status="pending") older than 10min, frees slot

### 2.0 reminder job build order:

1. DB migration: add reminder_sent (Bool), reminder_sent_at (DateTime),
   sms_reminder_sent (Bool) to Appointment
2. Add send_appointment_reminder() to email_service.py
3. Add start_reminder_loop() to app.py (every 3600s)
4. Query: confirmed, date=tomorrow, reminder_sent=False
5. Email all tiers → reminder_sent=True
6. SMS if freelancer.tier == "pro" via Twilio → sms_reminder_sent=True

---

## Gunicorn / Production Notes

- Config: backend/gunicorn.conf.py
- 3 workers, sync class, 120s timeout, 1000 max_requests with 50 jitter
- preload_app=True — app loaded ONCE in master process, then forked to workers
  ⚠️ Daemon threads (purge_old_pending, future reminder loop) only run in master
  Workers do NOT inherit daemon threads — this is correct and expected behavior
- graceful_timeout=30s, keepalive=5s

---

## Stripe System

### Webhook registered TWICE — verify which is live in Stripe dashboard:

- /webhook (app.add_url_rule)
- /stripe/webhook (Blueprint)

### 5 webhook events:

1. checkout.session.completed → upgrade tier, cancel old sub
2. customer.subscription.updated → sync all state
3. invoice.payment_failed → immediate downgrade to free
4. invoice.payment_succeeded → restore access
5. customer.subscription.deleted → full cleanup → free

### PRICE_TO_TIER — appears in THREE places, all must be updated for 2.0:

- stripe_routes.py webhook handler (inline) ← SOURCE OF TRUTH
- stripe_routes.py sync_subscription route (inline, duplicated)
- stripe_utils.py (sandbox IDs, stale)

```python
# Current live prices:
PRICE_TO_TIER = {
    "price_1Ra4Q7Cao129FRPLhW781Pum": "pro",    # $5/mo live
    "price_1Ra4SSCao129FRPLofSSMdhl": "elite",   # $10/mo live
    # 2.0: add new $20/mo price ID, remove elite
}
```

### Trial period:

- 30 days hardcoded in create_checkout_session: `trial_period_days: 30`
- Confirmed: no credit card required during trial (Stripe handles this)

### check_session_status route:

- No auth decorator — intentional (user may have expired JWT after Stripe checkout)
- Issues fresh access_token + refresh_token post-payment
- Used by UpgradeSuccess.jsx via rawAxios (not axiosInstance)

### Subscription cancellation:

- cancel_at_period_end=True — user keeps access until period/trial ends
- Full cleanup only fires on customer.subscription.deleted webhook
- Old subscription cancelled immediately when new checkout completes (via metadata.old_subscription_id)

---

## Database — Model Notes

### Freelancer

- tier: "free"|"pro"|"elite" — ALWAYS use get_effective_tier()
- phone: personal/private | business_phone: public-facing
- contact_email: separate from login email
- booking_instructions: JSON array
- location: String | business_address: String (public-facing)
- public_slug: 12-char random alphanumeric (all users)
- custom_url: freelancer-chosen vanity URL (unique, nullable)
- onboarding_completed: Boolean
- onboarding_step: Integer (legacy, keep alongside JSON dict)
- onboarding_steps_completed: JSON dict {"step1": true, ...}
- early_access: Boolean (flag for early users, used in seeding)
- show_footer_navbar: Boolean (UI preference)

### Freelancer — Stripe subscription fields (already in DB):

- stripe_customer_id: Stripe customer ID
- stripe_subscription_id: active subscription ID
- stripe_price_id: which price/plan they're on
- subscription_status: "trialing"|"active"|"past_due"|"canceled" etc
- cancel_at_period_end: Boolean — scheduled to cancel but still active
- current_period_end: DateTime — when billing period ends
- trial_end: DateTime — when trial ends

### Freelancer — Stripe Connect fields (NOT YET IN DB — add for 2.0):

- stripe_account_id: String, nullable — Connect account ID
- stripe_onboarded: Boolean, default=False — completed Connect onboarding
- stripe_deposit_enabled: Boolean, default=False — accepting deposits

### User (customers — no auth)

- phone column ✅ Twilio-ready, no migration needed

### Appointment

- cancel_token: plain UUID (no expiry — by design)
- freelancer_timezone: frozen at booking time
- ⚠️ MISSING for 2.0 — add via raw SQL migration (no Alembic):
  ALTER TABLE appointments ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;
  ALTER TABLE appointments ADD COLUMN reminder_sent_at TIMESTAMP;
  ALTER TABLE appointments ADD COLUMN sms_reminder_sent BOOLEAN DEFAULT FALSE;
  ALTER TABLE appointments ADD COLUMN customer_timezone VARCHAR(50);

### TimeSlot

- timezone frozen at creation
- Self-healing NULL timezone in get_public_time_slots

### ServiceAddon

- Tied to freelancer, not to a specific Service
- Inline tier limits: free=0, pro=5, elite=unlimited
- 2.0: free=0, pro=unlimited

---

## Feature Gating — Mismatch to Fix in 2.0

### backend/utils/features.py (enforced server-side):

custom_url → ["pro","elite"], csv_export → ["pro","elite"],
analytics → ["pro","elite"], scan → ["elite"], priority_support → ["elite"]

### frontend/src/utils/tiers.js FEATURES_BY_TIER (UI only):

verifiedBadge, emailReminders, smsReminders, addons, calendarSync, earlyAccess
→ Add smsReminders to features.py in 2.0

### 2.0 tiers.js changes:

- emailReminders: "pro" → "free"
- smsReminders: stays "pro" (add to features.py)
- Remove: earlyAccess, calendarSync, scan

---

## middleware.py — Security Perimeter

Add new public routes to BOTH lists:

### Backend open_prefixes (middleware.py) — ⚠️ MISSING:

/freelancer/delete-confirm, /freelancer/delete-finalize

### Frontend publicEndpoints (axiosInstance.js) — ⚠️ MISSING:

/auth/change-email/confirm

---

## requirements.txt

### Currently installed:

Flask, Flask-Cors, Flask-JWT-Extended, Flask-Limiter, Flask-SQLAlchemy,
psycopg2-binary, gunicorn, python-dotenv, itsdangerous, Werkzeug,
stripe, boto3, bleach, pytz

### Add for 2.0:

- twilio (SMS reminders)

---

## Demo Accounts (DO NOT TOUCH IN PRODUCTION)

| Name  | Email                  | Tier  | Notes                              |
| ----- | ---------------------- | ----- | ---------------------------------- |
| Emily | emily@sattutorpro.com  | free  | is_verified=False, SAT tutor (EDT) |
| Malik | malik@fadekings.com    | pro   | Barber, Chicago (CDT)              |
| Jade  | jade@glowskinbar.com   | elite | Esthetician, LA (PDT) → pro in 2.0 |
| Monty | tamsirrilley@gmail.com | elite | Tom's real account → pro in 2.0    |

seed_helpers.py + dev_routes.py: seed_freelancer() manages all demo data.
/dev/update-demos: production-safe endpoint to refresh demo accounts only.
/dev/seed-all: full wipe + reseed (dev only, blocked in production).

---

## Environment Variables

### Backend (backend/.env):

STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET,
BREVO_SMTP_LOGIN, BREVO_SMTP_PASSWORD, BREVO_SMTP_SERVER, BREVO_SMTP_PORT,
SUPPORT_EMAIL, JWT_SECRET_KEY, SECRET_KEY, FLASK_SECRET_KEY,
FRONTEND_URL, BACKEND_ORIGIN, DATABASE_URL, FLASK_ENV,
EMILY_PASSWORD, MALIK_PASSWORD, JADE_PASSWORD, MONTY_PASSWORD, DEV_PASSWORD

⚠️ SECRET_KEY ≠ FLASK_SECRET_KEY — both must be set, neither validated at startup

### Frontend:

VITE_API_BASE (frontend/.env + frontend/.env.production)

### Add for 2.0:

TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

---

## Coding Rules

- Surgical changes only — no full rewrites unless explicitly asked
- Format: "🔁 Replace this / ✅ With this" with exact file path
- Use get_effective_tier(freelancer) — NEVER freelancer.tier directly
- New public route → add to middleware.py open_prefixes AND axiosInstance.js publicEndpoints
- New email function → email_service.py, send_branded_customer_reply as send layer
- New background job → daemon thread in app.py (purge_old_pending pattern)
- localStorage writes → use setStoredFreelancer(), not direct setItem
- Timezone functions → timezoneHelpers.js on FE, timezone_utils.py on BE
- Password rules → validatePassword.js and is_strong_password() must stay in sync
- Smoke test locally before every prod deploy
- Semantic versioning on every commit (vX.Y.Z)
- Never modify demo accounts in production
- Add-on tier gates: inline in freelancer_routes.py — update that + FreelancerAdmin.jsx display
