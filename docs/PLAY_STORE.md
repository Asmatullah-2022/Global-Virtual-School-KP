# Play Store Preparation (Checklist — Nothing Submitted Automatically)

## App identity
- **App name**: Global Virtual School
- **Short description** (≤80 chars): `Learn, connect and grow with Global Virtual School — GVS, KP.`
- **Full description**: draft with the client; must not claim "Official
  Government App" unless formally authorized (see §39 of the brief) — use
  "Global Virtual School App" until that authorization exists.
- **Category**: Education

## Assets needed (not generated here — need real, approved artwork)
- App icon: 512×512 PNG, no transparency, derived from the existing GVS
  logo (do not redesign it).
- Feature graphic: 1024×500 PNG.
- Screenshots: at least 2 phone screenshots (Home, Learn, AI Teacher, Live
  Classes, Updates recommended) at real device resolution — capture these
  from the running app, not mockups.

## Privacy policy
- **Placeholder only**: a real privacy policy URL (e.g.
  `https://gvskp.org/privacy`) is required by Play Console before
  publishing. This build does not include a hosted policy — write one
  reflecting actual data collected (see `docs/DATABASE_SCHEMA.md`) before
  submission.

## Data safety form (Play Console)
Based on what this build actually collects:
- Account info (name, email, role, grade, school) — collected, used for
  app functionality, not sold.
- No location, contacts, camera, or microphone access requested.
- AI Teacher questions are sent to the configured AI provider (see
  `docs/AI_TEACHER_SETUP.md`) — disclose this if a provider is enabled.

## Content rating
Educational content for ages 11+ (grades 6-12); no user-generated public
content, no ads, no in-app purchases in this build — answer the Play
Console questionnaire accordingly once features match reality.

## Do not submit until
- [ ] Package ID `pk.gov.gvs.mobile` confirmed permanent by the client
- [ ] Production API domain wired in, `NODE_ENV=production`
- [ ] Real privacy policy published and linked
- [ ] Screenshots captured from the actual running app
- [ ] Facebook/AI Teacher integrations either configured or clearly shown
      with their "not yet connected" states (never faked for the listing)
