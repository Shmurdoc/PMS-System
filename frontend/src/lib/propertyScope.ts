import type { Property, User } from '../store/useAppStore';

/**
 * How a scoped employee picks a property.
 *
 * The product rule is one hotel at a time: an employee who covers several
 * hotels still works a single one at a time, so there is no combined "all my
 * properties" view. Admins keep the portfolio-wide overview.
 */

/** Properties the account is allowed to work in, primary first. */
export function assignedPropertyIds(user: User | null): string[] {
  if (!user) return [];
  if (user.propertyIds && user.propertyIds.length > 0) {
    const primary = user.propertyId;
    const rest = user.propertyIds.filter((id) => id !== primary);
    return primary ? [primary, ...rest] : [...user.propertyIds];
  }
  return user.propertyId ? [user.propertyId] : [];
}

/** The property a scoped employee starts on: their primary, never "all". */
export function initialPropertySelection(user: User | null, isAdmin: boolean): string {
  if (isAdmin) return 'all';
  const ids = assignedPropertyIds(user);
  return ids[0] ?? 'all';
}

export interface PropertyOption {
  value: string;
  label: string;
}

/**
 * Options for the header switcher. Admins get the portfolio plus a combined
 * view; an employee gets exactly their hotels and nothing combined.
 */
export function propertyOptions(
  user: User | null,
  properties: Property[],
  isAdmin: boolean,
): PropertyOption[] {
  if (isAdmin) {
    return [
      { value: 'all', label: `${properties.length} Properties` },
      ...properties.map((p) => ({ value: p.propertyId, label: p.name })),
    ];
  }

  const ids = assignedPropertyIds(user);
  const byId = new Map(properties.map((p) => [p.propertyId, p]));
  return ids.map((id) => ({
    value: id,
    label: byId.get(id)?.name ?? `Property ${id}`,
  }));
}
