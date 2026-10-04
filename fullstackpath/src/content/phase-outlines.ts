/**
 * Static roadmap outline for the landing page.
 *
 * GENERATED FILE — do not edit by hand. Regenerate with:
 *   node scripts/generate-outline.mjs
 *
 * Holds roadmap SHAPE and interview COUNTS only, so the marketing page needs no
 * database round trip. The interactive roadmap always reads live content from the
 * database, so this file can never be the source of truth for a learner.
 *
 * Regenerate after every content sync so the numbers below stay honest.
 */

import type { PhaseOutlineEntry } from "@/features/roadmap/phase-outline-data";

export const PHASE_1_OUTLINE: PhaseOutlineEntry = {
  "order": 1,
  "title": "Interview Preparation Foundations",
  "icon": "🧭",
  "color": "#6366f1",
  "difficulty": "BEGINNER",
  "summary": "How the interview pipeline actually works, and how to plan, resource and track your preparation so you walk into each round with a plan.",
  "topics": 41,
  "groups": [
    "Full Stack Interview",
    "Preparation Strategy",
    "Interview Communication"
  ],
  "deepTopics": 39,
  "questions": 105,
  "answeredQuestions": 6,
  "practiceBlocks": 2,
  "practiceItems": 30
};

export const PHASE_2_OUTLINE: PhaseOutlineEntry = {
  "order": 2,
  "title": "Absolute Foundations",
  "icon": "🌱",
  "color": "#10b981",
  "difficulty": "BEGINNER",
  "summary": "Zero-level foundations: how the web works, the terminal, Git, programming fundamentals and the developer environment.",
  "topics": 70,
  "groups": [
    "How the Web Works",
    "Terminal and Linux CLI",
    "Git and GitHub",
    "Programming Fundamentals",
    "Developer Environment",
    "Computer Science Basics for Web"
  ],
  "deepTopics": 62,
  "questions": 263,
  "answeredQuestions": 99,
  "practiceBlocks": 4,
  "practiceItems": 112
};

export const PHASE_3_OUTLINE: PhaseOutlineEntry = {
  "order": 3,
  "title": "Frontend Foundations",
  "icon": "🎨",
  "color": "#3b82f6",
  "difficulty": "INTERMEDIATE",
  "summary": "Frontend foundations: HTML, CSS, JavaScript core, TypeScript, browser internals, performance, accessibility and build tooling.",
  "topics": 198,
  "groups": [
    "Frontend Basics: HTML Fundamentals",
    "CSS Styling",
    "JavaScript Core",
    "TypeScript",
    "Browser Internals",
    "Web Performance",
    "Accessibility in Depth",
    "Build Tools and Tooling",
    "Progressive Web Apps and Web APIs"
  ],
  "deepTopics": 123,
  "questions": 874,
  "answeredQuestions": 391,
  "practiceBlocks": 10,
  "practiceItems": 256
};

export const PHASE_4_OUTLINE: PhaseOutlineEntry = {
  "order": 4,
  "title": "Frontend Frameworks",
  "icon": "⚛️",
  "color": "#06b6d4",
  "difficulty": "INTERMEDIATE",
  "summary": "Frontend frameworks: React in depth, meta-frameworks, state management, data fetching, routing and frontend architecture.",
  "topics": 181,
  "groups": [
    "React Concepts",
    "Next.js and Meta-Frameworks",
    "State Management",
    "Data Fetching and Forms",
    "Routing Strategies",
    "Frontend Architecture and Ecosystem"
  ],
  "deepTopics": 147,
  "questions": 854,
  "answeredQuestions": 322,
  "practiceBlocks": 58,
  "practiceItems": 356
};

export const PHASE_5_OUTLINE: PhaseOutlineEntry = {
  "order": 5,
  "title": "Backend Foundations",
  "icon": "⚙️",
  "color": "#f59e0b",
  "difficulty": "INTERMEDIATE",
  "summary": "Backend foundations: the Node.js runtime, Express, API design, background jobs, real-time systems and backend practices.",
  "topics": 231,
  "groups": [
    "Nodejs Runtime",
    "Express Framework",
    "NestJS and Backend Frameworks",
    "RESTful APIs",
    "GraphQL and Alternatives",
    "Background Processing and Messaging",
    "Real-Time Systems",
    "Files, Payments, and Integrations",
    "Other Backend Languages",
    "Backend Engineering Practices"
  ],
  "deepTopics": 189,
  "questions": 1134,
  "answeredQuestions": 253,
  "practiceBlocks": 120,
  "practiceItems": 160
};

