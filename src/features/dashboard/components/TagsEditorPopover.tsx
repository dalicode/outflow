import { createPortal } from 'react-dom'
import type { Ref } from 'react'
import TagMultiSelect from '../../../components/inputs/TagMultiSelect'
import type { FloatingPosition } from '../../../utils/floatingPosition'
import type { Tag } from '../../../types'

interface TagsEditorPopoverProps {
  isMobile: boolean
  activeTagsEditor: { draftTagIds: number[] } | null
  tagsEditorPosition: FloatingPosition | null
  tagsEditorRef: Ref<HTMLDivElement>
  activeTags: Tag[]
  isSavingTagsEditor: boolean
  onChange: (tagIds: number[]) => void
  onCreate: (name: string) => Promise<number>
  onCancel: () => void
  onSave: () => void | Promise<void>
  onEnter: (shiftKey: boolean) => void | Promise<void>
  onTab: (shiftKey: boolean) => void | Promise<void>
}

export default function TagsEditorPopover({
  isMobile,
  activeTagsEditor,
  tagsEditorPosition,
  tagsEditorRef,
  activeTags,
  isSavingTagsEditor,
  onChange,
  onCreate,
  onCancel,
  onSave,
  onEnter,
  onTab,
}: TagsEditorPopoverProps) {
  if (isMobile || !activeTagsEditor || !tagsEditorPosition) return null

  return createPortal(
    <div
      ref={tagsEditorRef}
      role="dialog"
      aria-label="Edit tags"
      data-testid="tags-editor-popover"
      data-placement={tagsEditorPosition.placement}
      className="rounded-theme-large border border-theme-border bg-theme-surface p-3 shadow-lg"
      style={{
        position: 'fixed',
        zIndex: 60,
        left: tagsEditorPosition.left,
        width: tagsEditorPosition.width,
        maxHeight: tagsEditorPosition.maxHeight,
        top: tagsEditorPosition.top,
        bottom: tagsEditorPosition.bottom,
      }}
    >
      <div className="space-y-2">
        <TagMultiSelect
          tags={activeTags}
          selectedTagIds={activeTagsEditor.draftTagIds}
          onChange={onChange}
          onCreate={onCreate}
          variant="inline"
          placeholder="Search or create tags"
          controlClassName="rounded-theme-medium border border-theme-border bg-theme-background px-2 py-1.5"
          autoFocus
          onCancel={onCancel}
          onEnter={onEnter}
          onTab={onTab}
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn-cancel-sm px-3 py-1.5 text-xs"
            onClick={onCancel}
            data-testid="tags-editor-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary-sm flex-1 px-3 py-1.5 text-xs"
            onClick={() => void onSave()}
            disabled={isSavingTagsEditor}
            data-testid="tags-editor-save"
          >
            {isSavingTagsEditor ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
