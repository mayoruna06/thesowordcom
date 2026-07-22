export interface TagStat {
  key: string;
  label: string;
  count: number;
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

export function collectTagStats(tagGroups: Iterable<readonly unknown[]>): TagStat[] {
  const stats = new Map<string, TagStat>();

  for (const tags of tagGroups) {
    for (const label of normalizeTags(tags)) {
      const key = tagKey(label);
      const current = stats.get(key);
      if (current) current.count += 1;
      else stats.set(key, { key, label, count: 1 });
    }
  }

  return [...stats.values()].sort((a, b) =>
    b.count - a.count || a.label.localeCompare(b.label, 'zh-TW'));
}

export function tagHref(base: string, value: unknown): string {
  const prefix = base.endsWith('/') ? base : base + '/';
  return prefix + 'tags/' + encodeURIComponent(tagKey(value)) + '/';
}