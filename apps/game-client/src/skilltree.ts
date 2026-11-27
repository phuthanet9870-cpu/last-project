/**
 * Skill System V4 window (spec §32–33): ascension tabs · visual tree with prerequisite lines · node states ·
 * detail panel (current vs next rank, from the same rank table combat uses) · pending allocation with Undo / Clear / Confirm ·
 * recommended builds + Auto Allocate (fills the draft only) · hotbar assign · reset (scroll first, else gold).
 * Nothing changes on the server until Confirm, which sends ONE atomic `skillCommit` with the revision + an idempotency key.
 */
import { CLASSES, PX_PER_M, autoAllocateDraft, phaseName, skillPointBudget, validateSkillDraft, valuesAt, type PlayerState, type Result, type SkillDef } from '@hb/game-core';
import { skillIcon } from './art.js';
import { L, getLang } from './i18n.js';
import { bindTip, confirmDialog, h, iconEl, openWindow, renderWin, toast } from './ui.js';

type Send = (cmd: string, args: Record<string, unknown>, okMsg?: string) => Promise<Result>;
let send: Send; let getP: () => PlayerState; let getGauge: () => number = () => 0;
export function initSkillTree(o: { send: Send; player: () => PlayerState; gauge: () => number }) { send = o.send; getP = o.player; getGauge = o.gauge; }

const S = { stage: 1 as 1 | 2 | 3, sel: null as string | null, draft: null as Record<string, number> | null, hist: [] as Record<string, number>[], cls: '', rev: -1, build: 0 };
const th = () => getLang() === 'th';
const T = (en: string, tth: string) => (th() ? tth : en);
const STAGE_NAME = (a: number) => T(`Ascension ${['I', 'II', 'III'][a - 1]}`, `อัสเซนชัน ${['I', 'II', 'III'][a - 1]}`);
const STAT_NAME: Record<string, [string, string]> = { maxHp: ['Max HP', 'HP สูงสุด'], maxMp: ['Max MP', 'MP สูงสุด'], atk: ['ATK', 'ATK'], matk: ['MATK', 'MATK'], def: ['DEF', 'DEF'], mdef: ['MDEF', 'MDEF'], acc: ['Accuracy', 'ความแม่นยำ'], eva: ['Evasion', 'หลบหลีก'], crit: ['Crit', 'คริ'], critDmg: ['Crit damage', 'ดาเมจคริ'], aspd: ['Attack speed', 'ความเร็วโจมตี'], moveSpeed: ['Move speed', 'ความเร็วเคลื่อนที่'], cdr: ['Cooldown reduction', 'ลดคูลดาวน์'], hpRegen: ['HP regen', 'ฟื้น HP'], mpRegen: ['MP regen', 'ฟื้น MP'], pen: ['Armor pen', 'เจาะเกราะ'], mpen: ['Magic pen', 'เจาะเวท'], lifesteal: ['Lifesteal', 'ดูดเลือด'], dmgReduce: ['Damage reduction', 'ลดดาเมจ'], healPower: ['Healing', 'พลังรักษา'], dropBonus: ['Drop rate', 'อัตราดรอป'], goldBonus: ['Gold find', 'เงินที่ได้'], elemBonus: ['Element bonus', 'โบนัสธาตุ'], ccResist: ['CC resist', 'ต้านควบคุม'] };

function committed(p: PlayerState) { return p.skillRanks; }
function draftOf(p: PlayerState): Record<string, number> {
  if (S.cls !== p.classId || S.rev !== (p.skillRev ?? 0) || !S.draft) { S.cls = p.classId; S.rev = p.skillRev ?? 0; S.draft = { ...committed(p) }; S.hist = []; }
  return S.draft;
}
const spent = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);
const pendingCount = (p: PlayerState, d: Record<string, number>) => spent(d) - spent(committed(p));

