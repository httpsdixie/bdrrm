# Barangay DRRM — Smart GIS System
**Barangay Linao, Ormoc City**

A web-based Geographic Information System and emergency management dashboard for Barangay Linao's BDRRMC officers and field responders.

---

## Tech Stack
| Layer    | Tech |
|----------|------|
| Frontend | HTML + CSS + Vanilla JS + Leaflet.js + Lucide Icons |
| Backend  | FastAPI (Python 3.13) |
| Database | Supabase (PostgreSQL) |
| Auth     | JWT (HS256) |

---

## Modules
- **GIS Map** — interactive Leaflet map with incident and evacuation center markers
- **Incident Tracking** — report, update status, filter, validate/invalidate, photo upload
- **Evacuation Centers** — capacity monitoring, demographics, Before/During/After phase tracking, historical log
- **Resource Logistics** — inventory management, dispatch, return tracking, ownership tiers
- **Reports** — incident & resource summary reports, CSV export/import, incident history
- **Emergency Directory** — centralized hotlines for public and officers
- **User Accounts** — admin-only page to add, edit, reset passwords, and delete DRRM personnel accounts
- **Public Map** — citizen-facing GIS view with weather widget and emergency hotlines
- **Dashboard** — live stat cards, recent incident feed, risk analysis, quick actions

---

## Setup

### 1. Supabase
- Go to [supabase.com](https://supabase.com) and create a project
- SQL Editor → paste and run `supabase/schema.sql`
- Go to Project Settings → API and copy your URL, anon key, and service role key

### 2. Environment variables
Edit `.env` in the project root:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
JWT_SECRET=any_long_random_string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 3. Python virtual environment
```bash
# From project root
python3 -m venv venv
venv/bin/pip install -r backend/requirements.txt
```

### 4. Start the backend
```bash
cd backend
../venv/bin/uvicorn main:app --reload
```
- API runs at: http://127.0.0.1:8000
- Interactive API docs: http://127.0.0.1:8000/docs

### 5. Open the frontend
Open `frontend/index.html` in VS Code with **Live Server** extension.

---

## Default Login
| Field    | Value           |
|----------|-----------------|
| Username | `admin`         |
| Password | `@Admin2026!`   |

---

## Project Structure
```
barangay-drrm/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── requirements.txt
│   ├── auth/
│   │   ├── jwt_handler.py
│   │   └── dependencies.py
│   └── routes/
│       ├── auth_routes.py          (login, register, user management)
│       ├── incident_routes.py
│       ├── evacuation_routes.py
│       ├── evac_tracking_routes.py
│       ├── resource_routes.py
│       ├── dashboard_routes.py
│       ├── map_routes.py
│       ├── reports_routes.py
│       ├── risk_routes.py
│       └── directory_routes.py
├── frontend/
│   ├── index.html          (login)
│   ├── dashboard.html
│   ├── map.html
│   ├── incidents.html
│   ├── evacuation.html
│   ├── resources.html
│   ├── reports.html
│   ├── directory.html
│   ├── accounts.html       (user management — admin only)
│   ├── public.html         (citizen public safety map)
│   └── assets/
│       ├── css/style.css
│       └── js/
│           ├── api.js
│           ├── auth.js
│           ├── dashboard.js
│           ├── incidents.js
│           ├── evacuation.js
│           ├── resources.js
│           ├── map.js
│           ├── map-manage.js
│           ├── reports.js
│           ├── directory.js
│           └── weather.js
├── supabase/
│   └── schema.sql
└── .env
```
