window.__ModuleLoader__.load({
  id: 'dsh-showroom',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const React = require('react');
    const inject = ['slots', 'connection', 'remote'];
    const SETTINGS_NS = 'dsh-showroom';

    function apply(ctx) {
      const api = ctx.connection.api;

      const selStyle = {
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit',
      };
      const taStyle = Object.assign({}, selStyle, { minHeight: 88, resize: 'vertical' });
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
              enabled: value.enabled !== false,
              hubPort: typeof value.hubPort === 'number' ? value.hubPort : 18765,
              remoteEnabled: value.remoteEnabled === true,
              accessKey: typeof value.accessKey === 'string' ? value.accessKey : '',
              sceneWelcome: typeof value.sceneWelcome === 'string' ? value.sceneWelcome : '',
              scenePresent: typeof value.scenePresent === 'string' ? value.scenePresent : '',
              sceneDemo: typeof value.sceneDemo === 'string' ? value.sceneDemo : '',
              sceneExit: typeof value.sceneExit === 'string' ? value.sceneExit : '',
              wishScene: typeof value.wishScene === 'string' ? value.wishScene : '',
              wishCooldownSec: typeof value.wishCooldownSec === 'number' ? value.wishCooldownSec : 45,
              entityAliases: typeof value.entityAliases === 'string' ? value.entityAliases : '',
              layoutJson: typeof value.layoutJson === 'string' ? value.layoutJson : '',
              pollMs: typeof value.pollMs === 'number' ? value.pollMs : 3000,
              autoConfirmVision: value.autoConfirmVision !== false,
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
          try {
            const ops = [
              { op: 'set', path: ['enabled'], value: !!draft.enabled },
              { op: 'set', path: ['hubPort'], value: Number(draft.hubPort) || 18765 },
              { op: 'set', path: ['remoteEnabled'], value: !!draft.remoteEnabled },
              { op: 'set', path: ['accessKey'], value: draft.accessKey },
              { op: 'set', path: ['sceneWelcome'], value: draft.sceneWelcome },
              { op: 'set', path: ['scenePresent'], value: draft.scenePresent },
              { op: 'set', path: ['sceneDemo'], value: draft.sceneDemo },
              { op: 'set', path: ['sceneExit'], value: draft.sceneExit },
              { op: 'set', path: ['wishScene'], value: draft.wishScene },
              { op: 'set', path: ['wishCooldownSec'], value: Number(draft.wishCooldownSec) || 45 },
              { op: 'set', path: ['entityAliases'], value: draft.entityAliases },
              { op: 'set', path: ['layoutJson'], value: draft.layoutJson },
              { op: 'set', path: ['pollMs'], value: Number(draft.pollMs) || 3000 },
              { op: 'set', path: ['autoConfirmVision'], value: !!draft.autoConfirmVision },
            ];
            const res = await api.settings.mutate({
              ns: SETTINGS_NS,
              ops,
              expectedRevision: meta.revision,
            });
            if (res.result.ok) {
              setMeta((m) => (m ? Object.assign({}, m, { revision: res.result.value.revision }) : m));
              setSaved(true);
              load();
            }
          } finally {
            setBusy(false);
          }
        }

        if (missing) {
          return React.createElement('div', null, '未找到 dsh-showroom 设置命名空间。请升级到最新桌面端或检查 apiproxy 白名单补丁。');
        }
        if (!draft || !meta) {
          return React.createElement('div', { style: { fontSize: 13, opacity: 0.6 } }, '加载中…');
        }

        const port = Number(draft.hubPort) || 18765;
        return React.createElement('div', { style: { maxWidth: 640 } },
          React.createElement('div', { style: { fontSize: 12, opacity: 0.7, marginBottom: 16, lineHeight: 1.5 } },
            `展厅编排：Show Mode、拍照控灯、孪生墙、许愿、多角色、只读诊断。语音 ASR 不在本插件内。孪生墙 http://127.0.0.1:${port}/twin.html`,
          ),
          React.createElement(Field, { label: '启用展厅插件' },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: draft.enabled, onChange: (e) => setDraft(Object.assign({}, draft, { enabled: e.target.checked })) }),
              '启用 showroom_* 工具与本地 Hub',
            ),
          ),
          React.createElement(Field, { label: 'Hub 端口', hint: '改端口后需重启会话 / 桌面端' },
            React.createElement('input', { type: 'number', value: draft.hubPort, style: selStyle, onChange: (e) => setDraft(Object.assign({}, draft, { hubPort: Number(e.target.value) || 18765 })) }),
          ),
          React.createElement(Field, { label: 'Show Mode 场景 entity_id', hint: '对应 HA scene.xxx' },
            React.createElement('input', { value: draft.sceneWelcome, style: selStyle, placeholder: 'welcome → scene.xxx', onChange: (e) => setDraft(Object.assign({}, draft, { sceneWelcome: e.target.value })) }),
            React.createElement('div', { style: { marginTop: 8 } },
              React.createElement('input', { value: draft.scenePresent, style: selStyle, placeholder: 'present → scene.xxx', onChange: (e) => setDraft(Object.assign({}, draft, { scenePresent: e.target.value })) }),
            ),
            React.createElement('div', { style: { marginTop: 8 } },
              React.createElement('input', { value: draft.sceneDemo, style: selStyle, placeholder: 'demo → scene.xxx', onChange: (e) => setDraft(Object.assign({}, draft, { sceneDemo: e.target.value })) }),
            ),
            React.createElement('div', { style: { marginTop: 8 } },
              React.createElement('input', { value: draft.sceneExit, style: selStyle, placeholder: 'exit → scene.xxx', onChange: (e) => setDraft(Object.assign({}, draft, { sceneExit: e.target.value })) }),
            ),
          ),
          React.createElement(Field, { label: '许愿场景 / 冷却秒', hint: '观众许愿触发的安全场景；未配置时仍广播文案' },
            React.createElement('input', { value: draft.wishScene, style: selStyle, placeholder: 'scene.wish_safe', onChange: (e) => setDraft(Object.assign({}, draft, { wishScene: e.target.value })) }),
            React.createElement('div', { style: { marginTop: 8 } },
              React.createElement('input', { type: 'number', value: draft.wishCooldownSec, style: selStyle, onChange: (e) => setDraft(Object.assign({}, draft, { wishCooldownSec: Number(e.target.value) || 45 })) }),
            ),
          ),
          React.createElement(Field, { label: '拍照控灯别名', hint: '每行：别名: entity_id' },
            React.createElement('textarea', { value: draft.entityAliases, style: taStyle, onChange: (e) => setDraft(Object.assign({}, draft, { entityAliases: e.target.value })) }),
          ),
          React.createElement(Field, { label: '拍照控灯自动执行', hint: '关闭后默认 dry_run，仅返回匹配' },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: draft.autoConfirmVision, onChange: (e) => setDraft(Object.assign({}, draft, { autoConfirmVision: e.target.checked })) }),
              '匹配后直接调用 HA',
            ),
          ),
          React.createElement(Field, { label: '孪生墙布局 JSON', hint: '{"nodes":[{"id":"light.x","label":"展台灯","x":20,"y":30}]}' },
            React.createElement('textarea', { value: draft.layoutJson, style: Object.assign({}, taStyle, { minHeight: 120 }), onChange: (e) => setDraft(Object.assign({}, draft, { layoutJson: e.target.value })) }),
          ),
          React.createElement(Field, { label: '状态轮询间隔 (ms)' },
            React.createElement('input', { type: 'number', value: draft.pollMs, style: selStyle, onChange: (e) => setDraft(Object.assign({}, draft, { pollMs: Number(e.target.value) || 3000 })) }),
          ),
          React.createElement('div', { style: { height: 1, background: 'var(--dsw-alias-border-l1)', margin: '8px 0 18px' } }),
          React.createElement(Field, { label: '远程展厅模式', hint: '监听 0.0.0.0；务必设置访问密钥。改完请重启桌面端。' },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: draft.remoteEnabled, onChange: (e) => setDraft(Object.assign({}, draft, { remoteEnabled: e.target.checked })) }),
              '允许局域网访问 Hub',
            ),
          ),
          React.createElement(Field, { label: '远程访问密钥', hint: '请求头 X-Showroom-Key 或 ?key=' },
            React.createElement('input', { type: 'password', value: draft.accessKey, style: selStyle, onChange: (e) => setDraft(Object.assign({}, draft, { accessKey: e.target.value })) }),
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' } },
            React.createElement('button', {
              onClick: save, disabled: busy || !meta.writable,
              style: Object.assign({}, btnStyle, { opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }),
            }, busy ? '保存中…' : '保存'),
            saved ? React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' } }, '已保存') : null,
          ),
        );
      }

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'showroom',
        order: 33,
        label: '展厅 Showroom',
      }, Section));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
