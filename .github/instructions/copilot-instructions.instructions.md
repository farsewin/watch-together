---
applyTo: "**"
---

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.# Project: Watch Together (MVP)

## Overview

This is a real-time video synchronization web application.

Tech Stack:

- Backend: Node.js, Express, Socket.IO
- Frontend: React (Vite), Functional Components, Hooks
- Communication: WebSockets via Socket.IO
- No authentication (MVP phase)

---

## Architecture Rules

- Keep backend logic modular and clean.
- Do not mix REST and socket logic in the same file unless necessary.
- Keep business logic separate from server bootstrap.
- Do not introduce unnecessary abstraction layers.
- Keep code simple and readable.

---

## Backend Guidelines

- Use Express for REST endpoints.
- Use UUID for room creation.
- Use in-memory storage for rooms (MVP only).
- Maximum 2 users per room.
- Broadcast socket events only to the same room.
- Do not sync video volume.
- Always prevent event loops when broadcasting video events.

Event types:

- "play"
- "pause"
- "seek"
- "sync"

If drift > 0.5 seconds, adjust currentTime.

---

## Frontend Guidelines

- Use functional React components only.
- Use React Hooks (useState, useEffect, useRef).
- No class components.
- Use a native HTML5 <video> element.
- Prevent infinite event loops using an `isRemote` flag.
- Socket connection must be initialized in a separate file.

---

## Code Quality

- Use clear variable names.
- Avoid deeply nested logic.
- Add comments only when necessary.
- Keep MVP minimal.
- Do not over-engineer.

---

## What To Avoid

- No database integration.
- No authentication.
- No Redux.
- No TypeScript (MVP).
- No UI libraries.

---

## Goal

Keep the implementation minimal, readable, and scalable-ready.