type NodeState = 'locked' | 'available' | 'learned' | 'maxed' | 'pending';
function nodeState(p: PlayerState, s: SkillDef, d: Record<string, number>): NodeState {
  const r = d[s.id] ?? 0, c = committed(p)[s.id] ?? 0;
  if (r > c) return 'pending';
  if (r >= s.maxRank) return 'maxed';
  if (r > 0) return 'learned';
  const err = validateSkillDraft(p, { ...d, [s.id]: 1 }); return err && err.code !== 'NO_SKILL_POINTS' ? 'locked' : 'available'; // out-of-points is not a lock
}
function addRank(p: PlayerState, s: SkillDef) {
  const d = draftOf(p); const next = { ...d, [s.id]: (d[s.id] ?? 0) + 1 }; const err = validateSkillDraft(p, next);
  if (err) { toast(err.msg ?? err.code, 'err'); return; }
  S.hist.push({ ...d }); S.draft = next; renderWin('skills');
}
function removeRank(p: PlayerState, s: SkillDef) {
  const d = draftOf(p); const r = d[s.id] ?? 0; if (r <= (committed(p)[s.id] ?? 0)) return;
  const next = { ...d, [s.id]: r - 1 }; if (validateSkillDraft(p, next)) { toast(T('Another pending skill depends on this rank', 'มีสกิลที่รอยืนยันซึ่งต้องใช้แรงก์นี้'), 'err'); return; }
  S.hist.push({ ...d }); S.draft = next; renderWin('skills');
}

function icon(s: SkillDef, color: string, size: number) { return iconEl(skillIcon(s.vfx === 'shot' ? 'arrow' : s.vfx === 'summon' ? 'mark' : s.vfx, color, s.type === 'passive'), size); }
function fmtVal(v: number) { return Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, ''); }

/** Current-rank vs next-rank rows from valuesAt() — the same table effectiveSkill() feeds to combat. */
function compareRows(s: SkillDef, rank: number): [string, string, string][] {
  const cur = rank > 0 ? valuesAt(s.src, rank) : null; const nxt = rank < s.maxRank ? valuesAt(s.src, rank + 1) : null;
  const rows: [string, string, string][] = []; const col = (f: (v: ReturnType<typeof valuesAt>) => string) => [cur ? f(cur) : '—', nxt ? f(nxt) : T('MAX', 'สูงสุด')] as const;
  if (s.type === 'passive') {
    for (let i = 0; i < (s.passive ?? []).length; i++) { const m = s.passive![i]!; const nm = STAT_NAME[m.stat] ?? [m.stat, m.stat]; const f = (v: ReturnType<typeof valuesAt>) => `+${fmtVal(v.passive[i]!.value)}${m.kind === 'pct' ? '%' : ''}`; rows.push([T(nm[0], nm[1]), ...col(f)]); }
    return rows;
  }
  const atk = s.dmgType === 'mag' ? 'MATK' : s.dmgType === 'heal' ? T('heal power', 'พลังรักษา') : 'ATK';
  rows.push(['MP', ...col((v) => String(v.mp))]);
  rows.push([T('Cooldown', 'คูลดาวน์'), ...col((v) => `${fmtVal(v.cdMs / 1000)}s`)]);
  if (s.range) rows.push([T('Range', 'ระยะ'), ...col(() => `${fmtVal(s.range / PX_PER_M)}m`)]);
  if (s.radius) rows.push([T('Area', 'รัศมี'), ...col(() => `${fmtVal(s.radius / PX_PER_M)}m`)]);
  if (s.dmgType !== 'none' && s.power) rows.push([s.dmgType === 'heal' ? T('Healing', 'การรักษา') : T('Damage', 'ดาเมจ'), ...col((v) => `${fmtVal(v.power * 100)}% ${atk}`)]);
  if (s.hits > 1) rows.push([T('Hits', 'จำนวนครั้ง'), ...col((v) => `×${v.hits}`)]);
  if (s.effects.length) rows.push([T('Effects', 'ผล'), ...col(() => s.effects.map((e) => `${e.s}${e.d ? ` ${fmtVal(e.d / 1000)}s` : ''}${e.c !== undefined ? ` ${Math.round(e.c * 100)}%` : ''}`).join(', '))]);
  if (s.gauge?.cost) rows.push([T('Gauge cost', 'ใช้เกจ'), ...col(() => `${s.gauge!.cost}${s.gauge!.need ? ` (${T('needs', 'ต้องมี')} ${s.gauge!.need})` : ''}${s.gauge!.scale ? `, +${s.gauge!.scale}%/${T('pt', 'แต้ม')}` : ''}`)]);
  if (s.gauge?.gain) rows.push([T('Gauge gain', 'ได้เกจ'), ...col(() => `+${s.gauge!.gain}`)]);
  return rows;
}

