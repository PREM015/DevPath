# PROJECT: FullStackPath — Complete Full Stack Interview Roadmap Platform

## 1. Project Overview

Build a production-ready, modern, interactive full-stack learning and interview preparation platform called **FullStackPath**.

The platform should combine:

* The visual mind-map experience of Whimsical.
* The structured learning paths of roadmap.sh.
* The progress tracking experience of a learning management system.
* The analytics and dashboard experience of a modern SaaS application.

This is NOT a static roadmap website.

It must be a complete multi-user application where every registered user can follow the same master roadmap while independently tracking their learning progress, notes, practice history, revision schedule, projects, and interview readiness.

The application must be deployable on Vercel with a production database.

## 2. Primary Objectives

1. Display a complete Full Stack Interview Roadmap from Zero to Staff Level.
2. Organize learning into 15 sequential phases.
3. Support interactive visual roadmap exploration.
4. Allow users to track individual topic-level progress.
5. Maintain persistent user-specific progress in the database.
6. Provide personalized dashboards and analytics.
7. Support notes, bookmarks, revisions, resources, and practice tracking.
8. Allow administrators to manage roadmap content.
9. Support responsive desktop, tablet, and mobile experiences.
10. Provide a reliable, secure, scalable architecture.

## 3. Recommended Technology Stack

Use the following stack unless there is a strong technical reason to change it.

### Frontend

* Next.js App Router
* React
* TypeScript (strict mode)
* Tailwind CSS
* shadcn/ui + Radix UI
* Framer Motion
* Lucide Icons
* React Flow (@xyflow/react) for interactive roadmap visualization
* Recharts for analytics
* TanStack Query where client-side server-state management is required
* React Hook Form + Zod

### Backend

* Next.js Route Handlers / Server Actions where appropriate
* Service and repository architecture
* Zod validation
* Secure authentication and authorization
* Centralized error handling
* Rate limiting for sensitive endpoints

### Database

* PostgreSQL (Neon recommended)
* Prisma ORM (latest stable compatible version)
* Database migrations
* Proper indexing and relational integrity

### Authentication

* Auth.js / NextAuth
* Email and password authentication
* Google OAuth (optional, only when credentials are configured)
* Email verification
* Forgot password / reset password
* Secure session handling
* Role-based access control: USER / ADMIN

### Deployment

* Vercel
* Neon PostgreSQL
* Vercel environment variables
* GitHub integration
* Production-ready build

Avoid introducing unnecessary infrastructure or paid services.

The core platform must work without requiring paid APIs.

---

# 4. Application Architecture

Use a modular architecture with clear separation of responsibilities.

Suggested structure:

src/
app/
(auth)/
(dashboard)/
roadmap/
admin/
api/
components/
ui/
layout/
roadmap/
dashboard/
analytics/
progress/
notes/
features/
auth/
roadmap/
progress/
notes/
revision/
projects/
analytics/
admin/
lib/
auth/
db/
validations/
permissions/
utils/
server/
services/
repositories/
actions/
hooks/
types/
config/

prisma/
schema.prisma
seed.ts

docs/
ARCHITECTURE.md
DATABASE.md
API.md
ROADMAP_CONTENT.md
DEPLOYMENT.md

Follow these principles:

* UI components must not directly contain database queries.
* API routes should not contain business logic.
* Validate all external input.
* Enforce ownership checks on user-specific data.
* Keep reusable business logic in services.
* Use database transactions for multi-step operations.
* Avoid unnecessary client components.
* Use Server Components by default.
* Never expose secrets to the frontend.
* Do not use mock progress or fake user analytics.
* Do not create duplicate roadmap content in multiple places.

---

# 5. Roadmap Content Structure

Use the complete roadmap content provided below as the canonical master roadmap.

Do not remove, rename, silently merge, or skip any provided phase, group, or topic.

The roadmap contains:

* 15 main phases
* Approximately 90 groups
* Hundreds of individual topics
* 4 difficulty levels
* Cross-cutting learning tracks
* Role-based paths
* Level-based paths
* Project milestones
* Interview preparation resources

Each topic must have a stable unique ID.

Recommended hierarchy:

Roadmap
→ Phase
→ Group
→ Topic
→ Subtopics
→ Resources
→ Practice tasks
→ Notes
→ User progress

Each phase and group should have:

