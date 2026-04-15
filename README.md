# Asset Management & Ticketing System

A monolith-ready micro-module for tracking company assets, managing maintenance schedules, and resolving support tickets. Built with **Node.js**, **Express**, and **PostgreSQL**.

---

## Architecture

```
├── server.js                 ← Express entry point
├── config/db.js              ← PostgreSQL pool + schema init
├── services/dbService.js     ← Data Access Layer (all SQL lives here)
├── controllers/              ← Thin request handlers (validate → DAL → respond)
├── routes/                   ← Express routers + master ticketingModule.js
├── middleware/auth.js        ← JWT verification + RBAC
├── helpers/                  ← Audit logging & notification helpers
├── views/index.html          ← SPA entry point (served by Express)
├── public/ticketing/         ← Namespaced static assets (CSS, JS)
│   ├── css/                  ← Design system (variables, components, layout)
│   └── js/                   ← Frontend modules + SPA views
└── uploads/                  ← User-uploaded files
```

**Key Design Decisions:**
- All tables prefixed with `ts_` to avoid collisions in a shared database
- All API routes grouped under `/api/ticketing/` for clean monolith integration
- Static assets served from `/ticketing/` namespace to prevent CSS/JS collisions
- JWT-based auth (replaces header simulation) — swap middleware for monolith auth
- Data Access Layer (`dbService.js`) — controllers contain zero SQL

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 18.x  |
| PostgreSQL  | ≥ 14.x  |

---

## Setup & Run

### 1. Create the PostgreSQL Database

```sql
CREATE DATABASE asset_ticketing_db;
```

### 2. Seed Test Users

The system starts with empty tables. Insert test users to begin:

```sql
-- Connect to asset_ticketing_db first
\c asset_ticketing_db

-- Create departments
INSERT INTO ts_departments (name) VALUES ('IT Department'), ('Human Resources'), ('Finance'), ('Operations');

-- Create test users (no passwords — testing phase)
INSERT INTO ts_users (name, email, role, department_id) VALUES
    ('Admin User', 'admin@test.com', 'admin', 1),
    ('Manager User', 'manager@test.com', 'manager', 1),
    ('Staff User', 'staff@test.com', 'staff', 1);

-- Create asset categories
INSERT INTO ts_asset_categories (name, description) VALUES
    ('IT Equipment', 'Laptops, monitors, printers, networking gear'),
    ('Furniture', 'Desks, chairs, cabinets, shelves'),
    ('Vehicles', 'Company cars, vans, delivery vehicles'),
    ('Software Licenses', 'Operating systems, productivity suites');
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The app starts at **http://localhost:3000**.

---

## Authentication

### Login (Testing Phase)

This module uses a **simplified JWT login** for standalone testing. No password is required.

```bash
POST /api/ticketing/login
Content-Type: application/json

{ "email": "admin@test.com" }
```

**Response:**
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "name": "Admin User", "role": "admin", ... }
}
```

### Using the Token

All API endpoints require the JWT in the `Authorization` header:

```bash
GET /api/ticketing/assets
Authorization: Bearer eyJhbGciOi...
```

### Monolith Integration

When merging into the main app, replace `middleware/auth.js` with your monolith's authentication middleware. The `req.user` contract is:

```js
req.user = {
    id: Number,            // User ID
    name: String,          // Display name
    email: String,         // Email
    role: String,          // 'admin' | 'manager' | 'staff'
    departmentId: Number   // Department FK
};
```

---

## API Endpoints

All routes are prefixed with `/api/ticketing`.

