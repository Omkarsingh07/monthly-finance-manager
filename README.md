# Monthly Finance Manager

A full-stack personal finance and monthly SIP investment management application built with Express.js, React 19, Vite, and Google Sheets API as the persistent storage layer.

## Features

- **Google Sheets Persistence**: Google Spreadsheet is the live, authoritative source of truth.
- **Stock-Wise SIP Allocation**: Configurable monthly investment budget with custom percentage weightages across ETFs and Stocks.
- **Pending Balance Accumulation**: Unspent allocation carries forward on a per-asset basis across months.
- **Whole-Share Purchases**: Floor calculation prevents fractional unit purchases.
- **Low-Latency Architecture**: Batched Google Sheets API reads (`batchGet`), HTTPS keep-alive connection pooling, O(1) CORS matching, and in-flight request deduplication.
- **Session Authentication**: Stateless JWT session authentication via secure, HTTP-only cookies.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS |
| **Routing** | React Router v7 |
| **Forms & Validation** | React Hook Form + Zod |
| **Backend** | Node.js + Express + TypeScript |
| **Storage** | Google Sheets API (`googleapis` v4) |

## Setup & Running Locally

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Test Suites

```bash
cd backend
npm run test:auth       # Security & Auth Suite
npm run test:sheets     # Google Sheets Connectivity & Schema Suite
npm run test:plan       # Investment Plan Persistence Suite
npm run test:monthly    # Monthly SIP & Accumulation Suite
npm run test:dashboard  # Dashboard Metric Calculation Suite
npm run test:e2e        # Full Multi-Month E2E Acceptance Suite
```
