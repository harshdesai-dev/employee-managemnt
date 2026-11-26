import test from 'node:test';
import assert from 'node:assert/strict';
import { getDepartmentOptions, getFailedSelection } from '../src/dashboard.js';

test('department options include defaults, live departments, and the current selection without duplicates', () => {
  assert.deepEqual(
    getDepartmentOptions(['Engineering', 'Design'], [{ department: 'Finance', count: 2 }, { department: 'Design', count: 1 }], 'Legacy'),
    ['Engineering', 'Design', 'Finance', 'Legacy'],
  );
});

test('department options safely handle a missing breakdown', () => {
  assert.deepEqual(getDepartmentOptions(['Engineering'], null, ''), ['Engineering']);
});

test('bulk selection retains only records whose updates failed', () => {
  const targets = [{ id: 10 }, { id: 11 }, { id: 12 }];
  const results = [{ status: 'fulfilled' }, { status: 'rejected' }, { status: 'fulfilled' }];
  assert.deepEqual(getFailedSelection(targets, results), [11]);
});
