import { describe, expect, it } from 'vitest';
import {
  assignedPropertyIds,
  initialPropertySelection,
  propertyOptions,
} from '../../src/lib/propertyScope';
import type { Property, User } from '../../src/store/useAppStore';

function employee(overrides: Partial<User> = {}): User {
  return {
    id: '2',
    name: 'Front Desk',
    email: 'front@nexus.com',
    role: 'front_desk',
    department: 'Front Desk',
    phone: '',
    hireDate: '2026-01-01',
    status: 'active',
    propertyId: '104',
    propertyIds: ['104', '107', '109'],
    ...overrides,
  } as User;
}

function properties(count: number, from = 101): Property[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    propertyId: String(from + i),
    name: `QA Hotel ${from + i}`,
    address: '',
    totalRooms: 0,
    occupiedRooms: 0,
    rating: 0,
    image: '',
    status: 'operational',
  })) as Property[];
}

describe('assignedPropertyIds', () => {
  it('returns the primary first, then the rest', () => {
    expect(assignedPropertyIds(employee())).toEqual(['104', '107', '109']);
  });

  it('falls back to the primary when an older session has no set', () => {
    expect(assignedPropertyIds(employee({ propertyIds: undefined }))).toEqual(['104']);
  });

  it('is empty for a signed-out or unscoped user', () => {
    expect(assignedPropertyIds(null)).toEqual([]);
    expect(assignedPropertyIds(employee({ propertyId: null, propertyIds: [] }))).toEqual([]);
  });
});

describe('initialPropertySelection', () => {
  it('opens a multi-hotel employee on a single hotel, never "all"', () => {
    expect(initialPropertySelection(employee(), false)).toBe('104');
  });

  it('keeps the portfolio overview for admins', () => {
    expect(initialPropertySelection(employee({ role: 'admin' }), true)).toBe('all');
  });

  it('degrades to "all" only when there is no assignment at all', () => {
    expect(initialPropertySelection(employee({ propertyId: null, propertyIds: [] }), false)).toBe('all');
  });
});

describe('propertyOptions', () => {
  it('lists only the three assigned hotels for an employee, with no combined entry', () => {
    const options = propertyOptions(employee(), properties(11), false);

    expect(options.map((o) => o.value)).toEqual(['104', '107', '109']);
    expect(options.some((o) => o.value === 'all')).toBe(false);
    expect(options.map((o) => o.label)).toEqual(['QA Hotel 104', 'QA Hotel 107', 'QA Hotel 109']);
  });

  it('gives an admin every hotel plus the combined view', () => {
    const options = propertyOptions(employee({ role: 'admin' }), properties(11), true);

    expect(options[0]).toEqual({ value: 'all', label: '11 Properties' });
    expect(options).toHaveLength(12);
  });

  it('never leaks a hotel outside the assignment', () => {
    const all = properties(11);
    const options = propertyOptions(employee(), all, false);
    const allowed = new Set(['104', '107', '109']);

    expect(options.every((o) => allowed.has(o.value))).toBe(true);
    expect(options).toHaveLength(3);
  });
});
