/** Game client entry: title → mode → character select/create → world. */
import { ALL_SKILLS, aiChooseAction, CLASSES, CLASS_IDS, EGG_POOL, MAPS, MONSTERS, NPCS, PETS, PlayerService, STARTER_CLASSES, TILE, getMap, MEMBERSHIPS, eventEndsAt } from '@hb/game-core';
import { LocalAdapter, RemoteAdapter, deleteSlot, importSaveString, listSlots, loadSlot, newLocalCharacter, safeStorage, type Adapter, type PubEntity } from './adapter.js';
import { characterSprite } from './art.js';
import { Audio } from './audio.js';
import { L, setLang, t } from './i18n.js';
import { act, initPanels, openArena, openBoss, openCardBook, openCharacter, openCrafting, openDev, openDungeons, openEvents, openHelp, openInventory, openMail, openMarket, openMounts, openNpc, openPets, openQuests, openRankings, openSettings, openSkills, openSocial, openTcg, openCreator } from './panels.js';
import { Renderer, lookOf } from './render.js';
import { buildHud, chatLine, closeAll, confirmDialog, openWindow, h, hideTip, isOpen, refreshAll, toast, updateHud, type HudRefs } from './ui.js';

const DEV = (() => { try { const q = new URLSearchParams(location.search); if (q.get('dev') === '0') return false; } catch { /* */ } return true; })(); // artifact testing mode: dev panel enabled
const app = document.getElementById('app')!;
const audio = new Audio();
const settings: Record<string, any> = { lang: 'en', master: 0.6, music: 0.45, sfx: 0.7, muted: false, particles: true, weather: true, lighting: true, reducedMotion: false, lowPerf: false, showNames: true, autoLoot: true, highContrast: false, zoom: 0.5, uiScale: 0.5 };
try { Object.assign(settings, JSON.parse(safeStorage()?.getItem('hearthbound_settings') ?? '{}')); } catch { /* */ }
setLang(settings.lang);
document.addEventListener('pointerdown', () => audio.unlock(), { once: false });

