'use client';
import { useState } from 'react';
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
}: {
  label: string;
  value: string;
  choices: readonly { value: string; label: string }[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const desktop = useMediaQuery('(min-width: 768px)'),
    [open, setOpen] = useState(false);
  if (desktop)
    return (
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          if (v) onChange(v);
        }}
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
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
        aria-label={label}
        disabled={disabled}
        className="w-full justify-between"
        onClick={() => setOpen(true)}
      >
        {choices.find((c) => c.value === value)?.label ?? label} ▾
      </Button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={label}>
        <div className="grid gap-2">
          {choices.map((c) => (
            <Button
              key={c.value}
              variant={c.value === value ? 'default' : 'outline'}
              onClick={() => {
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
