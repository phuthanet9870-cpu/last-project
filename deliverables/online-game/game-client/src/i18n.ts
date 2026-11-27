/** Thai/English localisation (§55). UI keys live here; content (items, skills, NPCs) carries its own {en, th}. */
export type Lang = 'en' | 'th';
const DICT: Record<string, [string, string]> = {
  title: ['Hearthbound Online', 'ฮาร์ธบาวด์ ออนไลน์'], subtitle: ['A cozy pixel-fantasy MMORPG', 'MMORPG แฟนตาซีพิกเซลแสนอบอุ่น'],
  play_local: ['Play Now (Artifact / Offline Mode)', 'เล่นทันที (โหมดออฟไลน์/อาร์ติแฟกต์)'], play_online: ['Online Mode (connect to server)', 'โหมดออนไลน์ (เชื่อมต่อเซิร์ฟเวอร์)'],
  continue: ['Continue', 'เล่นต่อ'], new_char: ['Create Character', 'สร้างตัวละคร'], delete: ['Delete', 'ลบ'], import_save: ['Import Save File', 'นำเข้าไฟล์เซฟ'],
  name: ['Name', 'ชื่อ'], class: ['Class', 'อาชีพ'], body: ['Body', 'รูปร่าง'], hair: ['Hair', 'ทรงผม'], hair_color: ['Hair color', 'สีผม'], skin: ['Skin', 'สีผิว'], eyes: ['Eyes', 'ดวงตา'],
  create: ['Begin Adventure', 'เริ่มการผจญภัย'], back: ['Back', 'กลับ'], role: ['Role', 'บทบาท'], element: ['Element', 'ธาตุ'], weapon: ['Weapons', 'อาวุธ'], gauge: ['Class gauge', 'มาตรอาชีพ'],
  inventory: ['Bag', 'กระเป๋า'], character: ['Character', 'ตัวละคร'], skills: ['Skills', 'สกิล'], quests: ['Quests', 'เควสต์'], map: ['Map', 'แผนที่'], pets: ['Pets', 'สัตว์เลี้ยง'], mounts: ['Mounts', 'สัตว์ขี่'],
  cards: ['Monster Cards', 'การ์ดมอนสเตอร์'], tcg: ['Hearthcards', 'ฮาร์ธการ์ด'], crafting: ['Crafting', 'คราฟต์'], market: ['Market', 'ตลาด'], social: ['Social', 'สังคม'], mail: ['Mail', 'จดหมาย'],
  dungeon: ['Dungeons', 'ดันเจี้ยน'], pvp: ['Arena', 'สนามประลอง'], rank: ['Rankings', 'อันดับ'], events: ['Events', 'กิจกรรม'], shop: ['Shop', 'ร้านค้า'], settings: ['Settings', 'ตั้งค่า'], help: ['Help', 'ช่วยเหลือ'],
  dev: ['Dev Panel', 'แผงนักพัฒนา'], save: ['Save', 'บันทึก'], saved: ['Game saved', 'บันทึกเกมแล้ว'], respawn: ['Respawn', 'เกิดใหม่'], farm: ['Farm', 'ฟาร์ม'], achievements: ['Achievements', 'ความสำเร็จ'],
  more: ['More', 'เพิ่มเติม'], sim_note: ['Other players, market traders and guild members in this mode are SIMULATED locally.', 'ผู้เล่นอื่น พ่อค้าในตลาด และสมาชิกกิลด์ในโหมดนี้เป็นการจำลองภายในเครื่อง'],
};
let lang: Lang = 'en';
export function setLang(l: Lang) { lang = l; }
export function getLang(): Lang { return lang; }
export function t(key: string): string { const v = DICT[key]; if (!v) { if (typeof console !== 'undefined') console.warn(`[i18n] missing key ${key}`); return key; } return lang === 'th' ? v[1] : v[0]; }
export function L(o: { en: string; th: string } | undefined): string { return o ? (lang === 'th' ? o.th : o.en) : ''; }
export function fmt(n: number | bigint): string { return Number(n).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US'); }
