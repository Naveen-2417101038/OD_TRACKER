# OD Tracking Application (On-Duty Management System)

A full-stack, enterprise-grade On-Duty (OD) Management and Academic Performance Tracking System built for educational institutions (e.g., Rajalakshmi Engineering College). The system streamlines OD request submissions, multi-level approvals, attendance and CAT marks tracking, and certificate verification.

---

## 📁 Project Directory Structure

The application is structured into two main independent directories: **`frontend`** (React + Vite SPA) and **`backend`** (Python Flask REST API + MongoDB Atlas).

```text
OD_TRACKER/
├── frontend/                 # React 19 + TypeScript Frontend Single Page Application
│   ├── public/               # Static assets & favicon
│   ├── src/                  # Application source code
│   │   ├── assets/           # UI Assets & images
│   │   ├── components/       # Reusable React components (Navbar, Modals, Badges, Cards)
│   │   ├── layouts/          # Layout wrappers
│   │   ├── pages/            # View pages (Dashboards, OD Requests, CAT Marks, Attendance, etc.)
│   │   ├── services/         # API services & HTTP client (`api.ts`)
│   │   ├── types/            # TypeScript type declarations
│   │   ├── App.tsx           # Main application entry point & router
│   │   ├── main.tsx          # React DOM render entry
│   │   └── index.css         # Styling system & Tailwind CSS v4 setup
│   ├── index.html            # Vite HTML template
│   ├── package.json          # Node dependencies and build scripts
│   ├── tsconfig.json         # TypeScript configuration
│   ├── vite.config.ts        # Vite configuration & dev proxy rules
│   └── .env.example          # Frontend environment variables template
│
├── backend/                  # Python Flask REST API Backend
│   ├── database/             # Database drivers (MongoDB Atlas / PostgreSQL) & seed scripts
│   ├── models/               # Data schemas & domain business logic
│   ├── routes/               # API route controllers (Auth, Mentor, Class Incharge, HOD, Academic, Admin)
│   ├── services/             # Background services (Audit, Deadlines, Excel parsing/exports)
│   ├── uploads/              # Runtime uploaded documents (OD letters, Certificates)
│   ├── tests/                # Backend unit and integration test suites
│   ├── app.py                # Main Flask application entry point
│   ├── config.py             # Server configuration & environment variables loader
│   ├── seed_od_data.py       # Database seeder script
│   ├── requirements.txt      # Python dependencies list
│   └── .env.example          # Backend environment variables template
│
├── .gitignore                # Global git ignore configuration
├── CONVERSATION_SUMMARY.md   # Architectural & workflow summary
└── README.md                 # Primary project documentation
```

---

## 🛠️ Technology Stack

- **Frontend (`/frontend`):**
  - **Framework:** React 19 + TypeScript
  - **Build Tool:** Vite 8
  - **Styling:** TailwindCSS v4 + Custom Modern UI CSS Tokens
  - **Icons:** Lucide React
  - **Routing:** React Router DOM v7

- **Backend (`/backend`):**
  - **Framework:** Python 3.10+ / Flask 3.0+
  - **CORS Management:** Flask-Cors
  - **Excel Engine:** openpyxl (Academic data import & HOD export)
  - **WSGI Server:** Gunicorn (Production deployment)
  - **Database:** MongoDB Atlas (Cloud) / Local MongoDB with PyMongo driver

---

## 🚀 Local Development Setup

### 1. Backend Setup (`/backend`)

```bash
cd backend

# Create & activate a Python virtual environment
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Create your local environment file
cp .env.example .env

# Run backend test suite to verify connection and logic
python test_auth.py
python test_class_incharge.py

# Start Flask Backend server (Runs on http://localhost:5000)
python app.py
```

### 2. Frontend Setup (`/frontend`)

```bash
cd frontend

# Install Node modules
npm install

# Create frontend environment template
cp .env.example .env.local

# Run Vite local dev server (Runs on http://localhost:5173)
npm run dev
```

---

## 📦 Production Deployment Guide

### A. Frontend Deployment (Vercel / Netlify / Cloudflare Pages)

1. Set the **Root Directory** in your deployment provider settings to: `frontend`
2. Set the **Build Command** to: `npm run build`
3. Set the **Output Directory** to: `dist`
4. Set the **Environment Variable**:
   - `VITE_API_BASE_URL`: `https://your-backend-domain.onrender.com` (Your deployed live backend API URL)

### B. Backend Deployment (Render / Railway / Heroku / AWS EC2 / Docker)

1. Set the **Root Directory** in your deployment provider settings to: `backend`
2. Set the **Build Command** to: `pip install -r requirements.txt`
3. Set the **Start Command** to: `gunicorn app:app --bind 0.0.0.0:$PORT`
4. Set the **Environment Variables**:
   - `MONGO_URI`: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/`
   - `MONGO_DB_NAME`: `od_tracking`
   - `SECRET_KEY`: `<your-random-32-byte-hex-string>`
   - `CORS_ORIGINS`: `https://your-frontend-app.vercel.app`

---

## 👥 Collaboration & Git Workflow

### Adding Teammates to GitHub
1. Open GitHub Repository: [https://github.com/Sharjin-Jino/OD_TRACKER](https://github.com/Sharjin-Jino/OD_TRACKER)
2. Go to **Settings ➔ Collaborators ➔ Add people**.
3. Invite team members by username or email.

### Pushing Changes cleanly
```bash
# 1. Pull latest main changes
git pull origin main

# 2. Stage changes
git add .

# 3. Commit with a meaningful description
git commit -m "Organized codebase into frontend and backend directories for deployment"

# 4. Push changes to GitHub
git push origin main
```
