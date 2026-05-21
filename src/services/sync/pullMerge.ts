import db from '../db/schema'
import { supabase } from '../supabase'
import { debugLog } from '../../utils/debug'
import { fromCloud, fromCloudLocalMap, toNumberOrUndefined } from './conversion'
import { deduplicateByName, verifySyncIntegrity } from './integrity'
import { fetchAllRowsForUser, getIsoTimestampMs } from './supabaseUtils'
import type { FromCloudMaps } from './types'

async function mergeByCloudId(
  tableName: string,
  cloudRows: Record<string, unknown>[],
): Promise<void> {
  if (cloudRows.length === 0) return
  const table = db.table<unknown, number>(tableName)
  const existing = (await table.toArray()) as Array<Record<string, unknown>>
  const localByCloudId = new Map(
    existing.filter((r) => r.cloudId).map((r) => [r.cloudId as string, r]),
  )
  for (const row of cloudRows) {
    const cid = row.cloudId as string | undefined
    if (cid && localByCloudId.has(cid)) {
      const local = localByCloudId.get(cid)
      if (!local) continue
      const cloudTime = new Date((row.updatedAt as string) || 0).getTime()
      const localTime = new Date((local.updatedAt as string) || 0).getTime()
      if (cloudTime > localTime) {
        await table.update(local.id as number, row)
      }
    } else {
      const rowName = (row.name as string)?.trim().toLowerCase()
      if (rowName && (tableName === 'categories' || tableName === 'payees')) {
        const existingByName = existing.find(
          (r) => r.name && String(r.name).trim().toLowerCase() === rowName,
        )
        if (existingByName) {
          await table.update(existingByName.id as number, row)
          continue
        }
      }
      await table.add(row)
    }
  }
}

async function resolveLocalCategoryId(
  cloudCategoryId: unknown,
  maps: FromCloudMaps,
): Promise<number | undefined> {
  if (cloudCategoryId != null) {
    const str = String(cloudCategoryId)
    const byCloud = maps.cloudIdToCategoryId?.get(str)
    if (byCloud !== undefined) return byCloud
    const numId = toNumberOrUndefined(cloudCategoryId)
    if (numId !== undefined) return numId
  }
  return undefined
}

async function resolveLocalPayeeId(
  cloudPayeeId: unknown,
  maps: FromCloudMaps,
): Promise<number | undefined> {
  if (cloudPayeeId != null) {
    const str = String(cloudPayeeId)
    const byCloud = maps.cloudIdToPayeeId?.get(str)
    if (byCloud !== undefined) return byCloud
    const numId = toNumberOrUndefined(cloudPayeeId)
    if (numId !== undefined) return numId
  }
  return undefined
}

