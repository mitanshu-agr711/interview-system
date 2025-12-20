🚀 AI Interview Platform

An Intelligent, Scalable Interview Practice & Evaluation System

An end-to-end AI-powered interview platform that helps users create, attempt, evaluate, and analyze technical interviews with deep analytics, workspace organization, and scalable backend architecture.

✨ Key Features

🤖 AI-generated interview questions (Gemini-powered)

🧠 AI-based answer evaluation & explanations

🗂️ Workspace-based interview organization

📊 Automatic interview analytics & scoring

🔁 Retry-safe, duplicate-proof answer submission

⚡ Scalable MongoDB schema with optimized indexing

🚀 Production-ready REST APIs

🧩 Redis-ready architecture (Upstash supported)

🏗️ High-Level Architecture
<img width="613" height="237" alt="image" src="https://github.com/user-attachments/assets/6d0ac78a-dd9f-41c7-9265-a61f1f09ac27" />



The Interview model acts as the central hub, connecting questions, answers, analytics, and workspaces.

📊 Database Schema Overview
<img width="511" height="207" alt="image" src="https://github.com/user-attachments/assets/0b321a16-6919-4ab8-8acf-d1ddd1895a44" />


🧑 User Model

Unique user identity

Authentication-ready

Ownership of workspaces, interviews, and answers

🗂️ Workspace Model

Groups interviews logically (e.g. Frontend, Backend, DSA)

Supports multiple interviews per workspace

🎯 Interview Model (Central Hub)

Tracks:

Status lifecycle (draft → in-progress → completed)

Timing (startedAt, completedAt)

Auto-calculated analytics:

Total questions

Correct / wrong answers

Score percentage

Indexes optimized for:

User dashboards

Workspace listing

Recent activity

❓ Question Model

AI-generated questions

Linked to interview + workspace

Reusable, searchable, and indexed

✍️ Answer Model

One answer per user per question

AI-evaluated correctness

Stores:

User answer

Correct answer

Explanation

Time taken

🔄 Complete API Flow
1️⃣ Create Interview with AI Questions

POST /api/interview/create

Validates user & workspace

Generates questions using AI

Saves interview + questions atomically (MongoDB transaction)

2️⃣ Start Interview

POST /api/interview/:interviewId/start

Moves interview to in-progress

Returns questions without answers

3️⃣ Submit Answer

POST /api/interview/submit-answer

Prevents duplicate submissions

Evaluates answer using AI

Updates interview analytics in real time

4️⃣ Complete Interview

POST /api/interview/:interviewId/complete

Finalizes interview

Calculates final score & analytics

5️⃣ Get Full Interview Report

GET /api/interview/:interviewId

Returns:

Interview metadata

Questions + user answers

Score breakdown

Weak topic identification

6️⃣ Workspace-Level Interview Listing

GET /api/interview/workspace/:workspaceId

Sorted by most recent

Lightweight, dashboard-ready response

7️⃣ User Analytics Dashboard

GET /api/interview/analytics/user

Provides:

Overall performance

Topic-wise strengths & weaknesses

Difficulty-wise analysis

Recent interview trends

📈 Analytics Capabilities

✅ Topic-wise accuracy

✅ Difficulty-wise scoring

✅ Weak topic detection

✅ Average score trends

✅ Interview completion tracking

⚡ Performance & Scalability
✅ Already Implemented

Strategic MongoDB indexes

Lean queries for fast reads

Batch inserts (insertMany)

MongoDB transactions

Duplicate answer protection

🔜 Planned Enhancements

Pagination for dashboards

Redis caching (Upstash)

Rate limiting

Async AI evaluation queue

WebSocket live interview mode

🧠 Redis (Caching Ready)

Designed to support:

User analytics caching

Interview state caching

Rate limiting

Token/session management

Fully compatible with Upstash Redis for serverless & cloud deployments.

🧪 Example End-to-End Flow
<img width="533" height="226" alt="image" src="https://github.com/user-attachments/assets/98e2d110-f68e-49dd-928d-642773929495" />


🛠️ Tech Stack

Backend: Node.js, TypeScript, Express

Database: MongoDB (Mongoose)

AI: Gemini API

Cache (Optional): Upstash Redis

Auth Ready: JWT-based design

Deployment: Render (testing), AWS (production-ready)

🎯 Why This Project Stands Out

✅ Real-world scalable schema design

✅ Clean separation of concerns

✅ Production-grade API flows

✅ Interview analytics built-in (not an afterthought)

✅ AI integration with meaningful use cases

✅ Ready for growth (10 users → 1M users)

📌 Future Roadmap

🔐 Role-based access (Admin / Interviewer)

📡 Real-time interview sessions

🎥 Voice-based AI interviews

🧾 PDF interview reports

🏆 Leaderboards & streaks

👨‍💻 Author

Mitanshu Agrawal
Full-Stack Developer | Backend & System Design Enthusiast

“Building scalable systems, not just APIs.”
