/** UI framework + HUD (§51–52). Plain DOM with a tiny h() helper; every button maps to a real command. */
import { phaseName, ALL_SKILLS, CLASSES, ITEMS, MAPS, MONSTERS, QUESTS, RARITY_COLOR, STATUSES, TITLES, playerStats, requiredExp, type ItemInstance, type PlayerState } from '@hb/game-core';
import { characterSprite, itemIcon, skillIcon } from './art.js';
import { lookOf } from './render.js';
import type { Adapter, PubEntity } from './adapter.js';
import { L, fmt, t } from './i18n.js';

export type Child = Node | string | number | null | undefined | false | Child[];
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else el.setAttribute(k, String(v));
  }
  const add = (c: Child) => { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : document.createTextNode(String(c))); };
  kids.forEach(add); return el;
}
export function iconEl(cv: HTMLCanvasElement, size = 32): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = size; c.height = size; const x = c.getContext('2d')!; x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, size, size); c.className = 'px'; return c; }
export function itemIconEl(it: { defId: string } | string, size = 32) { const d = ITEMS[typeof it === 'string' ? it : it.defId]!; return iconEl(itemIcon(d.icon, d.color), size); }
export function itemName(it: ItemInstance | string): string { const d = ITEMS[typeof it === 'string' ? it : it.defId]; if (!d) return String(it); const r = typeof it === 'string' ? 0 : it.refine; return `${r ? `+${r} ` : ''}${L(d.name)}`; }
export function itemTooltip(it: ItemInstance): string {
  const d = ITEMS[it.defId]!; const lines = [`<b style="color:${RARITY_COLOR[d.rarity]}">${itemName(it)}</b> <span class="dim">${d.rarity} ${d.type}${d.weapon ? ` · ${d.weapon}` : ''}</span>`];
  if (d.reqLevel > 1) lines.push(`<span class="dim">Req. level ${d.reqLevel}</span>`);
  for (const s of d.stats ?? []) lines.push(`${s.stat} +${s.value}${s.kind === 'pct' ? '%' : ''}`);
  for (const o of it.options) lines.push(`<span style="color:#8fd0ff">◆ ${o.stat} +${o.value}</span>`);
  it.sockets.forEach((g) => lines.push(g ? `<span style="color:#ff9fe0">◈ ${L(ITEMS[g]!.name)}</span>` : '<span class="dim">◇ empty socket</span>'));
  for (const c of it.cards) if (c) lines.push(`<span style="color:#ffd070">▣ ${c.replace('mc_', '')} card</span>`);
  if (it.stone?.skillId) lines.push(`<span style="color:#a0ffa0">Stone: ${L(ALL_SKILLS[it.stone.skillId]?.name)} ${it.stone.mods.map((m) => `${m.key}-${m.value}%`).join(', ')} +${it.stone.refine}${it.locked ? ' (slotted)' : ''}</span>`);
  if (d.use) lines.push(`<span class="dim">Use: ${Object.entries(d.use).map(([k, v]) => `${k} ${v}`).join(', ')}</span>`);
  if (d.desc) lines.push(`<i>${L(d.desc)}</i>`);
  if (['weapon', 'armor', 'accessory'].includes(d.type)) lines.push(it.durability <= 0 ? '<span style="color:#ff6060"><b>BROKEN</b> — no stats until repaired</span>' : `<span style="color:${it.durability < 20 ? '#ffb040' : '#a0a0a0'}">Durability ${Math.floor(it.durability)}%</span>`);
  lines.push(`<span class="dim">${it.bound ? 'Bound · ' : 'Tradeable · '}Sell ${Math.floor(d.price * 0.25)}G${it.locked ? ' · L' : ''}</span>`);
  return lines.join('<br>');
}

// ---------------- toasts & tooltips ----------------
let toastBox: HTMLElement; let tip: HTMLElement;
export function toast(msg: string, kind: 'info' | 'ok' | 'err' | 'gold' = 'info') { if (!toastBox) return; const e = h('div', { class: `toast ${kind}` }, msg); toastBox.prepend(e); setTimeout(() => e.classList.add('out'), 2600); setTimeout(() => e.remove(), 3200); while (toastBox.children.length > 6) toastBox.lastChild!.remove(); }
export function bindTip(el: HTMLElement, html: () => string) {
  el.addEventListener('mouseenter', (ev) => { tip.innerHTML = html(); tip.style.display = 'block'; moveTip(ev as MouseEvent); });
  el.addEventListener('mousemove', (ev) => moveTip(ev as MouseEvent)); el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}
