'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type ProductPriority = 'P0' | 'P1' | 'P2' | 'P3'

const PRIORITY_CONFIG: Record<ProductPriority, { label: string; className: string; description: string }> = {
  P0: {
    label: 'P0',
    className: 'bg-orange-500 text-white',
    description: '最高優先，本週必推進',
  },
  P1: {
    label: 'P1',
    className: 'bg-blue-500 text-white',
    description: '重要，本月目標',
  },
  P2: {
    label: 'P2',
    className: 'bg-slate-400 text-white',
    description: '一般，有空再做',
  },
  P3: {
    label: 'P3',
    className: 'bg-gray-300 text-gray-600',
    description: '低優先，長期擱置',
  },
}

interface PriorityPickerProps {
  priority: ProductPriority
  onSelect: (priority: ProductPriority) => void
  disabled?: boolean
}

export function PriorityPicker({ priority, onSelect, disabled }: PriorityPickerProps) {
  const [open, setOpen] = useState(false)
  const config = PRIORITY_CONFIG[priority]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          disabled={disabled}
          className={`
            px-1.5 py-0.5 rounded text-xs font-bold leading-none
            transition-opacity hover:opacity-80
            ${config.className}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          title={`Priority: ${priority} — 點擊更換`}
        >
          {config.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2" align="start">
        <div className="flex flex-col gap-1">
          {(Object.keys(PRIORITY_CONFIG) as ProductPriority[]).map((p) => {
            const c = PRIORITY_CONFIG[p]
            return (
              <button
                key={p}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(p)
                  setOpen(false)
                }}
                className={`
                  flex items-center gap-2 w-full px-2 py-1.5 rounded text-left
                  hover:bg-white/10 transition-colors
                  ${priority === p ? 'bg-white/5' : ''}
                `}
              >
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${c.className}`}>
                  {c.label}
                </span>
                <span className="text-xs text-white/60">{c.description}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function PriorityBadge({ priority }: { priority: ProductPriority }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold leading-none ${config.className}`}>
      {config.label}
    </span>
  )
}
