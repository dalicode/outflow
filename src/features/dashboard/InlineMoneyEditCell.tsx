import { useState } from 'react'
import MoneyInput from '../../components/inputs/MoneyInput'
import { useSettings } from '../../context/settingsContext'
import { resolveMoneyLocaleConfig } from '../../utils/moneyInput'

interface InlineMoneyEditCellProps {
  initialValue: number
  onCommit: (value: number) => void
  onCancel: () => void
  onTab?: (shiftKey: boolean) => void
}

export default function InlineMoneyEditCell({
  initialValue,
  onCommit,
  onCancel,
  onTab,
}: InlineMoneyEditCellProps) {
  const { settings } = useSettings()
  const { currency, locale } = resolveMoneyLocaleConfig(settings.currencySymbol)
  const [draftValue, setDraftValue] = useState(initialValue)

  return (
    <div data-no-cell-switch onPointerDown={(e) => e.stopPropagation()}>
      <MoneyInput
        value={draftValue}
        onChange={setDraftValue}
        currency={currency}
        locale={locale}
        allowNegative
        autoFocus
        variant="inline"
        className="w-full"
        inputClassName="text-right"
        onBlurValue={onCommit}
        onEnterValue={(value) => {
          onCommit(value)
        }}
        onTabValue={(value, shiftKey) => {
          onCommit(value)
          onTab?.(shiftKey)
        }}
        onEscape={onCancel}
      />
    </div>
  )
}
