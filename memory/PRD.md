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

## Backlog
- Background location tracking (requires a native build)
- P1: PDF/print and share for invoices; offline sales queue; purchase returns; reports by date range
- P2: route planning and map tracking; notifications center; currencies and price lists; backups; AI assistant
