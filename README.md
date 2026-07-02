# 🚧 SadakSathi सडक साथी

### Road Quality Reporting System for Nepal 🇳🇵

> "Report it. Map it. Fix it."

## 🎯 Problem

Nepal loses billions annually due to poor road conditions. Citizens had no easy way to report road damage to authorities. The process involved calling ward offices and filling paper forms.

## ✅ Solution

SadakSathi lets citizens report road problems in under 30 seconds with AI-powered damage detection and a real-time municipality dashboard.

## ⚡ Features

- 📍 Report road damage with GPS location
- 🤖 AI image analysis (Google Gemini Vision)
- 🗺️ Interactive heatmap of Kathmandu
- 👍 Community upvoting (one per user)
- 🏛️ Municipality admin dashboard
- 📊 Export reports as CSV and PDF
- 🔔 Real-time notifications
- 🏆 Citizen leaderboard with badges
- 🇳🇵 Nepali language support
- 📡 Offline mode for rural Nepal
- 🗑️ Delete your own reports
- ⚙️ Full settings page

## 🛠️ Tech Stack

| Frontend | Backend | AI | Database |
|---|---|---|---|
| React + Vite | Python FastAPI | Gemini Vision | PostgreSQL |
| Tailwind CSS | JWT Auth | Google AI | SQLAlchemy |
| Leaflet.js | RESTful API | | |

## 🚀 Run Locally

### Backend
```bash
cd sadaksathi/backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd sadaksathi/frontend
npm install
npm run dev
```

### Test Accounts
| Role | Phone | Password |
|---|---|---|
| Admin | 9800000000 | admin123 |

## 🌍 Live Demo

https://sadaksathi.vercel.app

## 👨‍💻 Developer

Built by Prakash Bhandari 
Computer Engineering Student - 6th Semester  
[Your College Name], Nepal

---

Made with ❤️ for Nepal 🇳🇵
