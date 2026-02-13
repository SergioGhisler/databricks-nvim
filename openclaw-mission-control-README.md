# OpenClaw Mission Control (MVP)

Realtime dashboard to visualize agent status (`idle`, `busy`, `thinking`, etc.) with React + WebSockets.

## Structure

- `openclaw-mission-control-server` → Node/Express + WebSocket status server
- `openclaw-mission-control-web` → React dashboard client

## Run

### 1) Start server

```bash
cd openclaw-mission-control-server
npm install
npm run dev
```

Server runs on `http://localhost:8787` and WS at `ws://localhost:8787/ws`.

### 2) Start web app

```bash
cd openclaw-mission-control-web
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).

## Current MVP

- Live connection indicator
- Agent cards with status and current task
- Activity feed of updates
- Demo ticker updates every 8s (can be replaced by real OpenClaw session events)

## Next steps

- Replace demo ticker with real OpenClaw session/tool event stream
- Add avatars + office map view
- Add task queue + per-agent detail pane
- Add auth and persistence
