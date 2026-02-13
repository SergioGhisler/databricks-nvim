const express = require('express');
const http = require('http');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const trackedAgents = ['main', 'dev-bot', 'research-bot', 'ops-bot', 'clyde'];
const sessionToAgent = new Map();

const state = {
  agents: Object.fromEntries(
    trackedAgents.map((name) => [
      name,
      {
        status: 'idle',
        task: 'Waiting',
        updatedAt: new Date().toISOString(),
        model: '',
        source: 'bootstrap',
      },
    ]),
  ),
  events: [],
};

const BUSY_MAX_AGE_MS = 18_000;
const THINKING_MAX_AGE_MS = 42_000;
const THINKING_PROMOTION_POLLS = 2;

const statusSmoothing = new Map(
  trackedAgents.map((agentId) => [agentId, { stable: 'idle', pending: null, count: 0 }]),
);

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function pushEvent(type, data) {
  const event = { id: Date.now(), type, at: new Date().toISOString(), data };
  state.events.unshift(event);
  state.events = state.events.slice(0, 400);
  broadcast({ type, data: event });
}

function applyAgentUpdate(agentId, patch) {
  const prev = state.agents[agentId] || {};
  const next = {
    ...prev,
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  };

  const changed =
    prev.status !== next.status ||
    prev.task !== next.task ||
    prev.model !== next.model ||
    prev.source !== next.source;

  state.agents[agentId] = next;
  if (changed) {
    pushEvent('agent.updated', { name: agentId, ...next });
  }
}

function statusFromAgeMs(ageMs) {
  if (ageMs <= BUSY_MAX_AGE_MS) return 'busy';
  if (ageMs <= THINKING_MAX_AGE_MS) return 'thinking';
  return 'idle';
}

function smoothPolledStatus(agentId, rawStatus) {
  const slot = statusSmoothing.get(agentId) || { stable: 'idle', pending: null, count: 0 };

  if (rawStatus === 'busy' || rawStatus === 'running_tool') {
    slot.stable = rawStatus;
    slot.pending = null;
    slot.count = 0;
    statusSmoothing.set(agentId, slot);
    return slot.stable;
  }

  if (rawStatus === 'thinking') {
    if (slot.stable === 'thinking' || slot.stable === 'busy') {
      slot.stable = 'thinking';
      slot.pending = null;
      slot.count = 0;
      statusSmoothing.set(agentId, slot);
      return slot.stable;
    }

    if (slot.pending === 'thinking') slot.count += 1;
    else {
      slot.pending = 'thinking';
      slot.count = 1;
    }

    if (slot.count >= THINKING_PROMOTION_POLLS) {
      slot.stable = 'thinking';
      slot.pending = null;
      slot.count = 0;
    }

    statusSmoothing.set(agentId, slot);
    return slot.stable;
  }

  // idle
  slot.stable = 'idle';
  slot.pending = null;
  slot.count = 0;
  statusSmoothing.set(agentId, slot);
  return slot.stable;
}

function sessionStorePath(agentId) {
  return path.join(process.env.HOME || '', '.openclaw', 'agents', agentId, 'sessions', 'sessions.json');
}

function readSessionsForStore(storePath) {
  if (!fs.existsSync(storePath)) return [];
  try {
    const raw = execFileSync('openclaw', ['sessions', '--json', '--store', storePath], {
      encoding: 'utf8',
      timeout: 6000,
    });
    const parsed = JSON.parse(raw);
    return parsed.sessions || [];
  } catch {
    return [];
  }
}

function updateFromOpenClaw() {
  sessionToAgent.clear();

  for (const agentId of trackedAgents) {
    const sessions = readSessionsForStore(sessionStorePath(agentId));

    for (const s of sessions) {
      if (s?.sessionId) sessionToAgent.set(s.sessionId, agentId);
    }

    if (sessions.length === 0) {
      applyAgentUpdate(agentId, {
        status: smoothPolledStatus(agentId, 'idle'),
        rawStatus: 'idle',
        task: 'No active session yet',
        source: 'poll',
      });
      continue;
    }

    sessions.sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    const latest = sessions[sessions.length - 1];
    const ageMs = latest.ageMs ?? Math.max(0, Date.now() - (latest.updatedAt || Date.now()));

    const rawStatus = statusFromAgeMs(ageMs);
    const status = smoothPolledStatus(agentId, rawStatus);

    applyAgentUpdate(agentId, {
      status,
      rawStatus,
      task: `${latest.kind || 'session'} · ${latest.key || 'n/a'}`,
      model: latest.model || '',
      updatedAt: new Date(latest.updatedAt || Date.now()).toISOString(),
      ageMs,
      source: 'poll',
    });
  }
}

function parseLogLine(line) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return;
  }

  const msg = String(obj?.message || '');

  // Fast status raise on run start (near real-time)
  if (msg.includes('embedded run start:')) {
    const sid = msg.match(/sessionId=([a-f0-9-]+)/i)?.[1];
    const model = msg.match(/model=([^\s]+)/i)?.[1] || '';
    const agentId = sid ? sessionToAgent.get(sid) || 'main' : 'main';
    applyAgentUpdate(agentId, {
      status: 'busy',
      task: 'Active run',
      model,
      source: 'events',
    });
    return;
  }

  // Elevate on explicit tool traffic markers if present
  if (msg.includes('tool') && msg.includes('runId=')) {
    for (const agentId of trackedAgents) {
      if (msg.includes(`agent:${agentId}:`)) {
        applyAgentUpdate(agentId, {
          status: 'running_tool',
          task: 'Running tool call',
          source: 'events',
        });
        break;
      }
    }
  }
}

function startLogStream() {
  const child = spawn('openclaw', ['logs', '--json', '--follow', '--plain', '--limit', '200'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) parseLogLine(line.trim());
    }
  });

  child.on('exit', () => {
    setTimeout(startLogStream, 1500);
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/state', (_req, res) => {
  res.json(state);
});

app.post('/api/agent/:name', (req, res) => {
  const name = req.params.name;
  applyAgentUpdate(name, {
    ...req.body,
    source: 'manual',
  });
  res.json({ ok: true, agent: state.agents[name] });
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state.snapshot', data: state }));
});

setInterval(updateFromOpenClaw, 1500);
updateFromOpenClaw();
startLogStream();

const PORT = process.env.PORT || 8787;
server.listen(PORT, () => {
  console.log(`mission-control server on http://localhost:${PORT}`);
});
