# TechPlatform — Advanced NoSQL Social Web Application

TechPlatform is a high-performance social media ecosystem designed for sharing technological innovations. This project serves as a comprehensive implementation of **Advanced NoSQL Database** principles, featuring complex data modeling, multi-stage aggregation pipelines, and secure RESTful API design.

Developed by a team of 2 students for the **Advanced Databases (NoSQL)** course.

---

## Technologies Used

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

---

## Project Overview
**TechPlatform** is an innovative social network for knowledge sharing in the IT sphere.
- **Objective:** To create a scalable platform with a "Smart Feed" based on user interests, leveraging the flexibility of NoSQL data models.
- **Core Functionality:** Article/video publishing, subscription systems, real-time likes/comments, and a business intelligence dashboard for category analytics.

---

## System Architecture

The application follows a **Decoupled Client-Server Architecture**:
- **Frontend**: A responsive Apple-inspired UI interacting with the backend via asynchronous Fetch API calls.
- **Backend**: A Stateless RESTful API built with Node.js and Express.
- **Database**: MongoDB Atlas utilized with optimized Mongoose schemas.
- **State Management**: Uses `localStorage` to maintain authentication tokens (JWT) and user preferences, ensuring low latency and reduced database load.



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
├── backend/
│   ├── models/            # Mongoose schemas (Data Modeling)
│   │   ├── User.js          # User profile with embedded statistics and interest arrays
│   │   ├── Content.js       # Post model with referenced authors and like arrays
│   │   ├── Comment.js       # Discussion model referencing posts and users
│   │   ├── Notification.js  # Activity logs for social triggers (likes/follows/comments)
│   │   └── Follow.js        # Relational model for user-to-user connections
│   │
│   ├── routes/            # REST API Endpoints (Business Logic)
│   │   ├── auth.js          # Registration, Login, and JWT generation
│   │   ├── content.js       # Post CRUD, like/unlike logic, and feed filtering
│   │   ├── comments.js      # Discussion logic and atomic post stat updates
│   │   ├── notifications.js # Fetching activity logs and bulk "read" updates
│   │   └── users.js         # Profile management and interest updates
│   │
│   └── server.js            # Main entry point, Multer config, and Aggregation routes
│
├── public/                # Frontend (Client-side)
│   ├── css/
│   │   └── style.css        # Apple-inspired UI design and animations
│   ├── js/
│   │   └── app.js           # Core API integration and feed rendering logic
│   ├── uploads/             # Multimedia storage (Avatars, Images, Videos)
│   ├── index.html           # Main discovery feed (Smart Feed)
│   ├── profile.html         # User dashboard, bookmarks, and settings
│   ├── post.html            # Full-page content view and discussion area
│   ├── create-post.html     # Content editor (Create/Edit functionality)
│   ├── notifications.html   # Personal activity center
│   ├── login.html           # Authentication portal
│   └── register.html        # Onboarding with interest selection
│
├── .env                     # Secrets (MongoDB URI, JWT Secret)
├── package.json             # Backend dependencies and scripts
└── README.md                # Project documentation
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
| **POST** | `/api/auth/login` | Authentication & JWT Generation | `findOne()` |
| **GET** | `/api/content` | Smart feed filtered by user interests | `.find().populate()` |
| **POST** | `/api/content/:id/like` | Atomic Like/Unlike toggle logic | `$addToSet` / `$pull` |
| **GET** | `/api/stats/categories` | Analytics: Content grouping & engagement | `$group`, `$avg` |
| **PUT** | `/api/notifications/read` | Bulk status update for notifications | `$updateMany` |

---

## Indexing and Optimization Strategy

To ensure high performance and low latency even with large data volumes, the following strategies were implemented:

* **Compound Index**: `userSchema.index({ interests: 1, role: 1 })`. This index drastically accelerates feed generation by allowing the engine to filter by multiple interest tags and user roles simultaneously.
* **Unique Index**: Implemented in the `Follow` collection to enforce data integrity at the database level, preventing duplicate subscription documents.
* **Text Index**: Applied to the `title` field in the `Content` collection to enable efficient keyword-based global search across all publications.
* **Optimization**: Systematic use of `.lean()` in all GET requests. This returns plain JavaScript objects instead of heavy Mongoose Documents, significantly reducing memory overhead and CPU usage during serialization.

---

## Contribution of Each Student

**Tamerlan Khassenov (Backend & NoSQL Specialist):**
* Designed the core database architecture and Mongoose schemas.
* Implemented complex Aggregation Framework logic and the indexing strategy.
* Developed the secure REST API and JWT-based authentication system.

**Altynay Yertay (Frontend & Integration Specialist):**
* Created the responsive user interface (7 unique functional pages).
* Integrated the API using Fetch and managed persistent state via `localStorage`.
* Implemented the media management system (Multer file handling and Cropper.js).
---