function moveTip(ev: MouseEvent) { const r = tip.getBoundingClientRect(); tip.style.left = `${Math.min(window.innerWidth - r.width - 8, ev.clientX + 14)}px`; tip.style.top = `${Math.min(window.innerHeight - r.height - 8, ev.clientY + 14)}px`; }
export function hideTip() { if (tip) tip.style.display = 'none'; }

// ---------------- windows ----------------
export type Box = HTMLElement & { append: (...nodes: any[]) => void };
function boxify(el: HTMLElement): Box { const orig = el.append.bind(el); (el as any).append = (...k: any[]) => orig(...k.flat(9).filter((x) => x !== null && x !== undefined && x !== false).map((x) => (x instanceof Node ? x : String(x)))); return el as Box; }
export interface WinDef { id: string; title: string; render: (body: Box) => void; width?: number; cls?: string }
const openWins = new Map<string, { el: HTMLElement; def: WinDef }>(); let layer: HTMLElement; let zTop = 10;
export function openWindow(def: WinDef) {
  const ex = openWins.get(def.id); if (ex) { ex.def = def; renderWin(def.id); ex.el.style.zIndex = String(++zTop); return; }
  const body = boxify(h('div', { class: 'win-body' }));
  const el = h('div', { class: `win ${def.cls ?? ''}`, style: { width: `${Math.min(def.width ?? 520, window.innerWidth - 16)}px`, zIndex: String(++zTop) }, role: 'dialog', 'aria-label': def.title },
    h('div', { class: 'win-title' }, h('span', {}, def.title), h('button', { class: 'x', 'aria-label': 'Close', onclick: () => closeWindow(def.id) }, '✕')), body);
  const n = openWins.size; el.style.left = `${Math.max(8, Math.min(window.innerWidth - (def.width ?? 520) - 8, 80 + n * 24))}px`; el.style.top = `${Math.max(8, 60 + n * 24)}px`;
  dragify(el, el.querySelector('.win-title') as HTMLElement); el.addEventListener('mousedown', () => { el.style.zIndex = String(++zTop); });
  layer.append(el); openWins.set(def.id, { el, def }); renderWin(def.id);
}
export function closeWindow(id: string) { const w = openWins.get(id); if (w) { w.el.remove(); openWins.delete(id); hideTip(); } }
export function isOpen(id: string) { return openWins.has(id); }
export function closeAll() { for (const id of [...openWins.keys()]) closeWindow(id); }
export function renderWin(id: string) { const w = openWins.get(id); if (!w) return; const body = w.el.querySelector('.win-body') as Box; const sc = body.scrollTop; body.innerHTML = ''; try { w.def.render(body); } catch (e: any) { body.append(h('div', { class: 'err' }, `UI error: ${e?.message ?? e}`)); console.error(e); } body.scrollTop = sc; }
export function refreshAll() { for (const id of openWins.keys()) renderWin(id); }
function dragify(el: HTMLElement, handle: HTMLElement) {
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  handle.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).tagName === 'BUTTON') return; drag = true; sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => { if (!drag) return; el.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx))}px`; el.style.top = `${Math.max(0, Math.min(window.innerHeight - 30, oy + e.clientY - sy))}px`; });
  handle.addEventListener('pointerup', () => { drag = false; });
}
export function confirmDialog(msg: string, onYes: () => void, yes = 'Confirm') { const id = `confirm_${Date.now()}`; openWindow({ id, title: 'Confirm', width: 360, render: (b) => b.append(h('p', { html: msg }), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { closeWindow(id); onYes(); } }, yes), h('button', { class: 'btn', onclick: () => closeWindow(id) }, 'Cancel'))) }); }
export function tabs(body: Box, names: string[], current: { v: string }, rerender: () => void): Box {
  const bar = h('div', { class: 'tabs', role: 'tablist' }, names.map((n) => h('button', { class: `tab ${current.v === n ? 'on' : ''}`, role: 'tab', 'aria-selected': String(current.v === n), onclick: () => { current.v = n; rerender(); } }, n)));
  body.append(bar); const c = boxify(h('div', { class: 'tab-body' })); body.append(c); return c;
}
export function bar(v: number, max: number, color: string, label?: string) { return h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`, background: color } }), h('span', {}, label ?? `${Math.floor(v)}/${Math.floor(max)}`)); }

