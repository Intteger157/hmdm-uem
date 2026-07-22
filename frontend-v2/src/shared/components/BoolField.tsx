interface BoolFieldProps {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  hint?: string
}

export function BoolField({
  id,
  label,
  checked,
  onCheckedChange,
  disabled = false,
  hint,
}: BoolFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className={`flex items-center gap-2 text-sm ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        {label}
      </label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
