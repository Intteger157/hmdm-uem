import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

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
      <NativeSelect
        id={id}
        className="h-9 px-3 shadow-xs"
        value={String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
