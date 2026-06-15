'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import FieldEditor, { EditableField } from './FieldEditor'

export interface EditableSection {
  id: string
  label: string
  display_order: number
  fields: EditableField[]
  isNew?: boolean
}

interface Props {
  section: EditableSection
  onChange: (updated: EditableSection) => void
  onDelete: () => void
}

function makeNewField(display_order: number): EditableField {
  return {
    id: crypto.randomUUID(),
    field_key: '',
    label: '',
    field_type: 'text_single',
    is_required: true,
    display_order,
    config: null,
    isNew: true,
  }
}

export default function SectionEditor({ section, onChange, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleFieldDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = section.fields.findIndex((f) => f.id === active.id)
    const newIndex = section.fields.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(section.fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      display_order: i * 10,
    }))
    onChange({ ...section, fields: reordered })
  }

  function updateField(index: number, updated: EditableField) {
    const fields = [...section.fields]
    fields[index] = updated
    onChange({ ...section, fields })
  }

  function deleteField(index: number) {
    onChange({ ...section, fields: section.fields.filter((_, i) => i !== index) })
  }

  function addField() {
    const display_order = (section.fields.length) * 10
    onChange({ ...section, fields: [...section.fields, makeNewField(display_order)] })
  }

  function handleDelete() {
    if (section.fields.length > 0 && !confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete()
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-zinc-200 rounded-xl bg-zinc-50">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing"
          aria-label="Drag section"
        >
          <GripVertical size={18} />
        </button>

        <input
          type="text"
          value={section.label}
          onChange={(e) => onChange({ ...section, label: e.target.value })}
          placeholder="Section name"
          className="flex-1 text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded px-1 py-0.5"
        />

        <div className="flex items-center gap-1">
          {confirmDelete && (
            <span className="text-xs text-red-500 mr-2">Delete section and all its fields?</span>
          )}
          {confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-zinc-500 hover:text-zinc-700 px-2 py-1 rounded"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className={`transition-colors ${confirmDelete ? 'text-red-600 hover:text-red-800' : 'text-zinc-400 hover:text-red-500'}`}
            aria-label="Delete section"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-4 space-y-2">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd} sensors={sensors}>
          <SortableContext
            items={section.fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {section.fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                onChange={(updated) => updateField(index, updated)}
                onDelete={() => deleteField(index)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {section.fields.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-4">No fields yet. Add one below.</p>
        )}

        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mt-1"
        >
          <Plus size={14} />
          Add Field
        </button>
      </div>
    </div>
  )
}