* Unique slug
* Title
* Description
* Difficulty level
* Display order
* Estimated learning time (optional)
* Prerequisites
* Related topics
* Icon
* Color
* Learning objectives

Each topic should have:

* Unique ID
* Title
* Description
* Difficulty
* Parent group
* Learning status
* Estimated time
* Prerequisites
* Related topics
* Recommended resources
* Practice checklist
* Interview questions
* Notes support

Difficulty legend:

🟢 Beginner
🟡 Intermediate
🔴 Advanced
⚫ Senior/Staff

The roadmap content should be stored in the database, not hardcoded separately in multiple frontend components.

Use a versioned seed system for initial roadmap data.

Important: Preserve the exact roadmap content supplied in the project specification. If content is too large, implement it in multiple deterministic seed files rather than truncating it.

---

# 6. Main Application Pages

## A. Landing Page (/)

Create a polished SaaS landing page.

Sections:

* Hero section
* Product introduction
* Interactive roadmap preview
* Learning process
* Features
* Progress tracking preview
* Role-based learning paths
* Project milestones
* FAQ
* Clear CTA
* Footer

Hero headline:

"Your Complete Journey from Beginner to Staff Engineer."

Subheading:

"One structured roadmap. Every essential skill. Your progress, tracked from day one."

CTA:

* Explore Roadmap
* Start Learning

Do not display fabricated user counts, testimonials, ratings, or success statistics.

## B. Authentication

Pages:

* /login
* /register
* /forgot-password
* /reset-password
* /verify-email

Requirements:

* Proper validation
* Password strength feedback
* Secure password hashing
* User-friendly error states
* Loading states
* Rate limiting
* Secure session management

## C. User Dashboard (/dashboard)

This should be the main personalized workspace.

Display actual database-backed user information:

### Overview Cards

* Overall roadmap completion
* Topics completed
* Topics currently learning
* Topics not started
* Topics needing revision
* Active learning days
* Total learning time

### Dashboard Sections

* Continue learning
* Recently studied topics
* Today's learning plan
* Upcoming revisions
* Current learning phase
* Project milestones
* Weekly learning activity
* Recent achievements
* Recommended next topics

Every metric must come from actual user records.

Do not invent or randomly generate statistics.

## D. Interactive Roadmap (/roadmap)

This is the most important page.

Create an interactive roadmap inspired by Whimsical and roadmap.sh.

### Visualization Requirements

Use React Flow.

Display all 15 phases as connected major nodes.

Each phase expands into its groups.

Each group expands into individual topics.

Topics should be represented with visually distinguishable nodes.

Features:

* Zoom in/out
* Pan
* Fit to screen
* Minimap
* Search topics
* Filter by difficulty
* Filter by phase
* Filter by status
* Collapse / expand groups
* Highlight prerequisites
* Highlight completed topics
* Highlight current learning path
* Highlight blocked topics
* Show related-topic connections
* Smooth animations
* Responsive mobile alternative

Do not render hundreds of detailed nodes simultaneously if performance becomes poor.

Implement progressive rendering:

* Initially display phase-level nodes.
* Expand a phase to display groups.
* Expand a group to display topics.
* Load additional detail when required.

### Topic Node States

Each node should visually represent:

NOT_STARTED
IN_PROGRESS
PRACTICED
COMPLETED
NEEDS_REVISION
BLOCKED

Use clear colors, badges, icons, and accessible labels.

Clicking a topic should open a detail drawer or side panel.

Topic detail panel should include:

* Topic title
* Description
* Difficulty
* Prerequisites
* Related topics
* Learning resources
* Practice checklist
* Interview questions
* Personal notes
* Status selector
* Completion date
* Time spent
* Mark as completed action

A user should be able to update their progress without leaving the roadmap.

## E. Topic Details (/roadmap/[topicSlug])

Provide a dedicated learning page.

Sections:

* Topic overview
* What to learn
* Important concepts
* Prerequisites
* Learning resources
* Practical exercises
* Interview questions
* Personal notes
* Related topics
* Progress controls

Provide a "Start Learning" button.

Provide a "Mark as Practiced" action.

Provide a "Mark as Completed" action.

Completion should be reversible.

Do not mark a topic completed merely because a user opened it.

## F. My Learning (/learning)

Provide a personalized learning workspace.

Features:

* Current learning phase
* Active topics
* Saved topics
* Learning queue
* Completed topics
* Blocked topics
* Learning history
* Custom learning plan

