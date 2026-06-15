'use client'

import { FieldType } from '@/types'

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text_single: 'Short Text',
  text_multi:  'Long Text',
  date:        'Date',
  number:      'Number',
  boolean:     'Yes / No',
  select:      'Dropdown',
  file:        'File Upload',
  signature:   'Signature',
}

interface Props {
  value: FieldType
  onChange: (value: FieldType) => void
  disabled?: boolean
}

export default function FieldTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FieldType)}
      disabled={disabled}
      className="text-sm border border-zinc-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([type, label]) => (
        <option key={type} value={type}>{label}</option>
      ))}
    </select>
  )
}
