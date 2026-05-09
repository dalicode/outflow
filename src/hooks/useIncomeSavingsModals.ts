import { useState } from 'react'
import { StorageService } from '../services/storageService'
import type { MonthlySummary } from '../types'

export function useIncomeSavingsModals(
  monthSummaries: MonthlySummary[],
  monthKeys: Array<{ year: number; month: number; name: string }>,
  onSaved: () => void,
) {
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false)
  const [modalTargetMonthIndex, setModalTargetMonthIndex] = useState(0)
  const [incomeError, setIncomeError] = useState('')
  const [savingsError, setSavingsError] = useState('')

  const openIncomeModal = (monthIndex: number = 0) => {
    setModalTargetMonthIndex(monthIndex)
    setIncomeError('')
    setIsIncomeModalOpen(true)
  }

  const closeIncomeModal = () => {
    setIsIncomeModalOpen(false)
    setIncomeError('')
  }

  const openSavingsModal = (monthIndex: number = 0) => {
    setModalTargetMonthIndex(monthIndex)
    setSavingsError('')
    setIsSavingsModalOpen(true)
  }

  const closeSavingsModal = () => {
    setIsSavingsModalOpen(false)
    setSavingsError('')
  }

  const handleIncomeSave = (data: { income: number; frequency: string; monthlyIncome: number }) => {
    const mk = monthKeys[modalTargetMonthIndex]
    const now = new Date()
    const isFuture =
      mk.year > now.getFullYear() || (mk.year === now.getFullYear() && mk.month > now.getMonth())
    if (isFuture) {
      setIncomeError('Future month values can only be changed via Schedule.')
      return false
    }
    setIncomeError('')
    persistIncomeChange(data, modalTargetMonthIndex)
    setIsIncomeModalOpen(false)
    return true
  }

  const handleSavingsSave = (rate: number) => {
    const mk = monthKeys[modalTargetMonthIndex]
    const now = new Date()
    const isFuture =
      mk.year > now.getFullYear() || (mk.year === now.getFullYear() && mk.month > now.getMonth())
    if (isFuture) {
      setSavingsError('Future month values can only be changed via Schedule.')
      return false
    }
    setSavingsError('')
    persistSavingsRateChange(rate, modalTargetMonthIndex)
    setIsSavingsModalOpen(false)
    return true
  }

  const persistIncomeChange = async (
    {
      income,
      frequency,
      monthlyIncome,
    }: {
      income: number
      frequency: string
      monthlyIncome: number
    },
    monthIndex: number = 0,
  ) => {
    const mk = monthKeys[monthIndex]
    const now = new Date()
    const isPast =
      mk.year < now.getFullYear() || (mk.year === now.getFullYear() && mk.month < now.getMonth())
    const isCurrent = mk.year === now.getFullYear() && mk.month === now.getMonth()

    if (isPast) {
      await StorageService.setIncomeSnapshot(mk.year, mk.month + 1, monthlyIncome)
    } else if (isCurrent) {
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await Promise.all([
        StorageService.setSetting('incomeAmount', income),
        StorageService.setSetting('incomeFrequency', frequency),
        StorageService.setSetting('monthlyIncome', monthlyIncome),
        StorageService.setSetting('monthlyIncomeUpdatedAt', yearMonth),
      ])
    }
    onSaved()
  }

  const persistSavingsRateChange = async (rate: number, monthIndex: number = 0) => {
    const mk = monthKeys[monthIndex]
    const now = new Date()
    const isPast =
      mk.year < now.getFullYear() || (mk.year === now.getFullYear() && mk.month < now.getMonth())
    const isCurrent = mk.year === now.getFullYear() && mk.month === now.getMonth()

    if (isPast) {
      await StorageService.setSavingsSnapshot(mk.year, mk.month + 1, rate)
    } else if (isCurrent) {
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await Promise.all([
        StorageService.setSetting('savingsRate', rate),
        StorageService.setSetting('savingsRateUpdatedAt', yearMonth),
      ])
    }
    onSaved()
  }

  const getInitialSavingsRate = () => {
    const summary = monthSummaries[modalTargetMonthIndex]
    return String(summary?.savingsRate ?? 0)
  }

  return {
    isIncomeModalOpen,
    isSavingsModalOpen,
    modalTargetMonthIndex,
    incomeError,
    savingsError,
    openIncomeModal,
    closeIncomeModal,
    openSavingsModal,
    closeSavingsModal,
    handleIncomeSave,
    handleSavingsSave,
    getInitialSavingsRate,
  }
}
