'use strict'

/**
 * Local showroom hub: static pages + SSE event bus + HA REST proxy.
 * Default bind 127.0.0.1:18765; optional LAN bind + access key (remote mode).
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.md': 'text/markdown; charset=utf-8',
    }[ext] || 'application/octet-stream'
  )
}

export function createShowroomHub({
  webRoot,
  getHaConfig,
  getShowroomConfig,
  onWish,
  onMode,
  host = '127.0.0.1',
  port = 18765,
}) {
  /** @type {Set<import('node:http').ServerResponse>} */
  const sseClients = new Set()
  const recent = []

  function broadcast(event) {
    const payload = { ...event, ts: Date.now() }
    recent.push(payload)
    while (recent.length > 100) recent.shift()
    const raw = `data: ${JSON.stringify(payload)}\n\n`
    for (const res of sseClients) {
      try {
        res.write(raw)
      } catch {
        sseClients.delete(res)
      }
    }
  }

  async function haFetch(apiPath, { method = 'GET', body } = {}) {
    const ha = getHaConfig() || {}
    const base = String(ha.baseUrl || '').replace(/\/+$/, '')
    const token = String(ha.token || '').trim()
    if (!base || !token) throw new Error('HA 未配置（设置 → Home Assistant）')
    const url = `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text }
    }
    if (!res.ok) throw new Error(`HA HTTP ${res.status}: ${text.slice(0, 200)}`)
    return json
  }

  function authorize(req, urlObj) {
    const cfg = getShowroomConfig() || {}
    if (!cfg.remoteEnabled) return true
    const key = String(cfg.accessKey || '')
    if (!key) return true
    const q = urlObj.searchParams.get('key')
    const header = req.headers['x-showroom-key']
    return q === key || header === key
  }

  const server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
      if (!authorize(req, urlObj)) {
        res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('unauthorized')
        return
      }

      if (urlObj.pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true, sse: sseClients.size, recent: recent.length }))
        return
      }

      if (urlObj.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ events: recent }))
        return
      }

      if (urlObj.pathname === '/api/stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        res.write(`data: ${JSON.stringify({ type: 'hello', recent })}\n\n`)
        sseClients.add(res)
        req.on('close', () => sseClients.delete(res))
        return
      }

      if (urlObj.pathname === '/api/layout') {
        const cfg = getShowroomConfig() || {}
        let layout = {
          title: '展厅孪生墙',
          nodes: [
            { id: 'light.demo_a', label: '射灯 A', x: 22, y: 30 },
            { id: 'light.demo_b', label: '射灯 B', x: 55, y: 30 },
            { id: 'light.demo_c', label: '灯带', x: 40, y: 62 },
          ],
        }
        try {
          if (cfg.layoutJson && String(cfg.layoutJson).trim()) {
            layout = JSON.parse(cfg.layoutJson)
          }
        } catch {
          /* keep default */
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(layout))
        return
      }

      if (urlObj.pathname === '/api/config') {
        const cfg = getShowroomConfig() || {}
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(
          JSON.stringify({
            modes: {
              welcome: cfg.sceneWelcome || '',
              present: cfg.scenePresent || '',
              demo: cfg.sceneDemo || '',
              exit: cfg.sceneExit || '',
            },
            roles: ['guide', 'butler', 'tech'],
            wishScene: cfg.wishScene || '',
            pollMs: Number(cfg.pollMs) || 3000,
          }),
        )
        return
      }

      if (urlObj.pathname === '/api/ha/states' && req.method === 'GET') {
        const states = await haFetch('/api/states')
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(states))
        return
      }

      if (urlObj.pathname === '/api/wish' && req.method === 'POST') {
        const chunks = []
        for await (const c of req) chunks.push(c)
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        const result = await onWish(body)
        broadcast({ type: 'wish', ok: !!result.ok, detail: result })
        res.writeHead(result.ok ? 200 : 429, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(result))
        return
      }

      if (urlObj.pathname === '/api/mode' && req.method === 'POST') {
        const chunks = []
        for await (const c of req) chunks.push(c)
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        const result = await onMode(body.mode)
        broadcast({ type: 'mode', mode: body.mode, ok: !!result.ok, detail: result })
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(result))
        return
      }

      let rel = urlObj.pathname === '/' ? '/twin.html' : urlObj.pathname
      rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '')
      const filePath = path.join(webRoot, rel)
      if (!filePath.startsWith(webRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404).end('not found')
        return
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) })
      fs.createReadStream(filePath).pipe(res)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }))
    }
  })

  let listening = null
  function start() {
    if (listening) return listening
    listening = new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => {
        server.off('error', reject)
        resolve({ host, port, url: `http://${host}:${port}/` })
      })
    })
    return listening
  }

  function stop() {
    for (const res of sseClients) {
      try {
        res.end()
      } catch {
        /* ignore */
      }
    }
    sseClients.clear()
    return new Promise((resolve) => server.close(() => resolve()))
  }

  return { start, stop, broadcast, server }
}

export function defaultWebRoot() {
  const candidates = [
    path.join(__dirname, '..', '..', 'showroom', 'web'),
    path.join(__dirname, 'web'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'twin.html'))) return c
  }
  return candidates[0]
}
