import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import ModalFooter from './ModalFooter'

type ModalActionTone = 'cancel' | 'modalCancel' | 'primary' | 'destructive'

interface ModalAction {
  key: string
  label: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  form?: string
  disabled?: boolean
  tone?: ModalActionTone
  className?: string
  dataTestId?: string
  stopPointerDownPropagation?: boolean
}

interface ModalActionRowProps {
  actions: ModalAction[]
  className?: string
}

const toneClassMap: Record<ModalActionTone, string> = {
  cancel: 'btn-cancel-sm',
  modalCancel: 'btn-modal-cancel',
  primary: 'btn-modal-primary',
  destructive: 'btn-modal-destructive',
}

export default function ModalActionRow({ actions, className }: ModalActionRowProps) {
  return (
    <ModalFooter className={className}>
      {actions.map((action) => {
        const pointerDownHandler = action.stopPointerDownPropagation
          ? (event: React.PointerEvent<HTMLButtonElement>) => {
              event.stopPropagation()
            }
          : undefined

        return (
          <button
            key={action.key}
            type={action.type ?? 'button'}
            form={action.form}
            onClick={action.onClick}
            disabled={action.disabled}
            onPointerDown={pointerDownHandler}
            data-testid={action.dataTestId}
            className={cn('flex-1', toneClassMap[action.tone ?? 'primary'], action.className)}
          >
            {action.label}
          </button>
        )
      })}
    </ModalFooter>
  )
}