// ---------------- HUD ----------------
export interface HudRefs { root: HTMLElement; hp: HTMLElement; mp: HTMLElement; exp: HTMLElement; gauge: HTMLElement; name: HTMLElement; buffs: HTMLElement; hotbar: HTMLElement; target: HTMLElement; tracker: HTMLElement; chatLog: HTMLElement; chatIn: HTMLInputElement; mini: HTMLCanvasElement; mapName: HTMLElement; info: HTMLElement; currencies: HTMLElement; party: HTMLElement; banner: HTMLElement; respawn: HTMLElement; menu: HTMLElement; joy: HTMLElement; mobileBtns: HTMLElement; portrait: HTMLCanvasElement }
export function buildHud(root: HTMLElement, handlers: { onHotbar: (i: number) => void; onChat: (ch: string, msg: string) => void; onRespawn: () => void; menu: { key: string; label: string; icon: string; open: () => void }[]; onJoy: (dx: number, dy: number) => void; onMobileAttack: () => void; onMobilePickup: () => void; onMobileInteract: () => void; onHotbarDrop?: (slot: number, skill: string | null, fromSlot: number | null) => void; onHotbarSet?: () => void }): HudRefs {
  layer = h('div', { class: 'win-layer' }); toastBox = h('div', { class: 'toasts', 'aria-live': 'polite' }); tip = h('div', { class: 'tooltip' });
  const portrait = document.createElement('canvas'); portrait.width = 40; portrait.height = 52; portrait.className = 'px portrait';
  const hp = h('div', { class: 'bar hp' }), mp = h('div', { class: 'bar mp' }), exp = h('div', { class: 'bar exp' }), gauge = h('div', { class: 'bar gauge' });
  const name = h('div', { class: 'pname' }); const buffs = h('div', { class: 'buffs' });
  const hotbar = h('div', { class: 'hotbar' }); for (let i = 0; i < 10; i++) { const s = h('button', { class: 'slot', 'aria-label': `Hotbar ${i + 1}`, onclick: () => handlers.onHotbar(i), draggable: i < 8 ? 'true' : undefined, ondragstart: (e: DragEvent) => { e.dataTransfer?.setData('text/hb-slot', String(i)); }, ondragover: (e: DragEvent) => { if (i < 8) e.preventDefault(); }, ondrop: (e: DragEvent) => { e.preventDefault(); if (i >= 8) return; const sk = e.dataTransfer?.getData('text/hb-skill'); const from = e.dataTransfer?.getData('text/hb-slot'); handlers.onHotbarDrop?.(i, sk || null, from ? Number(from) : null); } }, h('span', { class: 'key' }, i < 8 ? String(i + 1) : i === 8 ? 'Q' : 'E'), h('div', { class: 'cd' })); hotbar.append(s); }
  const hbset = (h('button', { class: 'slot hbset', 'aria-label': 'Hotbar set', title: 'Switch hotbar set (1–3)', onclick: () => handlers.onHotbarSet?.() }, h('span', { class: 'key' }, 'SET'), h('b', { class: 'hbn' }, '1')));
  const target = h('div', { class: 'target' }); const tracker = h('div', { class: 'tracker' }); const party = h('div', { class: 'party' });
  const chatLog = h('div', { class: 'chat-log', 'aria-live': 'off' }); let ch = 'local';
  const chatIn = h('input', { class: 'chat-in', placeholder: 'Enter to chat…  (/w world, /p party, /g guild)', maxlength: '160', 'aria-label': 'Chat message' }) as HTMLInputElement;
  chatIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { let m = chatIn.value.trim(); let c = ch; const mm = /^\/(w|p|g|t|h)\s+(.*)$/.exec(m); if (mm) { c = { w: 'world', p: 'party', g: 'guild', t: 'trade', h: 'help' }[mm[1] as 'w']!; m = mm[2]!; } if (m) handlers.onChat(c, m); chatIn.value = ''; chatIn.blur(); } if (e.key === 'Escape') chatIn.blur(); });
  const chatTabs = h('div', { class: 'chat-tabs' }, ['local', 'world', 'party', 'guild', 'trade'].map((c) => h('button', { class: `ctab ${c === ch ? 'on' : ''}`, onclick: (e: Event) => { ch = c; chatTabs.querySelectorAll('.ctab').forEach((x) => x.classList.remove('on')); (e.target as HTMLElement).classList.add('on'); } }, c)));
  const mini = document.createElement('canvas'); mini.width = 150; mini.height = 110; mini.className = 'minimap';
  const mapName = h('div', { class: 'mapname' }); const info = h('div', { class: 'info' }); const currencies = h('div', { class: 'currencies' });
  const banner = h('div', { class: 'banner' }); const respawn = h('div', { class: 'respawn hidden' }, h('div', {}, 'You have been defeated'), h('button', { class: 'btn primary', onclick: handlers.onRespawn }, t('respawn')));
  const menu = h('div', { class: 'menu' }, handlers.menu.map((m) => { const b = h('button', { class: 'mbtn', title: `${m.label} (${m.key})`, 'aria-label': m.label, onclick: m.open }, h('span', { class: 'mi' }, iconEl(itemIcon(m.icon, '#f0d090'), 22)), h('span', { class: 'ml' }, m.label)); return b; }));
  // virtual joystick (touch)
  const knob = h('div', { class: 'knob' }); const joy = h('div', { class: 'joy' }, knob); let jid: number | null = null; let jc = { x: 0, y: 0 };
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; joy.setPointerCapture(e.pointerId); });
  joy.addEventListener('pointermove', (e) => { if (jid !== e.pointerId) return; let dx = e.clientX - jc.x, dy = e.clientY - jc.y; const l = Math.hypot(dx, dy); if (l > 40) { dx = (dx / l) * 40; dy = (dy / l) * 40; } knob.style.transform = `translate(${dx}px,${dy}px)`; handlers.onJoy(Math.abs(dx) > 8 ? dx / 40 : 0, Math.abs(dy) > 8 ? dy / 40 : 0); });
  const jend = () => { jid = null; knob.style.transform = ''; handlers.onJoy(0, 0); }; joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  const mobileBtns = h('div', { class: 'mobile-btns' }, h('button', { class: 'mb atk', onclick: handlers.onMobileAttack, 'aria-label': 'Attack' }, 'ATK'), h('button', { class: 'mb', onclick: handlers.onMobilePickup, 'aria-label': 'Pick up' }, 'GET'), h('button', { class: 'mb', onclick: handlers.onMobileInteract, 'aria-label': 'Interact' }, 'TALK'));
  const hud = h('div', { class: 'hud' },
    h('div', { class: 'hud-tl' }, portrait, h('div', { class: 'stats' }, name, hp, mp, gauge, buffs)),
    h('div', { class: 'hud-tr' }, h('div', { class: 'mini-wrap' }, mini, mapName, info), currencies),
    target, tracker, party, banner, respawn,
    h('div', { class: 'hud-bottom' }, exp, h('div', { class: 'hbwrap' }, hbset, hotbar)),
    h('div', { class: 'chat' }, chatTabs, chatLog, chatIn), menu, joy, mobileBtns);
  root.append(hud, layer, toastBox, tip);
  return { root: hud, hp, mp, exp, gauge, name, buffs, hotbar, target, tracker, chatLog, chatIn, mini, mapName, info, currencies, party, banner, respawn, menu, joy, mobileBtns, portrait };
}
export function chatLine(refs: HudRefs, ch: string, from: string, msg: string) { const line = h('div', { class: `cl ch-${ch}` }, h('span', { class: 'cch' }, `[${ch}]`), h('b', {}, ` ${from}: `), msg); refs.chatLog.append(line); while (refs.chatLog.children.length > 80) refs.chatLog.firstChild!.remove(); refs.chatLog.scrollTop = refs.chatLog.scrollHeight; }

