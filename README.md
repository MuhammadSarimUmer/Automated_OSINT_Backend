# 🕵️‍♂️ Automated OSINT & Threat Intelligence Aggregator

A production-ready, backend-only Threat Intelligence platform built with **Node.js** and **MongoDB**. This system proactively monitors specific targets — domains, email addresses, and keywords — across the internet by cross-referencing them against external intelligence APIs. It autonomously detects data leaks, exposed credentials, and vulnerable infrastructure, then dispatches real-time alerts to administrators.

> **Designed for**: Security engineers, SOC analysts, and developers who need an autonomous, zero-maintenance threat-monitoring pipeline running 24/7 in the background.

---

## 📑 Table of Contents

1. [What is OSINT and How This System Does It](#-what-is-osint-and-how-this-system-does-it)
2. [System Architecture](#-system-architecture)
3. [Threat Detection Engine (Deep Dive)](#-threat-detection-engine-deep-dive)
4. [API Reference with Full Request/Response Examples](#-api-reference-with-full-requestresponse-examples)
5. [End-to-End OSINT Walkthrough](#-end-to-end-osint-walkthrough)
6. [Severity Classification Matrix](#-severity-classification-matrix)
7. [Alerting Engine](#-alerting-engine)
8. [Data Deduplication Logic](#-data-deduplication-logic)
9. [Security Architecture](#-security-architecture)
10. [Getting Started](#-getting-started)
11. [Environment Variables Reference](#-environment-variables-reference)
12. [Project Structure](#-project-structure)

---

## 🔍 What is OSINT and How This System Does It

**OSINT (Open-Source Intelligence)** is the practice of collecting and analyzing information from publicly available sources to identify security threats, data leaks, and infrastructure vulnerabilities — without any intrusive access or exploitation.

### The Problem This Solves

Every organization faces threats it can't see:
- A developer accidentally pushes an `.env` file containing database passwords to a public GitHub repo.
- A misconfigured server exposes a MongoDB port (27017) directly to the internet.
- A company's internal domain name appears in a public repository's source code, hinting at a credential leak.

This aggregator **automates the detection of exactly these scenarios** by acting as a continuous background watchdog.

### How the Intelligence Gathering Works — Step by Step

```
1. You register a "target" (a domain, keyword, or email) via the API
         ↓
2. The Node-Cron scheduler triggers the scanner every 6 hours
         ↓
3. Scanner Service queries GitHub's Search API (searching file contents)
   + queries Shodan's API (searching internet-exposed infrastructure)
         ↓
4. Results are parsed and evaluated against severity thresholds
         ↓
5. Threat matches are stored as Alert records in MongoDB
         ↓
6. HIGH / CRITICAL alerts trigger an immediate OAuth2 email to the admin
```

---

## 🏗️ System Architecture

The application is built on a **decoupled, asynchronous Service-Oriented Architecture (SOA)** to ensure high performance and resilience when querying rate-limited external APIs.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│                  (Postman / Any HTTP Client)                         │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTP Requests
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     EXPRESS API GATEWAY                              │
│          JWT Auth Middleware → Controllers → MongoDB                 │
└──────────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
┌─────────────────────────┐   ┌────────────────────────────────────────┐
│  BACKGROUND AUTOMATION  │   │        ALERTING ENGINE                 │
│                         │   │                                        │
│  Node-Cron (every 6h)   │   │  Threat Match? ──→ Generate Alert      │
│         ↓               │   │       ↓                                │
│  Scanner Services       │   │  HIGH/CRITICAL? ──→ Nodemailer OAuth2  │
│         ↓               │   │       ↓                                │
│  GitHub Search API      │   │  Admin Inbox receives email            │
│  Shodan Search API      │   └────────────────────────────────────────┘
└─────────────────────────┘
```

### Key Architectural Decisions

| Decision | Reason |
|---|---|
| Cron-based decoupled scanning | Prevents API scanning from blocking the main HTTP event loop |
| Service-Oriented Architecture | Each intelligence source (GitHub, Shodan) is an isolated, swappable service |
| MongoDB for alert storage | Schema flexibility accommodates diverse threat data shapes |
| JWT via cookies (stateless) | Scales horizontally without shared session state |
| OAuth2 over SMTP | More reliable, secure, and not subject to "less secure apps" restrictions |

---

## 🔬 Threat Detection Engine (Deep Dive)

### Scanner 1: Code & Credential Leaks via GitHub

**What it looks for:** Accidental commits of API keys, passwords, `.env` files, internal domain names, or proprietary code snippets to *public* GitHub repositories.

**API Query Used:**
```
GET https://api.github.com/search/code?q={targetValue}+in:file
```

The `in:file` parameter is critical — it **restricts the search to file contents only**, ignoring repository names, descriptions, or usernames. This dramatically reduces false positives.

**What constitutes a finding:**
- Your monitored keyword (e.g., `acme-internal`) appears inside any publicly accessible source file
- A monitored domain (e.g., `acme-corp.com`) is hardcoded in a config file
- A monitored email appears inside a `.env`, `.json`, or script file

**Severity assigned:** Always **HIGH** — the presence of internal identifiers in public code is a confirmed intelligence signal.

---

### Scanner 2: Infrastructure Vulnerabilities via Shodan

**What it looks for:** Internet-facing servers and infrastructure linked to your monitored domains, specifically checking for dangerous exposed ports.

**API Query Used:**
```
GET https://api.shodan.io/shodan/host/search?key={API_KEY}&query=hostname:{targetValue}
```

**What constitutes a finding:**
Shodan returns a list of IP addresses that resolve to your domain's hostname, along with all **open ports** detected on each IP.

The engine then applies a severity matrix:

#### Port-Based Severity Classification

| Open Port | Service | Severity | Why It's Dangerous |
|---|---|---|---|
| `27017` | MongoDB | **CRITICAL** | Direct database access with no auth layer in between |
| `3306` | MySQL/MariaDB | **CRITICAL** | Raw SQL database exposed to the internet |
| `21` | FTP | **CRITICAL** | Unencrypted file transfer — credentials sent in plaintext |
| `23` | Telnet | **CRITICAL** | Unencrypted remote shell — full command access in plaintext |
| `80` | HTTP | **MEDIUM** | Server is internet-facing (informational recon) |
| `443` | HTTPS | **MEDIUM** | Encrypted web traffic (informational, not inherently dangerous) |
| Any other port | Unknown | **MEDIUM** | Unexpected exposure, warrants investigation |

---

## 📡 API Reference with Full Request/Response Examples

All endpoints (except `/api/auth/register` and `/api/auth/login`) require a valid JWT cookie, set automatically upon login.

### Base URL
```
http://localhost:3000/api
```

---

### 🔐 Authentication

#### Register a New Admin User

```http
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Sarah Chen",
  "email": "sarah.chen@acmecorp.com",
  "password": "SecurePass@2024"
}
```

**Success Response (201):**
```json
{
  "status": "success",
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "64f3a1b2c3d4e5f6a7b8c9d0",
      "name": "Sarah Chen",
      "email": "sarah.chen@acmecorp.com",
      "createdAt": "2024-09-01T10:00:00.000Z"
    }
  }
}
```

---

#### Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "sarah.chen@acmecorp.com",
  "password": "SecurePass@2024"
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Logged in successfully",
  "data": {
    "user": {
      "_id": "64f3a1b2c3d4e5f6a7b8c9d0",
      "name": "Sarah Chen",
      "email": "sarah.chen@acmecorp.com"
    }
  }
}
```
> A `jwt` HttpOnly cookie is automatically set in the response headers. All subsequent requests will use this cookie for authentication.

---

### 🎯 Target Management

Targets are the **subjects of your OSINT monitoring**. They can be domains, emails, or keywords.

#### Create a Target (Register Something to Monitor)

```http
POST /api/targets
Content-Type: application/json
Cookie: jwt=<your_token>
```

**Request Body Schema:**
```json
{
  "value": "<string>",   // The domain, email, or keyword to monitor
  "type": "<string>"     // One of: "domain" | "email" | "keyword"
}
```

---

**Example 1 — Monitor a Corporate Domain:**
```json
{
  "value": "acme-corp.com",
  "type": "domain"
}
```
*What this triggers:*
- GitHub scanner searches all public files for `acme-corp.com in:file`
- Shodan scanner searches `hostname:acme-corp.com` for exposed infrastructure

**Success Response (201):**
```json
{
  "status": "success",
  "data": {
    "target": {
      "_id": "64f3b2c3d4e5f6a7b8c9d0e1",
      "value": "acme-corp.com",
      "type": "domain",
      "createdAt": "2024-09-01T10:05:00.000Z"
    }
  }
}
```

---

**Example 2 — Monitor a Corporate Email Address:**
```json
{
  "value": "admin@acme-corp.com",
  "type": "email"
}
```
*What this triggers:*
- GitHub scanner searches `admin@acme-corp.com in:file` — finds any repo where this email is hardcoded in configs, scripts, or leaked credential dumps

---

**Example 3 — Monitor an Internal Project Keyword:**
```json
{
  "value": "project-nighthawk-secret",
  "type": "keyword"
}
```
*What this triggers:*
- GitHub scanner searches `project-nighthawk-secret in:file` — if this keyword appears anywhere in a public repo's file content, it indicates a leak of internal documentation or code

---

**Example 4 — Monitor a Subdomain:**
```json
{
  "value": "api.acme-corp.com",
  "type": "domain"
}
```
*What this triggers:*
- Shodan checks if the API subdomain resolves to an IP with dangerous ports open (e.g., an accidentally public-facing dev server with port 27017 open)

---

#### Get All Registered Targets

```http
GET /api/targets
Cookie: jwt=<your_token>
```

**Response (200):**
```json
{
  "status": "success",
  "results": 3,
  "data": {
    "targets": [
      {
        "_id": "64f3b2c3d4e5f6a7b8c9d0e1",
        "value": "acme-corp.com",
        "type": "domain",
        "createdAt": "2024-09-01T10:05:00.000Z"
      },
      {
        "_id": "64f3b2c3d4e5f6a7b8c9d0e2",
        "value": "admin@acme-corp.com",
        "type": "email",
        "createdAt": "2024-09-01T10:07:00.000Z"
      },
      {
        "_id": "64f3b2c3d4e5f6a7b8c9d0e3",
        "value": "project-nighthawk-secret",
        "type": "keyword",
        "createdAt": "2024-09-01T10:09:00.000Z"
      }
    ]
  }
}
```

---

#### Delete a Target

```http
DELETE /api/targets/:id
Cookie: jwt=<your_token>
```

**Example:**
```http
DELETE /api/targets/64f3b2c3d4e5f6a7b8c9d0e1
```

**Response (204):** No content — target deleted, scanning will cease for this value.

---

### 🚨 Alert Management

Alerts are automatically generated by the scanner services. You do not create them manually — you only read and manage them.

#### Get All Alerts

```http
GET /api/alerts
Cookie: jwt=<your_token>
```

**Response (200):**
```json
{
  "status": "success",
  "results": 2,
  "data": {
    "alerts": [
      {
        "_id": "64f3c3d4e5f6a7b8c9d0e1f2",
        "target": {
          "_id": "64f3b2c3d4e5f6a7b8c9d0e1",
          "value": "acme-corp.com",
          "type": "domain"
        },
        "source": "shodan",
        "severity": "CRITICAL",
        "details": {
          "ip": "203.0.113.45",
          "ports": [80, 443, 27017],
          "hostnames": ["acme-corp.com"],
          "org": "AS12345 AcmeCorp Hosting LLC",
          "country": "US"
        },
        "message": "Host 203.0.113.45 linked to acme-corp.com exposes critical port 27017 (MongoDB)",
        "resolved": false,
        "createdAt": "2024-09-01T16:00:00.000Z"
      },
      {
        "_id": "64f3c3d4e5f6a7b8c9d0e1f3",
        "target": {
          "_id": "64f3b2c3d4e5f6a7b8c9d0e2",
          "value": "admin@acme-corp.com",
          "type": "email"
        },
        "source": "github",
        "severity": "HIGH",
        "details": {
          "repository": "some-user/infrastructure-notes",
          "file_path": "config/staging.env",
          "url": "https://github.com/some-user/infrastructure-notes/blob/main/config/staging.env",
          "match_context": "...DB_ADMIN=admin@acme-corp.com PASSWORD=hunter2..."
        },
        "message": "Target 'admin@acme-corp.com' found in public file: config/staging.env",
        "resolved": false,
        "createdAt": "2024-09-01T16:00:05.000Z"
      }
    ]
  }
}
```

---

#### Get Alerts Filtered by Severity

```http
GET /api/alerts?severity=CRITICAL
GET /api/alerts?severity=HIGH
GET /api/alerts?severity=MEDIUM
Cookie: jwt=<your_token>
```

---

#### Mark Alert as Resolved

```http
PATCH /api/alerts/:id/resolve
Cookie: jwt=<your_token>
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "alert": {
      "_id": "64f3c3d4e5f6a7b8c9d0e1f2",
      "resolved": true,
      "resolvedAt": "2024-09-02T09:30:00.000Z"
    }
  }
}
```

---

### 🔁 Manual Scan Trigger

While scans run automatically every 6 hours, you can force an immediate scan cycle:

```http
POST /api/scan/run
Cookie: jwt=<your_token>
```

**Request Body:** *(empty — scans all registered targets)*

**Response (200):**
```json
{
  "status": "success",
  "message": "Manual scan initiated for 3 target(s). Results will be stored as alerts.",
  "data": {
    "targets_queued": 3,
    "scan_id": "scan_20240901_160000"
  }
}
```

---

## 🧭 End-to-End OSINT Walkthrough

### Scenario: A Startup Monitoring Its Brand for Leaks

**Company:** NovaTech Labs  
**Concern:** They want to know if any internal code, credentials, or infrastructure details have accidentally become public.

#### Step 1 — Register & Login
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"DevOps Admin","email":"devops@novatech.io","password":"N0vaTech$ecure"}'

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"devops@novatech.io","password":"N0vaTech$ecure"}'
```

#### Step 2 — Register 4 Targets
```bash
# Primary domain
curl -X POST http://localhost:3000/api/targets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value":"novatech.io","type":"domain"}'

# Internal API subdomain
curl -X POST http://localhost:3000/api/targets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value":"api.novatech.io","type":"domain"}'

# Admin email
curl -X POST http://localhost:3000/api/targets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value":"admin@novatech.io","type":"email"}'

# Secret internal codename
curl -X POST http://localhost:3000/api/targets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"value":"nova-internal-v2-alpha","type":"keyword"}'
```

#### Step 3 — What Happens in the Background (6 hours later)

The cron job fires and the scanner performs:

| Target | Scanner | Query Sent | Finding |
|---|---|---|---|
| `novatech.io` | Shodan | `hostname:novatech.io` | IP `198.51.100.12` found with ports 80, 443 open → **MEDIUM** |
| `api.novatech.io` | Shodan | `hostname:api.novatech.io` | IP `198.51.100.99` found with ports 3306, 443 open → **CRITICAL** |
| `admin@novatech.io` | GitHub | `admin@novatech.io in:file` | Found in `ex-contractor/deploy-scripts` repo → **HIGH** |
| `nova-internal-v2-alpha` | GitHub | `nova-internal-v2-alpha in:file` | Found in `anonymous-user/random-dump` repo → **HIGH** |

#### Step 4 — Alerts Generated & Email Dispatched

- Admin receives an immediate email about the **CRITICAL** alert (exposed MySQL port)
- Admin receives an immediate email about both **HIGH** alerts (GitHub leaks)
- **MEDIUM** alert is stored in DB silently for review

---

## 📊 Severity Classification Matrix

| Severity | Trigger Condition | Auto-Email | Example |
|---|---|---|---|
| **CRITICAL** | Shodan finds port 27017, 3306, 21, or 23 open | ✅ Yes | MongoDB exposed at `db.acme-corp.com:27017` |
| **HIGH** | GitHub finds target value inside any public file | ✅ Yes | `admin@acme.com` found in `leaked-configs/prod.env` |
| **MEDIUM** | Shodan finds host but only standard ports (80/443) | ❌ No | `acme-corp.com` maps to an IP serving HTTP/HTTPS |
| **LOW** | *(Reserved for future expansion)* | ❌ No | — |

---

## 📧 Alerting Engine

### Why OAuth2 Instead of SMTP Password?

Standard SMTP authentication with a password is fragile — Google has deprecated "less secure app" access. This system uses **Google OAuth2** with a refresh token, which:

- Generates short-lived access tokens automatically
- Is not affected by 2FA enforcement
- Follows enterprise security best practices
- Provides higher deliverability rates

### Email Alert Format

**Subject:** `[CRITICAL] Threat Detected for Target: api.novatech.io`

**Body:**
```
A new threat has been detected by your OSINT Aggregator.

TARGET:   api.novatech.io
SOURCE:   Shodan Infrastructure Scanner
SEVERITY: CRITICAL
TIME:     2024-09-01 16:00:00 UTC

DETAILS:
IP Address : 198.51.100.99
Open Ports : 443, 3306
Organization: AS67890 NovaTech Hosting
Country    : US

MESSAGE:
Host 198.51.100.99 linked to api.novatech.io exposes critical
port 3306 (MySQL/MariaDB) to the public internet.

ACTION REQUIRED:
Immediately audit firewall rules for this IP and restrict
database port access to internal networks only.

---
This alert was generated automatically. Log in to your dashboard
to mark it as resolved once addressed.
```

---

## 🧠 Data Deduplication Logic

A persistent threat should not flood your inbox or database. The system implements **intelligent deduplication** before creating any alert record.

**Before inserting a new alert, the system checks:**

```javascript
// Pseudocode representation of the dedup query
const existingAlert = await Alert.findOne({
  target: targetId,
  source: scannerSource,       // "github" or "shodan"
  "details.url": findingUrl,   // For GitHub: exact file URL
  "details.ip": findingIp,     // For Shodan: exact IP address
  resolved: false
});

if (existingAlert) {
  // Update the `lastSeenAt` timestamp instead of creating a duplicate
  existingAlert.lastSeenAt = Date.now();
  await existingAlert.save();
} else {
  // New threat — create alert and potentially send email
  await Alert.create(newAlertData);
}
```

This means:
- **Same GitHub file** appearing across multiple scan cycles → 1 alert (updated timestamp)
- **Same exposed IP/port** persisting → 1 alert (updated timestamp)
- **New file** or **new IP** found → New alert created

---

## 🔒 Security Architecture

| Layer | Implementation | Purpose |
|---|---|---|
| **Authentication** | JWT stored in HttpOnly cookies | Prevents XSS token theft |
| **NoSQL Injection** | `express-mongo-sanitize` | Strips `$` and `.` operators from request inputs |
| **HTTP Headers** | `helmet` middleware | Sets CSP, HSTS, X-Frame-Options, etc. |
| **Rate Limiting** | *(Recommended: `express-rate-limit`)* | Prevents brute-force on auth endpoints |
| **Stateless Sessions** | JWT (no server-side sessions) | Horizontal scalability |
| **Email Auth** | Google OAuth2 refresh tokens | Avoids SMTP password exposure |
| **API Key Storage** | `.env` environment variables | Never committed to version control |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **MongoDB** v6+ (local or Atlas)
- GitHub Personal Access Token (free, needed for API rate limits)
- Shodan API Key (free tier available at shodan.io)
- Google Cloud Console project with OAuth2 credentials (for email alerts)

### 1. Clone & Install

```bash
git clone https://github.com/MuhammadSarimUmer/Automated_OSINT_Backend.git
cd Automated_OSINT_Backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# ── Server ──────────────────────────────────────────
PORT=3000

# ── Database ─────────────────────────────────────────
DB_URI=mongodb://localhost:27017/osint-aggregator

# ── Auth ─────────────────────────────────────────────
JWT_SECRET=replace_with_a_long_random_string_min_32_chars
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7

# ── External Intelligence APIs ────────────────────────
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHODAN_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ── OAuth2 Email (Google) ─────────────────────────────
EMAIL_USER=your_gmail@gmail.com
CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server starts at `http://localhost:3000`

### 4. Verify It's Running

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","message":"OSINT Aggregator running"}
```

### 5. First Scan

```bash
# Register, login, add a target, then trigger a scan
curl -X POST http://localhost:3000/api/scan/run -b cookies.txt
```

---

## ⚙️ Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: 3000) |
| `DB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWTs (min 32 chars) |
| `JWT_EXPIRES_IN` | No | JWT lifespan (default: 7d) |
| `GITHUB_TOKEN` | ✅ | GitHub PAT — enables authenticated API calls (5000 req/hr vs 60/hr unauthenticated) |
| `SHODAN_API_KEY` | ✅ | Shodan API key for infrastructure scanning |
| `EMAIL_USER` | ✅ | Gmail address used as sender for alerts |
| `CLIENT_ID` | ✅ | Google OAuth2 Client ID |
| `CLIENT_SECRET` | ✅ | Google OAuth2 Client Secret |
| `REFRESH_TOKEN` | ✅ | Google OAuth2 Refresh Token (long-lived) |

---

## 📁 Project Structure

```
osint-aggregator/
│
├── src/
│   ├── config/
│   │   └── db.js                  # MongoDB connection setup
│   │
│   ├── controllers/
│   │   ├── authController.js      # Register, login, logout
│   │   ├── targetController.js    # CRUD for monitored targets
│   │   └── alertController.js     # Read & resolve alerts
│   │
│   ├── middleware/
│   │   ├── auth.js                # JWT verification middleware
│   │   └── errorHandler.js        # Global error handler
│   │
│   ├── models/
│   │   ├── User.js                # User schema
│   │   ├── Target.js              # Target schema (domain/email/keyword)
│   │   └── Alert.js               # Alert schema with severity levels
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── targetRoutes.js
│   │   ├── alertRoutes.js
│   │   └── scanRoutes.js
│   │
│   ├── services/
│   │   ├── githubScanner.js       # GitHub Search API integration
│   │   ├── shodanScanner.js       # Shodan API integration
│   │   ├── alertService.js        # Alert creation + deduplication
│   │   └── emailService.js        # Nodemailer + Google OAuth2
│   │
│   └── utils/
│       └── scheduler.js           # Node-Cron job definition (every 6h)
│
├── app.js                         # Express app setup (middleware, routes)
├── server.js                      # Entry point (starts server + cron)
├── .env                           # Environment variables (not committed)
├── .env.example                   # Template for .env
├── .gitignore
└── package.json
```

---

## 🧪 Testing with Postman

Import the following collection to test all endpoints:

1. Set base URL: `http://localhost:3000/api`
2. Enable **"Send cookies"** in Postman settings
3. Run `POST /auth/login` first — the JWT cookie is set automatically
4. All subsequent requests will be authenticated via the cookie

**Recommended test sequence:**
```
1. POST  /auth/register      → Create admin account
2. POST  /auth/login         → Get JWT cookie
3. POST  /targets            → Add "yourdomain.com" (type: domain)
4. POST  /targets            → Add "admin@yourdomain.com" (type: email)
5. POST  /scan/run           → Trigger immediate scan
6. GET   /alerts             → View generated threat alerts
7. PATCH /alerts/:id/resolve → Mark an alert as handled
8. GET   /targets            → View all monitored targets
9. DELETE /targets/:id       → Remove a target
```

---

## ⚠️ Disclaimer

This tool is designed exclusively for **authorized security monitoring** of assets you own or have explicit written permission to monitor. Using this system to scan domains or infrastructure you do not own may violate the **Computer Fraud and Abuse Act (CFAA)**, GDPR, and equivalent laws in your jurisdiction.

The GitHub and Shodan APIs used here operate entirely on **publicly available information** and do not perform any intrusive or unauthorized access.

---

## 📄 License

MIT License — see `LICENSE` for details.

---

*Built with Node.js, Express, MongoDB, node-cron, Nodemailer, and the GitHub & Shodan APIs.*
