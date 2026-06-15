'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { FieldType } from '@/types'
import FieldTypeSelector from './FieldTypeSelector'

export interface EditableField {
  id: string
  field_key: string
  label: string
  field_type: FieldType
  is_required: boolean
  display_order: number
  config: Record<string, unknown> | null
  isNew?: boolean
}

interface Props {
  field: EditableField
  onChange: (updated: EditableField) => void
  onDelete: () => void
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/, '')
}

export default function FieldEditor({ field, onChange, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function handleLabelChange(label: string) {
    const updates: Partial<EditableField> = { label }
    if (field.isNew) updates.field_key = slugify(label)
    onChange({ ...field, ...updates })
  }

  function handleOptionsChange(raw: string) {
    const options = raw.split(',').map((o) => o.trim()).filter(Boolean)
    onChange({ ...field, config: { ...field.config, options } })
  }

  const options = (field.config?.options as string[] | undefined) ?? []

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-zinc-200 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing flex-shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
          {/* Label */}
          <input
            type="text"
            value={field.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Field label"
            className="text-sm border border-zinc-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />

          {/* Type */}
          <FieldTypeSelector
            value={field.field_type}
            onChange={(type) => onChange({ ...field, field_type: type })}
          />

          {/* Required toggle */}
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 whitespace-nowrap cursor-pointer select-none">
            <input
              type="checkbox"
              checked={field.is_required}
              onChange={(e) => onChange({ ...field, is_required: e.target.checked })}
              className="rounded border-zinc-300"
            />
            Required
          </label>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className="text-zinc-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Delete field"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Field key (small, below) */}
      <div className="ml-6 flex items-center gap-2">
        <span className="text-xs text-zinc-400">Key:</span>
        <input
          type="text"
          value={field.field_key}
          onChange={(e) => onChange({ ...field, field_key: e.target.value })}
          className="text-xs border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-500 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400 w-48"
        />
      </div>

      {/* Dropdown options (only for select type) */}
      {field.field_type === 'select' && (
        <div className="ml-6 space-y-1">
          <label className="text-xs text-zinc-500">Options (comma-separated)</label>
          <input
            type="text"
            value={options.join(', ')}
            onChange={(e) => handleOptionsChange(e.target.value)}
            placeholder="Option A, Option B, Option C"
            className="w-full text-sm border border-zinc-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
      )}
    </div>
  )
}
