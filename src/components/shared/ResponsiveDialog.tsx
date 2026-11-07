'use client';
import { layoutClassName } from '@/styles/layout';

import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const desktop = useMediaQuery('(min-width: 768px)');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={desktop ? '' : layoutClassName('mobile-drawer')}
        data-presentation={desktop ? 'dialog' : 'drawer'}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