| Method | Endpoint                        | Auth   | Description                    |
|--------|---------------------------------|--------|--------------------------------|
| POST   | `/login`                        | Public | JWT login (email only)         |
| GET    | `/assets`                       | All    | List assets (RBAC scoped)      |
| POST   | `/assets`                       | Admin  | Create asset                   |
| GET    | `/assets/:id`                   | All    | Asset detail                   |
| PUT    | `/assets/:id`                   | Admin  | Update asset                   |
| DELETE | `/assets/:id`                   | Admin  | Soft-delete asset              |
| POST   | `/assets/:id/assign`            | Admin, Manager | Assign asset           |
| POST   | `/assets/:id/unassign`          | Admin, Manager | Unassign asset         |
| GET    | `/assets/:id/history`           | All    | Asset change history           |
| GET    | `/assets/stats`                 | All    | Dashboard KPIs                 |
| GET    | `/assets/categories`            | All    | List categories                |
| POST   | `/assets/categories`            | Admin  | Create category                |
| GET    | `/tickets`                      | All    | List tickets (RBAC scoped)     |
| POST   | `/tickets`                      | All    | Create ticket                  |
| GET    | `/tickets/:id`                  | All    | Ticket detail + comments       |
| PUT    | `/tickets/:id`                  | All    | Update ticket                  |
| DELETE | `/tickets/:id`                  | Admin  | Delete ticket                  |
| POST   | `/tickets/:id/assign`           | Admin, Manager | Assign ticket          |
| POST   | `/tickets/:id/comments`         | All    | Add comment                    |
| GET    | `/tickets/stats`                | All    | Ticket statistics              |
| GET    | `/maintenance`                  | Admin, Manager | List schedules         |
| POST   | `/maintenance`                  | Admin, Manager | Create schedule        |
| PUT    | `/maintenance/:id/complete`     | Admin, Manager | Mark complete          |
| GET    | `/notifications`                | All    | User notifications             |
| GET    | `/notifications/unread-count`   | All    | Unread count                   |
| PUT    | `/notifications/read-all`       | All    | Mark all read                  |
| GET    | `/reports/asset-inventory`      | Admin, Manager | Asset inventory report |
| GET    | `/reports/ticket-summary`       | Admin, Manager | Ticket summary report  |
| POST   | `/reports/export`               | Admin, Manager | Export PDF/Excel       |
| GET    | `/audit-logs`                   | Admin  | System audit trail             |
| GET    | `/users`                        | All    | List users                     |
| GET    | `/users/departments`            | All    | List departments               |

---

## Roles & Permissions

| Feature                  | Admin | Manager | Staff |
|--------------------------|:-----:|:-------:|:-----:|
| View all assets          | ✅    | Dept    | Own   |
| Create/Edit/Delete assets| ✅    | ❌      | ❌    |
| Assign/Unassign assets   | ✅    | ✅      | ❌    |
| View all tickets         | ✅    | Dept    | Own   |
| Create tickets           | ✅    | ✅      | ✅    |
| Assign tickets           | ✅    | ✅      | ❌    |
| Maintenance schedules    | ✅    | ✅      | ❌    |
| Reports                  | ✅    | ✅      | ❌    |
| Audit logs               | ✅    | ❌      | ❌    |

---

## Database Tables

All tables are prefixed with `ts_` for namespace isolation:

| Table                     | Purpose                              |
|---------------------------|--------------------------------------|
| `ts_departments`          | Organization departments             |
| `ts_users`                | System users with roles              |
| `ts_asset_categories`     | Asset type classification            |
| `ts_assets`               | Company assets (soft-delete enabled) |
| `ts_asset_history`        | Asset change audit trail             |
| `ts_maintenance_schedules`| Preventive/repair maintenance        |
| `ts_tickets`              | Support/issue tickets                |
| `ts_ticket_comments`      | Ticket discussion threads            |
| `ts_notifications`        | In-app user notifications            |
| `ts_audit_logs`           | System-wide audit trail              |

---

## Environment Variables (Optional)

The defaults are hardcoded for development. Override with environment variables:

```
DB_HOST=localhost
DB_USER=postgres
DB_PASSWD=vinayai
DB_NAME=asset_ticketing_db
DB_PORT=5432
PORT=3000
```

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 4
- **Database:** PostgreSQL (via `pg`)
- **Auth:** JWT (`jsonwebtoken`)
- **Frontend:** Vanilla HTML/CSS/JS SPA (hash-based routing)
- **Reports:** ExcelJS + PDFKit
- **Fonts:** Inter (Google Fonts)
- **Charts:** Chart.js 4

---

## License

Internal use only.
