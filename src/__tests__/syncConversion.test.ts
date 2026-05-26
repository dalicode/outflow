import { describe, expect, it } from 'vitest'
import { fromCloud, toCloud } from '../services/sync/conversion'

describe('sync conversion archivedAt removal', () => {
  it('does not include archived_at when converting categories/payees/fixedExpenses to cloud rows', () => {
    const categoryRow = toCloud('categories', { name: 'Food', isArchived: true }, 'user-1')
    const payeeRow = toCloud('payees', { name: 'Cafe', isArchived: true }, 'user-1')
    const fixedExpenseRow = toCloud(
      'fixedExpenses',
      { name: 'Rent', amount: 1200, isArchived: true },
      'user-1',
    )

    expect('archived_at' in categoryRow).toBe(false)
    expect('archived_at' in payeeRow).toBe(false)
    expect('archived_at' in fixedExpenseRow).toBe(false)
  })

  it('does not read archived_at into local category/payee/fixed expense records', () => {
    const category = fromCloud('categories', {
      id: '1',
      local_id: 'local-cat',
      name: 'Food',
      is_archived: true,
      archived_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    const payee = fromCloud('payees', {
      id: '2',
      local_id: 'local-payee',
      name: 'Cafe',
      is_archived: true,
      archived_at: '2026-01-02T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    })
    const fixedExpense = fromCloud('fixed_expenses', {
      id: '3',
      local_id: 'local-fixed',
      name: 'Rent',
      amount: 1200,
      is_archived: true,
      archived_at: '2026-01-03T00:00:00.000Z',
      updated_at: '2026-01-03T00:00:00.000Z',
    })

    expect('archivedAt' in category).toBe(false)
    expect('archivedAt' in payee).toBe(false)
    expect('archivedAt' in fixedExpense).toBe(false)
  })

  it('maps expense split relationship ids for cloud/local conversion', () => {
    const cloudExpense = toCloud(
      'expenses',
      {
        date: '2026-05-01',
        amount: 20,
        splitId: 50,
      },
      'user-1',
      {
        expenseSplitIdToCloudId: new Map([[50, 'cloud-split-50']]),
      },
    )
    expect(cloudExpense.split_id).toBe('cloud-split-50')

    const localExpense = fromCloud(
      'expenses',
      {
        id: 'cloud-exp-1',
        local_id: 'local-exp-1',
        date: '2026-05-01',
        amount: 20,
        split_id: 'cloud-split-50',
        updated_at: '2026-05-01T00:00:00.000Z',
      },
      {
        cloudIdToExpenseSplitId: new Map([['cloud-split-50', 77]]),
      },
    )

    expect(localExpense.splitId).toBe(77)
  })

  it('uses notes for expense/split/schedule cloud conversion and accepts legacy cloud fields', () => {
    const cloudExpense = toCloud(
      'expenses',
      {
        date: '2026-05-01',
        amount: 20,
        notes: 'Lunch',
      },
      'user-1',
    )
    const cloudSplit = toCloud(
      'expenseSplits',
      {
        date: '2026-05-01',
        amount: 20,
        notes: 'Split lunch',
      },
      'user-1',
    )
    const cloudSchedule = toCloud(
      'schedules',
      {
        type: 'expense',
        targetId: null,
        effectiveYear: 2026,
        effectiveMonth: 6,
        newValue: 50,
        isActive: 1,
        notes: 'Planned lunch',
      },
      'user-1',
    )

    expect(cloudExpense.notes).toBe('Lunch')
    expect(cloudSplit.notes).toBe('Split lunch')
    expect(cloudSchedule.notes).toBe('Planned lunch')
    expect('description' in cloudExpense).toBe(false)
    expect('description' in cloudSplit).toBe(false)
    expect('note' in cloudSplit).toBe(false)
    expect('note' in cloudSchedule).toBe(false)

    const localExpense = fromCloud('expenses', {
      id: 'exp-1',
      local_id: 'local-exp-1',
      date: '2026-05-01',
      amount: 20,
      description: 'Legacy expense notes',
      updated_at: '2026-05-01T00:00:00.000Z',
    })
    const localSplit = fromCloud('expense_splits', {
      id: 'split-1',
      local_id: 'local-split-1',
      date: '2026-05-01',
      amount: 20,
      description: 'Legacy split notes',
      note: 'Legacy note field',
      updated_at: '2026-05-01T00:00:00.000Z',
    })
    const localSchedule = fromCloud('schedules', {
      id: 'sch-1',
      local_id: 'local-sch-1',
      type: 'income',
      target_id: null,
      effective_year: 2026,
      effective_month: 6,
      new_value: 4000,
      is_active: 1,
      note: 'Legacy schedule note',
      updated_at: '2026-05-01T00:00:00.000Z',
    })

    expect(localExpense.notes).toBe('Legacy expense notes')
    expect(localSplit.notes).toBe('Legacy split notes')
    expect(localSchedule.notes).toBe('Legacy schedule note')
  })

  it('converts tags and expense tag joins between local and cloud shapes', () => {
    const cloudTag = toCloud(
      'tags',
      {
        name: 'Work',
        normalizedName: 'work',
        isArchived: true,
      },
      'user-1',
    )
    expect(cloudTag).toEqual(
      expect.objectContaining({
        name: 'Work',
        normalized_name: 'work',
        is_archived: true,
      }),
    )

    const localTag = fromCloud('tags', {
      id: 'tag-cloud-1',
      local_id: 'tag-local-1',
      name: 'Project X',
      updated_at: '2026-05-01T00:00:00.000Z',
    })
    expect(localTag).toEqual(
      expect.objectContaining({
        name: 'Project X',
        normalizedName: 'project x',
      }),
    )

    const cloudExpenseTag = toCloud(
      'expenseTags',
      {
        expenseId: 11,
        tagId: 22,
      },
      'user-1',
      {
        expenseIdToCloudId: new Map([[11, 'cloud-exp-11']]),
        tagIdToCloudId: new Map([[22, 'cloud-tag-22']]),
      },
    )
    expect(cloudExpenseTag).toEqual(
      expect.objectContaining({
        expense_id: 'cloud-exp-11',
        tag_id: 'cloud-tag-22',
      }),
    )

    const localExpenseTag = fromCloud(
      'expense_tags',
      {
        id: 'expense-tag-cloud-1',
        local_id: 'expense-tag-local-1',
        expense_id: 'cloud-exp-11',
        tag_id: 'cloud-tag-22',
        updated_at: '2026-05-01T00:00:00.000Z',
      },
      {
        cloudIdToExpenseId: new Map([['cloud-exp-11', 111]]),
        cloudIdToTagId: new Map([['cloud-tag-22', 222]]),
      },
    )
    expect(localExpenseTag).toEqual(
      expect.objectContaining({
        expenseId: 111,
        tagId: 222,
      }),
    )
  })

  it('converts tag merge history between local and cloud shapes', () => {
    const cloudTagMerge = toCloud(
      'tagMergeHistory',
      {
        sourceTagId: 10,
        targetTagId: 20,
        affectedExpenseTagIds: [31, 32],
        duplicateExpenseTagIds: [33],
        revertedAt: null,
      },
      'user-1',
      {
        tagIdToCloudId: new Map([
          [10, 'cloud-tag-10'],
          [20, 'cloud-tag-20'],
        ]),
      },
    )

    expect(cloudTagMerge).toEqual(
      expect.objectContaining({
        source_tag_id: 'cloud-tag-10',
        target_tag_id: 'cloud-tag-20',
        affected_expense_tag_ids: [31, 32],
        duplicate_expense_tag_ids: [33],
      }),
    )

    const localTagMerge = fromCloud(
      'tag_merge_history',
      {
        id: 'tag-merge-cloud-1',
        local_id: 'tag-merge-local-1',
        source_tag_id: 'cloud-tag-10',
        target_tag_id: 'cloud-tag-20',
        affected_expense_tag_ids: ['44', '45'],
        duplicate_expense_tag_ids: ['46'],
        reverted_at: null,
        updated_at: '2026-05-01T00:00:00.000Z',
      },
      {
        cloudIdToTagId: new Map([
          ['cloud-tag-10', 101],
          ['cloud-tag-20', 202],
        ]),
      },
    )

    expect(localTagMerge).toEqual(
      expect.objectContaining({
        sourceTagId: 101,
        targetTagId: 202,
        affectedExpenseTagIds: [44, 45],
        duplicateExpenseTagIds: [46],
      }),
    )
  })
})
