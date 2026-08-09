import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DeviceSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  isSearching?: boolean
  className?: string
}

export function DeviceSearchInput({
  value,
  onChange,
  placeholder,
  isSearching = false,
  className,
}: DeviceSearchInputProps) {
  return (
    <div className={cn('relative min-w-0 flex-1 max-w-xl', className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="border-border/80 bg-card pl-9 pr-9 dark:border-[#242424] dark:bg-[#111111]"
        aria-busy={isSearching}
      />
      {isSearching ? (
        <Loader2
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}