export const PHASE_6_OUTLINE: PhaseOutlineEntry = {
  "order": 6,
  "title": "Database Systems",
  "icon": "🗄️",
  "color": "#eab308",
  "difficulty": "INTERMEDIATE",
  "summary": "Database systems: SQL and NoSQL, data modelling, ORMs, search and specialised stores, and caching layers.",
  "topics": 225,
  "groups": [
    "SQL Databases",
    "NoSQL Databases",
    "ORMs and Data Access",
    "Search and Specialized Stores",
    "Caching Layers",
    "Data Modeling Exercises",
    "Database Systems: Additional Topics 7",
    "Database Systems: Additional Topics 8",
    "Database Systems: Additional Topics 9",
    "Database Systems: Additional Topics 10",
    "Database Systems: Additional Topics 11",
    "Database Systems: Additional Topics 12",
    "Database Systems: Additional Topics 13",
    "Database Systems: Additional Topics 14",
    "Database Systems: Additional Topics 15",
    "Database Systems: Additional Topics 16",
    "Database Systems: Additional Topics 17",
    "Database Systems: Additional Topics 18",
    "Database Systems: Additional Topics 19",
    "Database Systems: Additional Topics 20",
    "Database Systems: Additional Topics 21",
    "Database Systems: Additional Topics 22",
    "Database Systems: Additional Topics 23",
    "Database Systems: Additional Topics 24",
    "Database Systems: Additional Topics 25",
    "Database Systems: Additional Topics 26",
    "Database Systems: Additional Topics 27",
    "Database Systems: Additional Topics 29"
  ],
  "deepTopics": 181,
  "questions": 950,
  "answeredQuestions": 543,
  "practiceBlocks": 36,
  "practiceItems": 552
};

export const PHASE_7_OUTLINE: PhaseOutlineEntry = {
  "order": 7,
  "title": "Networking and Security",
  "icon": "🔐",
  "color": "#ef4444",
  "difficulty": "INTERMEDIATE",
  "summary": "Networking and security: protocols, TLS, auth, cryptography and web application security.",
  "topics": 150,
  "groups": [
    "Network Protocols",
    "Auth Mechanisms",
    "Web Vulnerabilities",
    "Secure Engineering Practices",
    "Networking and Security: Additional Topics 17",
    "Networking and Security: Additional Topics 18",
    "Networking and Security: Additional Topics 19",
    "Networking and Security: Additional Topics 20",
    "Networking and Security: Additional Topics 21",
    "Networking and Security: Additional Topics 22",
    "Networking and Security: Additional Topics 23",
    "Networking and Security: Additional Topics 24",
    "Networking and Security: Additional Topics 25"
  ],
  "deepTopics": 119,
  "questions": 703,
  "answeredQuestions": 530,
  "practiceBlocks": 102,
  "practiceItems": 456
};

export const PHASE_8_OUTLINE: PhaseOutlineEntry = {
  "order": 8,
  "title": "DevOps and Cloud",
  "icon": "☁️",
  "color": "#0ea5e9",
  "difficulty": "INTERMEDIATE",
  "summary": "DevOps and cloud: containers, CI/CD, Linux in production, infrastructure as code, Kubernetes, networking and observability.",
  "topics": 162,
  "groups": [
    "Linux Server Administration",
    "Containerization",
    "Kubernetes Basics",
    "CI and CD",
    "Infrastructure as Code and Web Servers",
    "Cloud Platforms",
    "Observability and Reliability"
  ],
  "deepTopics": 125,
  "questions": 586,
  "answeredQuestions": 161,
  "practiceBlocks": 30,
  "practiceItems": 266
};

export const PHASE_9_OUTLINE: PhaseOutlineEntry = {
  "order": 9,
  "title": "Testing Strategies",
  "icon": "🧪",
  "color": "#14b8a6",
  "difficulty": "INTERMEDIATE",
  "summary": "Testing strategies: unit, integration and end-to-end tests, TDD, test doubles and coverage that means something.",
  "topics": 85,
  "groups": [
    "Unit Testing",
    "Integration Testing",
    "End to End Testing",
    "Quality Beyond Tests"
  ],
  "deepTopics": 74,
  "questions": 204,
  "answeredQuestions": 102,
  "practiceBlocks": 30,
  "practiceItems": 402
};

