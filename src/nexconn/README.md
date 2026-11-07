# Nexconn integration

Official docs reviewed 2026-11-04:

- [Web SDK](https://docs.nexconn.ai/chatsdk-web): `@nexconn/engine`, `@nexconn/chat`.
  Initialize `NCEngine` once, then add connection/message handlers, connect with
  a server-issued token, and use `GroupChannel.sendMessage` with
  `SendTextMessageParams`. History uses `BaseChannel.createMessagesQuery`.
- [Initialization](https://docs.nexconn.ai/chatsdk-web/init): region SG default,
  NA or SA selectable with `NEXCONN_REGION`. Check your console's data center.
- [Server authentication](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth):
  signed JSON POST; SHA1(secret + nonce + millisecond timestamp). Secrets stay server-side.
- [Tokens](https://docs.nexconn.ai/platform-chat-api/user/register):
  `/v4/auth/access-token/issue`, `result.accessToken`; 200 requests/s.
- [Group creation](https://docs.nexconn.ai/platform-chat-api/group-channel/managing-channels/create-group):
  `/v4/group-channel/create`; server-owned group, no client invitations or self-join.
  Join/leave/dismiss server endpoints each allow 100 requests/s.
- [Notices](https://docs.nexconn.ai/platform-chat-api/message/send-group):
  `/v4/group-channel/message/send`; 20 messages/s. Only public phase/run notices.
- [Retention](https://docs.nexconn.ai/platform-chat-api/message/message-about/about-message-types):
  normal group history retained in cloud by default; offline messages cached for
  seven days. History availability still depends on account settings.
- [Token expiry](https://docs.nexconn.ai/platform-chat-api/user/expire): tokens
  **do not expire by default**. Configure a short validity period in Nexconn
  Console before live use; token issuance has no documented TTL parameter.
  The app never pretends a locally assigned expiry changes provider validity.

Timeout is 5 seconds, with at most one failover to the documented backup domain
for repeatable calls. Create and notices are not blindly retried after ambiguous
failures. Group creation attempts compensating dismissal on failure.

Private DM delivery remains disabled. Docs describe targeted delivery, but we
have not performed an account-level privacy/leak test. Private cards are stored
in Postgres and fetched only by their session owner; notifications use own-user
WebSocket delivery. No evidence enters Nexconn automatically.

Missing Nexconn credentials selects the disabled provider and displays a degraded
banner. The fake provider is for tests only. No live credentials or provider calls
are needed for unit tests. Real token issuance, group membership and history need
an account to validate; public documentation alone is not live verification.

Browser SDK connectivity: `@nexconn/engine` 26.2.1 uses region-specific
`*-light-edge.com` navigation, WebSocket and cloud-control hosts. These differ
from the server API's `*-light-api.com` hosts. The shared CSP permits HTTPS and
WSS to both families for the supported SG/NA/SA regions. A successful token API
response does not establish the SDK connection. After a CSP change, reload the
whole page; reconnecting within an old document retains that document's policy.
Reconnect obtains a fresh token and retries the existing squad channel; it does
not require three players or start a match. Browser regression probes use mocked
Singapore SDK endpoints, without sending live tokens or creating remote data.
