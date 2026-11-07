'use client';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/classNames';
import styles from './PasswordInput.module.css';

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  leadingIcon?: ReactNode;
  wrapperClassName?: string | undefined;
};

export function PasswordInput({ className, leadingIcon, wrapperClassName, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn(styles.control, leadingIcon && styles.withIcon, wrapperClassName)}>
      {leadingIcon && (
        <span className={styles.leading} aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(styles.input, className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={styles.toggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}