export function openSkillTree() { openWindow({ id: 'skills', title: `${T('Skills', 'สกิล')} (K)`, width: 900, cls: 'skwin', render: (b) => {
  const p = getP(); const cls = CLASSES[p.classId]!; const d = draftOf(p); const gd = cls.gauge.def;
  const budget = skillPointBudget(p); const free = budget - spent(d); const pend = pendingCount(p, d);
  if (S.stage > p.ascension + 1 && !cls.skills.some((s) => s.asc === S.stage && (d[s.id] ?? 0) > 0)) S.stage = Math.min(S.stage, (p.ascension + 1) as 1 | 2 | 3) as 1 | 2 | 3;
  // header
  const ph = phaseName(gd, getGauge());
  b.append(h('div', { class: 'sk-head' },
    h('div', {}, h('b', { class: 'sk-cls' }, L(cls.name)), h('span', { class: 'sk-sub' }, ` · ${T('Job Lv', 'เลเวลอาชีพ')} ${p.jobLevel} · ${T('Base Lv', 'เลเวลตัวละคร')} ${p.level} · ${STAGE_NAME(p.ascension + 1 > 3 ? 3 : p.ascension + 1)}`)),
    h('div', { class: 'sk-gauge', title: L(cls.gauge.effect) }, h('b', {}, L(cls.gauge.name)), ` ${ph ? T(ph[0], ph[1]) : `${fmtVal(getGauge())}/${gd.max}`}`)));
  b.append(h('div', { class: 'sk-gdesc' }, L(cls.gauge.effect)));
  // stage tabs
  b.append(h('div', { class: 'sk-tabs', role: 'tablist' }, ([1, 2, 3] as const).map((a) => { const locked = p.ascension < a - 1; const n = cls.skills.filter((s) => s.asc === a).length; const r = cls.skills.filter((s) => s.asc === a).reduce((x, s) => x + (d[s.id] ?? 0), 0);
    return h('button', { class: `sk-tab ${S.stage === a ? 'on' : ''} ${locked ? 'lock' : ''}`, role: 'tab', 'aria-selected': S.stage === a ? 'true' : 'false', onclick: () => { S.stage = a; renderWin('skills'); } }, `${STAGE_NAME(a)} ${locked ? '🔒' : ''}`, h('small', {}, ` ${r} ${T('pts', 'แต้ม')} · ${n} ${T('skills', 'สกิล')}`)); })));
  const main = h('div', { class: 'sk-main' }); b.append(main);
  // tree
  const stage = cls.skills.filter((s) => s.asc === S.stage); const rows = Math.max(...stage.map((s) => s.tree[0])) + 1;
  const CW = 150, RH = 124, PADX = 18, PADY = 14; const W = CW * 3 + PADX * 2, H = RH * rows + PADY * 2;
  const tree = h('div', { class: 'sk-tree', style: { width: `${W}px`, height: `${H}px` } });
  const pos = (s: SkillDef) => ({ x: PADX + s.tree[1] * CW + CW / 2, y: PADY + s.tree[0] * RH + 30 });
  const NS = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H)); svg.setAttribute('class', 'sk-lines');
  for (const s of stage) for (const [pk, pr] of s.pre) { const ps = cls.skills.find((x) => x.key === pk)!; if (ps.asc !== s.asc) continue; const a = pos(ps), c = pos(s); const met = (d[ps.id] ?? 0) >= pr;
    const ln = document.createElementNS(NS, 'line'); ln.setAttribute('x1', String(a.x)); ln.setAttribute('y1', String(a.y + 22)); ln.setAttribute('x2', String(c.x)); ln.setAttribute('y2', String(c.y - 22)); ln.setAttribute('class', `${met ? 'met' : ''} ${s.preAny ? 'or' : ''}`); svg.append(ln); }
  tree.append(svg);
  for (const s of stage) {
    const stt = nodeState(p, s, d); const r = d[s.id] ?? 0; const { x, y } = pos(s);
    const node = h('div', { class: `sk-node ${stt} ${s.type} ${S.sel === s.id ? 'sel' : ''}`, style: { left: `${x - 60}px`, top: `${y - 28}px` }, tabindex: '0', 'data-skill': s.id,
      draggable: s.type !== 'passive' && (committed(p)[s.id] ?? 0) > 0 ? 'true' : undefined, ondragstart: (e: DragEvent) => { e.dataTransfer?.setData('text/hb-skill', s.id); },
      onclick: () => { S.sel = s.id; renderWin('skills'); }, oncontextmenu: (e: Event) => { e.preventDefault(); removeRank(p, s); },
      onkeydown: (e: KeyboardEvent) => { if (e.key === '+' || e.key === '=') addRank(p, s); if (e.key === '-') removeRank(p, s); if (e.key === 'Enter') { S.sel = s.id; renderWin('skills'); } } },
      h('div', { class: 'sk-ic' }, icon(s, cls.palette.trim, 40), stt === 'locked' ? h('span', { class: 'sk-lk' }, '🔒') : null),
      h('div', { class: 'sk-rk' }, `${r}/${s.maxRank}`),
      h('div', { class: 'sk-nm' }, L(s.name)),
      h('div', { class: 'sk-pm' }, h('button', { class: 'sk-b', 'aria-label': `- ${s.name.en}`, disabled: r <= (committed(p)[s.id] ?? 0) || undefined, onclick: (e: Event) => { e.stopPropagation(); removeRank(p, s); } }, '−'), h('button', { class: 'sk-b', 'aria-label': `+ ${s.name.en}`, disabled: stt === 'locked' || stt === 'maxed' || free <= 0 || undefined, onclick: (e: Event) => { e.stopPropagation(); addRank(p, s); } }, '+')));
    bindTip(node, () => `<b>${L(s.name)}</b> (${s.type})<br>${L(s.desc)}${stt === 'locked' ? `<br><span style="color:#c44">${validateSkillDraft(p, { ...d, [s.id]: 1 })?.msg ?? ''}</span>` : ''}`);
    tree.append(node);
  }
  main.append(h('div', { class: 'sk-treewrap' }, tree, h('div', { class: 'sk-normal' }, `${T('Normal attack', 'โจมตีปกติ')}: ${L({ en: cls.normal.n[0], th: cls.normal.n[1] })} — ${Math.round(cls.normal.p * 100)}% ${cls.normal.d === 'mag' ? 'MATK' : 'ATK'}${cls.normal.hits > 1 ? ` ×${cls.normal.hits}` : ''}, ${cls.normal.r}m · ${T('not part of the tree', 'ไม่อยู่ในต้นไม้สกิล')}`)));
  // detail
  const det = h('div', { class: 'sk-detail' }); main.append(det);
  const s = cls.skills.find((x) => x.id === S.sel) ?? stage[0]!; const rank = d[s.id] ?? 0; const crank = committed(p)[s.id] ?? 0;
  det.append(h('div', { class: 'sk-dh' }, icon(s, cls.palette.trim, 48), h('div', {}, h('b', {}, L(s.name)), h('div', { class: 'sk-sub' }, `${s.type === 'passive' ? T('Passive', 'ติดตัว') : s.type === 'ultimate' ? T('Ultimate', 'ท่าไม้ตาย') : T('Active', 'กดใช้')} · ${s.dmgType === 'phys' ? T('Physical', 'กายภาพ') : s.dmgType === 'mag' ? T('Magical', 'เวทมนตร์') : s.dmgType === 'heal' ? T('Healing', 'รักษา') : T('Utility', 'สนับสนุน')} · ${STAGE_NAME(s.asc)}`), h('div', { class: 'sk-sub' }, `${T('Rank', 'แรงก์')} ${rank}/${s.maxRank}${rank > crank ? ` (${T('pending', 'รอยืนยัน')} +${rank - crank})` : ''}`))));
  det.append(h('p', { class: 'sk-desc' }, L(s.desc)));
  const req = [`${T('Job level', 'เลเวลอาชีพ')} ${s.jobReq} ${p.jobLevel >= s.jobReq ? '✓' : '✗'}`, `${STAGE_NAME(s.asc)} ${p.ascension >= s.asc - 1 ? '✓' : '✗'}`, ...s.pre.map(([k, r]) => { const ps = cls.skills.find((x) => x.key === k)!; return `${L(ps.name)} ${r} ${(d[ps.id] ?? 0) >= r ? '✓' : '✗'}`; })];
  det.append(h('div', { class: 'sk-req' }, h('b', {}, T('Requires', 'เงื่อนไข') + (s.preAny ? T(' (any one skill)', ' (สกิลใดสกิลหนึ่ง)') : '')), h('ul', {}, req.map((x) => h('li', { class: x.endsWith('✓') ? 'ok' : 'no' }, x)))));
  const tbl = h('table', { class: 'sk-cmp' }, h('tr', {}, h('th', {}, ''), h('th', {}, rank > 0 ? `${T('Rank', 'แรงก์')} ${rank}` : T('Not learned', 'ยังไม่เรียน')), h('th', {}, rank < s.maxRank ? `${T('Rank', 'แรงก์')} ${rank + 1}` : '')));
  for (const [k, a, c] of compareRows(s, rank)) tbl.append(h('tr', {}, h('td', {}, k), h('td', {}, a), h('td', { class: a !== c ? 'up' : '' }, c)));
  det.append(tbl);
  det.append(h('div', { class: 'sk-row' }, h('button', { class: 'btn sm', disabled: nodeState(p, s, d) === 'locked' || rank >= s.maxRank || free <= 0 || undefined, onclick: () => addRank(p, s) }, T('+1 rank', '+1 แรงก์')), h('button', { class: 'btn sm', disabled: rank <= crank || undefined, onclick: () => removeRank(p, s) }, T('−1 rank', '−1 แรงก์'))));
  if (s.type !== 'passive' && crank > 0) det.append(h('div', { class: 'sk-row' }, h('span', {}, T('Hotbar: ', 'ช่องลัด: ')), Array.from({ length: 8 }, (_, i) => h('button', { class: `btn sm ${p.hotbar[i] === s.id ? 'on' : ''}`, onclick: () => send('hotbar', { i, id: s.id }) }, String(i + 1)))));
  if (s.type !== 'passive' && crank > 0) { const sockUid = p.skillSockets?.[s.id]; const inv = p.inventory.filter((x) => x.stone?.skillId === s.id); const cur = inv.find((x) => x.uid === sockUid);
    det.append(h('div', { class: 'sk-row' }, h('span', {}, `${T('Stone socket', 'ช่องศิลา')}: ${cur ? `${cur.stone!.mods.map((m) => `${m.key} ${m.value}%`).join(', ')} +${cur.stone!.refine}${cur.stone!.behavior ? ` ★${cur.stone!.behavior}` : ''}` : T('empty', 'ว่าง')} `),
      cur ? h('button', { class: 'btn sm', onclick: () => send('socketStone', { skill: s.id, uid: null }, T('Removed', 'ถอดแล้ว')) }, T('Remove', 'ถอด')) : null,
      ...inv.filter((x) => x.uid !== sockUid).slice(0, 3).map((x) => h('button', { class: 'btn sm', onclick: () => send('socketStone', { skill: s.id, uid: x.uid }, T('Embedded', 'ฝังแล้ว')) }, `${T('Embed', 'ฝัง')} ${x.stone!.mods.map((m) => `${m.key} ${m.value}%`).join('/')}`)),
      !inv.length ? h('span', { class: 'dim small' }, T('(inscribe a stone for this skill at Isolde)', '(จารึกศิลาสำหรับสกิลนี้ที่อิโซลด์)')) : null)); }
  else if (s.type === 'passive') det.append(h('p', { class: 'dim small' }, T('Passives work automatically once confirmed and cannot be placed on the hotbar.', 'สกิลติดตัวทำงานเองหลังยืนยัน ใส่ช่องลัดไม่ได้')));
  // builds
  const builds = cls.builds; const bd = builds[S.build] ?? builds[0]!;
  det.append(h('div', { class: 'sk-build' }, h('b', {}, T('Recommended builds', 'บิลด์แนะนำ')),
    h('select', { class: 'sk-sel', 'aria-label': 'build', onchange: (e: Event) => { S.build = Number((e.target as HTMLSelectElement).value); renderWin('skills'); } }, builds.map((x, i) => h('option', { value: String(i), selected: i === S.build || undefined }, L({ en: x.n[0], th: x.n[1] })))),
    h('div', { class: 'small' }, L({ en: bd.desc[0], th: bd.desc[1] })), h('div', { class: 'small ok' }, `+ ${L({ en: bd.pros[0], th: bd.pros[1] })}`), h('div', { class: 'small no' }, `− ${L({ en: bd.cons[0], th: bd.cons[1] })}`), h('div', { class: 'small dim' }, `${T('Stats', 'ค่าสถานะ')}: ${bd.stats} · ${T('Weapon', 'อาวุธ')}: ${bd.weapon}`),
    h('button', { class: 'btn sm', onclick: () => { const nd = autoAllocateDraft(p, bd.seq); S.hist.push({ ...d }); S.draft = nd; renderWin('skills'); toast(T(`Draft filled (+${spent(nd) - spent(d)}). Review, then Confirm.`, `เติมร่างแล้ว (+${spent(nd) - spent(d)}) ตรวจแล้วกดยืนยัน`), 'ok'); } }, T('Auto Allocate (draft)', 'จัดสรรอัตโนมัติ (ร่าง)'))));
  // footer
  b.append(h('div', { class: 'sk-foot' },
    h('div', { class: 'sk-pts' }, h('b', {}, `${free}`), ` ${T('points available', 'แต้มคงเหลือ')} · ${T('pending', 'รอยืนยัน')} ${pend} · ${T('total', 'ทั้งหมด')} ${budget} (${T('1 per job level', '1 ต่อเลเวลอาชีพ')})`),
    h('button', { class: 'btn', disabled: !S.hist.length || undefined, onclick: () => { S.draft = S.hist.pop()!; renderWin('skills'); } }, T('Undo', 'ย้อนกลับ')),
    h('button', { class: 'btn', disabled: !pend || undefined, onclick: () => { S.hist.push({ ...d }); S.draft = { ...committed(p) }; renderWin('skills'); } }, T('Clear', 'ล้าง')),
    h('button', { class: 'btn', onclick: () => confirmDialog(T('Reset ALL skills? Uses a Scroll of Unlearning if you have one, otherwise 2,000 gold.', 'รีเซ็ตสกิลทั้งหมด? ใช้คัมภีร์ลืมวิชาถ้ามี ไม่เช่นนั้นเสีย 2,000 ทอง'), () => send('resetSkills', {}, T('Skills reset', 'รีเซ็ตสกิลแล้ว'))) }, T('Reset', 'รีเซ็ต')),
    h('button', { class: 'btn primary sk-confirm', disabled: !pend || undefined, onclick: async () => {
      const changes = Object.fromEntries(Object.entries(d).filter(([k, v]) => v !== (committed(p)[k] ?? 0)));
      const r = await send('skillCommit', { draft: changes, rev: p.skillRev ?? 0, opId: `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }, T('Skills confirmed', 'ยืนยันสกิลแล้ว'));
      if (r.ok) { S.draft = null; S.hist = []; } renderWin('skills'); } }, T(`Confirm (${pend})`, `ยืนยัน (${pend})`))));
} }); }
