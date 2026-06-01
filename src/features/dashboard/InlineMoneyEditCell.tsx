import { useCallback, useRef, useState } from 'react'
import MoneyInput from '../../components/inputs/MoneyInput'
import { useSettings } from '../../context/settingsContext'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'

interface InlineMoneyEditCellProps {
  initialValue: number
  onCommit: (value: number) => void | Promise<void>
  onCancel: () => void
  onEnter?: (shiftKey: boolean) => void
  onTab?: (shiftKey: boolean) => void
}

export default function InlineMoneyEditCell({
  initialValue,
  onCommit,
  onCancel,
  onEnter,
  onTab,
}: InlineMoneyEditCellProps) {
  const { settings } = useSettings()
  const { currency, locale } = resolveMoneyLocaleConfig(settings.currencySymbol)
  const [draftValue, setDraftValue] = useState(initialValue)
  const skipNextBlurCommitRef = useRef(false)

  const commitValue = useCallback(
    async (value: number) => {
      await onCommit(value)
    },
    [onCommit],
  )

  const handleBlurCommit = useCallback(
    (value: number) => {
      if (skipNextBlurCommitRef.current) {
        skipNextBlurCommitRef.current = false
        return
      }
      void commitValue(value)
    },
    [commitValue],
  )

  const handleEnterCommit = useCallback(
    (value: number, shiftKey: boolean) => {
      skipNextBlurCommitRef.current = true
      void (async () => {
        await commitValue(value)
        onEnter?.(shiftKey)
      })()
    },
    [commitValue, onEnter],
  )

  const handleTabCommit = useCallback(
    (value: number, shiftKey: boolean) => {
      skipNextBlurCommitRef.current = true
      void (async () => {
        await commitValue(value)
        onTab?.(shiftKey)
      })()
    },
    [commitValue, onTab],
  )

  return (
    <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
      <MoneyInput
        value={draftValue}
        onChange={setDraftValue}
        currency={currency}
        locale={locale}
        allowNegative
        entryMode="decimal"
        autoFocus
        variant="inline"
        className="w-full"
        inputClassName="text-right"
        onBlurValue={handleBlurCommit}
        onEnterValue={handleEnterCommit}
        onTabValue={handleTabCommit}
        onEscape={onCancel}
      />
    </div>
  )
}