export async function pullFromSupabase(userId: string): Promise<void> {
  if (!supabase || !userId) return

  const [
    expRows,
    catRows,
    payRows,
    fixRows,
    snapRows,
    incomeSnapRows,
    savingsSnapRows,
    scheduleRows,
    categoryMergeRows,
    payeeMergeRows,
    setRows,
  ] = await Promise.all([
    fetchAllRowsForUser('expenses', userId),
    fetchAllRowsForUser('categories', userId),
    fetchAllRowsForUser('payees', userId),
    fetchAllRowsForUser('fixed_expenses', userId),
    fetchAllRowsForUser('fixed_expense_snapshots', userId),
    fetchAllRowsForUser('income_snapshots', userId),
    fetchAllRowsForUser('savings_snapshots', userId),
    fetchAllRowsForUser('schedules', userId),
    fetchAllRowsForUser('category_merge_history', userId),
    fetchAllRowsForUser('payee_merge_history', userId),
    fetchAllRowsForUser('settings', userId),
  ])

  const existingCats = await db.categories.toArray()
  const existingPayees = await db.payees.toArray()
  const existingFixed = await db.fixedExpenses.toArray()
  const catMap: FromCloudMaps = { cloudIdToCategoryId: fromCloudLocalMap(existingCats) }
  const payeeMap: FromCloudMaps = { cloudIdToPayeeId: fromCloudLocalMap(existingPayees) }
  const fixedMap: FromCloudMaps = { cloudIdToFixedExpenseId: fromCloudLocalMap(existingFixed) }
  const combinedMaps: FromCloudMaps = { ...catMap, ...payeeMap, ...fixedMap }

  if (catRows.length) {
    const rows = catRows.map((r: unknown) =>
      fromCloud('categories', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('categories', rows)
  }
  if (payRows.length) {
    const rows = payRows.map((r: unknown) =>
      fromCloud('payees', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('payees', rows)
  }

  if (catRows.length || payRows.length) {
    const updatedCats = await db.categories.toArray()
    const updatedPays = await db.payees.toArray()
    updatedCats.forEach((c) => {
      if (c.cloudId && c.id) catMap.cloudIdToCategoryId?.set(c.cloudId, c.id)
    })
    updatedPays.forEach((p) => {
      if (p.cloudId && p.id) payeeMap.cloudIdToPayeeId?.set(p.cloudId, p.id)
    })
  }

  const expenseResolutionMaps: FromCloudMaps = {
    cloudIdToCategoryId: catMap.cloudIdToCategoryId,
    cloudIdToPayeeId: payeeMap.cloudIdToPayeeId,
  }
  debugLog(
    '[sync] resolution maps — cloudId->cat:',
    catMap.cloudIdToCategoryId?.size ?? 0,
    'cloudId->pay:',
    payeeMap.cloudIdToPayeeId?.size ?? 0,
  )

  if (expRows.length) {
    debugLog('[sync] resolving', expRows.length, 'cloud expenses')
    const unresolvedCats = new Set<string>()
    const unresolvedPayees = new Set<string>()
    let resolvedViaInitialMap = 0
    let resolvedViaFallback = 0
    const resolvedRows = await Promise.all(
      expRows.map(async (r: unknown) => {
        const raw = r as Record<string, unknown>
        const local = fromCloud('expenses', raw, { ...catMap, ...payeeMap })

        let categoryId = local.categoryId as number | undefined
        if (categoryId !== undefined) {
          resolvedViaInitialMap++
        } else {
          const resolved = await resolveLocalCategoryId(
            local.cloudCategoryId,
            expenseResolutionMaps,
          )
          if (resolved !== undefined) {
            categoryId = resolved
            resolvedViaFallback++
          } else {
            unresolvedCats.add(String(local.cloudCategoryId ?? 'unknown'))
          }
        }

        let payeeId = local.payeeId as number | undefined
        if (payeeId === undefined && local.cloudPayeeId != null) {
          const resolved = await resolveLocalPayeeId(local.cloudPayeeId, expenseResolutionMaps)
          if (resolved !== undefined) {
            payeeId = resolved
          } else {
            unresolvedPayees.add(String(local.cloudPayeeId ?? 'unknown'))
          }
        }
        return { ...local, categoryId, payeeId }
      }),
    )
    debugLog(
      '[sync] expense resolution: initial map match:',
      resolvedViaInitialMap,
      'fallback/auto-create:',
      resolvedViaFallback,
      'unresolved cats:',
      [...unresolvedCats],
      'unresolved payees:',
      [...unresolvedPayees],
    )
    await mergeByCloudId('expenses', resolvedRows)
  }

  if (fixRows.length) {
    const rows = fixRows.map((r: unknown) =>
      fromCloud('fixed_expenses', r as Record<string, unknown>, combinedMaps),
    )
    await mergeByCloudId('fixedExpenses', rows)
  }

  if (fixRows.length) {
    const updatedFixed = await db.fixedExpenses.toArray()
    updatedFixed.forEach((f) => {
      if (f.cloudId && f.id) fixedMap.cloudIdToFixedExpenseId?.set(f.cloudId, f.id)
    })
  }
  const finalMaps: FromCloudMaps = { ...catMap, ...payeeMap, ...fixedMap }

  if (snapRows.length) {
    await mergeByCloudId(
      'fixedExpenseSnapshots',
      snapRows.map((r: unknown) =>
        fromCloud('fixed_expense_snapshots', r as Record<string, unknown>, finalMaps),
      ),
    )
  }
  if (incomeSnapRows.length) {
    await mergeByCloudId(
      'incomeSnapshots',
      incomeSnapRows.map((r: unknown) =>
        fromCloud('income_snapshots', r as Record<string, unknown>, finalMaps),
      ),
    )
  }
  if (savingsSnapRows.length) {
    await mergeByCloudId(
      'savingsSnapshots',
      savingsSnapRows.map((r: unknown) =>
        fromCloud('savings_snapshots', r as Record<string, unknown>, finalMaps),
      ),
    )
  }
  if (scheduleRows.length) {
    await mergeByCloudId(
      'schedules',
      scheduleRows.map((r: unknown) =>
        fromCloud('schedules', r as Record<string, unknown>, finalMaps),
      ),
    )
  }
  if (categoryMergeRows.length) {
    await mergeByCloudId(
      'categoryMergeHistory',
      categoryMergeRows.map((r: unknown) =>
        fromCloud('category_merge_history', r as Record<string, unknown>, finalMaps),
      ),
    )
  }
  if (payeeMergeRows.length) {
    await mergeByCloudId(
      'payeeMergeHistory',
      payeeMergeRows.map((r: unknown) =>
        fromCloud('payee_merge_history', r as Record<string, unknown>, finalMaps),
      ),
    )
  }
  if (setRows.length) {
    const pendingSettingsKeys = new Set<string>()
    const pendingQueue =
      'syncQueue' in db && db.syncQueue
        ? await db.syncQueue.where('table').equals('settings').toArray()
        : []
    for (const item of pendingQueue) {
      if (item.operation === 'delete') continue
      const key = String((item.payload as Record<string, unknown>)?.key ?? '')
      if (key) pendingSettingsKeys.add(key)
    }

    for (const row of setRows) {
      const local = fromCloud('settings', row as Record<string, unknown>)
      const key = String(local.key)
      if (pendingSettingsKeys.has(key)) continue
      const existing = await db.settings.get(key)
      const localTime = getIsoTimestampMs(existing?.updatedAt)
      const cloudTime = getIsoTimestampMs(local.updatedAt)
      if (existing && localTime > cloudTime) continue
      await db.settings.put({
        key,
        value: local.value,
        updatedAt:
          typeof local.updatedAt === 'string' && local.updatedAt.length > 0
            ? local.updatedAt
            : new Date().toISOString(),
      })
    }
  }

  await deduplicateByName(db.table('categories'), 'categoryId')
  await deduplicateByName(db.table('payees'), 'payeeId')
  await verifySyncIntegrity()
}
