'use client';
import { useState } from 'react';
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
  const holder = view.lock?.holderUserId === userId;
  const editable =
    holder && !busy && !view.simulationLocked && ['REPAIR_1', 'REPAIR_2'].includes(view.phase);
  const values = view.configuration.values;
  const choice = (
    label: string,
    value: string,
    choices: readonly string[],
    change: (value: string) => void,
  ) => (
    <div className="control">
      <label>{label}</label>
      <ResponsiveSelect
        label={label}
        choices={choices.map((value) => ({ value, label: value.replaceAll('_', ' ') }))}
        value={value}
        disabled={!editable}
        onChange={change}
      />
    </div>
  );
  return (
    <Card>
      <CardHeader className="repair-header">
        <div className="flex flex-wrap justify-between gap-2">
          <CardTitle>Repair the system</CardTitle>
          <Badge variant="outline">v{view.configuration.version}</Badge>
        </div>
        <p className="muted text-sm">
          Editor:{' '}
          {view.members.find((u) => u.userId === view.lock?.holderUserId)?.name ?? 'Not assigned'}
          {holder ? ' (you)' : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="controls-grid">
          {choice('App capacity', values.appCapacity, ['LOW', 'MEDIUM', 'HIGH'], (v) =>
            onChange({ appCapacity: ConfigurationValues.shape.appCapacity.parse(v) }),
          )}
          {choice('Database capacity', values.dbCapacity, ['LOW', 'MEDIUM', 'HIGH'], (v) =>
            onChange({ dbCapacity: ConfigurationValues.shape.dbCapacity.parse(v) }),
          )}
          {choice(
            'Retry policy',
            values.retryPolicy,
            ['NO_RETRY', 'RETRY_SAME_KEY', 'RETRY_NEW_IDENTITY'],
            (v) => onChange({ retryPolicy: ConfigurationValues.shape.retryPolicy.parse(v) }),
          )}
          {choice('Read cache', values.cache, ['OFF', 'ON_READS_ONLY'], (v) =>
            onChange({ cache: ConfigurationValues.shape.cache.parse(v) }),
          )}
        </div>
        <div className="toggle-row">
          <div>
            <label htmlFor="atomic">Atomic check-in</label>
            <p className="muted text-sm">One indivisible check-and-accept operation.</p>
          </div>
          <Switch
            id="atomic"
            checked={values.atomicCheckin}
            disabled={!editable}
            onCheckedChange={(v) => onChange({ atomicCheckin: v })}
          />
        </div>
        {!editable && (
          <p className="muted text-sm">
            {view.simulationLocked
              ? 'Simulation in progress. Configuration is locked.'
              : 'Only the active editor can change the configuration during repair.'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <ResponsiveSelect
            label="Pass control to"
            value={target}
            disabled={!editable}
            onChange={setTarget}
            choices={view.members
              .filter((u) => u.userId !== userId)
              .map((u) => ({ value: u.userId, label: u.name }))}
          />
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
