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

## Backlog
- P1: PDF/print and share for invoices; offline sales queue; purchase returns; reports by date range
- P2: route planning and map tracking; notifications center; currencies and price lists; backups; AI assistant