// ---------------- Title / menus ----------------
function screen(...kids: (Node | string | null)[]) { app.innerHTML = ''; const el = h('div', { class: 'screen' }, h('div', { class: 'sky' }), ...kids); app.append(el); return el; }
function title() {
  const slots = listSlots();
  screen(h('div', { class: 'title-box' },
    h('canvas', { class: 'logo-art px', width: '220', height: '80', id: 'logoArt' }),
    h('h1', {}, t('title')), h('p', { class: 'sub' }, t('subtitle')),
    h('div', { class: 'menu-col' },
      slots.length ? h('button', { class: 'btn big primary', onclick: () => charSelect() }, `${t('continue')} (${slots.length})`) : null,
      h('button', { class: 'btn big', onclick: () => createChar() }, t('new_char')),
      h('button', { class: 'btn big', onclick: () => onlineLogin() }, t('play_online')),
      h('button', { class: 'btn', onclick: () => importFlow() }, t('import_save')),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { setLang('en'); settings.lang = 'en'; persistSettings(); title(); } }, 'English'), h('button', { class: 'btn sm', onclick: () => { setLang('th'); settings.lang = 'th'; persistSettings(); title(); } }, 'ภาษาไทย'))),
    h('p', { class: 'fine' }, 'Artifact mode: full single-player simulation of the MMORPG systems. Other players are simulated. Original code, art & audio. v0.1 prototype — not production-ready.')));
  const cv = document.getElementById('logoArt') as HTMLCanvasElement; const x = cv.getContext('2d')!; x.imageSmoothingEnabled = false;
  STARTER_CLASSES.slice(0, 7).forEach((id, i) => { const c = CLASSES[id]!; x.drawImage(characterSprite(lookOf(id, { hairColor: c.palette.hair }), 0, 0, 'idle'), 8 + i * 30, 18, 30, 39); });
}
function charSelect() {
  const slots = listSlots();
  screen(h('div', { class: 'panel-box' }, h('h2', {}, 'Select Character'), h('div', { class: 'slots' }, slots.map((s) => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 52; cv.className = 'px'; const sv = loadSlot(s.id); const cx = cv.getContext('2d')!; cx.imageSmoothingEnabled = false; if (sv) cx.drawImage(characterSprite(lookOf(sv.player.classId, sv.player.appearance), 0, 0, 'idle'), 0, 0, 40, 52);
    return h('div', { class: 'slot-card' }, cv, h('div', {}, h('b', {}, s.name), h('div', { class: 'dim' }, `Lv ${s.level} ${L(CLASSES[s.classId]?.name)}`), h('div', { class: 'dim small' }, new Date(s.savedAt).toLocaleString())), h('button', { class: 'btn primary', onclick: () => { const sv2 = loadSlot(s.id); if (!sv2) { toastLite('Save could not be read'); return; } startLocal(sv2.player, sv2.market); } }, 'Play'), h('button', { class: 'btn sm danger', onclick: (e: Event) => { const b = e.currentTarget as HTMLButtonElement; if (b.dataset.armed) { deleteSlot(s.id); charSelect(); } else { b.dataset.armed = '1'; b.textContent = 'Click again to delete'; } } }, t('delete'))); })),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => createChar() }, t('new_char')), h('button', { class: 'btn', onclick: () => title() }, t('back')))));
}
function toastLite(m: string) { let el = document.getElementById('hbNotice'); if (!el) { el = h('div', { id: 'hbNotice', class: 'hb-notice', role: 'alert' }); document.body.append(el); } el.textContent = m; el.hidden = false; setTimeout(() => { if (el) el.hidden = true; }, 5000); }
function createChar() {
  const look = { body: 0 as 0 | 1, hair: 0, hairColor: '#5a3a22', skin: '#f0c8a0', eyes: '#202040' }; let cls = 'vanguard'; let name = ''; let showAll = false;
  const render = () => {
    const pv = document.createElement('canvas'); pv.width = 120; pv.height = 156; pv.className = 'px preview'; const px = pv.getContext('2d')!; px.imageSmoothingEnabled = false;
    let fr = 0; const anim = () => { if (!pv.isConnected) return; px.clearRect(0, 0, 120, 156); px.drawImage(characterSprite(lookOf(cls, look), Math.floor(fr / 16) % 4 === 3 ? 3 : Math.floor(fr / 16) % 4 === 1 ? 1 : Math.floor(fr / 16) % 4 === 2 ? 2 : 0, Math.floor(fr / 4) % 4, 'walk'), 10, 0, 100, 130); fr++; requestAnimationFrame(anim); }; requestAnimationFrame(anim);
    const c = CLASSES[cls]!; const list = showAll ? CLASS_IDS : STARTER_CLASSES;
    const nameIn = h('input', { value: name, maxlength: '16', placeholder: 'Your hero’s name', 'aria-label': t('name'), oninput: (e: Event) => { name = (e.target as HTMLInputElement).value; } }) as HTMLInputElement;
    screen(h('div', { class: 'panel-box wide' }, h('h2', {}, t('new_char')), h('div', { class: 'create' },
      h('div', { class: 'cpreview' }, pv, h('h3', {}, L(c.name)), h('div', { class: 'dim' }, `${t('role')}: ${c.role} · ${t('element')}: ${c.element}`), h('div', { class: 'dim' }, `${t('weapon')}: ${c.weapons.join(', ')}`), h('p', { class: 'small' }, L(c.mechanic)), h('div', { class: 'small' }, `STR ${c.base.str} AGI ${c.base.agi} VIT ${c.base.vit} INT ${c.base.int} DEX ${c.base.dex} LUK ${c.base.luk}`), h('div', { class: 'small dim' }, `Signature skills: ${c.skills.slice(0, 4).map((s) => L(s.name)).join(', ')}…`)),
      h('div', { class: 'copts' }, h('label', {}, t('name')), nameIn,
        h('label', {}, `${t('class')} (${list.length}${showAll ? '' : ` of ${CLASS_IDS.length}`})`), h('div', { class: 'class-grid' }, list.map((id) => { const k = CLASSES[id]!; const ic = document.createElement('canvas'); ic.width = 30; ic.height = 39; ic.className = 'px'; const ix = ic.getContext('2d')!; ix.imageSmoothingEnabled = false; ix.drawImage(characterSprite(lookOf(id, { ...look, hairColor: look.hairColor }), 0, 0, 'idle'), 0, 0, 30, 39); return h('button', { class: `cls ${cls === id ? 'on' : ''}`, title: `${L(k.name)} — ${k.role}`, onclick: () => { cls = id; name = nameIn.value; render(); } }, ic, h('span', {}, L(k.name))); })),
        h('button', { class: 'btn xs', onclick: () => { showAll = !showAll; name = nameIn.value; render(); } }, showAll ? 'Show starter classes' : 'Show all 26 classes'),
        h('label', {}, t('body')), h('div', { class: 'row' }, [0, 1].map((b) => h('button', { class: `btn sm ${look.body === b ? 'primary' : ''}`, onclick: () => { look.body = b as 0 | 1; name = nameIn.value; render(); } }, b ? 'Robe' : 'Tunic'))),
        h('label', {}, t('hair')), h('div', { class: 'row' }, [0, 1, 2, 3].map((v) => h('button', { class: `btn sm ${look.hair === v ? 'primary' : ''}`, onclick: () => { look.hair = v; name = nameIn.value; render(); } }, ['Short', 'Long', 'Spiky', 'Tail'][v]!))),
        h('label', {}, t('hair_color')), h('div', { class: 'row' }, ['#5a3a22', '#2a1a0a', '#e0c060', '#a03020', '#f0f0f0', '#4060c0', '#e080c0', '#40a060'].map((col) => h('button', { class: `swatch ${look.hairColor === col ? 'on' : ''}`, style: { background: col }, 'aria-label': col, onclick: () => { look.hairColor = col; name = nameIn.value; render(); } }))),
        h('label', {}, t('skin')), h('div', { class: 'row' }, ['#ffe0c0', '#f0c8a0', '#d8a070', '#a06840', '#704020'].map((col) => h('button', { class: `swatch ${look.skin === col ? 'on' : ''}`, style: { background: col }, 'aria-label': col, onclick: () => { look.skin = col; name = nameIn.value; render(); } }))),
        h('label', {}, t('eyes')), h('div', { class: 'row' }, ['#202040', '#205020', '#602020', '#4080c0', '#806020'].map((col) => h('button', { class: `swatch ${look.eyes === col ? 'on' : ''}`, style: { background: col }, onclick: () => { look.eyes = col; name = nameIn.value; render(); } }))),
        h('div', { class: 'row' }, h('button', { class: 'btn big primary', onclick: () => { name = nameIn.value.trim(); try { const p = newLocalCharacter(name, cls, look); startLocal(p, null); } catch (e: any) { toastLite(e.message === 'INVALID_NAME' ? 'Name must be 2–16 letters/numbers.' : e.message); } } }, t('create')), h('button', { class: 'btn', onclick: () => title() }, t('back')))))));
  };
  render();
}
function importFlow() {
  if (!document.querySelector('canvas.game')) { const ta = h('textarea', { id: 'importText', placeholder: 'Paste exported save text here, or choose a file', style: { width: '100%', height: '120px' } }) as HTMLTextAreaElement; const go = (txt: string) => { try { const sv = importSaveString(txt); startLocal(sv.player, sv.market); } catch (e: any) { toastLite(`Import failed: ${e.message}`); } }; screen(h('div', { class: 'panel-box' }, h('h2', {}, t('import_save')), ta, h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => go(ta.value) }, 'Import pasted text'), h('button', { class: 'btn', onclick: () => pickFile(go) }, 'Choose file…'), h('button', { class: 'btn', onclick: () => title() }, t('back'))))); return; }
  pickFile((txt) => { try { const sv = importSaveString(txt); startLocal(sv.player, sv.market); } catch (e: any) { toastLite(`Import failed: ${e.message}`); } });
}
function pickFile(cb: (t: string) => void) { const inp = h('input', { type: 'file', accept: '.json,application/json' }) as HTMLInputElement; inp.onchange = async () => { const f = inp.files?.[0]; if (f) cb(await f.text()); }; inp.click(); }
function onlineLogin() {
  const url = h('input', { value: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname || 'localhost'}:2567/ws` }) as HTMLInputElement; const api = h('input', { value: `${location.protocol}//${location.hostname || 'localhost'}:2567/api` }) as HTMLInputElement;
  const user = h('input', { placeholder: 'username' }) as HTMLInputElement; const pass = h('input', { type: 'password', placeholder: 'password (8+ chars)' }) as HTMLInputElement; const msg = h('div', { class: 'err' });
  const go = async (register: boolean) => {
    msg.textContent = '…';
    try {
      const r = await fetch(`${api.value}/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user.value, password: pass.value }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.statusText);
      const chars = await (await fetch(`${api.value}/characters`, { headers: { authorization: `Bearer ${j.accessToken}` } })).json();
      onlineChars(api.value, url.value, j.accessToken, chars.characters ?? []);
    } catch (e: any) { msg.textContent = `Could not reach the game server (${e.message}). Online mode needs the server from deliverables/online-game running (pnpm game:start). In the Claude artifact sandbox only Artifact mode is available.`; }
  };
  screen(h('div', { class: 'panel-box' }, h('h2', {}, t('play_online')), h('p', { class: 'dim' }, 'Connect to a Hearthbound game server. Real multiplayer: positions, combat, loot, chat, trades and market are authoritative on the server.'), h('label', {}, 'API'), api, h('label', {}, 'WebSocket'), url, h('label', {}, 'Username'), user, h('label', {}, 'Password'), pass, h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => go(false) }, 'Login'), h('button', { class: 'btn', onclick: () => go(true) }, 'Register'), h('button', { class: 'btn', onclick: () => title() }, t('back'))), msg));
}
function onlineChars(api: string, ws: string, token: string, chars: any[]) {
  let cls = 'vanguard'; const nameIn = h('input', { placeholder: 'Character name' }) as HTMLInputElement;
  screen(h('div', { class: 'panel-box' }, h('h2', {}, 'Server characters'), h('div', { class: 'slots' }, chars.map((c) => h('div', { class: 'slot-card' }, h('b', {}, c.name), h('span', { class: 'dim' }, ` Lv ${c.level} ${L(CLASSES[c.classId]?.name)}`), h('button', { class: 'btn primary', onclick: async () => { try { const a = await RemoteAdapter.connect(ws, token, c.id); startGame(a); } catch (e: any) { toastLite(e.message); } } }, 'Enter world')))),
    h('h3', {}, 'Create'), nameIn, h('select', { onchange: (e: Event) => { cls = (e.target as HTMLSelectElement).value; } }, CLASS_IDS.map((id) => h('option', { value: id }, L(CLASSES[id]!.name)))),
    h('button', { class: 'btn', onclick: async () => { const r = await fetch(`${api}/characters`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ name: nameIn.value, classId: cls, appearance: { body: 0, hair: 0, hairColor: '#5a3a22', skin: '#f0c8a0', eyes: '#202040' } }) }); const j = await r.json(); if (!r.ok) { toastLite(j.error); return; } onlineChars(api, ws, token, [...chars, j.character]); } }, 'Create character'), h('button', { class: 'btn', onclick: () => title() }, t('back'))));
}
function showSaveText(text: string) {
  openWindow({ id: 'savetext', title: 'Export save', width: 520, render: (b) => { const ta = h('textarea', { id: 'saveText', readonly: 'true', style: { width: '100%', height: '160px' } }, text) as HTMLTextAreaElement; b.append(h('p', { class: 'dim' }, 'If the file download did not start (embedded viewers block downloads), copy this text and save it as a .json file. Import it from the title screen.'), ta, h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { navigator.clipboard?.writeText(text).then(() => toast('Copied', 'ok')).catch(() => { ta.select(); toast('Press Ctrl/Cmd+C to copy', 'info'); }); } }, 'Copy save text'))); } });
}
function persistSettings() { try { safeStorage()?.setItem('hearthbound_settings', JSON.stringify(settings)); } catch { /* */ } }

// ---------------- Game ----------------
let running = false;
function startLocal(player: any, market: any) { const a = new LocalAdapter(player, market, { dev: DEV }); a.save(); startGame(a); }
function startGame(a: Adapter) {
  app.innerHTML = ''; running = true; audio.unlock();
  if (DEV) (window as any).__hb = { a, audio, settings, auto: () => auto, cmd: (c: string, x: any) => a.send(c, x), aiMove: () => (a instanceof LocalAdapter && a.session.tcg ? aiChooseAction(a.session.tcg.state, 0) : { type: 'end' }) }; // test hook (dev/artifact-testing only)
  const cv = h('canvas', { class: 'game', 'aria-label': 'Game world' }) as HTMLCanvasElement; const root = h('div', { class: 'game-root' }, cv); app.append(root);
  setTimeout(() => { // LiveOps reminders (§47): active event countdown + unclaimed membership dailies
    const ev = a.activeEvent(); if (ev) { const left = eventEndsAt(a.serverTime()) - a.serverTime(); toast(`Event: ${L(ev.name)} — ${Math.floor(left / 86400_000)}d ${Math.floor((left % 86400_000) / 3600_000)}h left (Events → Event)`, 'info'); }
    const day = new Date(a.serverTime() + 7 * 3600_000).toISOString().slice(0, 10); const due = Object.entries(a.p.memberships ?? {}).filter(([id, m]) => MEMBERSHIPS[id]?.daily && (m.until === null || m.until > a.serverTime()) && m.lastClaim !== day);
    if (due.length) toast(`Membership daily reward ready: ${due.map(([id]) => L(MEMBERSHIPS[id]!.name)).join(', ')}`, 'gold');
  }, 1500);
  let wed: any = null; setInterval(() => { if (running && a.mapId === 'wedding_plaza') a.send('weddingStatus').then((r) => { wed = r.ok ? r.data : null; }); else wed = null; }, 1000);
  const r = new Renderer(cv); let target: PubEntity | null = null; let auto = false; const keys = new Set<string>(); let joy = { x: 0, y: 0 };
  const resize = () => { r.resize(Math.floor(window.innerWidth), Math.floor(window.innerHeight)); r.zoom = 0.75 + settings.zoom * 0.75; }; window.addEventListener('resize', resize); resize();
  const apply = () => { audio.vol.master = settings.master; audio.vol.music = settings.music; audio.vol.sfx = settings.sfx; audio.muted = !!settings.muted; audio.apply(); Object.assign(r.settings, { particles: settings.particles, weather: settings.weather, lighting: settings.lighting, reducedMotion: settings.reducedMotion, lowPerf: settings.lowPerf, showNames: settings.showNames }); r.zoom = 0.75 + settings.zoom * 0.75; document.body.classList.toggle('hc', !!settings.highContrast); document.body.classList.toggle('reduced-motion', !!settings.reducedMotion); document.documentElement.style.setProperty('--ui', String(0.85 + settings.uiScale * 0.3)); relabel(); a.send('settings', { settings: { autoLoot: !!settings.autoLoot, offlineAuto: !!settings.offlineAuto } }); persistSettings(); };
  const exportSave = () => { if (!(a instanceof LocalAdapter)) { toast('Online saves live on the server', 'info'); return; } const blob = new Blob([a.exportSave()], { type: 'application/json' }); const u = URL.createObjectURL(blob); const link = h('a', { href: u, download: `hearthbound_${a.p.name}_${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); showSaveText(a.exportSave()); };
  const quit = () => { a.save(); running = false; closeAll(); audio.stop(); window.removeEventListener('resize', resize); title(); };
  initPanels({ a, target: () => target, audio, settings, applySettings: apply, exportSave, importSave: () => { quit(); importFlow(); }, quit, setNight: (v) => r.setNight(v) });
  (globalThis as any).__refinePreview = (uid: string) => new PlayerService(a.p).refinePreview(uid);
  (globalThis as any).__refPrice = (id: string) => (a instanceof LocalAdapter ? a.marketSvc.refPrice(id) : 0);
  (globalThis as any).__eggOdds = EGG_POOL.map((e) => `${L(PETS[e.id]!.name)} ${e.weight}%`).join(', ');
  const useHotbar = (i: number) => {
    if (i >= 8) { const it = a.p.inventory.find((x) => x.defId.startsWith(i === 8 ? 'potion_hp' : 'potion_mp')); if (it) a.send('useItem', { uid: it.uid }).then((res) => { if (res.ok) audio.play('heal'); }); else toast('No potion', 'err'); return; }
    const sk = a.p.hotbar[i]; if (!sk) return; const s = ALL_SKILLS[sk]!;
    const tgt = target && !target.dead ? target : null;
    a.send('cast', { skill: sk, target: tgt?.id ?? null }).then((res) => { if (!res.ok) { if (!['COOLDOWN', 'GLOBAL_COOLDOWN'].includes(res.err!)) toast(res.err!.replace(/_/g, ' ').toLowerCase(), 'err'); } else { audio.play(s.dmgType === 'heal' ? 'heal' : 'skill'); } });
  };
  const attack = () => {
    let tg = target && !target.dead && target.k !== 'npc' && target.k !== 'loot' ? target : null;
    if (!tg) { const me = a.entities().find((e) => e.id === a.myId)!; tg = a.entities().filter((e) => e.k === 'monster' && !e.dead).sort((x, y) => Math.hypot(x.x - me.x, x.y - me.y) - Math.hypot(y.x - me.x, y.y - me.y))[0] ?? null; if (tg && Math.hypot(tg.x - me.x, tg.y - me.y) > 400) tg = null; target = tg; r.selected = tg?.id ?? null; a.send('target', { id: tg?.id ?? null }); }
    if (!tg) return; const me = a.entities().find((e) => e.id === a.myId)!; const d = Math.hypot(tg.x - me.x, tg.y - me.y);
    a.send('attack', { target: tg.id }).then((res) => { if (!res.ok && res.err === 'OUT_OF_RANGE' && d < 600) a.send('moveTo', { x: tg!.x, y: tg!.y }); });
  };
  const interact = () => {
    const me = a.entities().find((e) => e.id === a.myId); if (!me) return;
    const ents = a.entities();
    const loot = ents.find((e) => e.k === 'loot' && Math.hypot(e.x - me.x, e.y - me.y) < 70); if (loot) { a.send('pickup').then((res) => res.ok && (res.data as any).n && audio.play('coin')); return; }
    const npc = ents.filter((e) => e.k === 'npc').sort((x, y) => Math.hypot(x.x - me.x, x.y - me.y) - Math.hypot(y.x - me.x, y.y - me.y))[0]; if (npc && Math.hypot(npc.x - me.x, npc.y - me.y) < 110) { openNpc(npc.def!); return; }
    const m = getMap(a.mapId); const node = m.nodes.map((n) => ({ n, d: Math.hypot(n.x * TILE + 16 - me.x, n.y * TILE + 16 - me.y) })).sort((x, y) => x.d - y.d)[0]; if (node && node.d < 80) { a.send('gather', { node: node.n.id }).then((res) => { if (res.ok) audio.play('coin'); else toast(res.msg ?? res.err!, 'err'); }); return; }
    const pi = MAPS[a.mapId]!.portals.findIndex((p) => Math.hypot(p.x * TILE + 16 - me.x, p.y * TILE + 16 - me.y) < 96); if (pi >= 0) { a.send('portal', { i: pi }).then((res) => { if (!res.ok) toast(res.msg ?? res.err!, 'err'); }); return; }
    toast('Nothing to interact with nearby', 'info');
  };
  const capture = () => { if (!target || target.k !== 'monster') { toast('Select a weakened monster first', 'err'); return; } const sp = MONSTERS[target.def!]!.capturable; if (!sp) { toast(`${target.n} cannot be captured`, 'err'); return; } a.send('capture', { target: target.id }).then((res) => { if (res.ok) toast((res.data as any).success ? `Captured ${L(PETS[sp]!.name)}!` : 'The net broke free… (lower its HP first)', (res.data as any).success ? 'ok' : 'err'); else toast(res.msg ?? res.err!, 'err'); refreshAll(); }); };
  const cycleTarget = () => { const me = a.entities().find((e) => e.id === a.myId)!; const list = a.entities().filter((e) => (e.k === 'monster' || e.k === 'bot') && !e.dead && Math.hypot(e.x - me.x, e.y - me.y) < 500).sort((x, y) => Math.hypot(x.x - me.x, x.y - me.y) - Math.hypot(y.x - me.x, y.y - me.y)); if (!list.length) return; const i = target ? list.findIndex((e) => e.id === target!.id) : -1; target = list[(i + 1) % list.length]!; r.selected = target.id; a.send('target', { id: target.id }); };
  const menu = [
    { key: 'C', label: t('character'), icon: 'armor', open: openCharacter }, { key: 'I', label: t('inventory'), icon: 'pack', open: openInventory }, { key: 'K', label: t('skills'), icon: 'staff', open: openSkills }, { key: 'J', label: t('quests'), icon: 'scroll', open: openQuests },
    { key: 'P', label: t('pets'), icon: 'egg', open: openPets }, { key: '', label: t('mounts'), icon: 'whistle', open: openMounts }, { key: '', label: t('cards'), icon: 'cards', open: openCardBook }, { key: '', label: t('crafting'), icon: 'pickaxe', open: openCrafting },
    { key: 'G', label: t('market'), icon: 'gem', open: openMarket }, { key: 'O', label: t('social'), icon: 'ring', open: openSocial }, { key: 'M', label: t('mail'), icon: 'book', open: openMail }, { key: '', label: t('dungeon'), icon: 'shield', open: openDungeons },
    { key: '', label: 'World Boss', icon: 'heart', open: openBoss }, { key: '', label: t('pvp'), icon: 'sword', open: openArena }, { key: 'B', label: t('tcg'), icon: 'pack', open: openTcg }, { key: '', label: t('rank'), icon: 'amulet', open: openRankings },
    { key: '', label: t('events'), icon: 'ticket', open: openEvents }, { key: 'H', label: t('help'), icon: 'book', open: openHelp }, { key: '', label: 'Creator', icon: 'lute', open: openCreator }, { key: 'Esc', label: t('settings'), icon: 'gloves', open: openSettings },
    ...(a.dev ? [{ key: '`', label: t('dev'), icon: 'gun', open: openDev }] : []),
    { key: 'Z', label: 'Auto', icon: 'knuckle', open: () => { auto = !auto; toast(`Auto-battle ${auto ? 'ON' : 'OFF'}`, 'info'); } },
  ];
  const relabel = () => { if (!hud) return; setLang(settings.lang); const keys = ['character', 'inventory', 'skills', 'quests', 'pets', 'mounts', 'cards', 'crafting', 'market', 'social', 'mail', 'dungeon', '', 'pvp', 'tcg', 'rank', 'events', 'help', '', 'settings']; hud.menu.querySelectorAll('.mbtn').forEach((b, i) => { const k = keys[i]; if (k) { (b.querySelector('.ml') as HTMLElement).textContent = t(k); b.setAttribute('aria-label', t(k)); } }); };
  // eslint-disable-next-line prefer-const
  let hud!: HudRefs;
  hud = buildHud(root, { onHotbar: useHotbar, onChat: (ch, m) => a.send('chat', { ch, msg: m }), onRespawn: () => a.send('respawn'), menu, onJoy: (dx, dy) => { joy = { x: dx, y: dy }; }, onMobileAttack: attack, onMobilePickup: interact, onMobileInteract: interact });
  chatLine(hud, 'system', 'System', `Welcome, ${a.p.name}! ${a.mode === 'local' ? 'Artifact mode — other players are simulated (·sim).' : 'Connected to server.'} Press H for help.`);
  const onMap = (mapId: string) => { r.setMap(mapId); target = null; r.selected = null; audio.setMood(MAPS[mapId]!.bgm); toast(L(MAPS[mapId]!.name), 'info'); hideTip(); };
  a.onMapChange = onMap; onMap(a.mapId); apply();
  // input
  const keyMap: Record<string, () => void> = { c: openCharacter, i: openInventory, k: openSkills, j: openQuests, p: openPets, o: openSocial, m: openMail, g: openMarket, b: openTcg, h: openHelp, f: interact, n: capture, ' ': attack, tab: cycleTarget, r: () => a.send('ride').then((res) => !res.ok && toast(res.msg ?? res.err!, 'err')), z: () => { auto = !auto; toast(`Auto-battle ${auto ? 'ON' : 'OFF'}`, 'info'); }, '`': openDev, q: () => useHotbar(8), e: () => useHotbar(9) };
  window.onkeydown = (e) => {
    if (!running) return; const tag = (e.target as HTMLElement).tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase(); if (k === 'enter') { hud.chatIn.focus(); e.preventDefault(); return; }
    if (k === 'escape') { if (document.querySelector('.win')) closeAll(); else openSettings(); return; }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); return; }
    if (/^[1-8]$/.test(k)) { useHotbar(Number(k) - 1); return; }
    const fn = keyMap[k]; if (fn) { e.preventDefault(); fn(); }
  };
  window.onkeyup = (e) => keys.delete(e.key.toLowerCase());
  window.onblur = () => keys.clear();
  cv.addEventListener('pointerdown', (e) => {
    const picked = r.pick(e.offsetX, e.offsetY, a.entities()); audio.unlock();
    if (picked && picked.id !== a.myId) {
      target = picked; r.selected = picked.id; a.send('target', { id: picked.id });
      if (picked.k === 'npc') { const me = a.entities().find((x) => x.id === a.myId)!; if (Math.hypot(picked.x - me.x, picked.y - me.y) < 120) openNpc(picked.def!); else a.send('moveTo', { x: picked.x, y: picked.y + 32 }); }
      else if (picked.k === 'loot') { a.send('moveTo', { x: picked.x, y: picked.y }); }
      else if (picked.k === 'monster' && e.detail >= 2) attack();
      return;
    }
    const w = r.screenToWorld(e.offsetX, e.offsetY);
    const m = getMap(a.mapId); const node = m.nodes.find((n) => Math.hypot(n.x * TILE + 16 - w.x, n.y * TILE + 16 - w.y) < 24);
    a.send('moveTo', { x: node ? node.x * TILE + 16 : w.x, y: node ? node.y * TILE + 48 : w.y }).then((res) => { if (!res.ok && !node) { /* blocked tile */ } });
  });
  // loop
  let last = performance.now(); let fps = 60, fpsAcc = 0, fpsN = 0, lastDx = 0, lastDy = 0, hudAcc = 0, autoAcc = 0, uiAcc = 0;
  const loop = (now: number) => {
    if (!running) return; const dt = Math.min(100, now - last); last = now;
    const dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joy.x; const dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + joy.y;
    if (dx !== lastDx || dy !== lastDy) { a.send('move', { dx, dy }); lastDx = dx; lastDy = dy; }
    a.tick(dt);
    if (auto) { autoAcc += dt; if (autoAcc > 400) { autoAcc = 0; autoStep(); } }
    const fx = a.drainFx(); const ents = a.entities(); const byId = new Map(ents.map((x) => [x.id, x]));
    for (const f of fx) {
      if (f.t === 'chat' && !((a.p as any).muted ?? []).includes(String(f.from).replace(/ \[sim\]$/, '')) && !((a.p as any).muted ?? []).includes(f.from)) chatLine(hud, f.ch, f.from, f.msg);
      if (f.t === 'notice' && (!f.to || f.to === a.myId)) { toast(f.msg, f.msg.startsWith('+') ? 'gold' : 'info'); if (!f.to) chatLine(hud, 'system', 'System', f.msg);
        const inv = /\((partyAccept|tradeAccept|duelAccept|guildAccept|marriageAccept|tcgAccept)\)|invites you to a party/.exec(f.msg); if (inv && a.mode === 'online') { const cmd = inv[1] ?? 'partyAccept'; confirmDialog(f.msg.replace(/\(.*?\)/, ''), () => act(cmd, {}, 'Accepted'), 'Accept'); } }
      if (f.t === 'level' && f.id === a.myId) { audio.play('level'); toast(`Level up! ${a.p.level}`, 'gold'); refreshAll(); }
      if (f.t === 'dmg' && (f.src === a.myId || f.tgt === a.myId)) audio.play(f.crit ? 'crit' : 'hit');
      if (f.t === 'death' && f.id === a.myId) audio.play('death');
    }
    r.pushFx(fx, a.myId, byId);
    if (target) { target = byId.get(target.id) ?? null; if (!target) r.selected = null; }
    (globalThis as any).__timeLabel = r.timeLabel(); (globalThis as any).__weather = r.weather(); (globalThis as any).__cds = a instanceof LocalAdapter ? a.world.entities.get(a.myId)?.cds : undefined;
    r.draw(a, dt);
    hudAcc += dt; if (hudAcc > 100) { hudAcc = 0; updateHud(hud, a, target, fps); { const ar: any = a.arenaInfo(); const wl: Record<string, string> = { gathering: 'Guests gathering', vows: 'Exchanging vows', rings: 'Exchanging rings', celebration: 'Celebration!' }; hud.banner.textContent = ar && !ar.done ? `${ar.mode === 'siege' ? 'Lantern Siege' : ar.mode === 'rush' ? 'Ember Rush' : 'Last Light'} · Blue ${Math.floor(ar.score?.[0] ?? 0)} : ${Math.floor(ar.score?.[1] ?? 0)} Red · ${Math.max(0, Math.ceil((ar.endsAt - Date.now()) / 1000))}s` : wed && wl[wed.phase] && a.mapId === 'wedding_plaza' ? `💒 ${wed.names.join(' & ')} — ${wl[wed.phase]} · ${Math.max(0, Math.ceil((wed.phaseEndsAt - a.serverTime()) / 1000))}s · ${wed.guests} guest(s)` : ''; hud.banner.style.display = hud.banner.textContent ? 'block' : 'none'; } r.drawMinimap(hud.mini, a); }
    uiAcc += dt; if (uiAcc > 1000) { uiAcc = 0; for (const id of ['boss', 'arena', 'dungeon', 'market', 'pets']) if (isOpen(id)) refreshAll(); }
    fpsAcc += dt; fpsN++; if (fpsAcc > 1000) { fps = Math.round((fpsN * 1000) / fpsAcc); fpsAcc = 0; fpsN = 0; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  /** Official auto-battle (§31): same commands & constraints as manual play; stops on death/full bag. */
  function autoStep() {
    const me = a.entities().find((e) => e.id === a.myId); if (!me) return; if (me.dead) { auto = false; toast('Auto-battle stopped: defeated', 'err'); return; }
    if (a.p.inventory.length >= a.p.invSlots) { auto = false; toast('Auto-battle stopped: bag full', 'err'); return; }
    if (me.hp / me.mhp < 0.35) useHotbar(8); if (me.mp / me.mmp < 0.2) useHotbar(9);
    if (Object.values(a.p.equipment).some((i) => i && i.durability < 20)) { const kit = a.p.inventory.find((x) => x.defId === 'repair_kit'); if (kit) a.send('useItem', { uid: kit.uid }).then((r) => r.ok && toast('Auto-repair: Tinker Kit used', 'info')); } // official auto-repair (§31)
    if (settings.autoLoot) { const bag = a.entities().filter((e) => e.k === 'loot').map((e) => ({ e, d: Math.hypot(e.x - me.x, e.y - me.y) })).filter((x) => x.d < 400).sort((x, y) => x.d - y.d)[0]; if (bag && bag.d > 30) { a.send('moveTo', { x: bag.e.x, y: bag.e.y }); return; } } // collect drops before the next fight (auto-loot)
    if (!target || target.dead || target.k !== 'monster') { target = null; attack(); return; }
    for (let i = 0; i < 8; i++) { const sk = a.p.hotbar[i]; const s = sk ? ALL_SKILLS[sk] : null; if (s && s.dmgType !== 'heal' && s.dmgType !== 'none' && me.mp > s.mp + 10 && Math.random() < 0.3) { useHotbar(i); return; } }
    attack();
  }
  void NPCS;
}

title();
