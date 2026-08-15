/**
 * dsh-homeassistant — native Home Assistant REST tools + MCP bridge config.
 *
 * Tools (when enabled + baseUrl/token set):
 *   ha_list_entities / ha_get_state / ha_call_service / ha_get_states_summary
 *
 * MCP: settings can enable streamable-http bridge; writes desktop-ha-mcp.json
 * so the desktop profile can insert @deepseek-ai/dsh-mcp-client on next boot.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

const SETTINGS_NS = 'dsh-homeassistant'
const MCP_STATE_FILE = 'desktop-ha-mcp.json'

const DEFAULT_DOMAINS =
  'light,switch,scene,script,input_boolean,climate,fan,media_player,cover,sensor,binary_sensor,weather'

const DANGEROUS_DOMAINS = new Set([
  'lock',
  'alarm_control_panel',
  'camera',
  'person',
  'device_tracker',
  'vacuum',
])

const configSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().default(''),
  token: z.string().default(''),
  allowDomains: z.string().default(DEFAULT_DOMAINS),
  blockDangerous: z.boolean().default(true),
  mcpEnabled: z.boolean().default(false),
  mcpUrl: z.string().default(''),
  mcpHeaderName: z.string().default(''),
  mcpHeaderValue: z.string().default(''),
})

function dshHomeDir() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function writeMcpState(cfg) {
  const file = path.join(dshHomeDir(), MCP_STATE_FILE)
  const payload = {
    enabled: !!cfg.mcpEnabled && String(cfg.mcpUrl || '').trim().length > 0,
    url: String(cfg.mcpUrl || '').trim(),
    headers: {},
    updatedAt: new Date().toISOString(),
  }
  if (cfg.mcpHeaderName && cfg.mcpHeaderValue) {
    payload.headers[String(cfg.mcpHeaderName).trim()] = String(cfg.mcpHeaderValue)
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return file
}

function parseDomains(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function entityDomain(entityId) {
  const id = String(entityId || '')
  const i = id.indexOf('.')
  return i === -1 ? '' : id.slice(0, i).toLowerCase()
}

function assertAllowed(cfg, entityId) {
  const domain = entityDomain(entityId)
  const allow = new Set(parseDomains(cfg.allowDomains))
  if (allow.size > 0 && !allow.has(domain) && !allow.has(entityId.toLowerCase())) {
    throw new Error(`实体 ${entityId} 不在 allowDomains 白名单（域名: ${domain || 'n/a'}）`)
  }
  if (cfg.blockDangerous && DANGEROUS_DOMAINS.has(domain)) {
    throw new Error(`实体域名 ${domain} 被 blockDangerous 拦截（门锁/报警等）。如需操作请在设置中关闭该保护。`)
  }
}

async function haFetch(cfg, apiPath, { method = 'GET', body, signal } = {}) {
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '')
  const token = String(cfg.token || '').trim()
  if (!base) throw new Error('未配置 Home Assistant baseUrl')
  if (!token) throw new Error('未配置 Home Assistant Long-Lived Access Token')
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
  if (!res.ok) {
    throw new Error(`HA HTTP ${res.status}: ${typeof json === 'object' ? JSON.stringify(json) : text}`)
  }
  return json
}

export const name = 'dsh-homeassistant'
export const inject = ['tools', 'settings', 'systemPrompt']
export function apply(ctx, config = {}) {
    const settings = ctx.settings
    if (settings) {
      try {
        settings.register(SETTINGS_NS, configSchema)
      } catch (e) {
        console.error('[ha] settings register failed:', e)
      }
    }

    function currentConfig() {
      if (settings) {
        try {
          const value = settings.get(SETTINGS_NS)
          if (value !== undefined) return value
        } catch {
          /* ignore */
        }
      }
      return {
        enabled: config.enabled === true,
        baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : '',
        token: typeof config.token === 'string' ? config.token : '',
        allowDomains: typeof config.allowDomains === 'string' ? config.allowDomains : DEFAULT_DOMAINS,
        blockDangerous: config.blockDangerous !== false,
        mcpEnabled: config.mcpEnabled === true,
        mcpUrl: typeof config.mcpUrl === 'string' ? config.mcpUrl : '',
        mcpHeaderName: typeof config.mcpHeaderName === 'string' ? config.mcpHeaderName : '',
        mcpHeaderValue: typeof config.mcpHeaderValue === 'string' ? config.mcpHeaderValue : '',
      }
    }

    let cfg = currentConfig()
    try {
      writeMcpState(cfg)
    } catch (e) {
      console.warn('[ha] write mcp state failed:', e?.message || e)
    }

    const offSettings = settings
      ? ctx.on('settings/updated', (ns) => {
          if (ns !== SETTINGS_NS) return
          cfg = currentConfig()
          try {
            writeMcpState(cfg)
          } catch (e) {
            console.warn('[ha] write mcp state failed:', e?.message || e)
          }
        })
      : () => {}

    ctx.systemPrompt.section({
      name: 'tool:homeassistant',
      order: 125,
      text:
        'Home Assistant tools (ha_*): use them to query or control smart-home entities when the user asks about lights, climate, scenes, etc. Respect domain allowlists. Prefer ha_get_states_summary before bulk actions. Never unlock doors or disarm alarms unless the user explicitly requests it and the tools allow it.',
    })

    const disposers = []

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'ha_list_entities',
          description:
            'List Home Assistant entity_ids (optionally filtered by domain). Returns id, state, and friendly_name.',
          parameters: {
            domain: {
              type: 'string',
              description: 'Optional domain filter, e.g. light / switch / climate',
            },
            query: {
              type: 'string',
              description: 'Optional substring filter on entity_id or friendly_name',
            },
            limit: {
              type: 'number',
              description: 'Max rows (default 80, max 200)',
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                count: { type: 'number', required: true },
                entities: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      entity_id: { type: 'string', required: true },
                      state: { type: 'string', required: true },
                      friendly_name: { type: 'string' },
                      domain: { type: 'string', required: true },
                    },
                  },
                },
              },
            },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
          },
          timeoutMs: 30_000,
          isConcurrencySafe: () => true,
          async execute(args, exec) {
            if (!cfg.enabled) throw new Error('Home Assistant 插件未启用（设置 → Home Assistant）')
            const states = await haFetch(cfg, '/api/states', { signal: exec.signal })
            const domainFilter = typeof args.domain === 'string' ? args.domain.trim().toLowerCase() : ''
            const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
            const limit = Math.min(200, Math.max(1, Number(args.limit) || 80))
            const allow = new Set(parseDomains(cfg.allowDomains))
            const rows = []
            for (const st of Array.isArray(states) ? states : []) {
              const entityId = String(st.entity_id || '')
              const domain = entityDomain(entityId)
              if (allow.size && !allow.has(domain) && !allow.has(entityId.toLowerCase())) continue
              if (cfg.blockDangerous && DANGEROUS_DOMAINS.has(domain)) continue
              if (domainFilter && domain !== domainFilter) continue
              const name = String(st.attributes?.friendly_name || '')
              if (query && !entityId.toLowerCase().includes(query) && !name.toLowerCase().includes(query)) {
                continue
              }
              rows.push({
                entity_id: entityId,
                state: String(st.state ?? ''),
                friendly_name: name || undefined,
                domain,
              })
              if (rows.length >= limit) break
            }
            return { count: rows.length, entities: rows }
          },
        }),
      ),
    )

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'ha_get_state',
          description: 'Get one Home Assistant entity state document.',
          parameters: {
            entity_id: {
              type: 'string',
              required: true,
              description: 'Entity id, e.g. light.living_room',
            },
          },
          output: {
            schema: { type: 'json' },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
          },
          timeoutMs: 20_000,
          isConcurrencySafe: () => true,
          async execute(args, exec) {
            if (!cfg.enabled) throw new Error('Home Assistant 插件未启用')
            const entityId = String(args.entity_id || '').trim()
            assertAllowed(cfg, entityId)
            return haFetch(cfg, `/api/states/${encodeURIComponent(entityId)}`, { signal: exec.signal })
          },
        }),
      ),
    )

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'ha_get_states_summary',
          description: 'Summarize entity counts by domain for allowed domains (quick overview).',
          parameters: {},
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                domains: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      domain: { type: 'string', required: true },
                      count: { type: 'number', required: true },
                    },
                  },
                },
                total: { type: 'number', required: true },
              },
            },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
          },
          timeoutMs: 30_000,
          isConcurrencySafe: () => true,
          async execute(_args, exec) {
            if (!cfg.enabled) throw new Error('Home Assistant 插件未启用')
            const states = await haFetch(cfg, '/api/states', { signal: exec.signal })
            const allow = new Set(parseDomains(cfg.allowDomains))
            const counts = new Map()
            let total = 0
            for (const st of Array.isArray(states) ? states : []) {
              const entityId = String(st.entity_id || '')
              const domain = entityDomain(entityId)
              if (allow.size && !allow.has(domain)) continue
              if (cfg.blockDangerous && DANGEROUS_DOMAINS.has(domain)) continue
              counts.set(domain, (counts.get(domain) || 0) + 1)
              total += 1
            }
            return {
              total,
              domains: [...counts.entries()]
                .map(([domain, count]) => ({ domain, count }))
                .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)),
            }
          },
        }),
      ),
    )

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'ha_call_service',
          description:
            'Call a Home Assistant service (e.g. domain=light, service=turn_on, entity_id=...). Respects allowlist and dangerous-domain block.',
          parameters: {
            domain: { type: 'string', required: true, description: 'Service domain, e.g. light' },
            service: { type: 'string', required: true, description: 'Service name, e.g. turn_on' },
            entity_id: {
              type: 'string',
              description: 'Target entity_id (recommended). May be comma-separated.',
            },
            data_json: {
              type: 'string',
              description: 'Optional extra service data as JSON object string',
            },
          },
          output: {
            schema: { type: 'json' },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
          },
          timeoutMs: 45_000,
          isConcurrencySafe: () => false,
          async execute(args, exec) {
            if (!cfg.enabled) throw new Error('Home Assistant 插件未启用')
            const domain = String(args.domain || '').trim().toLowerCase()
            const service = String(args.service || '').trim()
            if (!domain || !service) throw new Error('domain/service 必填')
            const entityRaw = typeof args.entity_id === 'string' ? args.entity_id.trim() : ''
            const entityIds = entityRaw
              ? entityRaw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
              : []
            for (const id of entityIds) assertAllowed(cfg, id)
            if (!entityIds.length) {
              const allow = new Set(parseDomains(cfg.allowDomains))
              if (allow.size && !allow.has(domain)) {
                throw new Error(`服务域名 ${domain} 不在 allowDomains 白名单`)
              }
              if (cfg.blockDangerous && DANGEROUS_DOMAINS.has(domain)) {
                throw new Error(`服务域名 ${domain} 被 blockDangerous 拦截`)
              }
            }
            let extra = {}
            if (typeof args.data_json === 'string' && args.data_json.trim()) {
              extra = JSON.parse(args.data_json)
              if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
                throw new Error('data_json 必须是 JSON 对象')
              }
            }
            const body = { ...extra }
            if (entityIds.length === 1) body.entity_id = entityIds[0]
            else if (entityIds.length > 1) body.entity_id = entityIds
            const result = await haFetch(cfg, `/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, {
              method: 'POST',
              body,
              signal: exec.signal,
            })
            return { ok: true, domain, service, entity_id: body.entity_id ?? null, result }
          },
        }),
      ),
    )

    return () => {
      offSettings()
      for (const d of disposers) {
        try {
          d()
        } catch {
          /* ignore */
        }
      }
    }
  }