export const PHASE_10_OUTLINE: PhaseOutlineEntry = {
  "order": 10,
  "title": "Coding Challenges, CS Fundamentals and DSA",
  "icon": "🧮",
  "color": "#8b5cf6",
  "difficulty": "INTERMEDIATE",
  "summary": "Coding challenges, CS fundamentals and DSA: complexity, core data structures, classic patterns and problem solving under time pressure.",
  "topics": 131,
  "groups": [
    "Data Structures",
    "Algorithms",
    "Problem Solving",
    "OS and Concurrency Fundamentals",
    "Practice Plan"
  ],
  "deepTopics": 109,
  "questions": 352,
  "answeredQuestions": 194,
  "practiceBlocks": 72,
  "practiceItems": 578
};

export const PHASE_11_OUTLINE: PhaseOutlineEntry = {
  "order": 11,
  "title": "Architecture Patterns and Low-Level Design",
  "icon": "🏗️",
  "color": "#d946ef",
  "difficulty": "INTERMEDIATE",
  "summary": "Architecture patterns and low-level design: SOLID, design patterns, domain-driven design and low-level system design.",
  "topics": 94,
  "groups": [
    "Design Patterns",
    "OOP, SOLID and Clean Code",
    "Architectural Styles",
    "Low-Level Design Case Studies"
  ],
  "deepTopics": 76,
  "questions": 166,
  "answeredQuestions": 12,
  "practiceBlocks": 30,
  "practiceItems": 554
};

export const PHASE_12_OUTLINE: PhaseOutlineEntry = {
  "order": 12,
  "title": "System Design",
  "icon": "📐",
  "color": "#a855f7",
  "difficulty": "INTERMEDIATE",
  "summary": "System design: scalability, estimation, distributed systems, a repeatable design framework and classic case studies.",
  "topics": 89,
  "groups": [
    "Scalability Principles",
    "System Estimation",
    "Distributed Systems Concepts",
    "System Design Framework",
    "Classic Case Studies"
  ],
  "deepTopics": 78,
  "questions": 250,
  "answeredQuestions": 80,
  "practiceBlocks": 66,
  "practiceItems": 428
};

export const PHASE_13_OUTLINE: PhaseOutlineEntry = {
  "order": 13,
  "title": "AI-Era Full Stack Skills",
  "icon": "🤖",
  "color": "#ec4899",
  "difficulty": "INTERMEDIATE",
  "summary": "AI-era full stack skills: LLM APIs, streaming UX, RAG, tool calling, agents and evaluating AI features.",
  "topics": 66,
  "groups": [
    "AI-Era Full Stack Skills Topics",
    "AI-Era Full Stack Skills: Additional Topics 2",
    "AI-Era Full Stack Skills: Additional Topics 4",
    "AI-Era Full Stack Skills: Additional Topics 5",
    "AI-Era Full Stack Skills: Additional Topics 6",
    "AI-Era Full Stack Skills: Additional Topics 7",
    "AI-Era Full Stack Skills: Additional Topics 8",
    "AI-Era Full Stack Skills: Additional Topics 9"
  ],
  "deepTopics": 55,
  "questions": 6,
  "answeredQuestions": 0,
  "practiceBlocks": 28,
  "practiceItems": 248
};

export const PHASE_14_OUTLINE: PhaseOutlineEntry = {
  "order": 14,
  "title": "Behavioral and Engineering Culture",
  "icon": "🤝",
  "color": "#f59e0b",
  "difficulty": "BEGINNER",
  "summary": "Behavioral and engineering culture: storytelling, collaboration, code review practice, and what senior and staff scope looks like.",
  "topics": 74,
  "groups": [
    "Behavioral Questions",
    "Engineering Culture",
    "Seniority and Leadership"
  ],
  "deepTopics": 65,
  "questions": 167,
  "answeredQuestions": 20,
  "practiceBlocks": 6,
  "practiceItems": 80
};

export const PHASE_15_OUTLINE: PhaseOutlineEntry = {
  "order": 15,
  "title": "Job Search, Offers and Career",
  "icon": "🎯",
  "color": "#10b981",
  "difficulty": "BEGINNER",
  "summary": "Job search, offers and career: application materials, search strategy and negotiation.",
  "topics": 97,
  "groups": [
    "Application Materials",
    "Job Search Strategy",
    "Offer and Negotiation",
    "Learning Paths",
    "Role Tracks",
    "Level Tracks",
    "Interview Kit"
  ],
  "deepTopics": 61,
  "questions": 293,
  "answeredQuestions": 147,
  "practiceBlocks": 18,
  "practiceItems": 334
};
/** Totals across all phases, from the same source as the entries above. */
export const CONTENT_TOTALS = {
  "phases": 15,
  "groups": 118,
  "topics": 1894,
  "deepTopics": 1503,
  "questions": 6907,
  "answeredQuestions": 2860,
  "practiceBlocks": 612,
  "practiceItems": 4812
} as const;

