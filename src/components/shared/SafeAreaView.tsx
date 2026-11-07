import { layoutClassName } from '@/styles/layout';
import type { ReactNode } from 'react';
export function SafeAreaView({ children }: { children: ReactNode }) {
  return <div className={layoutClassName('safe-area-view')}>{children}</div>;
}
