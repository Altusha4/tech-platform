# TechPlatform — Advanced NoSQL Social Web Application + SRE Observability

TechPlatform is a high-performance social media ecosystem designed for sharing technological innovations. This project serves as a comprehensive implementation of **Advanced NoSQL Database** principles, featuring complex data modeling, multi-stage aggregation pipelines, and secure RESTful API design — now fully containerized with a **production-ready SRE observability stack**.

Developed by a team of 2 students for the **Advanced Databases (NoSQL)** and **Introduction to SRE** courses.

---

## Technologies Used

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)

---

## Project Overview

**TechPlatform** is an innovative social network for knowledge sharing in the IT sphere.
- **Objective:** To create a scalable platform with a "Smart Feed" based on user interests, leveraging the flexibility of NoSQL data models.
- **Core Functionality:** Article/video publishing, subscription systems, real-time likes/comments, and a business intelligence dashboard for category analytics.
- **SRE Layer:** Full observability stack with Prometheus metrics, Grafana dashboards, and automated alerting.

---

## System Architecture

The application follows a **Decoupled Client-Server Architecture**:
- **Frontend**: A responsive Apple-inspired UI interacting with the backend via asynchronous Fetch API calls, served by Nginx.
- **Backend**: A Stateless RESTful API built with Node.js and Express.
- **Database**: MongoDB Atlas utilized with optimized Mongoose schemas.
- **State Management**: Uses `localStorage` to maintain authentication tokens (JWT) and user preferences, ensuring low latency and reduced database load.
- **Observability**: Prometheus scrapes system metrics via Node Exporter. Grafana visualizes Golden Signals and SLO compliance in real-time.

---

## Getting Started

### Option 1 — Run with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/Altusha4/tech-platform.git
cd tech-platform

# Create .env file inside backend/
# MONGO_URI=your_mongodb_atlas_connection_string
# JWT_SECRET=your_secret_key
# PORT=3000

