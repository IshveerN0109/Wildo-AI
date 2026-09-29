---
name: Cloud student data
description: Account ownership and persistence rules for student profiles and study records
---

Authenticated accounts are the only owners of persistent student data. Student profiles live in the managed PostgreSQL database, and notes, flashcards, conversations, quizzes, and progress must be filtered by the authenticated user ID.

**Why:** Anonymous rows with a null user ID can be shared by unrelated browser sessions and cannot follow a student across devices.

**How to apply:** Keep persistent study-data routes behind authentication. Use the managed database for structured profile and study content; use object storage only if future features add uploaded binary files.