Allow users to create a personal sequence of topics without modifying the master roadmap.

## G. Analytics (/analytics)

Build an actual analytics dashboard.

Charts:

* Daily learning time
* Weekly learning activity
* Monthly learning activity
* Phase-wise completion
* Difficulty-wise completion
* Topics completed over time
* Learning consistency
* Revision completion

Metrics:

* Total topics completed
* Overall percentage
* Current streak
* Longest streak
* Total learning hours
* Average weekly study time
* Phase completion percentage

Use real database-backed data.

Handle empty states correctly.

Do not use fake chart data.

Define calculation rules clearly and document them.

## H. Revision System (/revision)

Build a spaced repetition system.

Features:

* Add topic to revision
* Revision due date
* Revision interval
* Revision history
* Difficulty feedback
* Mark as remembered / needs more practice
* Today's revision queue
* Upcoming revisions
* Overdue revisions

Use a configurable spaced repetition algorithm.

Suggested initial intervals:

* First revision: 1 day
* Second revision: 3 days
* Third revision: 7 days
* Fourth revision: 14 days
* Fifth revision: 30 days

Users should be able to customize the intervals.

A topic should not automatically become completed after revision.

## I. Personal Notes (/notes)

Features:

* Topic-specific notes
* Markdown editor
* Autosave
* Search
* Tags
* Bookmarks
* Edit and delete
* Last updated time

Every note must belong to its owner.

Users must never see other users' private notes.

## J. Projects (/projects)

Include the eight project milestones:

1. Responsive portfolio (HTML/CSS/JS)
2. To-do app with TypeScript and tests
3. Blog with authentication and CRUD (React + Express + SQL)
4. E-commerce with Stripe and admin dashboard (Next.js)
5. Real-time chat with WebSockets and Redis
6. Dockerized app with CI/CD and cloud deployment
7. Multi-tenant SaaS with background jobs and observability
8. AI-powered application with RAG and streaming

Features:

* Project detail pages
* Required skills
* Related roadmap topics
* Checklist
* Personal project status
* Repository URL
* Live demo URL
* Notes
* Completion tracking

Project progress must be independent for each user.

## K. Interview Preparation (/interview)

Include:

* Interview preparation checklist
* Coding interview preparation
* System design preparation
* Behavioral preparation
* Mock interview history
* Interview question bank
* Personal interview notes
* Readiness checklist

Allow users to track preparation progress.

Do not display an arbitrary "job-ready" score without a documented calculation.

## L. Profile and Settings (/settings)

Users should be able to manage:

* Name
* Avatar
* Preferred role
* Target level
* Learning goals
* Daily study target
* Weekly study target
* Time zone
* Theme
* Notification preferences
* Account security
* Export personal data
* Delete account

Support:

* Frontend-leaning
* Backend-leaning
* Balanced
* Startup generalist

Support target levels:

* Junior
* Mid
* Senior
* Staff

Changing a learning path must not delete existing progress.

---

# 7. Individual User Progress System

This is a critical feature.

Every user must have independent progress for every roadmap topic.

Example:

User A:

* JavaScript: COMPLETED
* React: IN_PROGRESS
* Node.js: NOT_STARTED

User B:

* JavaScript: IN_PROGRESS
* React: NOT_STARTED
* Node.js: COMPLETED

Updating User A's progress must never modify User B's progress.

### Progress Status

NOT_STARTED
IN_PROGRESS
PRACTICED
COMPLETED
NEEDS_REVISION

### Progress Tracking

Store:

* User ID
* Topic ID
* Status
* Started date
* Completed date
* Last studied date
* Total time spent
* Confidence level
* Personal difficulty rating
* Number of revision sessions
* Created date
* Updated date

### Progress Rules

1. A new user starts with every topic as NOT_STARTED.
2. Opening a topic does not count as completion.
3. Completion must be an explicit user action.
4. Users can change or reset their own progress.
5. Progress must persist after logout.
6. Progress must be synchronized across devices.
7. Progress calculations must use the master roadmap as the denominator.
8. Disabled or archived roadmap topics must be handled consistently.
9. Deleting a user should follow a documented data retention policy.
10. Never expose another user's progress.

Use efficient database queries instead of fetching the entire roadmap and all progress records on every request.

---

# 8. Database Design

Design a normalized relational database.

Suggested models:

### User