let lastHud = ''; let lastHotbar = '';
export function updateHud(refs: HudRefs, a: Adapter, target: PubEntity | null, fps: number) {
  const p = a.p; const me = a.entities().find((e) => e.id === a.myId); if (!me) return;
  const d = playerStats(p).derived; const cls = CLASSES[p.classId]!;
  setBar(refs.hp, me.hp, me.mhp, '#e04848', `HP ${Math.ceil(me.hp)}/${me.mhp}`); setBar(refs.mp, me.mp, me.mmp, '#4878e0', `MP ${Math.floor(me.mp)}/${me.mmp}`);
  const req = p.level >= 120 ? 1 : requiredExp(p.level); setBar(refs.exp, p.level >= 120 ? 1 : p.exp, req, '#e0c040', p.level >= 120 ? `Mastery ${p.mastery}` : `EXP ${((p.exp / req) * 100).toFixed(1)}%`);
  { const gd = cls.gauge.def; const gv = me.g ?? 0; const ph = phaseName(gd, gv); setBar(refs.gauge, ph ? (Math.floor(gv) % gd.max) + 1 : gv, gd.max, '#c070ff', `${L(cls.gauge.name)} ${ph ? L({ en: ph[0], th: ph[1] }) : `${Number.isInteger(gv) ? gv : gv.toFixed(1)}/${gd.max}`}`); }
  const key = `${p.name}|${p.level}|${p.classId}|${p.ascension}|${(me.fx ?? []).join(',')}|${a.bal('gold')}|${a.bal('crystal')}|${a.bal('crystal_free')}|${a.mapId}|${p.title}`;
  if (key !== lastHud) {
    lastHud = key; { const px = refs.portrait.getContext('2d')!; px.imageSmoothingEnabled = false; px.clearRect(0, 0, 40, 52); px.drawImage(characterSprite(lookOf(p.classId, p.appearance), 0, 0, 'idle'), 0, 0, 40, 52); } refs.name.innerHTML = `<b>${p.name}</b> <span class="dim">Lv ${p.level}${p.ascension ? ` ✦${p.ascension}` : ''} ${L(cls.name)}</span>`;
    refs.buffs.innerHTML = ''; for (const s of me.fx ?? []) { const def = STATUSES[s]; if (!def) continue; refs.buffs.append(h('span', { class: `buff ${def.kind}`, style: { background: def.color }, title: L(def.name) }, L(def.name).slice(0, 2))); }
    refs.currencies.innerHTML = ''; for (const [c, ic, col] of [['gold', '●', '#ffd040'], ['crystal', '◆', '#80e0ff'], ['crystal_free', '◇', '#b0f0ff'], ['arena_token', '⚔', '#ff8080'], ['boss_coin', '☠', '#ff80ff'], ['card_dust', '✧', '#80c0ff']] as const) refs.currencies.append(h('span', { class: 'cur', title: c }, h('i', { style: { color: col } }, ic), ` ${fmt(a.bal(c))}`));
    refs.mapName.textContent = L(MAPS[a.mapId]!.name);
  }
  refs.info.textContent = `${(globalThis as any).__timeLabel ?? ''} · ${(globalThis as any).__weather ?? ''} · ${fps}fps${a.mode === 'online' ? ` · ${a.ping}ms` : ' · local'}`;
  // hotbar
  const hk = p.hotbar.join(',') + p.inventory.filter((i) => i.defId.startsWith('potion')).length;
  { const n = document.querySelector('.hbset .hbn'); if (n) n.textContent = String((p.hotbarSet ?? 0) + 1); }
  if (hk !== lastHotbar) { lastHotbar = hk; [...refs.hotbar.children].forEach((slot, i) => { const s = slot as HTMLElement; s.querySelector('canvas')?.remove(); const id = i < 8 ? p.hotbar[i] : i === 8 ? 'potion_hp' : 'potion_mp'; s.title = ''; if (i < 8 && id && ALL_SKILLS[id]) { const sk = ALL_SKILLS[id]!; s.prepend(iconEl(skillIcon(sk.vfx, cls.palette.trim), 36)); s.title = `${L(sk.name)} — ${L(sk.desc)} (MP ${sk.mp}, CD ${sk.cdMs / 1000}s)`; } else if (i >= 8) { const it = p.inventory.find((x) => x.defId.startsWith(id!)); if (it) { s.prepend(itemIconEl(it, 30)); s.title = `${itemName(it)} ×${it.qty}`; } } }); }
  const now = a.serverTime(); const cds = (me as any).cds as Record<string, number> | undefined;
  [...refs.hotbar.children].forEach((slot, i) => { if (i >= 8) return; const id = p.hotbar[i]; const cdEl = (slot as HTMLElement).querySelector('.cd') as HTMLElement; const until = id ? (cds?.[id] ?? (globalThis as any).__cds?.[id] ?? 0) : 0; const sk = id ? ALL_SKILLS[id] : null; const rem = until - now; if (sk && rem > 0) { cdEl.style.height = `${Math.min(100, (rem / sk.cdMs) * 100)}%`; cdEl.textContent = (rem / 1000).toFixed(rem < 10000 ? 1 : 0); } else { cdEl.style.height = '0'; cdEl.textContent = ''; } (slot as HTMLElement).classList.toggle('nomp', !!sk && me.mp < sk.mp); });
  // target
  if (target && !target.dead) { refs.target.style.display = 'block'; const m = target.k === 'monster' ? MONSTERS[target.def!] : null; refs.target.innerHTML = ''; refs.target.append(h('div', { class: 'tname' }, `${m && m.rank !== 'normal' ? `[${m.rank}] ` : ''}${target.n} Lv${target.l}${m ? ` · ${m.element}` : ''}`), bar(target.hp, target.mhp, '#e04040', `${Math.ceil(target.hp)}/${target.mhp}`), h('div', { class: 'tfx' }, (target.fx ?? []).map((s) => h('span', { class: 'buff', style: { background: STATUSES[s]?.color ?? '#888' } }, L(STATUSES[s]?.name).slice(0, 3))))); }
  else refs.target.style.display = 'none';
  refs.respawn.classList.toggle('hidden', !me.dead);
  // quest tracker
  const tk = p.quests.active.map((q) => q.id + q.progress.join('.')).join('|');
  if (refs.tracker.dataset.k !== tk) { refs.tracker.dataset.k = tk; refs.tracker.innerHTML = ''; if (p.quests.active.length) refs.tracker.append(h('div', { class: 'trh' }, t('quests'))); for (const q of p.quests.active.slice(0, 5)) { const def = QUESTS[q.id]!; refs.tracker.append(h('div', { class: 'trq' }, h('b', {}, L(def.name)), def.objectives.map((o, i) => h('div', { class: 'tro' }, `${objLabel(o)} ${q.progress[i]}/${'count' in o ? o.count : o.kind === 'level' ? o.level : 1}`)))); } }
  // party
  const pm = a.partyMembers(); const pk = pm.map((x) => `${x.id}${Math.round(x.hp / 10)}`).join(); if (refs.party.dataset.k !== pk) { refs.party.dataset.k = pk; refs.party.innerHTML = ''; for (const m of pm) if (m.id !== a.myId) refs.party.append(h('div', { class: 'pm' }, h('div', {}, `${m.n}${m.k === 'bot' ? ' ·sim' : ''} Lv${m.l}`), bar(m.hp, m.mhp, '#e04848', ''))); }
  void d; void TITLES;
}
function setBar(el: HTMLElement, v: number, max: number, col: string, label: string) { let f = el.firstChild as HTMLElement | null; if (!f) { f = h('div', { class: 'fill' }); el.append(f, h('span', {})); } f.style.width = `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`; f.style.background = col; (el.lastChild as HTMLElement).textContent = label; }
export function objLabel(o: any): string {
  switch (o.kind) { case 'kill': return `Defeat ${o.target === 'any' ? 'monsters' : L(MONSTERS[o.target]?.name)}`; case 'collect': return `Collect ${L(ITEMS[o.item]?.name)}`; case 'talk': return `Talk to ${o.npc.replace('_', ' ')}`; case 'visit': return `Visit ${L(MAPS[o.map]?.name)}`; case 'gather': return `Gather (${o.node})`; case 'level': return 'Reach level'; default: return o.kind.replace('_', ' '); }
}
export type { PlayerState };
