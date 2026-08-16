/**
 * dsh-showroom — exhibit orchestration (no ASR).
 *
 * Tools: showroom_set_mode / showroom_set_role / showroom_vision_control /
 *        showroom_announce / showroom_diagnose / showroom_list_layout
 * Hub: local SSE+REST pages for twin wall, wish pad, control panel.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createShowroomHub, defaultWebRoot } from './hub.mjs'

const SETTINGS_NS = 'dsh-showroom'
const HA_NS = 'dsh-homeassistant'

const ROLE_PROMPTS = {
  guide:
    '你是展厅导览员：热情、简洁，优先介绍产品亮点与演示流程；家居控制交给场景口令或管家角色。',
  butler:
    '你是展厅家居管家：优先使用 showroom_set_mode / showroom_vision_control / ha_* 控制白名单设备；危险动作拒绝；操作后用 showroom_announce 同步大屏。',
  tech:
    '你是技术讲解员：准确解释架构（DSH、HA、图片理解、孪生墙）；避免夸大；需要控设备时先说明再调用工具。',
}

const configSchema = z.object({
  enabled: z.boolean().default(true),
  hubPort: z.number().default(18765),
  remoteEnabled: z.boolean().default(false),
  accessKey: z.string().default(''),
  sceneWelcome: z.string().default(''),
  scenePresent: z.string().default(''),
  sceneDemo: z.string().default(''),
  sceneExit: z.string().default(''),
  wishScene: z.string().default(''),
  wishCooldownSec: z.number().default(45),
  entityAliases: z.string().default(''),
  layoutJson: z.string().default(''),
  pollMs: z.number().default(3000),
  autoConfirmVision: z.boolean().default(true),
})

function parseAliases(raw) {
  const map = new Map()
  for (const line of String(raw || '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const m = t.match(/^(.+?)\s*[:=]\s*(.+)$/)
    if (!m) continue
    map.set(m[1].trim().toLowerCase(), m[2].trim())
  }
  return map
}

function scoreMatch(state, query, aliases) {
  const q = query.toLowerCase()
  const id = String(state.entity_id || '').toLowerCase()
  const name = String(state.attributes?.friendly_name || '').toLowerCase()
  let score = 0
  if (id === q || name === q) score += 100
  if (name.includes(q) || id.includes(q)) score += 40
  for (const [alias, entityId] of aliases) {
    if (q.includes(alias) && id === entityId.toLowerCase()) score += 80
    if (alias.includes(q) && id === entityId.toLowerCase()) score += 50
  }
  for (const token of q.split(/[\s,，、]+/).filter((t) => t.length >= 2)) {
    if (name.includes(token) || id.includes(token)) score += 12
  }
  return score
}

async function haFetchFromCfg(ha, apiPath, { method = 'GET', body, signal } = {}) {
  const base = String(ha.baseUrl || '').replace(/\/+$/, '')
  const token = String(ha.token || '').trim()
  if (!base || !token) throw new Error('请先在设置 → Home Assistant 配置 URL 与 Token')
  const url = `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) throw new Error(`HA HTTP ${res.status}: ${text.slice(0, 240)}`)
  return json
}

function modeToSceneKey(mode) {
  const m = String(mode || '').toLowerCase()
  if (['welcome', '迎宾', '接待'].includes(m)) return 'welcome'
  if (['present', '讲解', 'presentation'].includes(m)) return 'present'
  if (['demo', '演示', 'show'].includes(m)) return 'demo'
  if (['exit', '离场', '结束'].includes(m)) return 'exit'
  return m
}

export const name = 'dsh-showroom'
export const inject = ['tools', 'settings', 'systemPrompt']

export function apply(ctx, config = {}) {
  const settings = ctx.settings
  if (settings) {
    try {
      settings.register(SETTINGS_NS, configSchema)
    } catch (e) {
      console.error('[showroom] settings register failed', e)
    }
  }

  function currentShowroom() {
    if (settings) {
      try {
        const v = settings.get(SETTINGS_NS)
        if (v !== undefined) return v
      } catch {
        /* ignore */
      }
    }
    return {
      enabled: config.enabled !== false,
      hubPort: config.hubPort || 18765,
      remoteEnabled: !!config.remoteEnabled,
      accessKey: config.accessKey || '',
      sceneWelcome: config.sceneWelcome || '',
      scenePresent: config.scenePresent || '',
      sceneDemo: config.sceneDemo || '',
      sceneExit: config.sceneExit || '',
      wishScene: config.wishScene || '',
      wishCooldownSec: config.wishCooldownSec || 45,
      entityAliases: config.entityAliases || '',
      layoutJson: config.layoutJson || '',
      pollMs: config.pollMs || 3000,
      autoConfirmVision: config.autoConfirmVision !== false,
    }
  }

  function currentHa() {
    if (settings) {
      try {
        const v = settings.get(HA_NS)
        if (v !== undefined) return v
      } catch {
        /* ignore */
      }
    }
    return { enabled: false, baseUrl: '', token: '', allowDomains: '', blockDangerous: true }
  }

  let cfg = currentShowroom()
  let role = 'guide'
  let lastWishAt = 0
  const disposers = []

  const hub = createShowroomHub({
    webRoot: defaultWebRoot(),
    getHaConfig: () => currentHa(),
    getShowroomConfig: () => currentShowroom(),
    onWish: async (body) => activateWish(body),
    onMode: async (mode) => activateMode(mode),
    host: cfg.remoteEnabled ? '0.0.0.0' : '127.0.0.1',
    port: Number(cfg.hubPort) || 18765,
  })

  async function activateMode(mode, signal) {
    const show = currentShowroom()
    const key = modeToSceneKey(mode)
    const sceneMap = {
      welcome: show.sceneWelcome,
      present: show.scenePresent,
      demo: show.sceneDemo,
      exit: show.sceneExit,
    }
    const scene = sceneMap[key]
    if (!scene) {
      return { ok: false, error: `未配置场景 ${key}（设置 → 展厅 Showroom）`, mode: key }
    }
    const ha = currentHa()
    await haFetchFromCfg(
      ha,
      '/api/services/scene/turn_on',
      { method: 'POST', body: { entity_id: scene }, signal },
    )
    hub.broadcast({
      type: 'mode',
      mode: key,
      entity_ids: [scene],
      tool: 'showroom_set_mode',
      ok: true,
    })
    return { ok: true, mode: key, scene }
  }

  async function activateWish(body = {}) {
    const show = currentShowroom()
    const cool = Math.max(5, Number(show.wishCooldownSec) || 45) * 1000
    const now = Date.now()
    if (now - lastWishAt < cool) {
      return {
        ok: false,
        error: `冷却中，请 ${Math.ceil((cool - (now - lastWishAt)) / 1000)}s 后再试`,
      }
    }
    const text = String(body?.text || body?.message || '').trim()
    lastWishAt = now
    hub.broadcast({
      type: 'announce',
      message: text ? `许愿：${text}` : '观众触发了许愿',
      ok: true,
      tool: 'wish',
    })
    try {
      const marker = path.join(
        process.env.DSH_HOME || path.join(os.homedir(), '.dsh'),
        'showroom-last-wish.json',
      )
      fs.mkdirSync(path.dirname(marker), { recursive: true })
      fs.writeFileSync(
        marker,
        `${JSON.stringify({ text, at: new Date().toISOString() }, null, 2)}\n`,
      )
    } catch {
      /* ignore */
    }
    if (!show.wishScene) {
      return { ok: true, scene: null, text, note: '未配置 wishScene，仅广播' }
    }
    const ha = currentHa()
    await haFetchFromCfg(ha, '/api/services/scene/turn_on', {
      method: 'POST',
      body: { entity_id: show.wishScene },
    })
    return { ok: true, scene: show.wishScene, text }
  }

  let roleText = ROLE_PROMPTS.guide
  ctx.systemPrompt.section({
    name: 'showroom:role',
    order: 40,
    get text() {
      return roleText
    },
  })
  ctx.systemPrompt.section({
    name: 'showroom:guide',
    order: 41,
    text:
      '展厅模式：优先 showroom_set_mode 切换迎宾/讲解/演示/离场；拍照控灯用 showroom_vision_control（query=画面描述, action=on|off|toggle）；重要操作后调用 showroom_announce；诊断用 showroom_diagnose（只读）。语音 ASR 不在本插件内。',
  })

  const offSettings = settings
    ? ctx.on('settings/updated', (ns) => {
        if (ns === SETTINGS_NS) cfg = currentShowroom()
      })
    : () => {}

  // Mirror HA tool activity onto the twin wall when possible.
  const offPost = ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    try {
      const name = exec?.name || ''
      if (!String(name).startsWith('ha_') && !String(name).startsWith('showroom_')) return decision
      const entityIds = []
      const args = exec?.args || {}
      if (typeof args.entity_id === 'string') entityIds.push(...args.entity_id.split(/[,;\s]+/).filter(Boolean))
      if (Array.isArray(args.entity_ids)) entityIds.push(...args.entity_ids)
      hub.broadcast({
        type: 'tool',
        tool: name,
        ok: decision?.kind !== 'reject' && !result?.isError,
        entity_ids: entityIds,
        args,
      })
    } catch {
      /* ignore */
    }
    return decision
  })

  hub
    .start()
    .then((info) => {
      console.log(`[showroom] hub ${info.url}twin.html`)
      try {
        const marker = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'showroom-hub.json')
        fs.mkdirSync(path.dirname(marker), { recursive: true })
        fs.writeFileSync(marker, `${JSON.stringify({ ...info, startedAt: new Date().toISOString() }, null, 2)}\n`)
      } catch {
        /* ignore */
      }
    })
    .catch((err) => console.error('[showroom] hub failed', err))

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'showroom_set_mode',
        description: 'Switch exhibit mode: welcome / present / demo / exit (maps to HA scenes).',
        parameters: {
          mode: {
            type: 'string',
            required: true,
            description: 'welcome|present|demo|exit or 迎宾/讲解/演示/离场',
          },
        },
        output: {
          schema: { type: 'json' },
          render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
        },
        timeoutMs: 30_000,
        isConcurrencySafe: () => false,
        async execute(args, exec) {
          if (!currentShowroom().enabled) throw new Error('展厅插件未启用')
          return activateMode(args.mode, exec.signal)
        },
      }),
    ),
  )

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'showroom_set_role',
        description: 'Switch showroom persona: guide | butler | tech. Optionally trigger a linked scene via mode.',
        parameters: {
          role: { type: 'string', required: true, description: 'guide|butler|tech' },
          mode: { type: 'string', description: 'Optional mode to run after role switch' },
        },
        output: {
          schema: { type: 'json' },
          render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
        },
        timeoutMs: 30_000,
        isConcurrencySafe: () => true,
        async execute(args, exec) {
          const next = String(args.role || '').toLowerCase()
          if (!ROLE_PROMPTS[next]) throw new Error('role 必须是 guide|butler|tech')
          role = next
          roleText = ROLE_PROMPTS[next]
          hub.broadcast({ type: 'role', role: next, ok: true })
          let modeResult = null
          if (args.mode) modeResult = await activateMode(args.mode, exec.signal)
          return { ok: true, role: next, modeResult }
        },
      }),
    ),
  )

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'showroom_vision_control',
        description:
          'Match HA entities from a natural-language/visual description and turn them on/off/toggle. Use after image understanding describes the photo.',
        parameters: {
          query: {
            type: 'string',
            required: true,
            description: 'Description from the photo / user, e.g. 左边射灯 / 灯带',
          },
          action: {
            type: 'string',
            required: true,
            description: 'on | off | toggle',
          },
          domain: { type: 'string', description: 'Optional domain filter, default light' },
          limit: { type: 'number', description: 'Max entities to control (default 3)' },
          dry_run: { type: 'boolean', description: 'If true, only return matches' },
        },
        output: {
          schema: { type: 'json' },
          render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
        },
        timeoutMs: 45_000,
        isConcurrencySafe: () => false,
        async execute(args, exec) {
          if (!currentShowroom().enabled) throw new Error('展厅插件未启用')
          const ha = currentHa()
          const show = currentShowroom()
          const action = String(args.action || '').toLowerCase()
          if (!['on', 'off', 'toggle'].includes(action)) throw new Error('action 必须是 on|off|toggle')
          const domain = String(args.domain || 'light').toLowerCase()
          const limit = Math.min(8, Math.max(1, Number(args.limit) || 3))
          const aliases = parseAliases(show.entityAliases)
          const states = await haFetchFromCfg(ha, '/api/states', { signal: exec.signal })
          const ranked = (Array.isArray(states) ? states : [])
            .filter((s) => String(s.entity_id || '').startsWith(`${domain}.`))
            .map((s) => ({ s, score: scoreMatch(s, String(args.query || ''), aliases) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
          if (!ranked.length) {
            const miss = {
              ok: false,
              error: `未匹配到实体：识别到「${args.query}」但白名单域名 ${domain} 下无对应设备`,
              matches: [],
            }
            hub.broadcast({ type: 'vision', ok: false, query: args.query, tool: 'showroom_vision_control' })
            return miss
          }
          const matches = ranked.map(({ s, score }) => ({
            entity_id: s.entity_id,
            friendly_name: s.attributes?.friendly_name,
            state: s.state,
            score,
          }))
          if (args.dry_run === true || (show.autoConfirmVision === false && args.dry_run !== false)) {
            return { ok: true, dry_run: true, action, matches }
          }
          const service = action === 'on' ? 'turn_on' : action === 'off' ? 'turn_off' : 'toggle'
          const entityIds = matches.map((m) => m.entity_id)
          await haFetchFromCfg(ha, `/api/services/${domain}/${service}`, {
            method: 'POST',
            body: { entity_id: entityIds },
            signal: exec.signal,
          })
          hub.broadcast({
            type: 'vision',
            ok: true,
            query: args.query,
            action,
            entity_ids: entityIds,
            tool: 'showroom_vision_control',
          })
          return { ok: true, action, service, matches, entity_ids: entityIds }
        },
      }),
    ),
  )

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'showroom_announce',
        description: 'Push a message / focus entities to the twin wall & tool visualizer.',
        parameters: {
          message: { type: 'string', required: true },
          entity_ids: { type: 'string', description: 'Comma-separated entity ids to highlight' },
        },
        output: {
          schema: { type: 'json' },
          render: (_a, v) => [{ type: 'text', text: JSON.stringify(v) }],
        },
        timeoutMs: 5_000,
        isConcurrencySafe: () => true,
        async execute(args) {
          const entity_ids = String(args.entity_ids || '')
            .split(/[,;\s]+/)
            .filter(Boolean)
          hub.broadcast({
            type: 'announce',
            message: String(args.message || ''),
            entity_ids,
            ok: true,
            tool: 'showroom_announce',
          })
          return { ok: true, message: args.message, entity_ids }
        },
      }),
    ),
  )

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'showroom_diagnose',
        description:
          'Read-only HA diagnosis for an entity or free-text alert. Suggests actions but does NOT auto-fix dangerous devices.',
        parameters: {
          entity_id: { type: 'string', description: 'Entity to inspect' },
          alert: { type: 'string', description: 'Alert text from HA automation' },
        },
        output: {
          schema: { type: 'json' },
          render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
        },
        timeoutMs: 30_000,
        isConcurrencySafe: () => true,
        async execute(args, exec) {
          const ha = currentHa()
          const entityId = String(args.entity_id || '').trim()
          const alert = String(args.alert || '').trim()
          const findings = []
          let state = null
          if (entityId) {
            state = await haFetchFromCfg(ha, `/api/states/${encodeURIComponent(entityId)}`, {
              signal: exec.signal,
            })
            findings.push({
              kind: 'state',
              entity_id: entityId,
              state: state.state,
              unavailable: state.state === 'unavailable' || state.state === 'unknown',
              attributes: {
                friendly_name: state.attributes?.friendly_name,
                device_class: state.attributes?.device_class,
              },
            })
          }
          const suggestions = []
          if (findings.some((f) => f.unavailable)) {
            suggestions.push('检查设备供电 / 网关 / Wi-Fi；可在 HA 中重新加载对应 integration（需人工）。')
          }
          if (/leak|漏水|water/i.test(alert)) {
            suggestions.push('优先确认阀门与传感器；不要自动操作锁具。通知值班人员。')
          }
          if (/offline|掉线|unavailable/i.test(alert) || findings.some((f) => f.unavailable)) {
            suggestions.push('只读确认周边路由与电源；避免批量重启。')
          }
          if (!suggestions.length) suggestions.push('汇总状态供人工判断；展厅模式默认不自动修复。')
          const out = {
            ok: true,
            alert: alert || null,
            state,
            findings,
            suggestions,
            auto_fix: false,
          }
          hub.broadcast({
            type: 'diagnose',
            ok: true,
            entity_ids: entityId ? [entityId] : [],
            message: suggestions[0],
            tool: 'showroom_diagnose',
          })
          return out
        },
      }),
    ),
  )

  disposers.push(
    ctx.tools.register(
      defineTool({
        name: 'showroom_list_layout',
        description: 'List twin-wall layout nodes and hub URL hint.',
        parameters: {},
        output: {
          schema: { type: 'json' },
          render: (_a, v) => [{ type: 'text', text: JSON.stringify(v, null, 2) }],
        },
        timeoutMs: 5_000,
        isConcurrencySafe: () => true,
        async execute() {
          const show = currentShowroom()
          let layout = { nodes: [] }
          try {
            if (show.layoutJson) layout = JSON.parse(show.layoutJson)
          } catch {
            /* ignore */
          }
          return {
            ok: true,
            hub: `http://127.0.0.1:${show.hubPort || 18765}/`,
            pages: {
              twin: 'twin.html',
              panel: 'panel.html',
              wish: 'wish.html',
              viz: 'viz.html',
            },
            layout,
            role,
          }
        },
      }),
    ),
  )

  return () => {
    offSettings()
    offPost()
    for (const d of disposers) {
      try {
        d()
      } catch {
        /* ignore */
      }
    }
    hub.stop().catch(() => {})
  }
}
