import DesktopDropdown from '../../../components/inputs/DesktopDropdown'
import MobileEntityPicker from '../../../components/inputs/MobileEntityPicker'
import SingleSelectTrigger from '../../../components/inputs/SingleSelectTrigger'
import type { ComboboxOption } from '../../../components/inputs/comboboxUtils'

interface ExpenseEntityFieldsProps {
  payeeId: string
  categoryId: string
  disabled?: boolean
  showCategoryField?: boolean
  payeeOptions: ComboboxOption[]
  categoryOptions: ComboboxOption[]
  recentPayeeOptions: ComboboxOption[]
  recentCategoryOptions: ComboboxOption[]
  selectedPayeeName?: string
  selectedCategoryName?: string
  showPayeePicker: boolean
  showCategoryPicker: boolean
  onShowPayeePickerChange: (open: boolean) => void
  onShowCategoryPickerChange: (open: boolean) => void
  onPayeeChange: (id: string | number | undefined) => void
  onCategoryChange: (id: string | number | undefined) => void
  onCreatePayee: (name: string) => Promise<string | number>
  onCreateCategory: (name: string) => Promise<string | number>
  desktopPayeeTestId?: string
  desktopCategoryTestId?: string
  mobilePayeeTestId?: string
  mobileCategoryTestId?: string
  onManagePayees?: () => void
  onManageCategories?: () => void
}

export default function ExpenseEntityFields({
  payeeId,
  categoryId,
  disabled = false,
  showCategoryField = true,
  payeeOptions,
  categoryOptions,
  recentPayeeOptions,
  recentCategoryOptions,
  selectedPayeeName,
  selectedCategoryName,
  showPayeePicker,
  showCategoryPicker,
  onShowPayeePickerChange,
  onShowCategoryPickerChange,
  onPayeeChange,
  onCategoryChange,
  onCreatePayee,
  onCreateCategory,
  desktopPayeeTestId,
  desktopCategoryTestId,
  mobilePayeeTestId,
  mobileCategoryTestId,
  onManagePayees,
  onManageCategories,
}: ExpenseEntityFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm text-theme-muted">Payee</label>
          {onManagePayees && (
            <button
              type="button"
              onClick={onManagePayees}
              className="text-xs font-medium text-theme-primary hover:opacity-80"
            >
              + Manage
            </button>
          )}
        </div>
        <div className="hidden sm:block">
          <div data-testid={desktopPayeeTestId}>
            <DesktopDropdown
              value={payeeId ? Number(payeeId) : undefined}
              options={payeeOptions}
              recentOptions={recentPayeeOptions}
              placeholder="Select payee"
              emptyMessage="No payees found."
              createHint="Type a new payee name to add it."
              allowCreate
              allowClear
              clearLabel="No payee"
              disabled={disabled}
              onChange={onPayeeChange}
              onCreate={onCreatePayee}
            />
          </div>
        </div>
        <div className="block sm:hidden">
          <div data-testid={mobilePayeeTestId}>
            <SingleSelectTrigger
              value={selectedPayeeName}
              placeholder="Select payee"
              isOpen={showPayeePicker}
              disabled={disabled}
              onClick={() => !disabled && onShowPayeePickerChange(true)}
            />
            <MobileEntityPicker
              open={showPayeePicker}
              title="Choose Payee"
              value={payeeId ? Number(payeeId) : undefined}
              options={payeeOptions}
              recentOptions={recentPayeeOptions}
              placeholder="Search or add payee"
              emptyMessage="No payees found."
              createHint="Type a new payee name to add it."
              allowCreate
              allowClear
              clearLabel="No payee"
              onChange={onPayeeChange}
              onCreate={onCreatePayee}
              onClose={() => onShowPayeePickerChange(false)}
            />
          </div>
        </div>
      </div>

      {showCategoryField && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm text-theme-muted">Category</label>
            {onManageCategories && (
              <button
                type="button"
                onClick={onManageCategories}
                className="text-xs font-medium text-theme-primary hover:opacity-80"
              >
                + Manage
              </button>
            )}
          </div>
          <div className="hidden sm:block">
            <div data-testid={desktopCategoryTestId}>
              <DesktopDropdown
                value={categoryId ? Number(categoryId) : undefined}
                options={categoryOptions}
                recentOptions={recentCategoryOptions}
                placeholder="Select category"
                emptyMessage="No categories found."
                createHint="Type a new category name to add it."
                allowCreate
                disabled={disabled}
                onChange={onCategoryChange}
                onCreate={onCreateCategory}
              />
            </div>
          </div>
          <div className="block sm:hidden">
            <div data-testid={mobileCategoryTestId}>
              <SingleSelectTrigger
                value={selectedCategoryName}
                placeholder="Select category"
                isOpen={showCategoryPicker}
                disabled={disabled}
                onClick={() => !disabled && onShowCategoryPickerChange(true)}
              />
              <MobileEntityPicker
                open={showCategoryPicker}
                title="Choose Category"
                value={categoryId ? Number(categoryId) : undefined}
                options={categoryOptions}
                recentOptions={recentCategoryOptions}
                placeholder="Search or add category"
                emptyMessage="No categories found."
                createHint="Type a new category name to add it."
                allowCreate
                onChange={onCategoryChange}
                onCreate={onCreateCategory}
                onClose={() => onShowCategoryPickerChange(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
