export interface TagEntry {
  key: string;
  label: string;
}

export interface TagStat extends TagEntry {
  count: number;
}

export interface TagSource {
  tags: readonly unknown[];
  tagSlugs?: readonly unknown[];
}

export function normalizeTag(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function tagKey(value: unknown): string {
  return normalizeTag(value).toLocaleLowerCase('zh-TW');
}

export function normalizeTags(values: readonly unknown[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const label = normalizeTag(value);
    const key = tagKey(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }

  return result;
}

export function tagEntries(source: TagSource): TagEntry[] {
  const seen = new Set<string>();
  const result: TagEntry[] = [];
  const slugs = Array.isArray(source.tagSlugs) ? source.tagSlugs : [];

  source.tags.forEach((value, index) => {
    const label = normalizeTag(value);
    const key = tagKey(slugs[index] || label);
    if (!label || !key || seen.has(key)) return;
    seen.add(key);
    result.push({ key, label });
  });

  return result;
}

export function collectTagStats(sources: Iterable<TagSource>): TagStat[] {
  const stats = new Map<string, TagStat>();

  for (const source of sources) {
    for (const tag of tagEntries(source)) {
      const current = stats.get(tag.key);
      if (current) current.count += 1;
      else stats.set(tag.key, { ...tag, count: 1 });
    }
  }

  return [...stats.values()].sort((a, b) =>
    b.count - a.count || a.label.localeCompare(b.label, 'zh-TW'));
}

export function tagHref(base: string, value: unknown): string {
  const prefix = base.endsWith('/') ? base : base + '/';
  return prefix + 'tags/' + encodeURIComponent(tagKey(value)) + '/';
}
