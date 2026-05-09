import type { Category, Schedule } from '../../types'
import { cn } from '../../utils/cn'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface ScheduleListProps {
  schedules: Schedule[]
  categories: Category[]
  onEdit: (schedule: Schedule) => void
  onDelete: (id: number) => void
}

export default function ScheduleList({
  schedules,
  categories,
  onEdit,
  onDelete,
}: ScheduleListProps) {
  if (schedules.length === 0) {
    return <p className="text-xs text-theme-muted italic mb-2">No scheduled changes yet.</p>
  }

  const upcoming = schedules
    .filter((s) => s.isActive)
    .sort((a, b) => a.effectiveYear - b.effectiveYear || a.effectiveMonth - b.effectiveMonth)

  const past = schedules
    .filter((s) => !s.isActive)
    .sort((a, b) => b.effectiveYear - a.effectiveYear || b.effectiveMonth - a.effectiveMonth)

  return (
    <div className="space-y-1.5 mb-2 max-h-48 overflow-y-auto scrollbar-themed">
      {upcoming.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wide">
            Upcoming
          </p>
          {upcoming.map((s) => (
            <ScheduleItem
              key={s.id}
              schedule={s}
              categories={categories}
              isArchived={false}
              onEdit={() => onEdit(s)}
              onDelete={() => onDelete(s.id as number)}
            />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-1 mt-2">
          <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wide">
            Archived
          </p>
          {past.map((s) => (
            <ScheduleItem
              key={s.id}
              schedule={s}
              categories={categories}
              isArchived={true}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleItem({
  schedule,
  categories,
  isArchived,
  onEdit,
  onDelete,
}: {
  schedule: Schedule
  categories: Category[]
  isArchived: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const typeLabel =
    schedule.type === 'income'
      ? 'Income'
      : schedule.type === 'savingsRate'
        ? 'Savings %'
        : schedule.type === 'expense'
          ? 'Expense'
          : 'Fixed Exp.'

  const valueLabel =
    schedule.type === 'savingsRate' ? `${schedule.newValue}%` : `$${schedule.newValue}`

  const dateLabel =
    schedule.type === 'expense' && schedule.day
      ? `${MONTHS[schedule.effectiveMonth - 1]} ${schedule.day}, ${schedule.effectiveYear}`
      : `${MONTHS[schedule.effectiveMonth - 1]} ${schedule.effectiveYear}`

  return (
    <div
      className={cn('schedule-row', isArchived ? 'schedule-row-archived' : 'schedule-row-upcoming')}
    >
      <div>
        <span className="font-medium text-theme-text">{typeLabel}</span>
        <span className="text-theme-muted mx-1">&rarr;</span>
        <span className="text-theme-primary font-semibold">{valueLabel}</span>
        <span className="text-theme-muted ml-2">{dateLabel}</span>
        {schedule.categoryId && (
          <span className="text-theme-muted ml-1">
            ({categories.find((c) => c.id === schedule.categoryId)?.name ?? 'Unknown'})
          </span>
        )}
        {schedule.note && <span className="text-theme-muted ml-1">({schedule.note})</span>}
        {isArchived && <span className="text-theme-success ml-1.5 text-[10px]">&#10003;</span>}
      </div>
      {!isArchived && (
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="settings-edit-btn">
            Edit
          </button>
          <button onClick={onDelete} className="settings-del-btn">
            Del
          </button>
        </div>
      )}
    </div>
  )
}
