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

## 👥 How to Add Teammates to GitHub

As the repository owner (`Sharjin-Jino`), follow these steps to give team members push access:

1. Open your GitHub Repository: [https://github.com/Sharjin-Jino/OD_TRACKER](https://github.com/Sharjin-Jino/OD_TRACKER)
2. Go to **Settings** (tab at the top).
3. Select **Collaborators** under the *Access* section in the left sidebar.
4. Click **Add people**.
5. Enter your teammate's **GitHub Username** or **Email Address**.
6. Click **Add [username] to this repository**.
7. Teammates will receive an email invitation or can visit `https://github.com/Sharjin-Jino/OD_TRACKER/invitations` to accept the invite.

---

## 💻 How Teammates Set Up the Project on Their Computer

Once invited, each teammate should perform the following setup:

### Step 1: Clone the Repository
```bash
git clone https://github.com/Sharjin-Jino/OD_TRACKER.git
cd OD_TRACKER
```

### Step 2: Create Local Environment Configuration
```bash
# Copy template to create local .env
cp .env.example .env
```

### Step 3: Install Dependencies & Run

#### Backend Setup:
```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

pip install -r backend/requirements.txt
python backend/app.py
```

#### Frontend Setup:
```bash
npm install
npm run dev
```

---

## 🔄 How Teammates Push Their Changes & New Files to GitHub

When a teammate adds new files or updates existing code, follow these steps:

### Method A: Feature Branch Workflow (Recommended)

1. **Pull latest changes from main:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create a new branch for the task:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Add files and commit changes:**
   ```bash
   # Stage all new and modified files
   git add .

   # Verify what is staged (ensure .env and node_modules are ignored)
   git status

   # Commit with descriptive message
   git commit -m "Add feature-name and update student dashboard"
   ```

4. **Push the branch to GitHub:**
   ```bash
   git push -u origin feature/your-feature-name
   ```

5. **Merge on GitHub:**
   - Go to GitHub: [https://github.com/Sharjin-Jino/OD_TRACKER](https://github.com/Sharjin-Jino/OD_TRACKER)
   - Click **Compare & pull request**
   - Click **Create pull request** and merge into `main`.

---

### Method B: Direct Push to Main (For Quick Updates)

```bash
# 1. Always pull first to avoid conflicts
git pull origin main

# 2. Stage new/updated files
git add .

# 3. Commit changes
git commit -m "Update student profile page and fix backend route"

# 4. Push directly to main branch
git push origin main
```

---

## ⚠️ Important Collaboration Rules

- 🛑 **NEVER force push to main:** Do NOT use `git push --force` or `git reset --hard` on shared branches.
- 🔒 **NEVER commit secrets:** Do not commit `.env`, passwords, secret keys, or DB credentials. Keep secrets strictly in `.env`.
- 📁 **NEVER commit runtime user uploads:** Uploaded PDF letters or certificates in `backend/uploads/` are ignored by Git. Keep `.gitkeep` files intact.
- 🔄 **Always pull before pushing:** Always pull the latest `main` branch before starting new work or pushing changes to avoid merge conflicts.
