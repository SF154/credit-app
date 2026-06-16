interface FieldWrapperProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export default function FieldWrapper({ label, required, error, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
