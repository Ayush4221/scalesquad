# Step 14a — Account deletion backend and web request path

Status: proposed subplan alongside A2, before Android settings/release. Estimate:
1–2 developer days within A2; refine if provider cleanup or OAuth reauthentication
needs more work. A7 verifies this feature rather than first building it.
No runtime change is made by this document.

## Prerequisites and decisions

Use shared accounts and MVC services. Confirm retention periods, supported recent
reauthentication and active-match behavior before coding. Native password users
verify the current password; web-only OAuth users need a supported recent OAuth
reauthentication flow, not a password bypass. No SMTP/recovery is introduced.
Record justified retained audit data and its expiry in the privacy policy.

## Tasks

1. Define strict deletion DTOs, a confirmation UI and an authenticated endpoint.
   Derive the target from the principal, never an arbitrary supplied user ID.
   Preserve web Origin/native Bearer checks and bounded reauthentication/limits.
2. Require deliberate confirmation and recent authentication. Create a durable,
   idempotent deletion job before destructive work. Prevent deleting accounts
   from logging in, creating matches or registering new devices. Concurrent and
   repeated requests converge without duplicated provider work.
3. Revoke web/native sessions and refresh families, close game sockets through
   existing revocation, and invalidate FCM/Web Push bindings. Stop new delivery
   to the deleting account and clear local credentials, SDK data and drafts.
4. Resolve active games explicitly: close games hosted by the account through
   server lifecycle rules, safely notify remaining teammates, and remove the user
   from other games/lobbies according to the agreed policy. Do not silently
   transfer hosting or cascade-delete a live squad without a recorded decision.
5. Remove Nexconn memberships and delete closed-match groups where appropriate.
   Persist cleanup references before deleting relations so upstream failure cannot
   orphan access. Reuse bounded maintenance/retries and record provider failures;
   a timeout is not success. Pending work survives process restart.
6. Delete credentials, provider links, evidence and covered personal data under
   the policy. Minimize/anonymize justified security/audit retention with purpose
   and expiry. Preserve needed shared non-personal match facts deliberately;
   do not retain personal data indefinitely or rely on blind database cascades.
7. Add discoverable native Settings and public web request entry points identifying
   ScaleSquad. The web page may require login to complete deletion; expose no
   account-existence or sensitive status leaks. Show honest pending/completed
   acknowledgment and document any cleanup/retention delay.

## Unit tests required

- Missing/expired auth, wrong user, invalid body/Origin, rejected reauthentication
  and limits. Document permitted roles/phases; an active game must not indefinitely
  prevent an owner from requesting deletion.
- Web/native revocation, refresh replay, host/non-host/finished games and teammate privacy.
- Concurrent requests, partial failures, provider timeouts, restart and retry
  without lost group/device references or duplicate destructive actions.
- Covered personal data removed; retained audit fields minimized and expired.
- Web/mobile entry points, cancel, pending/success messaging and local purge.

## Security checks

- [ ] Principal-bound target and recent authentication; no password/email leak.
- [ ] Session, refresh, socket, provider and device access accounted for.
- [ ] Cleanup state/references survive failures and relation deletion.
- [ ] Active-match effects and retained data explicitly documented.
- [ ] Completion is never claimed while required provider cleanup is pending.
- [ ] Privacy/Play declarations and request page match actual behavior.

## Exit criteria

- [ ] Server/DB authorization and failure tests pass.
- [ ] Web request path/native contract ready before Settings implementation.
- [ ] Completed cleanup leaves no active credential/device/provider access.
- [ ] Teammate effects, retry operations and retention reviewed.
- [ ] Lint/types/build and existing auth/game regressions pass.

Reference: [Play deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111).
