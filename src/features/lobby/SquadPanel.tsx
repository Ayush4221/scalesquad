import { commonStrings } from '@/constants/strings/common';
import { lobbyStrings } from '@/constants/strings/lobby';
import { layoutClassName } from '@/styles/layout';
import type { PublicMatchView } from '@scalesquad/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
const roleLabels = {
  TRAFFIC: commonStrings.traffic,
  DATA: commonStrings.data,
  OPS: commonStrings.operations,
} as const;
export function SquadPanel({ view }: { view: PublicMatchView }) {
  const reading = ['BRIEFING', 'INCIDENT_EVIDENCE'].includes(view.phase);
  return (
    <div className={layoutClassName('tab-squad')}>
      <Card>
        <CardHeader>
          <CardTitle>{commonStrings.yourSquad}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="roster list-none p-0">
            {view.members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-3 border-b border-border py-4"
              >
                <span>
                  {member.name}
                  {member.role && (
                    <small className={layoutClassName('muted block')}>
                      {roleLabels[member.role]}
                    </small>
                  )}
                </span>
                <span>
                  {reading
                    ? member.acknowledged
                      ? lobbyStrings.acknowledged
                      : lobbyStrings.reading
                    : lobbyStrings.inSquad}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
