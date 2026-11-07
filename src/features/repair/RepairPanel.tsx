'use client';
import { commonStrings } from '@/constants/strings/common';
import { repairStrings } from '@/constants/strings/repair';

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
          <CardTitle>{repairStrings.repairTheSystem}</CardTitle>
          <Badge variant="outline">
            {repairStrings.v}
            {view.configuration.version}
          </Badge>
        </div>
        <p className={layoutClassName('muted text-sm')}>
          {repairStrings.editor}{' '}
          {view.members.find((u) => u.userId === view.lock?.holderUserId)?.name ??
            repairStrings.notAssigned}
          {holder ? commonStrings.youSuffix : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="controls-grid grid grid-cols-1 gap-5 md:grid-cols-2">
          {choice(
            commonStrings.appCapacity,
            values.appCapacity,
            view.scenario.choices.capacity,
            (v) => onChange({ appCapacity: ConfigurationValues.shape.appCapacity.parse(v) }),
            repairStrings.higherCapacityHandlesMoreRequestsAnd,
          )}
          {choice(
            commonStrings.databaseCapacity,
            values.dbCapacity,
            view.scenario.choices.capacity,
            (v) => onChange({ dbCapacity: ConfigurationValues.shape.dbCapacity.parse(v) }),
            repairStrings.writeCapacityLimitsHowManyCheck,
          )}
          {choice(
            commonStrings.retryPolicy,
            values.retryPolicy,
            view.scenario.choices.retryPolicy,
            (v) => onChange({ retryPolicy: ConfigurationValues.shape.retryPolicy.parse(v) }),
            repairStrings.theSameKeyLetsTheServer,
          )}
          {choice(
            repairStrings.readCache,
            values.cache,
            view.scenario.choices.cache,
            (v) => onChange({ cache: ConfigurationValues.shape.cache.parse(v) }),
            repairStrings.cachedReadsCanBeFasterOnly,
          )}
        </div>
        <div className="toggle-row flex items-center justify-between gap-4 border-y border-border py-4">
          <div>
            <label className="mb-2 block text-xs text-muted-foreground" htmlFor="atomic">
              {commonStrings.atomicCheckIn}
            </label>
            <p className={layoutClassName('muted text-sm')}>
              {repairStrings.oneIndivisibleCheckAndAcceptOperation}
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
              ? repairStrings.simulationInProgressConfigurationIsLocked
              : repairStrings.onlyTheActiveEditorCanChange}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <div className="control">
            <label className="mb-2 block text-xs text-muted-foreground" htmlFor={`${prefix}-pass`}>
              {repairStrings.passControlTo}
            </label>
            <ResponsiveSelect
              id={`${prefix}-pass`}
              label={repairStrings.passControlTo}
              value={target}
              disabled={!editable}
              onChange={setTarget}
              choices={view.members
                .filter((u) => u.userId !== userId)
                .map((u) => ({ value: u.userId, label: u.name }))}
            />
          </div>
          <Button variant="outline" disabled={!editable || !target} onClick={() => onPass(target)}>
            {repairStrings.passControl}
          </Button>
          {view.hostUserId === userId && (
            <Button
              variant="ghost"
              disabled={
                busy || view.simulationLocked || !['REPAIR_1', 'REPAIR_2'].includes(view.phase)
              }
              onClick={onReclaim}
            >
              {repairStrings.reclaimControl}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