* id
* name
* email
* passwordHash
* role
* emailVerified
* preferredRole
* targetLevel
* timezone
* dailyGoalMinutes
* createdAt
* updatedAt

### Phase

* id
* title
* slug
* description
* order
* difficulty
* isActive

### RoadmapGroup

* id
* phaseId
* title
* slug
* description
* order
* difficulty

### Topic

* id
* groupId
* title
* slug
* description
* difficulty
* order
* estimatedMinutes
* isActive

### TopicPrerequisite

* id
* topicId
* prerequisiteTopicId

### TopicRelation

* id
* sourceTopicId
* targetTopicId
* relationType

### UserTopicProgress

* id
* userId
* topicId
* status
* startedAt
* completedAt
* lastStudiedAt
* totalTimeMinutes
* confidence
* updatedAt

Unique constraint:
(userId, topicId)

### StudySession

* id
* userId
* topicId
* startedAt
* endedAt
* durationMinutes
* notes

### UserNote

* id
* userId
* topicId
* title
* content
* createdAt
* updatedAt

### Bookmark

* id
* userId
* topicId
* createdAt

Unique constraint:
(userId, topicId)

### Revision

* id
* userId
* topicId
* nextReviewAt
* intervalDays
* reviewCount
* easeFactor
* lastReviewedAt
* status

### RevisionHistory

* id
* userId
* topicId
* result
* reviewedAt
* previousInterval
* nextInterval

### Project

* id
* title
* description
* order
* requiredSkills

### UserProjectProgress

* id
* userId
* projectId
* status
* repositoryUrl
* demoUrl
* notes
* completedAt

### Achievement

* id
* name
* description
* criteria

### UserAchievement

* id
* userId
* achievementId
* unlockedAt

### LearningGoal

* id
* userId
* title
* target
* deadline
* status

### LearningActivity

* id
* userId
* activityType
* referenceId
* metadata
* createdAt

Add appropriate indexes, cascading rules, and unique constraints.

Review the schema before generating migrations.

Do not create unnecessary duplicated progress records.

Use transactions where needed.

---

# 9. Personalized Learning Paths

Build learning paths based on:

* Target role
* Target level
* Available study time
* Current progress
* Prerequisite completion

### Role Paths

1. Frontend-leaning
2. Backend-leaning
3. Balanced Full Stack
4. Startup Generalist

### Level Paths

1. Junior
2. Mid
3. Senior
4. Staff

Allow users to switch paths at any time.

A personalized path should prioritize relevant topics without deleting or hiding the master roadmap.

Provide a "Show all roadmap topics" option.

Use transparent rules for topic recommendations.

Never claim that a user is guaranteed to become job-ready.

---

# 10. Smart Learning Features

Implement these additional features where practical.

### A. Daily Learning Planner

* User chooses daily study target.
* System suggests topics based on current progress.
* Include pending revisions.
* Allow manual customization.
* Track planned versus actual study time.

### B. Learning Streaks

* Count days based on meaningful learning activity.
* Use user's configured timezone.
* Avoid double-counting multiple sessions on the same day.
* Clearly define what counts as an active learning day.

### C. Achievement System

Examples:

* First topic completed
* First phase completed
* 7-day learning streak
* 30 topics completed
* First project completed
* First revision completed

Achievements must be triggered by actual events.

### D. Topic Dependency Engine

* Show prerequisites.
* Identify blocked topics.
* Allow users to explore advanced topics even when prerequisites are incomplete.
* Explain why a topic is marked as recommended or blocked.

### E. Global Search

Search across:

* Phases
* Groups
* Topics
* Resources
* Notes

Provide keyboard shortcuts.

### F. Import and Export

* Export user progress as JSON or CSV.
* Export personal notes.
* Import progress from supported JSON format.
* Validate imports before applying changes.
* Provide duplicate detection.

### G. Notifications (Optional)

* In-app notifications
* Upcoming revision reminders
* Daily goal reminders
* Achievement notifications

The platform must work without push notification infrastructure.

Do not send unnecessary notifications.

---

# 11. Admin Dashboard (/admin)

Create a protected administrator dashboard.

Only ADMIN users can access it.

Features:

* Overview
* User management
* Roadmap phase management
* Group management
* Topic management
* Resource management
* Difficulty management
* Prerequisite management
* Project management
* Content publishing
* Content versioning
* Archive and restore

Admin should be able to:

