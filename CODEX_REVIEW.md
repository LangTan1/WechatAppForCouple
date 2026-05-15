# Codex Review Guide - 琳浪小栈 (LangLang Bistro)

## Project Overview

A WeChat Mini Program built as a couples-only lifestyle app. Two partners bind together via invite code, then share diaries, whispers, albums, moods, achievements, and a virtual coin-based "shop" system. The app uses WeChat Cloud Development for cross-device data sync.

**Core concept**: One partner creates a "couple space" (developer role), the other joins via invite code (user role). All shared data syncs through a single cloud document per couple.

## Tech Stack

- **Framework**: Native WeChat Mini Program (WXML + WXSS + JS), no third-party frameworks
- **Base library**: 3.15.2, `es6: false` (Babel transpilation disabled)
- **Storage**: `wx.setStorageSync` / `wx.getStorageSync` (local) + WeChat Cloud NoSQL database (remote sync)
- **Cloud functions**: `coupleOps` (all DB operations with admin privileges), `getOpenid`
- **Cloud storage**: `wx.cloud.uploadFile` for avatars and album photos
- **Weather API**: QWeather (和风天气) in `utils/weather.js`
- **No build tools, no npm, no bundler** - raw source files served directly

## Architecture

### Data Flow

```
Local Storage (wx.Storage) <--set() auto-sync--> Cloud DB (couples collection)
       ^                                              |
       |         loadFromCloud() polling (3-5s)       |
       +----------------------------------------------+
```

- `storage.js` is the **single source of truth** - all reads/writes go through it
- `set()` automatically fire-and-forget syncs to cloud via `coupleOps` cloud function
- `loadFromCloud()` polls cloud on intervals (5s for most pages, 3s for whisper)
- `_syncingFromCloud` flag prevents cloud→local→cloud echo loops

### Dual Role System

| Aspect | Developer (创建者) | User (使用者) |
|--------|-------------------|--------------|
| Entry | Dev key (default: `langdev520`) | 6-digit invite code |
| Identity stored as | `devName`/`devGender` | `userName`/`userGender` |
| Shop role | Manage products, process orders, issue coins | Browse, order, request coins |
| Reset | Can delete cloud doc, full reset | Rebind only (preserves invite code) |

### Cloud Field Mapping

Role-aware field mapping in `_getCloudFieldFor()`:
- `my_name` → `devName` (on dev device) / `userName` (on user device)
- `partner_name` → `userName` (on dev device) / `devName` (on user device)
- Static mappings in `CLOUD_FIELDS` for shared data (diaries, whispers, etc.)

## Key Files (Read Order)

### 1. Entry & Config
- **[app.js](app.js)** - Cloud init, update manager, global lifecycle
- **[app.json](app.json)** - TabBar config (4 tabs: index/menu/record/profile), page routes

### 2. Core Data Layer (MUST READ)
- **[utils/storage.js](utils/storage.js)** - The brain of the app. All data operations, cloud sync, role management, recovery logic. ~1000+ lines. Key functions:
  - `set()` / `get()` - local storage with auto cloud sync
  - `loadFromCloud()` - fetch from cloud with network error resilience
  - `createCouple()` / `bindCouple()` - couple space creation and binding
  - `_syncCloudToLocal()` - role-aware field mapping from cloud
  - `_resolveCloudFileIDs()` - converts cloud fileIDs to HTTP URLs for cross-user access
  - `clearStorageKeepIdentity()` - safe reset preserving recovery info
  - `_tryRestoreCouple()` - 4-layer recovery: openid→invite code→manual input→find old spaces

### 3. Cloud Function
- **[cloudfunctions/coupleOps/index.js](cloudfunctions/coupleOps/index.js)** - All DB operations. Runs server-side with admin privileges. Actions: `createCouple`, `bindCouple`, `loadCouple`, `saveField`, `saveBatch`, `findCoupleByOpenid`, `findAllCouplesByOpenid`, `findCoupleByCode`, `unbindCouple`

