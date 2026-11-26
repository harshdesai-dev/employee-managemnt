export function getDepartmentOptions(defaults, breakdown = [], selected = '') {
  const discovered = Array.isArray(breakdown)
    ? breakdown.map((item) => item?.department).filter((department) => typeof department === 'string' && department.length > 0)
    : [];
  return [...new Set([...defaults, ...discovered, ...(selected ? [selected] : [])])];
}

export function getFailedSelection(targets, results) {
  return targets.filter((target, index) => results[index]?.status !== 'fulfilled').map((target) => target.id);
}
