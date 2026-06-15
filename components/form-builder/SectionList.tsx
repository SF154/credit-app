'use client'

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
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import SectionEditor, { EditableSection } from './SectionEditor'

interface Props {
  sections: EditableSection[]
  onChange: (sections: EditableSection[]) => void
}

function makeNewSection(display_order: number): EditableSection {
  return {
    id: crypto.randomUUID(),
    label: '',
    display_order,
    fields: [],
    isNew: true,
  }
}

export default function SectionList({ sections, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({
      ...s,
      display_order: i * 10,
    }))
    onChange(reordered)
  }

  function updateSection(index: number, updated: EditableSection) {
    const next = [...sections]
    next[index] = updated
    onChange(next)
  }

  function deleteSection(index: number) {
    onChange(sections.filter((_, i) => i !== index))
  }

  function addSection() {
    onChange([...sections, makeNewSection(sections.length * 10)])
  }

  return (
    <div className="space-y-4">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd} sensors={sensors}>
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section, index) => (
            <SectionEditor
              key={section.id}
              section={section}
              onChange={(updated) => updateSection(index, updated)}
              onDelete={() => deleteSection(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addSection}
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-600 border border-dashed border-zinc-300 rounded-xl w-full hover:border-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <Plus size={16} />
        Add Section
      </button>
    </div>
  )
}
