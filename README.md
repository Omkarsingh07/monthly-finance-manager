# Monthly Finance Manager

A full-stack monthly investment tracking application with Google Sheets API as the persistent storage layer.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Routing | React Router v7 |
| Forms | React Hook Form + Zod |
| Backend | Node.js + Express + TypeScript |
| API | REST API |
| Storage | Google Sheets API (`googleapis`) |

## Project Structure

```
monthly-finance-manager/
├── frontend/   — React + Vite app (port 5173)
├── backend/    — Express API server (port 3001)
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 18+
- Google Cloud Service Account with Google Sheets API enabled
- A Google Spreadsheet shared with your Service Account email (Editor permissions)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and configure your Google Sheets credentials:
# - GOOGLE_SHEETS_SPREADSHEET_ID
# - GOOGLE_SERVICE_ACCOUNT_EMAIL
# - GOOGLE_PRIVATE_KEY
npm install

# Test Google Sheets connectivity and initialize tabs
npm run test:sheets

# Start backend dev server
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173  
Backend runs on http://localhost:3001  
API calls from frontend are proxied to backend via Vite dev-server proxy.

## Environment Variables

### backend/.env

| Variable | Description |
|----------|-------------|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | The ID of your Google Spreadsheet (found in sheet URL) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Service Account email |
| `GOOGLE_PRIVATE_KEY` | Google Service Account Private Key |
| `PORT` | Backend port (default: 3001) |
| `NODE_ENV` | `development` or `production` |

**Never commit `.env` files.** Only `.env.example` is tracked.
