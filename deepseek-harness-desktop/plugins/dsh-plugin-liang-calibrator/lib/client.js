window.__ModuleLoader__.load({
	id: "dsh-plugin-liang-calibrator",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}

		const liang_menu_css = ".dsh-lm-root{min-width:0;position:relative}.dsh-lm-trigger{min-width:0;max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;display:flex}.dsh-lm-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsh-lm-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}.dsh-lm-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dsh-lm-triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.dsh-lm-triggerEffort{color:var(--dsw-alias-label-caption);flex:none}.dsh-lm-chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}.dsh-lm-chevronOpen{transform:rotate(180deg)}.dsh-lm-menu{z-index:20;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:min(240px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 8px);right:0;overflow:hidden}.dsh-lm-status,.dsh-lm-empty{color:var(--dsw-alias-label-tertiary);padding:10px;font-size:13px;line-height:20px}.dsh-lm-error,.dsh-lm-warning{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;padding:7px 8px;font-size:12px;line-height:18px;display:flex}.dsh-lm-warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}.dsh-lm-retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}.dsh-lm-groups{min-height:0;overflow-y:auto}.dsh-lm-group+.dsh-lm-group{margin-top:4px}.dsh-lm-groupTitle{z-index:1;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-tertiary);padding:5px 8px 3px;font-size:12px;font-weight:500;line-height:18px;position:sticky;top:0}.dsh-lm-option{width:100%;min-height:38px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:10px;outline:none;align-items:center;gap:8px;padding:6px 8px;display:flex}.dsh-lm-option:hover:not(:disabled),.dsh-lm-option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.dsh-lm-selected{background:0 0}.dsh-lm-option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.dsh-lm-optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}.dsh-lm-modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:20px;overflow:hidden}.dsh-lm-description{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}.dsh-lm-check{color:var(--dsw-alias-label-primary);flex:0 0 18px;place-items:center;display:grid}.dsh-lm-cell{width:100%;height:40px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;align-items:center;gap:8px;padding:0 10px;font-size:14px;line-height:22px;display:flex}.dsh-lm-cell:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-lm-cellLabel{text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;overflow:hidden}.dsh-lm-cellValue{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);flex:0 auto;overflow:hidden}.dsh-lm-cellChevron{color:var(--dsw-alias-label-tertiary);flex:none} .dsh-lm-menu{max-height:min(420px,100vh - 96px)}";
		if (typeof document !== "undefined") {
			for (const stale of document.querySelectorAll("style[data-plugin-css=\"dsh-plugin-liang-calibrator/menu\"]")) stale.remove();
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-liang-calibrator";
			tag.dataset.pluginCss = "dsh-plugin-liang-calibrator/menu";
			tag.textContent = liang_menu_css;
			document.head.appendChild(tag);
		}
		const liang_css = {
			"root": "dsh-lm-root",
			"trigger": "dsh-lm-trigger",
			"triggerLabel": "dsh-lm-triggerLabel",
			"triggerEffort": "dsh-lm-triggerEffort",
			"chevron": "dsh-lm-chevron",
			"chevronOpen": "dsh-lm-chevronOpen",
			"menu": "dsh-lm-menu",
			"status": "dsh-lm-status",
			"empty": "dsh-lm-empty",
			"error": "dsh-lm-error",
			"warning": "dsh-lm-warning",
			"retry": "dsh-lm-retry",
			"groups": "dsh-lm-groups",
			"group": "dsh-lm-group",
			"groupTitle": "dsh-lm-groupTitle",
			"option": "dsh-lm-option",
			"optionCopy": "dsh-lm-optionCopy",
			"modelName": "dsh-lm-modelName",
			"description": "dsh-lm-description",
			"check": "dsh-lm-check",
			"selected": "dsh-lm-selected",
			"cell": "dsh-lm-cell",
			"cellLabel": "dsh-lm-cellLabel",
			"cellValue": "dsh-lm-cellValue",
			"cellChevron": "dsh-lm-cellChevron",
		};		//#region lib/liang/effort-slider.js
		/**
		* Liang intensity calibrator (滑动变祖器): the model + thinking-effort
		* slider. The 0..30 range spans every provider/model/reasoning-effort
		* combination the directory offers, so DeepSeek-V4-Flash + DeepSeek-V4-Pro
		* with off/high/max each map 1:1 onto the six stages — 小难梁, 牢梁,
		* 梁子, 梁圣, 梁神, 梁祖. The portrait is drawn from the per-level
		* keyframes (frame-00..frame-30) rather than a scrubbed video: the dsh
		* static server answers without HTTP Range support, so media-element
		* seeking silently fails. Dragging commits the mapped selection without
		* closing the popup.
		*/
		const LIANG_MAX_LEVEL = 30;
		const LIANG_STAGE_SPAN = 5;
		const LIANG_STAGES = ["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"];
		const LIANG_FRAME_BASE = "/liang-assets/frames/";
		const liangFrameUrl = (level) => `${LIANG_FRAME_BASE}frame-${String(Math.max(0, Math.min(LIANG_MAX_LEVEL, level))).padStart(2, "0")}.webp`;
		/** Combo index owned by a slider position (proportional split of 0..30). */
		const liangComboIndexForPos = (position, count) => Math.max(0, Math.min(count - 1, Math.floor(position * count / (LIANG_MAX_LEVEL + 1))));
		/** Canonical slider position for a combo: first at 0, last at 30, middles even. */
		const liangPosForCombo = (index, count) => index <= 0 ? 0 : index >= count - 1 ? LIANG_MAX_LEVEL : Math.round(index * LIANG_MAX_LEVEL / (count - 1));
		/** Stage index for a slider position (six stages of five levels). */
		const liangStageForPos = (position) => Math.min(LIANG_STAGES.length - 1, Math.floor(position / LIANG_STAGE_SPAN));
		/** Stage index for a combo — for six combos this is the combo index itself. */
		const liangStageForCombo = (index, count) => liangStageForPos(liangPosForCombo(index, count));
		let liangStylesInjected = false;
		const ensureLiangStyles = () => {
			if (liangStylesInjected) return;
			liangStylesInjected = true;
			if (typeof document === "undefined") return;
			for (const stale of document.querySelectorAll("style[data-liang-effort]")) stale.remove();
			const css = ".dsh-liang{display:flex;flex-direction:column;gap:7px;padding:6px 6px 8px;width:228px;box-sizing:border-box;color:var(--dsw-alias-label-primary)}.dsh-liang-canvasWrap{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--dsw-alias-border-inverted);background:#1d1918}.dsh-liang-canvas{width:100%;aspect-ratio:1/1;display:block}.dsh-liang-canvasWrap::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,rgb(255 255 255/2.5%) 0 1px,transparent 1px 4px),radial-gradient(circle at 22% 18%,rgb(255 255 255/8%) 0 1px,transparent 1.5px);background-size:auto,7px 7px;mix-blend-mode:soft-light;opacity:.35}.dsh-liang-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#b8b4a9;font-size:12px;line-height:18px}.dsh-liang-readout{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:0 2px}.dsh-liang-id{display:flex;flex-direction:column;align-items:flex-start;min-width:0}.dsh-liang-stage{font-family:\"Songti SC\",STSong,\"SimSun\",serif;font-size:22px;font-weight:700;line-height:28px}.dsh-liang-combo{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}.dsh-liang-level{color:var(--dsw-alias-label-tertiary);font-family:\"SFMono-Regular\",Consolas,monospace;font-size:12px;line-height:18px}.dsh-liang-range{width:100%;margin:0;accent-color:#4d6bfe;cursor:pointer}.dsh-liang-markers{display:flex;justify-content:space-between;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;padding:0 2px}.dsh-liang-marker{white-space:nowrap}.dsh-liang-marker.is-current{color:#4d6bfe;font-weight:700}";
			const tag = document.createElement("style");
			tag.dataset.liangEffort = "";
			tag.textContent = css;
			document.head.appendChild(tag);
		};
		/**
		* The calibrator surface: it IS the model-select root pane, so opening the
		* composer's model seat lands straight on the slider. Combos are the
		* reasoning-effort levels of the *currently selected* model only — the
		* Model row beneath drills into the plain list to change models.
		* @param props - effort combos for the current model, current combo index, busy flag, commit verb.
		*/
		function LiangEffortSlider({ combos, currentIndex, busy, onChoose }) {
			ensureLiangStyles();
			const levelFromIndex = (index) => index <= -1 ? 0 : liangPosForCombo(index, combos.length);
			const canvasRef = (0, react.useRef)(null);
			const imagesRef = (0, react.useRef)(new Map());
			const lastCommitted = (0, react.useRef)(currentIndex);
			const [level, setLevel] = (0, react.useState)(() => levelFromIndex(currentIndex));
			const [ready, setReady] = (0, react.useState)(false);
			const [dragging, setDragging] = (0, react.useState)(false);
			const drawFrame = (image) => {
				const canvas = canvasRef.current;
				if (canvas === null) return;
				const ratio = Math.min(window.devicePixelRatio || 1, 2);
				const size = Math.max(1, Math.round((canvas.clientWidth || 200) * ratio));
				if (canvas.width !== size || canvas.height !== size) {
					canvas.width = size;
					canvas.height = size;
				}
				const context = canvas.getContext("2d");
				if (context === null) return;
				context.clearRect(0, 0, size, size);
				context.drawImage(image, 0, 0, size, size);
			};
			(0, react.useEffect)(() => {
				lastCommitted.current = currentIndex;
				if (currentIndex !== -1 && currentIndex !== liangComboIndexForPos(level, combos.length)) setLevel(levelFromIndex(currentIndex));
			}, [currentIndex, combos.length]);
			(0, react.useEffect)(() => {
				const frame = Math.max(0, Math.min(LIANG_MAX_LEVEL, Math.round(level)));
				const cache = imagesRef.current;
				const url = liangFrameUrl(frame);
				let image = cache.get(url);
				if (image === void 0) {
					image = new Image();
					cache.set(url, image);
					image.onload = () => {
						setReady(true);
						drawFrame(image);
					};
					image.src = url;
				} else if (image.complete) drawFrame(image);
				for (const near of [frame - 1, frame + 1]) {
					if (near < 0 || near > LIANG_MAX_LEVEL) continue;
					const nearUrl = liangFrameUrl(near);
					if (cache.has(nearUrl)) continue;
					const nearImage = new Image();
					cache.set(nearUrl, nearImage);
					nearImage.src = nearUrl;
				}
			}, [level]);
			(0, react.useEffect)(() => {
				if (!dragging) return;
				const stop = () => {
					setDragging(false);
				};
				window.addEventListener("pointerup", stop);
				window.addEventListener("pointercancel", stop);
				return () => {
					window.removeEventListener("pointerup", stop);
					window.removeEventListener("pointercancel", stop);
				};
			}, [dragging]);
			const comboIndex = combos.length === 0 ? -1 : liangComboIndexForPos(level, combos.length);
			const combo = comboIndex === -1 ? void 0 : combos[comboIndex];
			const stageIndex = comboIndex === -1 ? liangStageForPos(level) : liangStageForCombo(comboIndex, combos.length);
			const stage = LIANG_STAGES[stageIndex];
			const comboLabel = combo === void 0 ? void 0 : combo.effortName ?? combo.modelName;
			const commit = (raw) => {
				const position = Math.max(0, Math.min(LIANG_MAX_LEVEL, raw));
				setLevel(position);
				if (combos.length === 0) return;
				const index = liangComboIndexForPos(position, combos.length);
				if (lastCommitted.current === index) return;
				lastCommitted.current = index;
				onChoose(index);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-liang",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-liang-canvasWrap",
						children: [
							(0, react_jsx_runtime.jsx)("canvas", {
								ref: canvasRef,
								className: "dsh-liang-canvas",
								role: "img",
								"aria-label": `梁系强度：${stage}`
							}),
							!ready && (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-liang-load",
								children: "载入连续祖力…"
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-liang-readout",
						children: [
							(0, react_jsx_runtime.jsxs)("span", {
								className: "dsh-liang-id",
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: "dsh-liang-stage",
										children: stage
									}),
									comboLabel !== void 0 && (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-liang-combo",
										children: comboLabel
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: "dsh-liang-level",
								children: `${String(Math.round(level)).padStart(2, "0")} / ${LIANG_MAX_LEVEL}`
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("input", {
						type: "range",
						min: 0,
						max: LIANG_MAX_LEVEL,
						step: 0.01,
						value: level,
						disabled: busy && !dragging,
						className: "dsh-liang-range",
						"aria-label": "梁系强度",
						onPointerDown: () => {
							setDragging(true);
						},
						onPointerUp: () => {
							setDragging(false);
						},
						onPointerCancel: () => {
							setDragging(false);
						},
						onChange: (event) => {
							commit(Number(event.target.value));
						}
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "dsh-liang-markers",
						children: LIANG_STAGES.map((name, index) => {
							const markerCombo = combos.find((_, comboAt) => liangStageForCombo(comboAt, combos.length) === index);
							return (0, react_jsx_runtime.jsx)("span", {
								className: `dsh-liang-marker${index === stageIndex ? " is-current" : ""}`,
								title: markerCombo === void 0 ? void 0 : markerCombo.effortName ?? markerCombo.modelName,
								children: name
							}, index);
						})
					})
				]
			});
		}


		/**
		* ModelSelect: the composer's named model seat (`conversation.input.model`).
		* Two-level selection per figma 496:26454's MenuDropdown: the root menu is
		* the Model / Effort row pair (label + current value + a right chevron),
		* each drilling into its own list — the provider-grouped model list over
		* the shared directory, and the effort levels. The trigger (313:14108's
		* ToggleButton) shows both: model name + effort in the caption tone.
		* Data and submission ride the SAME per-session ModelDirectory as the
		* /model popup; exact-model reasoning metadata and the selected effort come
		* from the Host rather than a client-owned vocabulary. A rejected selection
		* announces through the shared transient Toast anchored to the composer
		* card; the in-menu strip with Retry remains the catalog-load surface.
		*/
		/**
		* Render the composer model seat.
		* @param props - owner share (locked) + injected face (shared directory
		* store/verbs) + the standard locale seat.
		* @returns the trigger and, while open, the two-level menu.
		*/
		function LiangModelSelect({ locked, available, directory, load, select, t }) {
			const state = (0, react.useSyncExternalStore)((fn) => directory.subscribe(fn), () => directory.getSnapshot());
			const [open, setOpen] = (0, react.useState)(false);
			const [pane, setPane] = (0, react.useState)("root");
			const lastActionRef = (0, react.useRef)("load");
			const [toast, setToast] = (0, react.useState)(null);
			const toastSeq = (0, react.useRef)(0);
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const itemRefs = (0, react.useRef)([]);
			const id = (0, react.useId)();
			const choices = (0, react.useMemo)(() => state.groups.flatMap((group) => group.models.map((model) => ({
				group,
				model,
				selection: {
					provider: group.id,
					model: model.id,
					...model.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: model.reasoning.defaultEffort }
				}
			}))), [state.groups]);
			const currentChoice = choices[state.current === null ? -1 : choices.findIndex((c) => c.selection.provider === state.current?.provider && c.selection.model === state.current.model)];
			const reasoning = currentChoice?.model.reasoning;
			const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
			const effortLabel = reasoning === void 0 ? void 0 : effectiveEffort === void 0 ? t("effort.providerDefault") : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
			/** Effort steps for the *current* model only — slider never switches models. */
			const combos = (0, react.useMemo)(() => {
				if (currentChoice === void 0) return [];
				const group = currentChoice.group;
				const model = currentChoice.model;
				if (model.reasoning === void 0) return [{
					provider: group.id,
					model: model.id,
					modelName: model.name,
					effort: void 0,
					effortName: void 0
				}];
				const efforts = [...model.reasoning.defaultEffort === void 0 ? [{
					effort: void 0,
					name: t("effort.providerDefault")
				}] : [], ...model.reasoning.efforts.map((effort) => ({
					effort: effort.id,
					name: effort.name
				}))];
				return efforts.map((level) => ({
					provider: group.id,
					model: model.id,
					modelName: model.name,
					effort: level.effort,
					effortName: level.name
				}));
			}, [currentChoice, t]);
			const currentComboIndex = state.current === null || combos.length === 0 ? -1 : combos.findIndex((combo) => combo.effort === effectiveEffort);
			const liangLabel = currentComboIndex === -1 ? void 0 : LIANG_STAGES[liangStageForCombo(currentComboIndex, combos.length)];
			const shownEffortLabel = liangLabel ?? effortLabel;
			const busy = state.status === "selecting";
			const reload = () => {
				lastActionRef.current = "load";
				load();
			};
			(0, react.useEffect)(() => {
				if (available) {
					lastActionRef.current = "load";
					load();
				}
			}, [available, load]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const closeOutside = (event) => {
					if (!rootRef.current?.contains(event.target)) setOpen(false);
				};
				document.addEventListener("mousedown", closeOutside);
				return () => {
					document.removeEventListener("mousedown", closeOutside);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				if (pane === "model" || document.activeElement === document.body) rootRef.current?.focus();
			}, [pane, open]);
			if (!available) return null;
			const show = () => {
				setPane("root");
				setOpen(true);
				reload();
			};
			const close = (restoreFocus = false) => {
				setOpen(false);
				setPane("root");
				if (restoreFocus) queueMicrotask(() => {
					triggerRef.current?.focus();
				});
			};
			const moveFocus = (offset) => {
				const items = itemRefs.current.filter((item) => item !== null);
				if (items.length === 0) return;
				const active = items.findIndex((item) => item === document.activeElement);
				items[(Math.max(active, 0) + offset + items.length) % items.length]?.focus();
			};
			const onRootKeyDown = (event) => {
				if (event.key === "Escape" && open) {
					event.preventDefault();
					if (pane !== "root") setPane("root");
					else close(true);
					return;
				}
				if (!open) return;
				if (event.target instanceof HTMLElement && event.target.closest(".dsh-liang") !== null) return;
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					moveFocus(event.key === "ArrowDown" ? 1 : -1);
				}
			};
			const onBlur = (event) => {
				if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return;
				close();
			};
			const settleSelection = (accepted) => {
				if (accepted) {
					if (rootRef.current !== null) close(true);
					return;
				}
				const message = directory.getSnapshot().error;
				if (message !== null) {
					toastSeq.current += 1;
					setToast({
						seq: toastSeq.current,
						text: t("error.action", { message })
					});
				}
			};
			const choose = (selection, keepOpen) => {
				if (state.current?.provider === selection.provider && state.current.model === selection.model) {
					if (keepOpen === true) setPane("root");
					else close(true);
					return;
				}
				lastActionRef.current = "select";
				select(selection).then((accepted) => {
					if (accepted && keepOpen === true) {
						setPane("root");
						return;
					}
					settleSelection(accepted);
				});
			};
			const chooseCombo = (combo, keepOpen) => {
				if (state.current === null) return;
				const selection = {
					provider: state.current.provider,
					model: state.current.model,
					...combo.effort === void 0 ? {} : { reasoningEffort: combo.effort }
				};
				if (effectiveEffort === (selection.reasoningEffort ?? void 0)) {
					if (keepOpen !== true) close(true);
					return;
				}
				lastActionRef.current = "select";
				select(selection).then((accepted) => {
					if (accepted && keepOpen === true) return;
					settleSelection(accepted);
				});
			};
			const modelLabel = currentChoice?.model.name ?? t("trigger.fallback");
			const triggerLabel = shownEffortLabel === void 0 ? modelLabel : `${modelLabel} · ${shownEffortLabel}`;
			const triggerAria = currentChoice === void 0 ? t("trigger.selectAria") : effortLabel === void 0 ? t("trigger.aria", { model: modelLabel }) : t("trigger.ariaEffort", {
				model: modelLabel,
				effort: effortLabel
			});
			itemRefs.current = [];
			let itemIndex = 0;
			const itemRef = () => {
				const at = itemIndex++;
				return (node) => {
					itemRefs.current[at] = node;
				};
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: liang_css.root,
				tabIndex: -1,
				onKeyDown: onRootKeyDown,
				onBlur,
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						ref: triggerRef,
						type: "button",
						className: liang_css.trigger,
						"aria-label": triggerAria,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						"aria-controls": open ? `${id}-menu` : void 0,
						title: triggerLabel,
						disabled: locked,
						onClick: () => {
							if (open) close();
							else show();
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: liang_css.triggerLabel,
								children: modelLabel
							}),
							shownEffortLabel !== void 0 && (0, react_jsx_runtime.jsx)("span", {
								className: liang_css.triggerEffort,
								title: effortLabel,
								children: shownEffortLabel
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: clsx(liang_css.chevron, open && liang_css.chevronOpen) })
						]
					}),
					open && (0, react_jsx_runtime.jsxs)("div", {
						id: `${id}-menu`,
						className: liang_css.menu,
						role: "menu",
						"aria-label": t("menu.aria"),
						"aria-busy": state.status === "loading" || busy,
						children: [
							pane === "root" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state.error !== null && lastActionRef.current === "load" && (0, react_jsx_runtime.jsxs)("div", {
								className: liang_css.error,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: liang_css.retry,
									onClick: reload,
									children: t("retry")
								})]
							}), currentChoice === void 0 ? (0, react_jsx_runtime.jsx)("div", {
								className: liang_css.empty,
								children: t("empty.models")
							}) : combos.length === 0 ? (0, react_jsx_runtime.jsx)("div", {
								className: liang_css.empty,
								children: t("empty.efforts")
							}) : (0, react_jsx_runtime.jsx)(LiangEffortSlider, {
								combos,
								currentIndex: currentComboIndex,
								busy,
								onChoose: (index) => {
									const combo = combos[index];
									if (combo === void 0) return;
									chooseCombo(combo, true);
								}
							}), (0, react_jsx_runtime.jsxs)("button", {
								ref: itemRef(),
								type: "button",
								role: "menuitem",
								className: liang_css.cell,
								onClick: () => {
									setPane("model");
								},
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: liang_css.cellLabel,
										children: t("menu.model")
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: liang_css.cellValue,
										children: modelLabel
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: liang_css.cellChevron })
								]
							})] }),
							pane === "model" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								state.status === "loading" && (0, react_jsx_runtime.jsx)("div", {
									className: liang_css.status,
									children: t("status.loading")
								}),
								state.error !== null && lastActionRef.current === "load" && (0, react_jsx_runtime.jsxs)("div", {
									className: liang_css.error,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: liang_css.retry,
										onClick: reload,
										children: t("retry")
									})]
								}),
								state.failures.map((failure) => (0, react_jsx_runtime.jsxs)("div", {
									className: liang_css.warning,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("warning.groupLoad", {
										name: failure.name,
										message: failure.message
									}) }), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: liang_css.retry,
										onClick: reload,
										children: t("retry")
									})]
								}, failure.id)),
								(0, react_jsx_runtime.jsx)("div", {
									className: clsx(liang_css.groups, "scrollable"),
									children: state.groups.map((group) => {
										const headingId = `${id}-${group.id}`;
										return (0, react_jsx_runtime.jsxs)("section", {
											role: "group",
											"aria-labelledby": headingId,
											className: liang_css.group,
											children: [(0, react_jsx_runtime.jsx)("div", {
												className: liang_css.groupTitle,
												id: headingId,
												children: group.name
											}), group.models.map((model) => {
												const selected = state.current?.provider === group.id && state.current.model === model.id;
												return (0, react_jsx_runtime.jsxs)("button", {
													ref: itemRef(),
													type: "button",
													role: "menuitemradio",
													"aria-checked": selected,
													className: clsx(liang_css.option, selected && liang_css.selected),
													title: model.name,
													disabled: busy,
													onClick: () => {
														choose({
															provider: group.id,
															model: model.id
														}, true);
													},
													children: [(0, react_jsx_runtime.jsxs)("span", {
														className: liang_css.optionCopy,
														children: [(0, react_jsx_runtime.jsx)("span", {
															className: liang_css.modelName,
															children: model.name
														}), model.description !== void 0 && (0, react_jsx_runtime.jsx)("span", {
															className: liang_css.description,
															children: model.description
														})]
													}), (0, react_jsx_runtime.jsx)("span", {
														className: liang_css.check,
														children: selected ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null
													})]
												}, model.id);
											})]
										}, group.id);
									})
								}),
								state.status === "ready" && choices.length === 0 && (0, react_jsx_runtime.jsx)("div", {
									className: liang_css.empty,
									children: t("empty.models")
								})
							] }),
						]
					}),
					toast !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: toast.text,
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, {}),
						anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
						onDone: () => {
							setToast(null);
						}
					}, toast.seq)
				]
			});
		}
		//#endregion
		