# Start all 5 services
docker-compose up -d --build
```

| Service | URL |
|---------|-----|
| TechPlatform App | http://localhost |
| Backend API | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:3000/api-docs |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

> Grafana login: `admin` / `admin123`

### Option 2 — Run Locally

```bash
cd backend
npm install
node server.js
# Open http://localhost:3000
```

---

## Database Schema Description

We utilized a combination of Embedded and Referenced models to demonstrate diverse NoSQL approaches:

### 1. Embedded Data Model
Used within the `Users` collection to store statistics:
- **Reasoning:** Statistical data (`postsCount`, `totalLikes`) is always needed when viewing a profile. Embedding data eliminates the need for additional JOIN operations.

### 2. Referenced Data Model
Used for relationships like `Content -> User` and `Comment -> Content`:
- **Reasoning:** These collections can grow indefinitely. Using references (`ObjectId`) prevents exceeding the 16MB document size limit.

---

## Project Structure

```text
TechPlatform/
│
├── Dockerfile.backend           # Node.js 20 Alpine container
├── Dockerfile.frontend          # Nginx 1.25 Alpine container
├── docker-compose.yml           # 5-service orchestration
├── nginx.conf                   # Reverse proxy + static file server
│
├── backend/
│   ├── models/                  # Mongoose schemas (Data Modeling)
│   │   ├── User.js              # User profile with embedded statistics and interest arrays
│   │   ├── Content.js           # Post model with referenced authors and like arrays
│   │   ├── Comment.js           # Discussion model referencing posts and users
│   │   ├── Notification.js      # Activity logs for social triggers (likes/follows/comments)
│   │   └── Follow.js            # Relational model for user-to-user connections
│   │
│   ├── routes/                  # REST API Endpoints (Business Logic)
│   │   ├── auth.js              # Registration, Login, and JWT generation
│   │   ├── content.js           # Post CRUD, like/unlike logic, and feed filtering
│   │   ├── comments.js          # Discussion logic and atomic post stat updates
│   │   ├── notifications.js     # Fetching activity logs and bulk "read" updates
│   │   └── users.js             # Profile management and interest updates
│   │
│   └── server.js                # Main entry point, Multer config, and Aggregation routes
│
├── public/                      # Frontend (Client-side)
│   ├── css/
│   │   └── style.css            # Apple-inspired UI design and animations
│   ├── js/
│   │   └── app.js               # Core API integration and feed rendering logic
│   ├── uploads/                 # Multimedia storage (Avatars, Images, Videos)
│   ├── index.html               # Main discovery feed (Smart Feed)
│   ├── profile.html             # User dashboard, bookmarks, and settings
│   ├── post.html                # Full-page content view and discussion area
│   ├── create-post.html         # Content editor (Create/Edit functionality)
│   ├── notifications.html       # Personal activity center
│   ├── login.html               # Authentication portal
│   └── register.html            # Onboarding with interest selection
│
├── monitoring/                  # SRE Observability Stack
│   ├── prometheus.yml           # Scrape configuration
│   ├── alert_rules.yml          # Warning + Critical alert rules
│   └── grafana/
│       ├── dashboards/          # Auto-provisioned Grafana dashboard JSON
│       └── provisioning/        # Datasource and dashboard provisioning config
│
├── .env                         # Secrets (MongoDB URI, JWT Secret) — not committed
├── package.json                 # Backend dependencies and scripts
└── README.md                    # Project documentation
```

---

## MongoDB Queries & Aggregation

### 1. Multi-Stage Aggregation Pipeline
Implemented in `/api/stats/categories` for real-time business analytics. This pipeline groups content by category, calculates engagement metrics, and formats the output for the frontend.

```javascript
Content.aggregate([
    // Stage 1: Group by category and calculate metrics
    { 
        $group: { 
            _id: "$category", 
            count: { $sum: 1 }, 
            avgLikes: { $avg: "$likes" } 
        } 
    },
    // Stage 2: Sort by the most popular categories
    { $sort: { count: -1 } },
    // Stage 3: Project final shape and round numerical values
    { 
        $project: { 
            category: "$_id", 
            count: 1, 
            avgLikes: { $round: ["$avgLikes", 1] }, 
            _id: 0 
        } 
    }
])
```

### 2. Advanced Update Operations
To maintain data integrity and performance, we utilize atomic MongoDB operators:
* **`$addToSet` / `$pull`**: Implemented in the Like system to ensure that User IDs are added or removed from the `likedBy` array without creating duplicates or requiring a read-before-write operation.
* **`$inc`**: Utilized for high-concurrency fields such as view counts, total likes, and comment counters. This avoids race conditions by performing the increment directly on the database server.

---

## API Documentation

| Method | Endpoint | Description | MongoDB Operator |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | User onboarding | `insertOne()` |
| **POST** | `/api/auth/login` | Authentication & JWT Generation | `findOne()` |
| **GET** | `/api/content` | Smart feed filtered by user interests | `.find().populate()` |
| **POST** | `/api/content` | Create new post | `insertOne()` |
| **DELETE** | `/api/content/:id` | Remove post and cascade cleanup | `deleteOne()` |
| **POST** | `/api/content/:id/like` | Atomic Like/Unlike toggle logic | `$addToSet` / `$pull` |
| **GET** | `/api/comments/:postId` | Retrieve post comments | `.populate()` |
| **POST** | `/api/comments` | Add comment and update stats | `$inc` |
| **GET** | `/api/notifications/:userId` | Personal alert stream | Referenced data |
| **PUT** | `/api/notifications/read` | Bulk status update for notifications | `$updateMany` |
| **GET** | `/api/stats/categories` | Analytics: Content grouping & engagement | `$group`, `$avg` |
| **GET** | `/api/users/mini-profile/:id` | Mini profile card data | `.select()` |

---

## Indexing and Optimization Strategy

To ensure high performance and low latency even with large data volumes, the following strategies were implemented:

* **Compound Index**: `contentSchema.index({ category: 1, createdAt: -1 })`. Optimizes the main feed query which filters by category and sorts by date, preventing in-memory sorts.
* **Text Index**: Applied to `title` and `preview` fields in the `Content` collection to enable efficient keyword-based global search without expensive `$regex` scans.
* **TTL Index**: Applied to `notifications` to automatically delete old alerts after 30 days — built-in data maintenance without manual scripts.
* **Unique Index**: Implemented in the `Follow` collection to enforce data integrity at the database level, preventing duplicate subscription documents.
* **Optimization**: Systematic use of `.lean()` in all GET requests. This returns plain JavaScript objects instead of heavy Mongoose Documents, significantly reducing memory overhead and CPU usage during serialization.

---

## SRE Observability Stack

### Service Level Objectives (SLOs)

| SLI | Metric | SLO Target | Monthly Error Budget |
|-----|--------|-----------|---------------------|
| Availability | CPU idle % | 99.5% | 216 minutes |
| DB Performance | Memory available % | 99.0% | 432 minutes |

**Error Budget Formula:**
Error Budget = (1 - SLO) × 43,200 minutes
SLO 99.5% → (1 - 0.995) × 43,200 = 216 minutes/month
SLO 99.0% → (1 - 0.990) × 43,200 = 432 minutes/month

### Golden Signals (Grafana Dashboard)

| Signal | Panel | PromQL |
|--------|-------|--------|
| **Latency** | CPU Load % | `(1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m]))) * 100` |
| **Traffic** | Network bytes/s | `rate(node_network_receive_bytes_total{device!~"lo"}[1m])` |
| **Errors** | Disk I/O errors/s | `rate(node_disk_read_errors_total[5m]) or vector(0)` |
| **Saturation** | Memory used | `node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes` |

### Alert Rules

| Alert | Condition | Severity | For |
|-------|-----------|----------|-----|
| HighCPUWarning | CPU busy > 70% | warning | 2m |
| HighCPUCritical | CPU busy > 90% | critical | 1m |
| LowMemoryWarning | Memory available < 20% | warning | 2m |
| LowMemoryCritical | Memory available < 5% | critical | 1m |

---

## Contribution of Each Student

**Tamerlan Khassenov — Backend & NoSQL Specialist:**
* Designed the core database architecture and Mongoose schemas.
* Implemented complex Aggregation Framework logic and the indexing strategy.
* Developed the secure REST API and JWT-based authentication system.

**Altynay Yertay — Frontend, Integration & SRE Specialist:**
* Created the responsive user interface (7 unique functional pages).
* Integrated the API using Fetch and managed persistent state via `localStorage`.
* Implemented the media management system (Multer file handling).
* Containerized the full stack with Docker and Docker Compose.
* Built the SRE observability stack: Prometheus, Grafana, Node Exporter.
* Defined SLOs, Error Budgets, and configured all alert rules.

---

**University:** Astana IT University  
**Group:** SE-2416  
**Courses:** Advanced Databases (NoSQL) · Introduction to SRE