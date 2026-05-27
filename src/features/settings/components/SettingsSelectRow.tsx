import DesktopDropdown from '../../../components/inputs/DesktopDropdown'
import type { ComboboxOption } from '../../../components/inputs'

export const FONT_OPTIONS: ComboboxOption[] = [
  { id: 'system', label: 'System UI' },
  { id: 'sans', label: 'Sans-serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
  { id: 'roboto', label: 'Roboto' },
  { id: 'georgia', label: 'Georgia' },
  { id: 'financeMono', label: 'Data Mono' },
]

export const FONT_SIZE_OPTIONS: ComboboxOption[] = [
  { id: '0.85', label: 'Small' },
  { id: '1', label: 'Medium' },
  { id: '1.15', label: 'Large' },
  { id: '1.3', label: 'X-Large' },
]

export const CURRENCY_OPTIONS: ComboboxOption[] = [
  { id: '$', label: '$ Dollar' },
  { id: '€', label: '€ Euro' },
  { id: '£', label: '£ Pound' },
  { id: '¥', label: '¥ Yen' },
  { id: '₹', label: '₹ Rupee' },
]

export const DECIMAL_OPTIONS: ComboboxOption[] = [
  { id: '0', label: '0' },
  { id: '1', label: '1' },
  { id: '2', label: '2' },
]

export const THOUSAND_SEPARATOR_OPTIONS: ComboboxOption[] = [
  { id: ',', label: '1,000' },
  { id: '.', label: '1.000' },
  { id: ' ', label: '1 000' },
]

export const DATE_FORMAT_OPTIONS: ComboboxOption[] = [
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]

interface SettingsSelectRowProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
}

export default function SettingsSelectRow({
  label,
  value,
  onChange,
  options,
}: SettingsSelectRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-theme-muted">{label}</span>
      <div className="shrink-0">
        <DesktopDropdown
          value={value}
          options={options}
          onChange={(nextValue) => {
            if (typeof nextValue === 'string') {
              onChange(nextValue)
            }
          }}
          placeholder={label}
          emptyMessage={`No ${label.toLowerCase()} options available.`}
          ariaLabel={label}
          preserveOrder
          searchable={false}
          triggerSize="sm"
          triggerClassName="w-auto min-w-[8rem]"
        />
      </div>
    </div>
  )
}
