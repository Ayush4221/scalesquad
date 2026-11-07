import { layoutClassName } from '@/styles/layout';
import type { PublicMatchView } from '@scalesquad/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
const roleLabels = { TRAFFIC: 'Traffic', DATA: 'Data', OPS: 'Operations' } as const;
export function SquadPanel({ view }: { view: PublicMatchView }) {
  const reading = ['BRIEFING', 'INCIDENT_EVIDENCE'].includes(view.phase);
  return (
    <div className={layoutClassName('tab-squad')}>
      <Card>
        <CardHeader>
          <CardTitle>Your squad</CardTitle>
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
                  {reading ? (member.acknowledged ? 'Acknowledged' : 'Reading') : 'In squad'}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