* Create a phase
* Edit a phase
* Reorder phases
* Add groups
* Add topics
* Edit descriptions
* Add resources
* Connect prerequisites
* Archive topics

Critical rule:

Updating master roadmap content must NOT accidentally delete existing user progress.

Use stable topic IDs.

When a topic is archived, preserve its historical progress.

Protect admin actions using server-side authorization, not just frontend route protection.

---

# 12. UI / UX Design System

Create a premium, polished, modern developer-focused interface.

Visual direction:

* Dark-first design
* Deep charcoal / near-black background
* Subtle gradients
* Glassmorphism used selectively
* Soft borders
* High-quality typography
* Clean spacing
* Subtle hover interactions
* Smooth transitions
* Excellent visual hierarchy

Avoid:

* Excessive gradients
* Overloaded dashboards
* Too many colors
* Unnecessary animations
* Tiny text
* Generic template appearance
* Excessive rounded cards everywhere

### Color system

Use semantic colors:

* Beginner: Green
* Intermediate: Yellow
* Advanced: Red
* Senior/Staff: Purple
* Completed: Green
* In progress: Blue
* Needs revision: Orange
* Not started: Neutral

Provide a light theme as well.

### Layout

Desktop:

* Sidebar navigation
* Top navigation
* Main content
* Optional contextual panel

Mobile:

* Bottom navigation or compact sidebar
* Responsive roadmap visualization
* Touch-friendly controls
* Expandable topic cards
* No horizontal page overflow

### Accessibility

* Semantic HTML
* Keyboard navigation
* Visible focus indicators
* ARIA only when necessary
* Color contrast
* Accessible dialogs and drawers
* Reduced-motion support

---

# 13. Performance Requirements

The platform may eventually contain thousands of roadmap topics and many users.

Implement:

* Database pagination
* Lazy loading
* Progressive roadmap rendering
* Optimized React Flow nodes
* Memoized expensive components
* Efficient progress queries
* Server-side caching for shared roadmap content
* Proper cache invalidation
* Database indexing
* Image optimization
* Dynamic imports where useful
* Avoid unnecessary API calls
* Avoid N+1 queries

Never cache user-specific data publicly.

Never use a shared cache key for different users' private progress.

---

# 14. Security Requirements

Implement production-level security.

Include:

* Secure authentication
* Password hashing using a suitable modern algorithm
* Server-side authorization
* User ownership validation
* Input validation
* SQL injection prevention through safe ORM usage
* XSS prevention
* CSRF protection where applicable
* Secure cookies
* Rate limiting
* Secure headers
* Secrets stored only in environment variables
* No API keys in frontend bundles
* Safe file and URL handling
* Account deletion protection
* Admin authorization
* Audit logging for important admin operations

Do not trust user IDs sent by the client.

Derive the authenticated user from the server-side session.

All private operations must verify ownership.

---

# 15. Testing Requirements

Use:

* Jest or Vitest
* React Testing Library
* Playwright

Write tests for:

### Authentication

* Registration
* Login
* Logout
* Unauthorized access
* Password reset

### Progress

* Creating progress
* Updating status
* Completion
* Resetting progress
* Cross-user isolation
* Progress persistence

### Roadmap

* Phase rendering
* Topic expansion
* Filtering
* Search
* Prerequisites
* Archived topics

### Analytics

* Completion percentage
* Learning time
* Daily activity
* Streak calculation

### Admin

* Access control
* Topic creation
* Topic editing
* Archiving
* Reordering

### E2E

* Register → Explore roadmap → Start topic → Complete topic → Dashboard reflects progress.
* Logout → Login → Progress remains.
* User A cannot access User B's notes or progress.
* Admin can edit content without destroying progress.

---

# 16. Deployment Requirements

The final application must deploy successfully to Vercel.

Provide:

* Correct build configuration
* Production environment variable documentation
* Neon PostgreSQL connection setup
* Database migration instructions
* Seed instructions
* Vercel deployment instructions
* Production authentication configuration
* Custom domain readiness
* Error handling
* Health check endpoint

Environment variables should be documented in .env.example.

Never include real credentials.

Use appropriate pooled and direct database connection URLs for the chosen Neon/Prisma configuration.

Do not run destructive database operations automatically.

Do not reset production database.

Use safe deployment migrations.

The app should support:

* Local development
* Preview deployment
* Production deployment

---

# 17. Complete Original Roadmap Content

