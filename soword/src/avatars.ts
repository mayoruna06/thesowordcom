// 預設頭像：與後端 src/reader.js 的 PRESET_AVATARS 白名單必須一致。
// avatar 欄位存代號字串（目前只有 'preset:<key>'），未來開放上傳後
// 會出現 'upload:<sha256>'，屆時 avatarFace() 需加一個分支即可。

export interface AvatarPreset {
  key: string;
  label: string;
  emoji?: string;
  image?: string;
}

const avatarBase = `${import.meta.env.BASE_URL}images/avatars/`;

// 新帳號只顯示圖片頭像；圖片保留原比例，由圓形容器以 cover 自動裁切。
export const PRESET_AVATARS: AvatarPreset[] = [
  { key: 'portrait01', image: `${avatarBase}portrait-01.webp`, label: '水墨人物 01' },
  { key: 'portrait02', image: `${avatarBase}portrait-02.webp`, label: '水墨人物 02' },
  { key: 'portrait03', image: `${avatarBase}portrait-03.webp`, label: '水墨人物 03' },
  { key: 'portrait04', image: `${avatarBase}portrait-04.webp`, label: '水墨人物 04' },
  { key: 'portrait05', image: `${avatarBase}portrait-05.webp`, label: '水墨人物 05' },
  { key: 'portrait06', image: `${avatarBase}portrait-06.webp`, label: '水墨人物 06' },
  { key: 'portrait07', image: `${avatarBase}portrait-07.webp`, label: '水墨人物 07' },
  { key: 'portrait08', image: `${avatarBase}portrait-08.webp`, label: '水墨人物 08' },
  { key: 'portrait09', image: `${avatarBase}portrait-09.webp`, label: '水墨人物 09' },
  { key: 'portrait10', image: `${avatarBase}portrait-10.webp`, label: '水墨人物 10' },
  { key: 'portrait11', image: `${avatarBase}portrait-11.webp`, label: '水墨人物 11' },
];

// 舊圖示不再出現在選單，但保留顯示相容性，避免既有會員頭像失效。
const LEGACY_PRESET_AVATARS: AvatarPreset[] = [
  { key: 'book', emoji: '📖', label: '書' },
  { key: 'quill', emoji: '🪶', label: '羽毛筆' },
  { key: 'moon', emoji: '🌙', label: '月' },
  { key: 'star', emoji: '⭐', label: '星' },
  { key: 'cat', emoji: '🐱', label: '貓' },
  { key: 'fox', emoji: '🦊', label: '狐狸' },
  { key: 'owl', emoji: '🦉', label: '貓頭鷹' },
  { key: 'tea', emoji: '🍵', label: '茶' },
  { key: 'leaf', emoji: '🍃', label: '葉' },
  { key: 'wave', emoji: '🌊', label: '浪' },
  { key: 'flame', emoji: '🔥', label: '火' },
  { key: 'cloud', emoji: '☁️', label: '雲' },
];

export const ALL_AVATARS = [...PRESET_AVATARS, ...LEGACY_PRESET_AVATARS];
export const TONES = ['#efe7db', '#e7ece4', '#eee3e3', '#e4e9ef', '#f0ebe0', '#e9e4ef'];

/** 依代號取得顯示內容；沒設定頭像時退回暱稱首字。 */
export function avatarFace(avatar: string, displayName: string) {
  const key = /^preset:(\w+)$/.exec(avatar || '')?.[1];
  const preset = ALL_AVATARS.find(a => a.key === key);
  if (preset) {
    const tone = TONES[ALL_AVATARS.indexOf(preset) % TONES.length];
    return { text: preset.emoji || '', image: preset.image || '', tone };
  }
  const first = [...(displayName || '讀')][0] || '讀';
  return { text: first, image: '', tone: TONES[first.charCodeAt(0) % TONES.length] };
}
