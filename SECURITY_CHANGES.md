# Security and dispatch update

Public signup supports patient and doctor accounts only. Administrators and dispatchers must be provisioned separately. Protected APIs validate active database accounts and enforce ownership or staff access. Profile API IDs refer to User IDs. Alert tracking uses an alert-specific, expiring token in `X-Tracking-Token`; that token cannot perform clinical transitions or submit feedback.

Set a unique, random `JWT_SECRET` of at least 32 characters before starting the backend. There is no fallback signing key. Keep `DEMO_MODE=false` on public deployments. Restart the backend after changing credentials. Existing deployments using the removed fallback key must configure a secret; users must sign in again after key rotation.

The browser attaches authentication only to the configured API origin. Anonymous SOS creation remains public. Staff incident notifications use an authenticated socket room. Room subscriptions require authorization in development and production.

Alert lifecycle: PENDING → DISPATCHED → TRANSPORTING → COMPLETED; DISPATCHED may also complete directly. Cancellation is allowed from active states. Terminal state changes use conditional updates inside the resource-release transaction. Retry and reassignment lock the alert row; vehicle reservations use conditional claims. Reassignment is rejected after transport starts.

AI runs locally only when cloud providers are disabled. Enabling Groq or OpenAI can transmit prompt content, including clinical context, to that provider. Clinical briefing requires assigned-doctor or staff access. Anonymous triage does not load stored patient history. These controls do not constitute regulatory certification.

Verification: `npm --prefix backend test` runs isolated regression tests with a mocked database, including ownership, role escalation, tracking scope, lifecycle, and competing cancellation. `npm --prefix frontend run build` checks the production bundle. Real PostgreSQL concurrency and deployed end-to-end behavior require a dedicated test database and are not covered by those mocked tests. Existing frontend lint warnings and the large bundle remain separate maintenance work.
