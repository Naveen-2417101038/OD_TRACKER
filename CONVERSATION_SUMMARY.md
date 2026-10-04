# OD Tracking Application – Project Setup & Git Workflow Reference

> **Saved Conversation & Setup Reference**  
> *Generated on: October 4, 2026*  
> *Repository URL:* `https://github.com/Sharjin-Jino/OD_TRACKER.git`

---

## 📌 Executive Summary

This document captures the setup details, configurations, and Git workflow established for the **OD Tracking Application**.

- **Original Application Intact:** All frontend components, backend endpoints, database schemas, authentication systems, attendance tracking, CAT marks modules, certificate verification, and OD workflow logic remain exactly as built.
- **Git Repository Initialized:** Local repository initialized on `main` branch and linked to remote `origin` (`https://github.com/Sharjin-Jino/OD_TRACKER.git`).
- **Secret & File Safety:** Sensitive credentials (`.env`), Python virtual environment (`.venv/`), Node modules (`node_modules/`), runtime database (`od_tracking.db`), and user-uploaded files (`backend/uploads/`) are protected by `.gitignore`.

---

## 👥 1. How to Add Teammates to GitHub Repository

As the repository owner (`Sharjin-Jino`):

1. Open your GitHub repository: [https://github.com/Sharjin-Jino/OD_TRACKER](https://github.com/Sharjin-Jino/OD_TRACKER)
2. Click **Settings** (tab on top menu).
3. Select **Collaborators** from the left navigation sidebar.
4. Click **Add people**.
5. Type your teammate's **GitHub Username** or **Email Address**.
6. Click **Add [username] to this repository**.
7. Your teammate will receive an invitation email or can accept it directly at `https://github.com/Sharjin-Jino/OD_TRACKER/invitations`.

---

## 💻 2. Teammate First-Time Computer Setup

Once invited, your teammate should run these commands on their computer:

```bash
# 1. Clone the project from GitHub
git clone https://github.com/Sharjin-Jino/OD_TRACKER.git
cd OD_TRACKER

# 2. Create local .env file from template
cp .env.example .env

# 3. Setup Python Backend
python -m venv .venv
.venv\Scripts\Activate.ps1   # PowerShell on Windows
pip install -r backend/requirements.txt
python backend/app.py

# 4. Setup React Frontend
npm install
npm run dev
```

---

## 🔄 3. How Teammates Push Their Changes & New Files to GitHub

### Method A: Feature Branch Workflow (Recommended)
1. **Pull latest changes before starting:**
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Create a branch for your feature:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Add files and commit:**
   ```bash
   git add .
   git commit -m "Add new files and update feature"
   ```
4. **Push branch to GitHub:**
   ```bash
   git push -u origin feature/your-feature-name
   ```
5. **Merge on GitHub:** Go to GitHub and click **Compare & pull request** -> **Merge pull request**.

---

### Method B: Direct Push to Main (Quick Updates)
```bash
git pull origin main
git add .
git commit -m "Describe your changes"
git push origin main
```

---

## ⚠️ Collaboration Golden Rules

1. 🛑 **Never Force Push:** Do not run `git push --force` or `git reset --hard` on shared branches.
2. 🔒 **Never Commit Secrets:** Keep secret keys, database URIs, and passwords inside local `.env` only.
3. 📁 **Never Commit User Uploads:** Uploaded PDF certificates or letters under `backend/uploads/` are ignored by Git.
4. 🔄 **Pull Before Push:** Always run `git pull origin main` before pushing new work to avoid merge conflicts.
