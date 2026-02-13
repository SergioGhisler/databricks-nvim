import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const host = window.location.hostname
const WS_URL = `ws://${host}:8787/ws`
const API_URL = `http://${host}:8787/api/employee-status`

const CANVAS_W = 1100
const CANVAS_H = 720

const statusColor = {
  idle: '#22c55e',
  busy: '#f59e0b',
  thinking: '#3b82f6',
  running_tool: '#a855f7',
  blocked: '#ef4444',
  done: '#14b8a6',
}

const bootstrapAgents = {
  main: { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString(), model: '' },
  'dev-bot': { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString(), model: '' },
  'research-bot': { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString(), model: '' },
  'ops-bot': { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString(), model: '' },
  clyde: { status: 'idle', task: 'Waiting', updatedAt: new Date().toISOString(), model: '' },
}

const deskSlots = [
  { x: 110, y: 250 },
  { x: 250, y: 250 },
  { x: 390, y: 250 },
  { x: 530, y: 250 },
  { x: 110, y: 430 },
  { x: 250, y: 430 },
  { x: 390, y: 430 },
  { x: 530, y: 430 },
]

const uniqueItems = ['☕', '📚', '🦆', '🎧', '🧪', '🕹', '🧠', '🚀']

const roomLabels = [
  { x: 80, y: 32, text: 'CONFERENCE' },
  { x: 320, y: 32, text: 'BOSS OFFICE' },
  { x: 560, y: 32, text: 'KITCHEN' },
]

const seatedStates = new Set(['working', 'busy', 'running_tool'])
const thinkingStates = new Set(['thinking'])

