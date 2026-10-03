# AquaCare: Aquarium Care and Maintenance Tracker

## Project Description

AquaCare is a small full-stack web application for aquarium owners. It helps keep track of recurring aquarium-care tasks (feeding, water changes, water testing, filter cleaning, plant maintenance, medication, and others) and shows at a glance which tasks are overdue, due today, upcoming, or completed.

It was built as the final project for **CITE 006A (Build Your Own Full-Stack Application)** at the Technological Institute of the Philippines – Manila. It is intentionally simple: one MongoDB collection, one REST resource, and a plain HTML/CSS/JavaScript frontend.

**Live application:** `[Live Application URL — to be added after deployment]`

## Features

- Dashboard showing active tasks, tasks due today, upcoming tasks, overdue tasks, and recently completed tasks
- Add a task (title, aquarium name, task type, frequency, due date, notes)
- View all tasks with color-coded status badges: Overdue, Due today, Upcoming, Completed
- Edit a task using the same form
- Delete a task (with a confirmation prompt)
- Mark a task as done, or undo it
- Filter the task list by status
- Responsive layout for desktop and phone
- Server-side validation with proper HTTP status codes (200, 201, 400, 404, 500)

## Technologies Used

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (`fetch` API) |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| Database hosting | MongoDB Atlas (free M0 cluster) |
| Version control | Git and GitHub |
| Deployment | Netlify (static frontend + Express running as a Netlify Function) |

## System Architecture

```text
Browser
   ↓
Frontend (HTML / CSS / JavaScript in /public)
   ↓  fetch("/api/tasks")
Express / Node.js REST API
   ↓  Mongoose (MONGODB_URI)
MongoDB Atlas  (database: aquacare, collection: tasks)
```

- **Locally**, `server.js` starts Express, which serves both the frontend files and the API.
- **On Netlify**, the files in `public/` are served as a static site, and requests to `/api/*` are redirected (see `netlify.toml`) to a Netlify Function that wraps the same Express app using `serverless-http`.
- The frontend always calls relative URLs such as `/api/tasks`, so no localhost URL is hard-coded.
- Task status (Overdue / Due today / Upcoming) is **not stored**; it is computed in the browser from `dueDate` and `completed`.

## Project Structure

```text
aquacare/
├── app.js                    Express app (middleware + routes), exported
├── server.js                 Local entry point (connects to MongoDB, then listens)
├── db.js                     Cached MongoDB connection helper
├── netlify.toml              Netlify settings and /api redirect
├── package.json
├── .env.example              Template for environment variables
├── .gitignore
├── README.md
├── models/
│   └── Task.js               Mongoose schema and validation
├── routes/
│   └── taskRoutes.js         /api/tasks route definitions
├── controllers/
│   └── taskController.js     CRUD logic and error handling
├── netlify/
│   └── functions/
│       └── api.js            Wraps the Express app as a Netlify Function
└── public/
    ├── index.html
    ├── style.css
    └── script.js
```

## Installation Instructions

Requirements: [Node.js](https://nodejs.org/) 18 or newer, Git, and a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account.

```bash
git clone https://github.com/<your-username>/aquacare.git
cd aquacare
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. The `.env` file is ignored by Git and must never be committed.

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string, with your database user's password | `mongodb+srv://aquacare_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority` |
| `PORT` | Port for local development (not needed on Netlify) | `3000` |
| `DB_NAME` | Optional. Database name; defaults to `aquacare` | `aquacare` |

## How to Run Locally

```bash
npm run dev     # development (auto-restarts on file changes)
# or
npm start       # normal start
```

Then open <http://localhost:3000>. The terminal should print `MongoDB connected` and `AquaCare running at http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Purpose | Success | Error codes |
|---|---|---|---|---|
| GET | `/api/tasks` | List all tasks (sorted by due date) | 200 | 500 |
| GET | `/api/tasks/:id` | Get one task | 200 | 400, 404, 500 |
| POST | `/api/tasks` | Create a task | 201 | 400, 500 |
| PUT | `/api/tasks/:id` | Update a task (also used to mark it done) | 200 | 400, 404, 500 |
| DELETE | `/api/tasks/:id` | Delete a task | 200 | 400, 404, 500 |
| GET | `/api/health` | Check that the API and database are reachable | 200 | 500 |

Example request body for `POST /api/tasks`:

```json
{
  "title": "Water Change",
  "aquarium": "5G Betta Tank",
  "type": "Water Change",
  "frequency": "Weekly",
  "dueDate": "2026-10-05",
  "notes": "Replace approximately 20-30% of the water"
}
```

Required fields: `title`, `aquarium`, `type`, `dueDate`. Allowed `type` values: Feeding, Water Change, Water Testing, Filter Cleaning, Plant Maintenance, Medication, Other. Allowed `frequency` values: Once, Daily, Weekly, Monthly, Other.

## MongoDB Information

- **Database:** `aquacare` (MongoDB Atlas)
- **Collection:** `tasks`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Generated by MongoDB |
| `title` | String | Required, max 100 characters |
| `aquarium` | String | Required, max 60 characters |
| `type` | String | Required, must be one of the allowed task types |
| `frequency` | String | Defaults to `Once` |
| `dueDate` | Date | Required |
| `completed` | Boolean | Defaults to `false` |
| `completedAt` | Date | Set when a task is marked done; cleared when undone |
| `notes` | String | Optional, max 500 characters |
| `createdAt`, `updatedAt` | Date | Added automatically by Mongoose |

All four CRUD operations work on this collection: Create (`POST`), Read (`GET`), Update (`PUT`), Delete (`DELETE`).

## Git Workflow

The project was developed with Git and GitHub using small commits and feature branches, each merged into `main` through a Pull Request.

| Branch | Purpose |
|---|---|
| `main` | Always working; used for deployment |
| `feature/backend-api` | MongoDB connection, Task model, and CRUD routes |
| `feature/frontend-dashboard` | HTML, CSS, JavaScript, dashboard, and CRUD interface |
| `fix/validation-and-ui` | Fixes found during testing |
| `feature/netlify-deploy` | Netlify Function wrapper and configuration |
| `docs/readme` | README and screenshots |

Commit messages follow a simple pattern (`chore:`, `feat:`, `fix:`, `docs:`). See the repository's commit history and closed Pull Requests for details.

## Deployment Information

1. Push the repository to GitHub.
2. In MongoDB Atlas, open **Network Access** and allow access from anywhere (`0.0.0.0/0`), because Netlify Functions do not have fixed IP addresses.
3. In Netlify, choose **Add new site → Import an existing project**, connect the GitHub repository, and keep the settings from `netlify.toml` (publish directory `public`, functions directory `netlify/functions`).
4. In **Site configuration → Environment variables**, add `MONGODB_URI` (and optionally `DB_NAME`).
5. Deploy, then open the site URL and check `/api/health`.

## Live Application URL

`[Live Application URL — to be added after deployment]`

## Screenshots

`[Screenshot: Dashboard — to be added]`

`[Screenshot: Add / edit task form — to be added]`

`[Screenshot: Task list with status badges — to be added]`

## Contributors

- Stephen Kyle V. Laroco — BS Data Science and Analytics, Technological Institute of the Philippines – Manila