IMPORTANT:

Use the complete 15-phase roadmap specification supplied after this prompt as the source of truth.

Preserve every group, topic, difficulty level, and cross-cutting track.

The original specification includes:

PHASE 1: Interview Preparation Foundations

PHASE 2: Absolute Foundations

PHASE 3: Frontend Foundations

PHASE 4: Frontend Frameworks

PHASE 5: Backend Foundations

PHASE 6: Database Systems

PHASE 7: Networking and Security

PHASE 8: DevOps and Cloud

PHASE 9: Testing Strategies

PHASE 10: Coding Challenges, CS Fundamentals and DSA

PHASE 11: Architecture Patterns and Low-Level Design

PHASE 12: System Design

PHASE 13: AI-Era Full Stack Skills

PHASE 14: Behavioral and Engineering Culture

PHASE 15: Job Search, Offers and Career

CROSS-CUTTING TRACKS:

* Projects
* Learning Paths
* Role Tracks
* Level Tracks
* Interview Kit

Use the complete topic lists from my supplied roadmap specification. Do not replace them with shortened summaries.

---

# 18. Development Workflow

Build this project in phases.

Do not attempt to generate the entire application in one uncontrolled operation.

### Stage 1: Foundation

* Analyze requirements
* Define architecture
* Initialize Next.js
* Configure TypeScript
* Configure Tailwind
* Configure Prisma
* Create database schema
* Create documentation

### Stage 2: Roadmap Engine

* Create canonical roadmap content
* Implement seed scripts
* Build phase/group/topic APIs
* Build roadmap visualization
* Implement topic detail panel
* Add search and filtering

### Stage 3: Authentication and User System

* Registration
* Login
* Sessions
* User roles
* Authorization
* User settings

### Stage 4: Progress System

* Topic progress
* Study sessions
* Progress persistence
* Completion calculations
* User-specific isolation

### Stage 5: Dashboard and Analytics

* User dashboard
* Charts
* Activity tracking
* Streak calculations
* Phase completion

### Stage 6: Learning Features

* Notes
* Bookmarks
* Revision system
* Learning planner
* Project tracker
* Interview preparation

### Stage 7: Admin

* Roadmap CRUD
* User management
* Content management
* Permissions

### Stage 8: Production Quality

* Testing
* Security audit
* Performance optimization
* Responsive design
* Accessibility
* Error handling

### Stage 9: Deployment

* Vercel
* Neon
* Production migrations
* Environment variables
* Deployment verification

---

# 19. Critical Instructions for the AI Coding Agent

1. First inspect the existing project directory and package configuration.
2. If a project already exists, understand its architecture before modifying anything.
3. Do not overwrite existing working code without understanding its purpose.
4. Do not invent completed features.
5. Do not use mock data for actual user progress or analytics.
6. Do not skip database persistence.
7. Do not implement authentication as frontend-only logic.
8. Do not use localStorage as the primary progress database.
9. localStorage may be used for harmless UI preferences only.
10. Never expose private data across accounts.
11. Keep the code modular and maintainable.
12. Avoid unnecessary dependencies.
13. Use stable IDs for all roadmap entities.
14. Ensure every user has independent progress.
15. Do not hardcode user-specific dashboard statistics.
16. Keep the master roadmap separate from user progress.
17. Use transactions for critical multi-record operations.
18. Include proper loading, empty, error, and success states.
19. Keep all pages responsive.
20. Do not leave TODOs for core functionality.
21. Never claim a feature is complete unless it is implemented and tested.
22. Do not generate a fake successful deployment report.
23. Run type checks, lint, tests, and production build at appropriate stages.
24. Document all important architectural decisions.
25. Keep a DEVELOPMENT_STATUS.md file tracking completed and pending tasks.

### Final Acceptance Criteria

The project is considered complete only when:

* All 15 roadmap phases are present.
* Every provided topic is preserved.
* Roadmap visualization works.
* Users can register and log in.
* Each user has independent persistent progress.
* Dashboard displays real user data.
* Analytics calculate real metrics.
* Notes and bookmarks are private.
* Revision system works.
* Project tracking works.
* Admin can manage roadmap content.
* Archived topics preserve historical progress.
* Mobile and desktop layouts work.
* Security and authorization tests pass.
* Production build succeeds.
* Vercel deployment instructions are documented.

**Build a real, maintainable, production-ready application — not a UI prototype.**