### 4. Setup Flow
- **[pages/setup/setup.js](pages/setup/setup.js)** - Access control: key verification, name/gender input, invite code binding, Pin lock, recovery flow

### 5. Main Pages
- **[pages/index/index.js](pages/index/index.js)** - Home: day counter, weather, love quotes, mood card, message badges
- **[pages/menu/menu.js](pages/menu/menu.js)** - Shop system: dual mode (user browses/orders, dev manages products/orders/requests)
- **[pages/profile/profile.js](pages/profile/profile.js)** - Profile: avatar, info, coin management, achievements, settings

### 6. Feature Pages
- **[pages/whisper/whisper.js](pages/whisper/whisper.js)** - Chat-style whispers with 3s polling
- **[pages/album/album.js](pages/album/album.js)** - Photo album with cloud storage, comments, pinch-zoom
- **[pages/diary/diary.js](pages/diary/diary.js)** - Shared diary
- **[pages/achievement/achievement.js](pages/achievement/achievement.js)** - 25 achievements, 4 tiers (bronze/silver/gold/platinum)

## Storage Keys (40 total)

Key categories:
- **Identity**: `setup_done`, `dev_key`, `user_key`, `current_role`, `last_role`, `lock_enabled`, `lock_pin`
- **Couple info**: `together_date`, `my_name`, `partner_name`, `my_avatar`, `partner_avatar`, `my_gender`, `partner_gender`
- **Coins**: `boy_coins` (dev balance), `girl_coins` (user balance)
- **Feature data**: `custom_diaries`, `custom_whispers`, `custom_wishes`, `custom_anniversaries`, `custom_menu_items`, `custom_album`, `custom_moods`, `custom_achievements`, `custom_angry`, `custom_reflection`, `custom_learn`, `custom_sweet`, `custom_avoid`
- **Orders**: `order_queue`, `food_requests`, `coin_requests`, `order_total_count`, `coin_transactions`
- **Cloud**: `couple_doc_id`

## Shop System

### Three-tier category
- Food (正餐/甜品/小吃) → 20 default items
- Fruit (10 default items, no subcategory)
- Couple Activities (居家服务/约会活动/甜蜜亲密) → 15 default items

### Order flow
User submits order → `order_queue` entry (status: pending) → Dev accepts (cooking) → Dev marks done (done). Negative-price items trigger coin issuance requests.

### Coin system
`girl_coins` is the user's balance. Dev can add/deduct with notes. `coin_transactions` tracks history. Users can request coin top-ups.

## Cross-User Cloud File Access

Problem: `cloud://` fileIDs only work for the uploader. Solution: `_resolveCloudFileIDs()` batch-converts all cloud fileIDs to HTTP URLs via `wx.cloud.getTempFileURL` after each cloud sync. The conversion runs under `_syncingFromCloud = true` to prevent the HTTP URLs from being synced back to cloud (which would overwrite the original fileIDs).

## Recovery Mechanism (断线恢复)

The app is resilient to network failures:
1. `loadFromCloud` only clears `couple_doc_id` when the document is confirmed deleted (not on network errors)
2. On load failure, retries after 1.5s, then falls back to local data if `couple_doc_id` exists
3. Invite code cached locally in `last_invite_code` for recovery
4. `clearStorageKeepIdentity()` preserves invite code + names + genders before clearing
5. Developer has 4-layer recovery: openid lookup → invite code cache → manual input → find all old spaces

## What to Focus On During Review

1. **Data integrity**: Does the cloud sync logic in `storage.js` handle all edge cases (echo loops, partial failures, role conflicts)?
2. **Security**: Is the `coupleOps` cloud function properly scoped? Can one couple access another's data?
3. **Recovery resilience**: Are there scenarios where a user permanently loses access?
4. **Performance**: Are the 3-5s polling intervals appropriate? Any risk of excessive cloud function invocations?
5. **Code quality**: `storage.js` is the largest file - assess its maintainability
6. **WXSS consistency**: Are styles consistent across pages? Any unused styles?
7. **Memory leaks**: Are polling intervals properly cleaned up in `onHide`/`onUnload`?
