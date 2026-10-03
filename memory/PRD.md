# Smart System — Mobile (Expo) PRD

## Original problem
"reBuild it as mobile app": rebuild the uploaded Lovable/Supabase web app "Smart System" as an Expo mobile app. It is an Arabic RTL sales and distribution ERP.
User choices: FastAPI + MongoDB backend, all roles (Developer, Owner, Accountant, Field Agent), Emergent Google sign-in, no AI assistant, Arabic RTL only.

## Architecture
- Backend: /app/backend/server.py (FastAPI, Motor). Auth uses Emergent Google with a Bearer session_token stored in user_sessions.
- Frontend: expo-router. Root gate in app/_layout.tsx sends users to login / activate / blocked / dev / owner / dist / acct.
- Role tab groups use src/RoleTabs.tsx (NativeTabs on iOS 26+, JS Tabs elsewhere). Screens live in src/screens. UI kit is src/ui.tsx. Cairo font, moss-green theme.

## Implemented (2026-06)
- Google login, plus activation by license code (LIC-) or employee code (EMP-), plus a 14-day self-service trial
- Developer: stats, create/delete licenses, manage orgs (extend, suspend, reactivate)
- Owner: KPIs (sales, profit, stock value, debts), low-stock alerts, agent performance, products CRUD, purchases (stock in), customers, employee invites, deliveries from warehouse to a distributor
- Distributor: own stock, new sale invoice (cash or credit), collections, sales returns, history
- Accountant: overview, invoices/collections/returns, debts with collect, customers, customer statement
- Blocked screen for suspended or expired orgs

## Iteration 2 (2026-06)
- PDF invoices via expo-print, built from HTML that includes the logo and org contact/tax info. Distributors can share (native), print, or send a WhatsApp text to the customer's phone
- Org profile and logo upload (Emergent Object Storage), managed from Owner > الإدارة > ملف المؤسسة
- Offline-first agent transactions: src/offline.ts keeps a GET cache plus a persistent queue; src/offlineActions.ts applies changes locally first. The server de-duplicates by client id. A SyncBanner shows pending and failed items
- Reports screen (/reports): day/week/month bar chart and table for owner and accountant
- Upgrade plans: the developer creates plans, sets payment settings, and approves or rejects requests (Developer > الاشتراكات). The owner uses /upgrade (also reachable from the blocked screen)
- GPS: foreground location tracking for agents, with location attached to every transaction. Owner sees agent locations under الإدارة > تتبع GPS (map on native, list on web)

## Iteration 3 (2026-06)
- Route planner: in Owner > الإدارة > خطوط السير, the owner picks a distributor, a date and customers, then orders them by hand or by nearest. The distributor sees today's route on the home screen with directions and visited/skipped marks, which work offline
- Restock requests: distributors send a one-tap request for low items (works offline). The owner fulfills a request, which creates a delivery, or rejects it, from the deliveries segment
- Customer price lists: customer types with a price per product. The server locks prices on sales and returns, and the invoice form shows them read-only
- Customer GPS location: saved from the customer form, or filled in automatically from the first sale with GPS
- Yearly plans: the developer sets yearly_price. The upgrade screen has a monthly/yearly toggle and a "save X%" badge. A yearly approval adds 365 days

## Iteration 4 (2026-06), in progress
- Supabase was REVERTED at the user's request. The backend is back on MongoDB (Motor, MONGO_URL/DB_NAME). All Supabase data was copied back into Mongo, then every Supabase table was dropped. pgstore.py and the migration scripts were deleted, along with SUPABASE_DB_URL and asyncpg. The pre-restore Mongo data was saved to backend/mongo_backup_before_restore.json
- Missing original features: backend done and screens wired; testing_agent NOT run yet
  - Delivery confirm/reject by distributor; invoice discounts (%/fixed) and voiding
  - Purchase returns, stock movements and price history
  - Notifications center; accountant alerts; finance/discount analytics
  - Route KPIs and route history; org currency and exchange rate
  - JSON backup export; org deletion requests (dev approves); account deletion
  - Terms/privacy consent gate and legal screens; help FAQ
  - Developer monitoring, app version management and update gate
- Push notifications (Emergent managed): playbook received, NOT implemented. Waiting for the user's google-services.json
- The user's Expo Go shows a 403 "Region Restricted" page, a platform region block rather than a code issue

## Iteration 4 testing (MongoDB restore)
- Full regression: 130/130 backend tests pass (run serially with `pytest tests -n 0`). All 4 role dashboards render cleanly on web
- tests/conftest.py removes leftover fixed-id idempotency docs. The outdated test_smart_system.py was removed

## Iteration 5 (2026-06)
- Invoice/collection/purchase lists (src/screens/Sales.tsx) gained search (customer, invoice no, product, supplier), summary cards (total and operation count), and a custom from/to date range ("مخصص", YYYY-MM-DD)
- The accountant now has a separate bottom tab for التحصيلات (app/acct/collections.tsx)
- Segments row no longer shrinks when the screen content overflows (ui.tsx)

## Iteration 6 (2026-06)
- Tracker: tapping a distributor (Owner > الإدارة > تتبع GPS) opens a full-screen Google Map (AgentMapSheet). It uses the official embed with no API key: a WebView on native and an iframe on web. It has map/satellite/hybrid views, chips to jump to today's visits, and buttons to open in Google Maps or get directions
- Date picker: DateField is a tap-to-pick Arabic calendar (weeks start Saturday, min/max supported). It replaces the typed dates in the Sales custom range
- Leaderboard: GET /api/stats/leaderboard?month=YYYY-MM (STAFF) ranks distributors by sales (excludes voided). A Leaderboard card on the owner/accountant home has month switching, a sales/collections toggle, and medals
- Customer statement: StatementActions adds a PDF (expo-print, share sheet on native, print on web), print, and a WhatsApp summary inside the statement sheet
- Guided tour: GuidedTour runs a first-run walkthrough per role (storage key tour_done_<role>). Tab descriptions come from the role _layout files. It can be replayed from حسابي > الجولة التعريفية

## Backlog
- Background location tracking (requires a native build)
- P1: PDF/print and share for invoices; offline sales queue; purchase returns; reports by date range
- P2: route planning and map tracking; notifications center; currencies and price lists; backups; AI assistant
