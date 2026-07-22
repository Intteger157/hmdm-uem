import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TimeInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/** HH:MM time field used for app/system update windows. */
export function TimeInput({ id, label, value, onChange, disabled = false }: TimeInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
