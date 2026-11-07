'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/shared/ResponsiveDialog';
import { ChangePasswordForm } from './ChangePasswordForm';
import { SignOutButton } from './SignOutButton';
import { NotificationSettings } from '@/pwa/NotificationSettings';
export function AccountSettings() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Settings
      </Button>
      <ResponsiveDialog title="Account settings" open={open} onOpenChange={setOpen}>
        <ChangePasswordForm />
        <NotificationSettings />
        <SignOutButton all />
      </ResponsiveDialog>
    </>
  );
}
