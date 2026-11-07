'use client';
import { layoutClassName } from '@/styles/layout';

import { useId, useState } from 'react';
import { repairOptionLabels } from '@/constants/repairOptions';
import { ConfigurationValues, type PublicMatchView } from '@scalesquad/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ResponsiveSelect } from '@/components/shared/ResponsiveSelect';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
export function RepairPanel({
  view,
  userId,
  busy,
  onChange,
  onPass,
  onReclaim,
}: {
  view: PublicMatchView;
  userId: string;
  busy: boolean;
  onChange: (change: Partial<ConfigurationValues>) => void;
  onPass: (target: string) => void;
  onReclaim: () => void;
}) {
  const [target, setTarget] = useState('');
  const prefix = useId();
  const holder = view.lock?.holderUserId === userId;
  const editable =
    holder && !busy && !view.simulationLocked && ['REPAIR_1', 'REPAIR_2'].includes(view.phase);
  const values = view.configuration.values;
  const choice = (
    label: string,
    value: string,
    choices: readonly string[],
    change: (value: string) => void,
    help: string,
  ) => (
    <div className="control">
      <label
        className="mb-2 block text-xs text-muted-foreground"
        htmlFor={`${prefix}-${label.replaceAll(' ', '-').toLowerCase()}`}
      >
        {label}
      </label>
      <ResponsiveSelect
        id={`${prefix}-${label.replaceAll(' ', '-').toLowerCase()}`}
        describedBy={`${prefix}-${label.replaceAll(' ', '-').toLowerCase()}-help`}
        label={label}
        choices={choices.map((value) => ({ value, label: repairOptionLabels[value] ?? value }))}
        value={value}
        disabled={!editable}
        onChange={change}
      />
      <p
        id={`${prefix}-${label.replaceAll(' ', '-').toLowerCase()}-help`}
        className={layoutClassName('muted text-sm')}
      >
        {help}
      </p>
    </div>
  );
  return (
    <Card>
      <CardHeader className={layoutClassName('repair-header')}>
        <div className="flex flex-wrap justify-between gap-2">
          <CardTitle>Repair the system</CardTitle>
          <Badge variant="outline">v{view.configuration.version}</Badge>
        </div>
        <p className={layoutClassName('muted text-sm')}>
          Editor:{' '}
          {view.members.find((u) => u.userId === view.lock?.holderUserId)?.name ?? 'Not assigned'}
          {holder ? ' (you)' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="controls-grid grid grid-cols-1 gap-5 md:grid-cols-2">
          {choice(
            'App capacity',
            values.appCapacity,
            view.scenario.choices.capacity,
            (v) => onChange({ appCapacity: ConfigurationValues.shape.appCapacity.parse(v) }),
            'Higher capacity handles more requests and costs more credits.',
          )}
          {choice(
            'Database capacity',
            values.dbCapacity,
            view.scenario.choices.capacity,
            (v) => onChange({ dbCapacity: ConfigurationValues.shape.dbCapacity.parse(v) }),
            'Write capacity limits how many check-ins can be confirmed.',
          )}
          {choice(
            'Retry policy',
            values.retryPolicy,
            view.scenario.choices.retryPolicy,
            (v) => onChange({ retryPolicy: ConfigurationValues.shape.retryPolicy.parse(v) }),
            'The same key lets the server recognize a repeated request; a new identity starts a new attempt.',
          )}
          {choice(
            'Read cache',
            values.cache,
            view.scenario.choices.cache,
            (v) => onChange({ cache: ConfigurationValues.shape.cache.parse(v) }),
            'Cached reads can be faster. Only the database can confirm admission.',
          )}
        </div>
        <div className="toggle-row flex items-center justify-between gap-4 border-y border-border py-4">
          <div>
            <label className="mb-2 block text-xs text-muted-foreground" htmlFor="atomic">
              Atomic check-in
            </label>
            <p className={layoutClassName('muted text-sm')}>
              One indivisible check-and-accept operation.
            </p>
          </div>
          <Switch
            id="atomic"
            checked={values.atomicCheckin}
            disabled={!editable}
            onCheckedChange={(v) => onChange({ atomicCheckin: v })}
          />
        </div>
        {!editable && (
          <p className={layoutClassName('muted text-sm')}>
            {view.simulationLocked
              ? 'Simulation in progress. Configuration is locked.'
              : 'Only the active editor can change the configuration during repair.'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <div className="control">
            <label className="mb-2 block text-xs text-muted-foreground" htmlFor={`${prefix}-pass`}>
              Pass control to
            </label>
            <ResponsiveSelect
              id={`${prefix}-pass`}
              label="Pass control to"
              value={target}
              disabled={!editable}
              onChange={setTarget}
              choices={view.members
                .filter((u) => u.userId !== userId)
                .map((u) => ({ value: u.userId, label: u.name }))}
            />
          </div>
          <Button variant="outline" disabled={!editable || !target} onClick={() => onPass(target)}>
            Pass control
          </Button>
          {view.hostUserId === userId && (
            <Button
              variant="ghost"
              disabled={
                busy || view.simulationLocked || !['REPAIR_1', 'REPAIR_2'].includes(view.phase)
              }
              onClick={onReclaim}
            >
              Reclaim control
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
