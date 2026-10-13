/** Category records can be stored as names or imported taxonomy objects. */
export function categoryNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const name = typeof item === 'string' ? item
      : item && typeof item === 'object' && 'name' in item ? item.name : '';
    return typeof name === 'string' && name.trim() ? [name.trim()] : [];
  });
}
