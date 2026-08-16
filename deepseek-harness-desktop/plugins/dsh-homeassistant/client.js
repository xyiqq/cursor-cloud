window.__ModuleLoader__.load({
  id: 'dsh-homeassistant',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const inject = ['slots', 'connection', 'remote'];
    const SETTINGS_NS = 'dsh-homeassistant';

    function apply(ctx) {
      const api = ctx.connection.api;

      const selStyle = {
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit',
      };
      const taStyle = Object.assign({}, selStyle, { minHeight: 72, resize: 'vertical' });
      const btnStyle = {
        boxSizing: 'border-box', height: 36, font: 'inherit', cursor: 'pointer',
        border: 'none', borderRadius: 18, justifyContent: 'center', alignItems: 'center',
        padding: '0 14px', fontSize: 14, lineHeight: '22px', display: 'inline-flex',
        background: 'var(--dsw-alias-button-primary-fill)',
        color: 'var(--dsw-alias-label-primary-foreground)',
      };

      function Field(props) {
        return React.createElement('div', { style: { marginBottom: 18 } },
          React.createElement('div', { style: { fontSize: 13, fontWeight: 600, marginBottom: 7 } }, props.label),
          props.children,
          props.hint ? React.createElement('div', { style: { fontSize: 12, opacity: 0.55, marginTop: 5 } }, props.hint) : null,
        );
      }

      function Section() {
        const [meta, setMeta] = React.useState(null);
        const [draft, setDraft] = React.useState(null);
        const [busy, setBusy] = React.useState(false);
        const [saved, setSaved] = React.useState(false);
        const [missing, setMissing] = React.useState(false);
        const [note, setNote] = React.useState('');

        function load() {
          api.settings.describe({}).then((sRes) => {
            const view = sRes.result.ok
              ? (sRes.result.value.namespaces || []).find((n) => n.ns === SETTINGS_NS)
              : undefined;
            if (!view) { setMissing(true); return; }
            const value = view.value || {};
            setMeta({
              revision: view.revision,
              writable: sRes.result.value.writable !== false,
            });
            setDraft({
              enabled: value.enabled === true,
              baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : '',
              token: typeof value.token === 'string' ? value.token : '',
              allowDomains: typeof value.allowDomains === 'string' ? value.allowDomains : '',
              blockDangerous: value.blockDangerous !== false,
              mcpEnabled: value.mcpEnabled === true,
              mcpUrl: typeof value.mcpUrl === 'string' ? value.mcpUrl : '',
              mcpHeaderName: typeof value.mcpHeaderName === 'string' ? value.mcpHeaderName : '',
              mcpHeaderValue: typeof value.mcpHeaderValue === 'string' ? value.mcpHeaderValue : '',
            });
          }).catch(() => { setMissing(true); });
        }

        React.useEffect(() => {
          load();
          const off = ctx.remote.$on('settings/document-updated', (ns) => {
            if (ns === SETTINGS_NS) load();
          });
          return off;
        }, []);

        async function save() {
          if (!draft || !meta) return;
          setBusy(true);
          setSaved(false);
          setNote('');
          try {
            const ops = [
              { op: 'set', path: ['enabled'], value: !!draft.enabled },
              { op: 'set', path: ['baseUrl'], value: draft.baseUrl },
              { op: 'set', path: ['token'], value: draft.token },
              { op: 'set', path: ['allowDomains'], value: draft.allowDomains },
              { op: 'set', path: ['blockDangerous'], value: !!draft.blockDangerous },
              { op: 'set', path: ['mcpEnabled'], value: !!draft.mcpEnabled },
              { op: 'set', path: ['mcpUrl'], value: draft.mcpUrl },
              { op: 'set', path: ['mcpHeaderName'], value: draft.mcpHeaderName },
              { op: 'set', path: ['mcpHeaderValue'], value: draft.mcpHeaderValue },
            ];
            const res = await api.settings.mutate({
              ns: SETTINGS_NS,
              ops,
              expectedRevision: meta.revision,
            });
            if (res.result.ok) {
              setMeta((m) => (m ? Object.assign({}, m, { revision: res.result.value.revision }) : m));
              setSaved(true);
              if (draft.mcpEnabled) {
                setNote('MCP 桥接配置已写入。请完全退出并重启桌面端后生效（原生 ha_* 工具保存后即可用）。');
              } else {
                setNote('已保存。原生 ha_* 工具立即生效。');
              }
              load();
            }
          } finally {
            setBusy(false);
          }
        }

        if (missing) {
          return React.createElement('div', null, '未找到 dsh-homeassistant 设置命名空间。请升级到最新桌面端或检查 apiproxy 白名单补丁。');
        }
        if (!draft || !meta) {
          return React.createElement('div', { style: { fontSize: 13, opacity: 0.6 } }, '加载中…');
        }

        return React.createElement('div', { style: { maxWidth: 620 } },
          React.createElement('div', { style: { fontSize: 12, opacity: 0.7, marginBottom: 16, lineHeight: 1.5 } },
            '两套接入：① 原生 REST 工具（ha_*）；② 可选 MCP（推荐 ha-mcp 的 streamable-http URL）。勿同时对同一 HA 开两套写操作以免冲突。',
          ),
          React.createElement(Field, { label: '启用原生 HA 工具', hint: '注册 ha_list_entities / ha_get_state / ha_call_service 等' },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: draft.enabled, onChange: (e) => setDraft(Object.assign({}, draft, { enabled: e.target.checked })) }),
              '启用 REST 工具',
            ),
          ),
          React.createElement(Field, { label: 'Home Assistant URL', hint: '例如 http://homeassistant.local:8123 或 http://192.168.1.x:8123' },
            React.createElement('input', { value: draft.baseUrl, style: selStyle, placeholder: 'http://homeassistant.local:8123', onChange: (e) => setDraft(Object.assign({}, draft, { baseUrl: e.target.value })) }),
          ),
          React.createElement(Field, { label: 'Long-Lived Access Token', hint: 'HA → 个人资料 → 长期访问令牌。保存在 DSH settings 中。' },
            React.createElement('input', { type: 'password', value: draft.token, style: selStyle, placeholder: 'eyJ…', onChange: (e) => setDraft(Object.assign({}, draft, { token: e.target.value })) }),
          ),
          React.createElement(Field, { label: '域名白名单', hint: '逗号分隔。示例：light,switch,scene,climate' },
            React.createElement('textarea', { value: draft.allowDomains, style: taStyle, onChange: (e) => setDraft(Object.assign({}, draft, { allowDomains: e.target.value })) }),
          ),
          React.createElement(Field, { label: '拦截危险域名', hint: '默认拦截 lock / alarm_control_panel 等' },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: draft.blockDangerous, onChange: (e) => setDraft(Object.assign({}, draft, { blockDangerous: e.target.checked })) }),
              '启用危险域名保护',
            ),
          ),
          React.createElement('div', { style: { height: 1, background: 'var(--dsw-alias-border-l1)', margin: '8px 0 18px' } }),
          React.createElement(Field, { label: '启用 MCP 桥接', hint: '通过 @deepseek-ai/dsh-mcp-client 连接 ha-mcp（streamable-http）。需重启桌面端。' },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: draft.mcpEnabled, onChange: (e) => setDraft(Object.assign({}, draft, { mcpEnabled: e.target.checked })) }),
              '启动时挂载 MCP Home Assistant',
            ),
          ),
          React.createElement(Field, { label: 'MCP URL', hint: 'ha-mcp / 自定义组件给出的 streamable-http 地址' },
            React.createElement('input', { value: draft.mcpUrl, style: selStyle, placeholder: 'http://homeassistant.local:9584/mcp', onChange: (e) => setDraft(Object.assign({}, draft, { mcpUrl: e.target.value })) }),
          ),
          React.createElement(Field, { label: '可选 MCP Header', hint: '若服务需要鉴权，填写 Header 名与值（如 Authorization）' },
            React.createElement('input', { value: draft.mcpHeaderName, style: selStyle, placeholder: 'Authorization', onChange: (e) => setDraft(Object.assign({}, draft, { mcpHeaderName: e.target.value })) }),
            React.createElement('div', { style: { marginTop: 8 } },
              React.createElement('input', { value: draft.mcpHeaderValue, style: selStyle, placeholder: 'Bearer …', onChange: (e) => setDraft(Object.assign({}, draft, { mcpHeaderValue: e.target.value })) }),
            ),
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' } },
            React.createElement('button', {
              onClick: save, disabled: busy || !meta.writable,
              style: Object.assign({}, btnStyle, { opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }),
            }, busy ? '保存中…' : '保存'),
            saved ? React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' } }, '已保存') : null,
          ),
          note ? React.createElement('div', { style: { fontSize: 12, opacity: 0.75, marginTop: 10, lineHeight: 1.5 } }, note) : null,
        );
      }

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'homeassistant',
        order: 32,
        label: 'Home Assistant',
      }, Section));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