function App() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const agentsAnimRef = useRef({})

  const [agents, setAgents] = useState(bootstrapAgents)
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const pull = () => {
      fetch(API_URL)
        .then((r) => r.json())
        .then((data) => {
          if (data?.agents) setAgents(data.agents)
          if (Array.isArray(data?.events)) setEvents(data.events)
        })
        .catch(() => {})
    }

    pull()
    const timer = setInterval(pull, 5000)

    const ws = new WebSocket(WS_URL)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'state.snapshot') {
        if (msg?.data?.agents) setAgents(msg.data.agents)
        if (Array.isArray(msg?.data?.events)) setEvents(msg.data.events)
      }
      if (msg.type === 'agent.updated') {
        const event = msg.data || {}
        const payload = event.data || event
        if (payload?.name) {
          setAgents((prev) => ({ ...prev, [payload.name]: payload }))
        }
        setEvents((prev) => [event, ...prev].slice(0, 200))
      }
    }

    return () => {
      clearInterval(timer)
      ws.close()
    }
  }, [])

  const agentList = useMemo(() => Object.entries(agents), [agents])

  const recentEventsByAgent = useMemo(() => {
    const map = {}
    for (const e of events) {
      const payload = e?.data || e || {}
      const name = payload?.name
      if (!name) continue
      if (!map[name]) map[name] = []
      if (map[name].length < 3) {
        map[name].push({
          status: payload?.status || 'idle',
          task: payload?.task || 'n/a',
          at: e?.at || e?.updatedAt || payload?.updatedAt,
        })
      }
    }
    return map
  }, [events])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const initAgentAnim = () => {
      const next = { ...agentsAnimRef.current }
      agentList.forEach(([name], i) => {
        const desk = deskSlots[i % deskSlots.length]
        if (!next[name]) {
          next[name] = {
            x: 820 + (i % 2) * 80,
            y: 200 + i * 55,
            tx: 760 + Math.random() * 280,
            ty: 190 + Math.random() * 320,
            step: 0,
            lastStepAt: 0,
            wanderAt: Date.now(),
            pauseUntil: 0,
            prevStatus: 'idle',
          }
        }
      })
      agentsAnimRef.current = next
    }

    const drawRect = (x, y, w, h, c) => {
      ctx.fillStyle = c
      ctx.fillRect(x, y, w, h)
    }

    const drawStaticWorld = () => {
      for (let y = 0; y < CANVAS_H - 70; y += 20) {
        for (let x = 0; x < CANVAS_W; x += 20) {
          const dark = ((x + y) / 20) % 2 === 0
          drawRect(x, y, 20, 20, dark ? '#121212' : '#181818')
        }
      }

      drawRect(0, 0, 700, 120, '#202020')
      drawRect(20, 20, 200, 80, '#313131')
      drawRect(250, 20, 200, 80, '#313131')
      drawRect(480, 20, 200, 80, '#313131')
      roomLabels.forEach((r) => {
        ctx.fillStyle = '#e5e7eb'
        ctx.font = '16px "JetBrains Mono", monospace'
        ctx.fillText(r.text, r.x, r.y)
      })

      drawRect(20, 130, 650, 420, '#1c1c1c')
      drawRect(330, 130, 30, 420, '#252525')
      drawRect(20, 330, 650, 30, '#252525')

      deskSlots.forEach((d, i) => {
        drawRect(d.x - 40, d.y - 24, 80, 48, '#2e2e2e')
        drawRect(d.x - 18, d.y - 18, 36, 20, '#0f172a')
        drawRect(d.x - 15, d.y + 8, 30, 12, '#444')
        drawRect(d.x + 24, d.y - 16, 10, 10, '#6b7280')
        ctx.fillStyle = '#facc15'
        ctx.font = '14px "JetBrains Mono", monospace'
        ctx.fillText(uniqueItems[i], d.x + 22, d.y + 18)
      })

      drawRect(700, 40, 380, 510, '#1f2937')
      drawRect(740, 90, 140, 44, '#6b21a8')
      drawRect(900, 110, 90, 30, '#374151')
      drawRect(1000, 80, 30, 70, '#60a5fa')
      drawRect(760, 190, 40, 40, '#16a34a')
      drawRect(820, 220, 40, 40, '#16a34a')
      drawRect(920, 220, 120, 60, '#065f46')
      drawRect(930, 230, 100, 40, '#0f766e')
      drawRect(890, 320, 160, 95, '#f8fafc')

      for (let i = 0; i < 12; i++) {
        const px = 40 + (i * 88) % 1000
        const py = 560 + (i % 3) * 24
        drawRect(px, py, 12, 12, '#16a34a')
        drawRect(px + 4, py + 10, 4, 10, '#166534')
      }
    }

    const drawAgent = (name, agent, anim, i, now) => {
      const desk = deskSlots[i % deskSlots.length]
      const status = agent.status || 'idle'
      const shouldSit = seatedStates.has(status)
      const isThinking = thinkingStates.has(status)
      const prevStatus = anim.prevStatus || 'idle'

      if (status !== prevStatus) {
        anim.prevStatus = status

        // Immediate unseat for non-seated statuses.
        if (!shouldSit) {
          const nearDeskNow = Math.abs(anim.x - desk.x) < 18 && Math.abs(anim.y - (desk.y + 42)) < 16
          if (nearDeskNow) {
            anim.tx = desk.x + 50
            anim.ty = desk.y + 56
          }
          anim.pauseUntil = 0
        }
      }

      if (shouldSit) {
        anim.tx = desk.x
        anim.ty = desk.y + 42
      } else if (isThinking) {
        // Thinking: stand and occasionally pause, but never sit.
        if (!anim.pauseUntil && now - anim.wanderAt > 2100) {
          anim.tx = 760 + Math.random() * 280
          anim.ty = 190 + Math.random() * 320
          anim.wanderAt = now
          anim.pauseUntil = now + 700 + Math.random() * 900
        }
        if (anim.pauseUntil && now >= anim.pauseUntil) {
          anim.pauseUntil = 0
        }
      } else if (now - anim.wanderAt > 2200) {
        anim.tx = 760 + Math.random() * 280
        anim.ty = 190 + Math.random() * 320
        anim.wanderAt = now
        anim.pauseUntil = 0
      }

      const dx = anim.tx - anim.x
      const dy = anim.ty - anim.y
      const dist = Math.hypot(dx, dy)
      const pausedThinking = isThinking && anim.pauseUntil && now < anim.pauseUntil
      const speed = shouldSit ? 1.7 : 1.2
      if (dist > 2 && !pausedThinking) {
        anim.x += (dx / dist) * speed
        anim.y += (dy / dist) * speed
      }

      if (now - anim.lastStepAt > 260) {
        anim.step = anim.step ? 0 : 1
        anim.lastStepAt = now
      }

      const nearDesk = Math.abs(anim.x - desk.x) < 14 && Math.abs(anim.y - (desk.y + 42)) < 12
      const sitting = shouldSit && nearDesk

      const body = ['#f97316', '#38bdf8', '#a78bfa', '#34d399', '#f43f5e'][i % 5]
      const x = Math.round(anim.x)
      const y = Math.round(anim.y)

      drawRect(x - 8, y - 36, 16, 10, '#f5d0a9')
      drawRect(x - 10, y - 26, 20, 16, body)

      if (sitting) {
        drawRect(x - 10, y - 10, 20, 10, body)
      } else {
        const legOffset = anim.step ? 3 : 0
        drawRect(x - 8, y - 10, 6, 12 + legOffset, '#334155')
        drawRect(x + 2, y - 10, 6, 12 + (anim.step ? 0 : 3), '#334155')
      }

      ctx.fillStyle = '#e5e7eb'
      ctx.font = '12px "JetBrains Mono", monospace'
      ctx.fillText(name, x - 24, y - 44)

      drawRect(x + 12, y - 36, 7, 7, statusColor[agent.status] || '#94a3b8')

      anim.hitbox = { x: x - 12, y: y - 40, w: 26, h: 42, name }
    }

    const render = (now) => {
      initAgentAnim()
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      drawStaticWorld()

      agentList.forEach(([name, agent], i) => {
        const anim = agentsAnimRef.current[name]
        if (!anim) return
        drawAgent(name, agent, anim, i, now)
      })

      drawRect(0, CANVAS_H - 70, CANVAS_W, 70, '#0b1220')
      agentList.forEach(([name, agent], i) => {
        const x = 16 + i * 210
        drawRect(x, CANVAS_H - 56, 196, 40, '#111827')
        drawRect(x + 8, CANVAS_H - 42, 10, 10, statusColor[agent.status] || '#94a3b8')
        ctx.fillStyle = '#d1d5db'
        ctx.font = '13px "JetBrains Mono", monospace'
        ctx.fillText(`${name} · ${agent.status}`, x + 24, CANVAS_H - 32)
      })

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)

    const onMove = (ev) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((ev.clientX - rect.left) / rect.width) * CANVAS_W
      const y = ((ev.clientY - rect.top) / rect.height) * CANVAS_H
      const hit = Object.values(agentsAnimRef.current).find((a) => {
        const h = a.hitbox
        return h && x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h
      })
      if (hit?.name) {
        const name = hit.name
        setHover({
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
          name,
          agent: agents[name],
          events: recentEventsByAgent[name] || [],
        })
      } else {
        setHover(null)
      }
    }

    const onLeave = () => setHover(null)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [agentList, agents, recentEventsByAgent])

  return (
    <div className="page">
      <header className="header">
        <h1>Mission Control · Retro Office</h1>
        <span className={connected ? 'pill ok' : 'pill err'}>{connected ? 'WS live' : 'WS offline'}</span>
      </header>

      <div className="canvas-wrap">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="retro-canvas" />
        {hover && hover.agent && (
          <div className="hover-popover" style={{ left: hover.x + 14, top: hover.y + 14 }}>
            <h3>{hover.name}</h3>
            <p><b>Status:</b> {hover.agent.status || 'idle'}</p>
            <p><b>Model:</b> {hover.agent.model || 'n/a'}</p>
            <p><b>Task:</b> {hover.agent.task || 'n/a'}</p>
            <p><b>Last 3 events:</b></p>
            <ul>
              {hover.events.length > 0 ? hover.events.map((e, idx) => (
                <li key={`${hover.name}-${idx}`}>{e.status} · {e.task}</li>
              )) : <li>none</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
