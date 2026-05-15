# Codex Fix Review

## Purpose

This document summarizes the changes made after the quick code review so Claude Code can review the patch with full context.

## Scope

Changed files:

- `cloudfunctions/coupleOps/index.js`
- `pages/setup/setup.js`
- `cloudfunctions/coupleOps/review.test.js` (new)

Unrelated workspace note:

- `CODEX_REVIEW.md` is currently untracked in the workspace but was not modified by this patch.

## Original Findings

### 1. Cloud function authorization was too loose

Before the patch:

- `loadCouple`, `saveField`, `saveBatch`, and `unbindCouple` trusted the client-provided `docId`
- `findCoupleByCode` returned the full couple document
- if someone knew a valid `docId`, they could read or modify that document through the cloud function

### 2. Developer restore could pick the wrong historical space

Before the patch:

- `findCoupleByOpenid` used the first query result without explicit recency selection
- if a developer had multiple old couple docs, restore could target an arbitrary one instead of the newest one

### 3. Rebind failure UI state was wrong

Before the patch:

- `pages/setup/setup.js`
- in `confirmRebind()`, the catch branch cleared `bindLoading` instead of `rebindLoading`
- a failed rebind could leave the page stuck in loading state

### 4. Same-space user could still delete the whole couple doc

This was found while re-checking the flow after the first round of fixes.

Before the patch:

- even after adding document-level authorization, `unbindCouple` still allowed any participant in the couple doc
- that meant the user-side client could theoretically call the cloud function directly and delete the full shared space
- this conflicted with the product rule that reset/delete is a developer-only action

## What Changed

### Cloud function hardening

Added shared helpers in `cloudfunctions/coupleOps/index.js`:

- `ALLOWED_COUPLE_FIELDS`
- `PUBLIC_COUPLE_FIELDS`
- `pickFields()`
- `toPublicCouple()`
- `canAccessCouple()`
- `canUnbindCouple()`
- `pickLatestCouple()`
- `filterAllowedUpdates()`
- `sanitizeCreateDoc()`
- `loadCoupleRecord()`
- `requireAuthorizedCouple()`

Behavior changes:

- `loadCouple` now checks that the caller openid belongs to the target couple doc
- `saveField` now checks authorization and rejects fields outside the allowlist
- `saveBatch` now checks authorization and drops fields outside the allowlist
- `unbindCouple` now requires the caller to be the developer openid, not just any participant
- `createCouple` now sanitizes the incoming `docData` before writing
- `findCoupleByCode`, `findCoupleByOpenid`, and `findAllCouplesByOpenid` now return only public fields instead of the full raw document

### Restore selection fix

The following query flows now explicitly choose the newest matching doc:

- `findCoupleByOpenid`
- `findCoupleByCode`
- `bindCouple`

They use `orderBy('createdAt', 'desc')` plus `pickLatestCouple()` as an extra guard.

### Setup page fix

In `pages/setup/setup.js`:

- `confirmRebind()` catch branch now clears `rebindLoading`

## Why The Design Looks This Way

### Why return only public fields

The setup and restore UI only needs display and restore-safe fields such as:

- `_id`
- `inviteCode`
- names
- genders
- avatars
- `togetherDate`

It does not need:

- `devOpenid`
- `userOpenid`
- full shared business state

So returning a narrowed document reduces unnecessary exposure without breaking current restore behavior.

### Why keep `loadCouple` returning the full document

`storage.loadFromCloud()` still needs the full shared state for sync:

- diaries
- whispers
- albums
- wishes
- menu data
- orders
- coin data

So the patch keeps full document reads only for already-authorized couple participants.

### Why `unbindCouple` is stricter than `load/save`

Read/write sync currently treats both sides as valid participants in the same shared space.

Delete/reset is different:

- product behavior already treats full reset as developer-only
- allowing the user side to delete the doc through direct cloud-function invocation would be a policy gap

So `unbindCouple` now uses a stricter rule than ordinary sync access.

## Verification Performed

### Syntax checks

Executed successfully:

- `node --check pages/setup/setup.js`
- `node --check cloudfunctions/coupleOps/index.js`

### Regression test file

Added:

- `cloudfunctions/coupleOps/review.test.js`

Executed successfully with `NODE_PATH` pointing at the existing cloud-function dependencies.

Current assertions cover:

- latest doc selection
- update field allowlist filtering
- participant authorization
- developer-only unbind authorization
- public-field projection

## Remaining Risk

The main remaining risk is not cross-couple access anymore. The remaining issue is role-level business authorization inside the same couple space.

Right now:

- `saveField` and `saveBatch` verify that the caller belongs to the couple doc
- but they do not verify whether that role is allowed to change a specific business field

So a modified client could still try to change fields that are only meant to be changed by certain UI flows, for example:

- coin balances
- menu definitions
- order state
- request approval state

This is not a regression from the patch. It is a deeper architectural issue that still exists after the authorization hardening.

Recommended next step:

- move high-risk mutations into dedicated cloud-function actions with explicit role checks
- examples: order transitions, coin grants/deductions, menu management, request approval

## Review Questions For Claude Code

Suggested focus areas for follow-up review:

1. Is the public-field projection set correct, or is any required field missing for restore/setup flows?
2. Should `pickLatestCouple()` use `updatedAt` first, or should it rely only on `createdAt` for restore semantics?
3. Should `saveField` / `saveBatch` remain generic, or should we begin splitting high-risk business writes into dedicated actions now?
4. Are there any setup or restore paths that still assume the cloud function returns raw full documents in places where it now returns projected documents?
