# OD Tracking Application (On-Duty Management System)

A full-stack, enterprise-grade On-Duty (OD) Management and Academic Performance Tracking System built for educational institutions (e.g., Rajalakshmi Engineering College). The system streamlines OD request submissions, multi-level approvals, attendance and CAT marks tracking, and certificate verification.

---

## 🚀 Key Features

### 👨‍🎓 Student Portal
- **Submit OD Requests:** Apply for Internal/External On-Duty requests with event details, dates, and documentation upload (OD letters).
- **Track OD Status:** Real-time multi-stage approval tracking (Mentor ➔ Class Incharge ➔ HOD).
- **Certificate Upload & Verification:** Upload event participation/completion certificates for approved ODs.
- **Academic Performance & Attendance:** View semester CAT (Continuous Assessment Test) marks, subject-wise attendance percentages, and overall OD credit statistics.
- **OD History:** Filter and view past OD applications with status badges and download options.

### 👨‍🏫 Faculty & Mentor Portal
- **Mentor Review:** Review and initial sign-off on assigned mentees' OD applications.
- **Class Incharge Review:** Comprehensive class-level OD approval workflow, student attendance validation, and CAT marks breakdown.
- **Academic Monitoring:** View detailed academic performance profiles for assigned students before approving OD requests.

### 🏛️ HOD (Head of Department) Portal
- **Final OD Approval:** Department-wide OD request management with bulk approval/rejection capabilities.
- **Certificate Verification:** Inspect and verify student event certificates submitted post-OD.
- **Department Analytics & Reports:** View departmental attendance metrics and export official OD records to Excel (`.xlsx`).

---

## 🛠️ Technology Stack

- **Frontend:**
  - **Framework:** React 19 + TypeScript
  - **Build Tool:** Vite 8
  - **Styling:** TailwindCSS v4 + Custom Modern UI CSS Tokens
  - **Icons:** Lucide React
  - **Routing:** React Router DOM v7
- **Backend:**
  - **Framework:** Python 3.10+ / Flask 3.0+
  - **CORS Management:** Flask-Cors
  - **Export Engine:** openpyxl (Excel Report Generation)
  - **Production Server:** Gunicorn WSGI Server
- **Database:**
  - **Database:** MongoDB Atlas (Cloud) / Local MongoDB instance
  - **Driver:** PyMongo + dnspython (with automatic local fallback mode support)

---

## 📁 Project Structure

```text
OD_TRACKER/
├── backend/                  # Python Flask REST API Backend
│   ├── database/             # MongoDB database connection & initial seeders
│   ├── models/               # Data schemas & business logic models
│   ├── routes/               # API Endpoints (Auth, OD Requests, Mentor, Class Incharge, HOD, Academic)
│   ├── services/             # Utility services (PDF parsing, file handling)
│   ├── uploads/              # Runtime uploaded files (OD letters, Certificates)
│   ├── app.py                # Main Flask application entry point
│   ├── config.py             # Server configuration & environment variables loader
│   ├── requirements.txt      # Python dependencies
│   └── seed_od_data.py       # Initial database seeder script
├── public/                   # Public static assets
├── src/                      # React Frontend Source
│   ├── assets/               # Branding assets & images
│   ├── components/           # Reusable UI components (Navbar, Modals, Badges, Cards)
│   ├── data/                 # Mock & fallback datasets
│   ├── layouts/              # Main layout wrappers
│   ├── pages/                # Views (Dashboard, ApplyOD, ODRequests, CATMarks, Attendance, etc.)
│   ├── services/             # API client services & HTTP utilities
│   ├── types/                # TypeScript interface & type definitions
│   ├── App.tsx               # Primary React component & Router setup
│   ├── index.css             # Design tokens & Global Tailwind utilities
│   └── main.tsx              # React DOM render entry point
├── .env.example              # Sample environment variables template
├── .gitignore                # Git ignore configuration
├── package.json              # Frontend npm dependencies & scripts
├── vite.config.ts            # Vite bundler configuration
└── README.md                 # Project documentation
```

---

## ⚙️ Setup and Installation

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **Python:** v3.10 or higher
- **MongoDB:** Local MongoDB or MongoDB Atlas connection string

---

### 1️⃣ Environment Variables Setup

1. Copy `.env.example` to `.env` in the root directory:
   ```bash
   cp .env.example .env
   ```
2. Configure the required environment variables inside `.env`:
   ```env
   # Database Connection
   MONGO_URI=mongodb://127.0.0.1:27017/od_tracking
   MONGO_DB_NAME=od_tracking

   # Flask Secret Key
   SECRET_KEY=your_secure_random_secret_key

   # Server Settings
   FLASK_ENV=development
   PORT=5000
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

   # Frontend API Base URL (Leave empty in dev for Vite proxy)
   VITE_API_BASE_URL=
   ```

---

### 2️⃣ Backend Setup (Python Flask)

1. Navigate to the `backend` directory (or use project root with virtualenv):
   ```bash
   # Create a virtual environment
   python -m venv .venv

   # Activate virtual environment
   # On Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source .venv/bin/activate

   # Install dependencies
   pip install -r backend/requirements.txt
   ```

2. Seed initial sample data (optional but recommended for development):
   ```bash
   python backend/seed_od_data.py
   ```

3. Start the backend server:
   ```bash
   python backend/app.py
   ```
   *The backend server will start on `http://localhost:5000`.*

---

### 3️⃣ Frontend Setup (React + Vite)

1. Install frontend dependencies:
   ```bash
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend application will run on `http://localhost:5173`.*

---

## 🤝 Team Git & GitHub Collaboration Workflow

To ensure smooth collaboration across all team members working on this project:

### 🔄 Daily Workflow
1. **Pull latest changes before starting work:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create a Feature Branch for major changes:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Stage and Commit changes in small, logical chunks:**
   ```bash
   git add .
   git commit -m "Add feature description"
   ```

4. **Push the Feature Branch to GitHub:**
   ```bash
   git push -u origin feature/your-feature-name
   ```

5. **Merge to Main:**
   Create a Pull Request (PR) on GitHub to review and merge into `main`.

6. **Quick Pushing directly to `main` (for minor updates):**
   ```bash
   git pull origin main
   git add .
   git commit -m "Describe your update"
   git push origin main
   ```

---

## ⚠️ Important Collaboration Rules

- 🛑 **NEVER force push to main:** Do NOT use `git push --force` or `git reset --hard` on shared branches.
- 🔒 **NEVER commit secrets:** Do not commit `.env`, passwords, secret keys, or DB credentials. Keep secrets strictly in `.env`.
- 📁 **NEVER commit runtime user uploads:** Uploaded PDF letters or certificates in `backend/uploads/` are ignored by Git. Keep `.gitkeep` files intact.
- 🔄 **Always pull before pushing:** Always pull the latest `main` branch before starting new work or pushing changes to avoid merge conflicts.
