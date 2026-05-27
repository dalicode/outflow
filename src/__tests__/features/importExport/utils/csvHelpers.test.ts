import { describe, expect, it } from 'vitest'
import type { Expense } from '@/types'
import { CSV_HEADERS, expenseToRow, parseCSV } from '@/features/importExport/utils/csvHelpers'

const escapeCsvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`

const makeCsv = (rows: Array<Array<string | number>>, lineEnding = '\n'): string =>
  [CSV_HEADERS, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join(lineEnding)

describe('parseCSV', () => {
  it('parses quoted commas in payee and notes', () => {
    const csv = [
      '"Date","Category","Payee","Notes","Amount","Month","Year"',
      '"2026-01-05","Food","Trader, Joe\'s","Lunch, team","12.34","1","2026"',
    ].join('\n')

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].payee).toBe("Trader, Joe's")
    expect(rows[0].notes).toBe('Lunch, team')
  })

  it('parses escaped quotes inside quoted values', () => {
    const csv = [
      '"Date","Category","Payee","Notes","Amount","Month","Year"',
      '"2026-02-07","Shopping","Bob ""Outlet""","He said ""hi""","45.5","2","2026"',
    ].join('\n')

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].payee).toBe('Bob "Outlet"')
    expect(rows[0].notes).toBe('He said "hi"')
  })

  it('keeps empty trailing cells', () => {
    const csv = [
      'Date,Category,Payee,Notes,Amount,Month,Year',
      '2026-03-10,Utilities,Hydro,,99.5,,',
    ].join('\n')

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].month).toBe('')
    expect(rows[0].year).toBe('')
    expect(rows[0].notes).toBe('')
  })

  it('supports CRLF line endings', () => {
    const csv = [
      '"Date","Category","Payee","Notes","Amount","Month","Year"',
      '"2026-04-01","Rent","Landlord","April rent","1200","4","2026"',
    ].join('\r\n')

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].date).toBe('2026-04-01')
    expect(rows[0].notes).toBe('April rent')
  })

  it('round trips an outflow export-style row from expenseToRow', () => {
    const expense: Expense = {
      date: '2026-05-11',
      amount: 23.5,
      categoryId: 1,
      payeeId: 2,
      notes: 'Coffee with "Sam", downtown',
    }

    const row = expenseToRow(
      expense,
      { 1: 'Food & Drink' },
      { 2: 'Cafe "North", Inc.' },
      (iso) => iso,
    )
    const csv = makeCsv([row])

    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].date).toBe('2026-05-11')
    expect(rows[0].category).toBe('Food & Drink')
    expect(rows[0].payee).toBe('Cafe "North", Inc.')
    expect(rows[0].notes).toBe('Coffee with "Sam", downtown')
    expect(rows[0].amount).toBe('23.5')
    expect(rows[0].month).toBe('5')
    expect(rows[0].year).toBe('2026')
  })

  it('exports split child allocations as regular flat rows', () => {
    const splitChild: Expense = {
      date: '2026-05-12',
      amount: 8.25,
      splitId: 42,
      categoryId: 3,
      payeeId: 7,
      notes: 'Split child allocation',
    }

    const row = expenseToRow(splitChild, { 3: 'Transport' }, { 7: 'Metro' }, (iso) => iso)

    expect(row).toEqual([
      '2026-05-12',
      'Transport',
      'Metro',
      'Split child allocation',
      8.25,
      5,
      '2026',
    ])
  })
})
