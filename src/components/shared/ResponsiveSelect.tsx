'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ResponsiveDialog } from './ResponsiveDialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
export function ResponsiveSelect({
  label,
  value,
  choices,
  disabled,
  onChange,
  id,
  describedBy,
}: {
  label: string;
  value: string;
  choices: readonly { value: string; label: string }[];
  disabled: boolean;
  onChange: (v: string) => void;
  id?: string;
  describedBy?: string;
}) {
  const desktop = useMediaQuery('(min-width: 768px)'),
    [open, setOpen] = useState(false);
  useEffect(() => {
    if (disabled || desktop) setOpen(false);
  }, [disabled, desktop]);
  if (desktop)
    return (
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          if (!disabled && v && choices.some((choice) => choice.value === v)) onChange(v);
        }}
      >
        <SelectTrigger id={id} aria-describedby={describedBy} aria-label={label} className="w-full">
          <SelectValue placeholder={label}>
            {choices.find((choice) => choice.value === value)?.label ?? label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} sideOffset={8}>
          {choices.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  return (
    <>
      <Button
        variant="outline"
        id={id}
        aria-describedby={describedBy}
        aria-label={label}
        disabled={disabled}
        className="w-full justify-between"
        onClick={() => setOpen(true)}
      >
        {choices.find((c) => c.value === value)?.label ?? label} ▾
      </Button>
      <ResponsiveDialog open={open && !disabled} onOpenChange={setOpen} title={label}>
        <div className="grid gap-2">
          {choices.map((c) => (
            <Button
              key={c.value}
              variant={c.value === value ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(c.value);
                setOpen(false);
              }}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </ResponsiveDialog>
    </>
  );
}
