// 預設頭像：與後端 src/reader.js 的 PRESET_AVATARS 白名單必須一致。
// avatar 欄位存代號字串（目前只有 'preset:<key>'），未來開放上傳後
// 會出現 'upload:<sha256>'，屆時 avatarHtml() 需加一個分支即可。

export const PRESET_AVATARS = [
  { key: 'book',  emoji: '📖', label: '書' },
  { key: 'quill', emoji: '🪶', label: '羽毛筆' },
  { key: 'moon',  emoji: '🌙', label: '月' },
  { key: 'star',  emoji: '⭐', label: '星' },
  { key: 'cat',   emoji: '🐱', label: '貓' },
  { key: 'fox',   emoji: '🦊', label: '狐狸' },
  { key: 'owl',   emoji: '🦉', label: '貓頭鷹' },
  { key: 'tea',   emoji: '🍵', label: '茶' },
  { key: 'leaf',  emoji: '🍃', label: '葉' },
  { key: 'wave',  emoji: '🌊', label: '浪' },
  { key: 'flame', emoji: '🔥', label: '火' },
  { key: 'cloud', emoji: '☁️', label: '雲' },
];

export const TONES = ['#efe7db', '#e7ece4', '#eee3e3', '#e4e9ef', '#f0ebe0', '#e9e4ef'];

/** 依代號取得顯示內容；沒設定頭像時退回暱稱首字。 */
export function avatarFace(avatar: string, displayName: string) {
  const key = /^preset:(\w+)$/.exec(avatar || '')?.[1];
  const preset = PRESET_AVATARS.find(a => a.key === key);
  if (preset) {
    const tone = TONES[PRESET_AVATARS.indexOf(preset) % TONES.length];
    return { text: preset.emoji, tone };
  }
  // 未選頭像：用暱稱第一個字（含中文與 emoji 都能正確取第一個字元）
  const first = [...(displayName || '讀')][0] || '讀';
  return { text: first, tone: TONES[first.charCodeAt(0) % TONES.length] };
}
