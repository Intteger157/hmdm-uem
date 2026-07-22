import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

interface FormSelectOption {
  value: string | number
  label: string
}

interface FormSelectProps {
  id: string
  label: string
  value: string | number
  options: FormSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  hint?: string
  className?: string
}

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

export function FormSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
  className,
}: FormSelectProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={selectClassName}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