const zh = {
			"command.description": "选择本会话使用的模型",
			"option.loadError": "目录加载失败：{message}",
			"trigger.fallback": "选择模型",
			"trigger.selectAria": "选择模型",
			"trigger.aria": "选择模型，当前 {model}",
			"trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
			"menu.aria": "模型与梁系校准",
			"menu.model": "模型",
			"menu.effort": "梁系校准",
			"effort.providerDefault": "Default",
			"status.loading": "正在刷新模型列表…",
			"error.action": "模型操作失败：{message}",
			"action.reload": "重新加载",
			"warning.groupLoad": "{name} 加载失败：{message}",
			"empty.models": "没有可用的模型。",
			"blocked.composer": "当前模型不可用，请先选择模型",
			"empty.efforts": "当前模型未提供推理等级。"
		};
const en = {
			"command.description": "Select the model for this conversation",
			"option.loadError": "Catalog failed to load: {message}",
			"trigger.fallback": "Select model",
			"trigger.selectAria": "Select model",
			"trigger.aria": "Select model, current {model}",
			"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
			"menu.aria": "Model and Liang calibration",
			"menu.model": "Model",
			"menu.effort": "Liang Calibration",
			"effort.providerDefault": "Default",
			"status.loading": "Refreshing model list…",
			"error.action": "Model operation failed: {message}",
			"action.reload": "Reload",
			"warning.groupLoad": "{name} failed to load: {message}",
			"empty.models": "No models available.",
			"blocked.composer": "This model is unavailable — select one to continue",
			"empty.efforts": "This model provides no reasoning effort levels."
		};

		/** Dictionary namespace owned by this plugin. */
		const NS = "liang";
		const SETTINGS_NS = "dsh-liang-calibrator";
		/** Required services: locale, slots, sessions, model directory, settings API. */
		const inject = ["locale", "slots", "sessions", "modelDirectories", "connection", "remote"];
		/**
		* Client plugin body: settings section always available; model seat is only
		* shadowed while enabled (stock selector returns when turned off).
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "liang-calibrator: dictionaries");

			const api = ctx.connection.api;

			function SettingsSection() {
				const [meta, setMeta] = react.useState(null);
				const [draft, setDraft] = react.useState(null);
				const [busy, setBusy] = react.useState(false);
				const [saved, setSaved] = react.useState(false);
				const [missing, setMissing] = react.useState(false);

				const load = react.useCallback(() => {
					api.settings.describe({}).then((sRes) => {
						const view = sRes.result.ok
							? (sRes.result.value.namespaces || []).find((n) => n.ns === SETTINGS_NS)
							: undefined;
						if (!view) {
							setMissing(true);
							return;
						}
						const value = view.value || {};
						setMeta({
							revision: view.revision,
							writable: sRes.result.value.writable !== false
						});
						setDraft({
							enabled: value.enabled !== false
						});
						setMissing(false);
					}).catch(() => {
						setMissing(true);
					});
				}, []);

				react.useEffect(() => {
					load();
					const off = ctx.remote.$on("settings/document-updated", (ns) => {
						if (ns === SETTINGS_NS) load();
					});
					return off;
				}, [load]);

				async function save() {
					if (!draft || !meta) return;
					setBusy(true);
					setSaved(false);
					try {
						const res = await api.settings.mutate({
							ns: SETTINGS_NS,
							ops: [{
								op: "set",
								path: ["enabled"],
								value: !!draft.enabled
							}],
							expectedRevision: meta.revision
						});
						if (res.result.ok) {
							setMeta((m) => m ? Object.assign({}, m, { revision: res.result.value.revision }) : m);
							setSaved(true);
							load();
						}
					} finally {
						setBusy(false);
					}
				}

				if (missing) {
					return react.createElement("div", null, "未找到滑动变祖器设置。请升级到最新桌面端，或检查 apiproxy 白名单是否含 dsh-liang-calibrator。");
				}
				if (!draft || !meta) {
					return react.createElement("div", { style: { opacity: 0.6 } }, "加载中…");
				}

				const rowStyle = { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 };
				const btnStyle = {
					boxSizing: "border-box",
					height: 36,
					font: "inherit",
					cursor: busy ? "default" : "pointer",
					border: "none",
					borderRadius: 18,
					padding: "0 14px",
					fontSize: 14,
					background: "var(--dsw-alias-button-primary-fill)",
					color: "var(--dsw-alias-label-primary-foreground)",
					opacity: busy ? 0.6 : 1
				};

				return react.createElement("div", null,
					react.createElement("div", { style: { fontSize: 13, lineHeight: 1.55, opacity: 0.75, marginBottom: 16 } },
						"开启后，输入框旁的模型位使用滑动校准器（先选模型，再滑思考强度）。关闭后恢复官方默认模型选择器，一般无需重启。"
					),
					react.createElement("label", { style: rowStyle },
						react.createElement("input", {
							type: "checkbox",
							checked: !!draft.enabled,
							onChange: (e) => setDraft({ enabled: e.target.checked })
						}),
						react.createElement("span", null, "启用滑动变祖器")
					),
					react.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
						react.createElement("button", {
							type: "button",
							onClick: save,
							disabled: busy || !meta.writable,
							style: btnStyle
						}, busy ? "保存中…" : "保存"),
						saved ? react.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-state-success-primary)" } }, "已保存") : null
					)
				);
			}

			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "liang-calibrator",
				order: 34,
				label: "滑动变祖器"
			}, SettingsSection));

			ctx.inject(["slots", "modelDirectories"], (scope) => {
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				let disposeModel = null;

				const syncModelSeat = (enabled) => {
					if (disposeModel) {
						disposeModel();
						disposeModel = null;
					}
					if (!enabled) return;
					disposeModel = scope.slots.inject("conversation.input.model", () => scope.slots.register({
						name: "conversation.input.model",
						locale: NS,
						priority: -1,
						registrant: "liang-calibrator",
						inject: (sessionId) => {
							const directory = models.directoryFor(sessionId);
							const available = sessions.subagentAddress(sessionId) === void 0;
							return {
								available,
								directory: directory.store,
								load: () => {
									if (available) directory.load().catch(() => {});
								},
								select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false)
							};
						}
					}, LiangModelSelect));
				};

				const readEnabled = () => api.settings.describe({}).then((sRes) => {
					if (!sRes.result.ok) return true;
					const view = (sRes.result.value.namespaces || []).find((n) => n.ns === SETTINGS_NS);
					if (!view) return true;
					return view.value?.enabled !== false;
				}).catch(() => true);

				readEnabled().then(syncModelSeat);
				const off = ctx.remote.$on("settings/document-updated", (ns) => {
					if (ns !== SETTINGS_NS) return;
					readEnabled().then(syncModelSeat);
				});
				return () => {
					try {
						off?.();
					} catch {
						/* ignore */
					}
					if (disposeModel) {
						disposeModel();
						disposeModel = null;
					}
				};
			});
		}
		exports.name = "liang-calibrator";
		exports.inject = inject;
		exports.apply = apply;
		exports.LiangModelSelect = LiangModelSelect;
		exports.LiangEffortSlider = LiangEffortSlider;
		return module.exports;
	}
});
