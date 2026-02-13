const express = require('express');
const http = require('http');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const state = {
  agents: {
    main: { status: 'idle', task: 'Coordinator', updatedAt: new Date().toISOString() },
    'dev-bot': { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString() },
    'research-bot': { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString() },
    'ops-bot': { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString() },
  },
  events: [],
};

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function pushEvent(type, data) {
  const event = { id: Date.now(), type, at: new Date().toISOString(), data };
  state.events.unshift(event);
  state.events = state.events.slice(0, 200);
  broadcast({ type, data: event });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/state', (_req, res) => {
  res.json(state);
});

app.post('/api/agent/:name', (req, res) => {
  const name = req.params.name;
  const current = state.agents[name] || { status: 'idle', task: 'Unknown' };
  const next = {
    ...current,
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  state.agents[name] = next;
  pushEvent('agent.updated', { name, ...next });
  res.json({ ok: true, agent: next });
});

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state.snapshot', data: state }));
});

// demo ticker so UI shows movement immediately
const demoStates = ['idle', 'busy', 'thinking', 'running_tool'];
setInterval(() => {
  const names = Object.keys(state.agents);
  const name = names[Math.floor(Math.random() * names.length)];
  const status = demoStates[Math.floor(Math.random() * demoStates.length)];
  state.agents[name] = {
    ...state.agents[name],
    status,
    task: `Demo task: ${status}`,
    updatedAt: new Date().toISOString(),
  };
  pushEvent('agent.updated', { name, ...state.agents[name] });
}, 8000);

const PORT = process.env.PORT || 8787;
server.listen(PORT, () => {
  console.log(`mission-control server on http://localhost:${PORT}`);
});
