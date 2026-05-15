# 双人天气与区县位置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页同时展示绑定双方各自独立的天气和“城市 + 区县”位置，并实现“自动定位优先、手动位置兜底、1 小时缓存刷新”的完整链路。

**Architecture:** 在共享情侣文档中新增双方独立的 `WeatherProfile` 和 `WeatherSnapshot` 字段，沿用现有 `storage -> cloud sync -> index page` 架构接入同步。天气模块负责刷新“当前用户自己的”位置与天气，首页只展示双方快照，不在一台设备上代替另一方定位。

**Tech Stack:** 微信原生小程序、`utils/storage.js` 本地与云同步、和风天气 GeoAPI / Weather Now API、轻量 Node 回归脚本。

---

## 文件结构

本次实现预计修改或新增这些文件：

- Modify: `cloudfunctions/coupleOps/index.js`
  - 放开新的天气字段白名单，允许云同步写入 `devWeatherProfile` / `userWeatherProfile` / `devWeatherSnapshot` / `userWeatherSnapshot`
- Modify: `cloudfunctions/coupleOps/review.test.js`
  - 补白名单回归测试，避免新字段被过滤掉
- Modify: `utils/storage.js`
  - 新增 weather profile / snapshot 的 storage key、角色映射、getter / setter、缓存过期判断辅助函数
- Modify: `utils/storage.review.test.js`
  - 补 weather profile / snapshot 的同步与角色映射测试
- Modify: `utils/weather.js`
  - 重构为“刷新我的天气 + 组装首页双人展示 + 手动位置解析 + fallback”的完整模块
- Add: `utils/weather.review.test.js`
  - 用 stub `wx` 做天气逻辑回归测试
- Modify: `pages/index/index.js`
  - 首页读取双方天气快照、按 1 小时判断是否刷新我的天气
- Modify: `pages/index/index.wxml`
  - 真正渲染“我 / TA”两份天气和区县位置
- Modify: `pages/index/index.wxss`
  - 调整天气卡片样式，适配双列布局
- Modify: `pages/profile/profile.js`
  - 新增“我的天气位置设置”入口与操作逻辑
- Modify: `pages/profile/profile.wxml`
  - 增加自动定位 / 手动地区选择的 UI
- Modify: `pages/profile/profile.wxss`
  - 新增位置设置卡片样式
- Modify: `README.md`
  - 更新天气系统说明，补充双人天气与手动位置兜底

## 约定的数据结构

### WeatherProfile

```js
{
  mode: 'auto' | 'manual',
  province: '浙江省',
  city: '杭州市',
  district: '西湖区',
  locationId: '101210106',
  displayName: '杭州市 西湖区',
  lat: 30.25,
  lon: 120.13,
  updatedAt: 1710000000000
}
```

### WeatherSnapshot

```js
{
  temp: 26,
  minTemp: 23,
  maxTemp: 29,
  text: '多云',
  icon: '⛅',
  clothing: '温度舒适，穿件短袖或裙子就很好～',
  clothingIcon: '👕',
  location: '杭州市 西湖区',
  source: 'auto' | 'manual' | 'fallback',
  updatedAt: 1710000000000
}
```

### 首页最终展示结构

```js
{
  mine: {
    name: '我',
    hasData: true,
    location: '杭州市 西湖区',
    temp: 26,
    minTemp: 23,
    maxTemp: 29,
    text: '多云',
    icon: '⛅',
    clothing: '温度舒适，穿件短袖或裙子就很好～',
    clothingIcon: '👕',
    source: 'auto',
    updatedAt: 1710000000000
  },
  partner: {
    name: 'TA',
    hasData: false,
    location: '等待 TA 设置位置',
    temp: null,
    minTemp: null,
    maxTemp: null,
    text: '暂未同步',
    icon: '📍',
    clothing: '',
    clothingIcon: '',
    source: '',
    updatedAt: 0
  }
}
```

### 缓存时长常量

```js
const WEATHER_CACHE_TTL = 60 * 60 * 1000;
```

## Task 1: 扩展云同步字段白名单

**Files:**
- Modify: `cloudfunctions/coupleOps/index.js`
- Test: `cloudfunctions/coupleOps/review.test.js`

- [ ] **Step 1: 先写失败的白名单测试**

在 `cloudfunctions/coupleOps/review.test.js` 追加断言，先让测试因为字段未放行而失败。

```js
{
  const updates = helpers.filterAllowedUpdates({
    devWeatherProfile: { mode: 'auto', city: '杭州' },
    userWeatherProfile: { mode: 'manual', city: '上海' },
    devWeatherSnapshot: { temp: 26, location: '杭州 西湖区' },
    userWeatherSnapshot: { temp: 22, location: '上海 浦东新区' }
  });
  assert.deepEqual(updates, {
    devWeatherProfile: { mode: 'auto', city: '杭州' },
    userWeatherProfile: { mode: 'manual', city: '上海' },
    devWeatherSnapshot: { temp: 26, location: '杭州 西湖区' },
    userWeatherSnapshot: { temp: 22, location: '上海 浦东新区' }
  });
}
```

- [ ] **Step 2: 运行测试确认它先失败**

Run:

```powershell
$env:NODE_PATH='C:\CodeLearning\VS\WeChatApp\cloudfunctions\getOpenid\node_modules'; node cloudfunctions\coupleOps\review.test.js
```

Expected:

- 失败
- 报错应指向 `filterAllowedUpdates()` 丢掉了 weather 字段

- [ ] **Step 3: 最小实现放开天气字段**

在 `cloudfunctions/coupleOps/index.js` 的 `ALLOWED_COUPLE_FIELDS` 中加入以下字段：

```js
'devWeatherProfile',
'userWeatherProfile',
'devWeatherSnapshot',
'userWeatherSnapshot'
```

不要加入 `PUBLIC_COUPLE_FIELDS`，因为 setup / restore 流程不需要这些字段。

- [ ] **Step 4: 再跑测试确认通过**

Run:

```powershell
$env:NODE_PATH='C:\CodeLearning\VS\WeChatApp\cloudfunctions\getOpenid\node_modules'; node cloudfunctions\coupleOps\review.test.js
```

Expected:

- PASS
- 原有授权测试仍通过

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/coupleOps/index.js cloudfunctions/coupleOps/review.test.js
git commit -m "feat: allow weather profile and snapshot sync"
```

## Task 2: 扩展 storage 的天气字段与角色映射

**Files:**
- Modify: `utils/storage.js`
- Test: `utils/storage.review.test.js`

- [ ] **Step 1: 写失败的 storage 回归测试**

在 `utils/storage.review.test.js` 追加下面这组测试，先覆盖“当前角色写我的天气，云字段要映射到 dev 侧”的行为。

```js
{
  const cloudData = {};
  const { storage, runtime } = await loadStorage(cloudData);

  storage.setMyWeatherProfile({
    mode: 'auto',
    city: '杭州市',
    district: '西湖区'
  });

  storage.setPartnerWeatherSnapshot({
    temp: 22,
    location: '上海市 浦东新区',
    source: 'manual',
    updatedAt: 1710000000000
  });

  assert.equal(runtime.saveFieldCalls[0].cloudField, 'devWeatherProfile');
  assert.equal(runtime.saveFieldCalls[1].cloudField, 'userWeatherSnapshot');
}
```

- [ ] **Step 2: 运行测试确认先失败**

Run:

```powershell
node utils\storage.review.test.js
```

Expected:

- 失败
- 报错应为 `setMyWeatherProfile` / `setPartnerWeatherSnapshot` 未定义，或 cloudField 映射不存在

- [ ] **Step 3: 在 storage 中加入 key、映射、getter / setter**

在 `utils/storage.js` 中补这些 key：

```js
MY_WEATHER_PROFILE: 'my_weather_profile',
PARTNER_WEATHER_PROFILE: 'partner_weather_profile',
MY_WEATHER_SNAPSHOT: 'my_weather_snapshot',
PARTNER_WEATHER_SNAPSHOT: 'partner_weather_snapshot'
```

在角色感知映射中加入：

```js
function _myWeatherProfileCloudField() { return isDeveloper() ? 'devWeatherProfile' : 'userWeatherProfile'; }
function _partnerWeatherProfileCloudField() { return isDeveloper() ? 'userWeatherProfile' : 'devWeatherProfile'; }
function _myWeatherSnapshotCloudField() { return isDeveloper() ? 'devWeatherSnapshot' : 'userWeatherSnapshot'; }
function _partnerWeatherSnapshotCloudField() { return isDeveloper() ? 'userWeatherSnapshot' : 'devWeatherSnapshot'; }
```

在 `_getCloudFieldFor()` 中补映射：

```js
if (storageKey === 'my_weather_profile') return _myWeatherProfileCloudField();
if (storageKey === 'partner_weather_profile') return _partnerWeatherProfileCloudField();
if (storageKey === 'my_weather_snapshot') return _myWeatherSnapshotCloudField();
if (storageKey === 'partner_weather_snapshot') return _partnerWeatherSnapshotCloudField();
```

补 getter / setter：

```js
function getMyWeatherProfile() { return get(STORAGE_KEYS.MY_WEATHER_PROFILE, null); }
function setMyWeatherProfile(profile) { set(STORAGE_KEYS.MY_WEATHER_PROFILE, profile); }
function getPartnerWeatherProfile() { return get(STORAGE_KEYS.PARTNER_WEATHER_PROFILE, null); }
function setPartnerWeatherProfile(profile) { set(STORAGE_KEYS.PARTNER_WEATHER_PROFILE, profile); }
function getMyWeatherSnapshot() { return get(STORAGE_KEYS.MY_WEATHER_SNAPSHOT, null); }
function setMyWeatherSnapshot(snapshot) { set(STORAGE_KEYS.MY_WEATHER_SNAPSHOT, snapshot); }
function getPartnerWeatherSnapshot() { return get(STORAGE_KEYS.PARTNER_WEATHER_SNAPSHOT, null); }
function setPartnerWeatherSnapshot(snapshot) { set(STORAGE_KEYS.PARTNER_WEATHER_SNAPSHOT, snapshot); }
function isWeatherSnapshotExpired(snapshot, ttl) {
  if (!snapshot || !snapshot.updatedAt) return true;
  return Date.now() - snapshot.updatedAt > ttl;
}
```

并在 `_syncCloudToLocal()` 中把云端新字段同步到对应本地 key。

- [ ] **Step 4: 再跑 storage 测试**

Run:

```powershell
node utils\storage.review.test.js
```

Expected:

- PASS
- 原有头像 / 相册回归测试继续通过

- [ ] **Step 5: Commit**

```bash
git add utils/storage.js utils/storage.review.test.js
git commit -m "feat: add weather profile and snapshot storage mapping"
```

## Task 3: 重构天气模块的核心逻辑

**Files:**
- Modify: `utils/weather.js`
- Add: `utils/weather.review.test.js`

- [ ] **Step 1: 先写天气模块回归测试**

创建 `utils/weather.review.test.js`，覆盖三条最关键路径：

```js
const assert = require('node:assert/strict');

async function testDisplayDataUsesBothSnapshots() {
  const weather = require('./weather.js');
  const storage = require('./storage.js');

  storage.setMyName('阿明');
  storage.setPartnerName('小雨');
  storage.setMyWeatherSnapshot({
    temp: 26, minTemp: 23, maxTemp: 29, text: '多云', icon: '⛅',
    clothing: '短袖就好', clothingIcon: '👕', location: '杭州市 西湖区',
    source: 'auto', updatedAt: 1710000000000
  });
  storage.setPartnerWeatherSnapshot({
    temp: 22, minTemp: 20, maxTemp: 24, text: '小雨', icon: '🌧️',
    clothing: '带伞', clothingIcon: '☂️', location: '上海市 浦东新区',
    source: 'manual', updatedAt: 1710000001000
  });

  const data = weather.getWeatherDisplayData();
  assert.equal(data.mine.name, '阿明');
  assert.equal(data.mine.location, '杭州市 西湖区');
  assert.equal(data.partner.name, '小雨');
  assert.equal(data.partner.location, '上海市 浦东新区');
}
```

再补一条“定位失败时回退到手动位置”的测试和一条“没有任何位置时回退 fallback”的测试。

- [ ] **Step 2: 跑测试确认先失败**

Run:

```powershell
node utils\weather.review.test.js
```

Expected:

- 失败
- 报错应指向 `getWeatherDisplayData()` / `refreshMyWeather()` 尚不存在

- [ ] **Step 3: 重构 `utils/weather.js`**

按下面的最小接口实现：

```js
const WEATHER_CACHE_TTL = 60 * 60 * 1000;

function buildWeatherProfileFromCity(city, mode, coords) {
  return {
    mode,
    province: city.adm1 || '',
    city: city.adm2 || city.name || '',
    district: city.name || '',
    locationId: city.id || '',
    displayName: [city.adm2 || city.city || '', city.name || ''].filter(Boolean).join(' '),
    lat: coords ? coords.latitude : null,
    lon: coords ? coords.longitude : null,
    updatedAt: Date.now()
  };
}

function buildWeatherSnapshot(now, profile, source) {
  const temp = parseInt(now.temp, 10);
  const maxTemp = isNaN(temp) ? 0 : temp + 3;
  const minTemp = isNaN(temp) ? 0 : temp - 3;
  const clothing = getClothingAdvice(maxTemp);
  return {
    temp,
    minTemp,
    maxTemp,
    text: now.text || '未知天气',
    icon: mapQweatherIcon(now.icon),
    clothing: clothing.text,
    clothingIcon: clothing.icon,
    location: profile.displayName || '',
    source,
    updatedAt: Date.now()
  };
}

function getWeatherDisplayData() {
  const mySnapshot = storage.getMyWeatherSnapshot();
  const partnerSnapshot = storage.getPartnerWeatherSnapshot();
  return {
    mine: normalizeDisplayItem(storage.getMyName() || '我', mySnapshot, true),
    partner: normalizeDisplayItem(storage.getPartnerName() || 'TA', partnerSnapshot, false)
  };
}
```

再实现：

- `refreshMyWeather()`
- `refreshMyWeatherByAutoLocation()`
- `refreshMyWeatherByManualProfile()`
- `refreshMyWeatherFallback()`
- `resolveManualLocation(region)`
- `getLocationCandidatesByText(region)`

其中 `resolveManualLocation(region)` 建议调用：

```js
wx.request({
  url: QWEATHER_GEO_API,
  data: {
    location: region.district,
    adm: region.city,
    range: 'cn',
    number: 10
  }
})
```

再在返回结果里优先匹配：

```js
const matched = list.find((item) => item.name === region.district && item.adm2 === region.city)
  || list.find((item) => item.name === region.district)
  || list[0];
```

- [ ] **Step 4: 再跑天气模块测试**

Run:

```powershell
node utils\weather.review.test.js
```

Expected:

- PASS
- `getWeatherDisplayData()` 能正确区分双方数据
- 定位失败时能回退 manual / fallback

- [ ] **Step 5: Commit**

```bash
git add utils/weather.js utils/weather.review.test.js
git commit -m "feat: add dual weather refresh and display logic"
```

## Task 4: 接首页双人天气展示与刷新逻辑

**Files:**
- Modify: `pages/index/index.js`
- Modify: `pages/index/index.wxml`
- Modify: `pages/index/index.wxss`

- [ ] **Step 1: 先准备最小 UI 期望**

把首页天气卡片的数据目标先写在实现注释中，作为开发时的结构约束：

```js
{
  weather: {
    mine: { name, location, temp, text, icon, hasData, clothing, clothingIcon },
    partner: { name, location, temp, text, icon, hasData }
  }
}
```

同时在 `index.wxml` 先把旧的“单份天气复用”标记出来，便于替换。

- [ ] **Step 2: 修改首页 JS，让页面先读快照再按需刷新**

在 `pages/index/index.js` 把 `loadWeather()` 改成：

```js
async loadWeather() {
  this.setData({ weather: weather.getWeatherDisplayData() });

  const mySnapshot = storage.getMyWeatherSnapshot();
  const expired = storage.isWeatherSnapshotExpired(mySnapshot, 60 * 60 * 1000);

  if (!expired) return;

  try {
    await weather.refreshMyWeather();
    this.setData({ weather: weather.getWeatherDisplayData() });
  } catch (e) {
    this.setData({ weather: weather.getWeatherDisplayData() });
  }
}
```

并在 `_doSyncFromCloud()` 成功后补：

```js
this.setData({ weather: weather.getWeatherDisplayData() });
```

- [ ] **Step 3: 修改首页 WXML，真正区分“我 / TA”**

用这种结构替换旧天气卡片核心部分：

```xml
<view class="weather-card" wx:if="{{weather}}">
  <view class="weather-title">今天的天气</view>
  <view class="weather-partners">
    <view class="weather-person">
      <view class="weather-person-name">{{weather.mine.name}}</view>
      <view class="weather-person-location">{{weather.mine.location}}</view>
      <view class="weather-person-temp" wx:if="{{weather.mine.hasData}}">
        <text>{{weather.mine.icon}}</text>
        <text>{{weather.mine.temp}}°</text>
      </view>
      <view class="weather-person-text">{{weather.mine.text}}</view>
    </view>
    <view class="weather-divider">❤</view>
    <view class="weather-person">
      <view class="weather-person-name">{{weather.partner.name}}</view>
      <view class="weather-person-location">{{weather.partner.location}}</view>
      <view class="weather-person-temp" wx:if="{{weather.partner.hasData}}">
        <text>{{weather.partner.icon}}</text>
        <text>{{weather.partner.temp}}°</text>
      </view>
      <view class="weather-person-text">{{weather.partner.text}}</view>
    </view>
  </view>
  <view class="weather-clothing" wx:if="{{weather.mine.hasData}}">
    <text>{{weather.mine.clothingIcon}}</text>
    <text>{{weather.mine.clothing}}</text>
  </view>
</view>
```

- [ ] **Step 4: 补首页样式**

在 `pages/index/index.wxss` 增加双列天气样式：

```css
.weather-title { font-size: 30rpx; font-weight: 600; margin-bottom: 24rpx; }
.weather-partners { display: flex; align-items: stretch; justify-content: space-between; gap: 20rpx; }
.weather-person { flex: 1; background: rgba(255,255,255,0.18); border-radius: 24rpx; padding: 24rpx; }
.weather-person-name { font-size: 30rpx; font-weight: 600; }
.weather-person-location { margin-top: 8rpx; font-size: 24rpx; opacity: 0.85; }
.weather-person-temp { margin-top: 18rpx; font-size: 42rpx; font-weight: 700; }
.weather-person-text { margin-top: 12rpx; font-size: 24rpx; opacity: 0.9; }
.weather-divider { align-self: center; font-size: 28rpx; opacity: 0.75; }
```

- [ ] **Step 5: 跑语法检查**

Run:

```powershell
node --check pages\index\index.js
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add pages/index/index.js pages/index/index.wxml pages/index/index.wxss
git commit -m "feat: render dual weather on home page"
```

## Task 5: 接资料页的手动位置设置入口

**Files:**
- Modify: `pages/profile/profile.js`
- Modify: `pages/profile/profile.wxml`
- Modify: `pages/profile/profile.wxss`

- [ ] **Step 1: 先写清楚资料页需要的最小 state**

在 `profile.js` 的 `data` 里新增：

```js
weatherModeLabel: '',
weatherLocationLabel: '',
weatherUpdatedAtLabel: '',
manualRegion: ['北京市', '北京市', '朝阳区'],
showWeatherModeSheet: false
```

- [ ] **Step 2: 在资料页中接入显示与操作**

在 `refreshData()` 中补：

```js
const myWeatherProfile = storage.getMyWeatherProfile();
const modeLabel = !myWeatherProfile ? '未设置' : (myWeatherProfile.mode === 'manual' ? '手动位置' : '自动定位');
const locationLabel = myWeatherProfile && myWeatherProfile.displayName ? myWeatherProfile.displayName : '暂未设置';
const updatedAtLabel = myWeatherProfile && myWeatherProfile.updatedAt
  ? new Date(myWeatherProfile.updatedAt).toLocaleString('zh-CN')
  : '暂无记录';
```

并 `setData` 到页面。

新增方法：

```js
async useCurrentWeatherLocation() {
  wx.showLoading({ title: '更新天气中...' });
  try {
    await weather.refreshMyWeather({ forceAuto: true });
    this.refreshData();
    wx.showToast({ title: '已更新当前位置', icon: 'none' });
  } catch (e) {
    wx.showToast({ title: '定位失败，请检查授权', icon: 'none' });
  } finally {
    wx.hideLoading();
  }
}

async onManualRegionChange(e) {
  const region = e.detail.value;
  this.setData({ manualRegion: region });
  try {
    await weather.saveManualWeatherLocation({
      province: region[0],
      city: region[1],
      district: region[2]
    });
    this.refreshData();
    wx.showToast({ title: '手动位置已更新', icon: 'none' });
  } catch (err) {
    wx.showToast({ title: '位置解析失败，请重试', icon: 'none' });
  }
}
```

- [ ] **Step 3: 修改 WXML 增加位置设置卡片**

在资料页适合的设置区域插入：

```xml
<view class="setting-card weather-setting-card">
  <view class="setting-title">天气位置</view>
  <view class="setting-sub">模式：{{weatherModeLabel}}</view>
  <view class="setting-sub">位置：{{weatherLocationLabel}}</view>
  <view class="setting-sub">更新：{{weatherUpdatedAtLabel}}</view>
  <view class="weather-setting-actions">
    <view class="weather-action-btn" bindtap="useCurrentWeatherLocation">使用当前位置</view>
    <picker mode="region" value="{{manualRegion}}" bindchange="onManualRegionChange">
      <view class="weather-action-btn secondary">手动设置区县</view>
    </picker>
  </view>
</view>
```

- [ ] **Step 4: 补样式**

在 `profile.wxss` 增加：

```css
.weather-setting-card { margin-top: 24rpx; }
.weather-setting-actions { display: flex; gap: 20rpx; margin-top: 20rpx; }
.weather-action-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 24rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #FF8EA1, #FF6B8A);
  color: #fff;
  font-size: 26rpx;
}
.weather-action-btn.secondary {
  background: rgba(255, 107, 138, 0.12);
  color: #FF5F80;
}
```

- [ ] **Step 5: 跑语法检查**

Run:

```powershell
node --check pages\profile\profile.js
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add pages/profile/profile.js pages/profile/profile.wxml pages/profile/profile.wxss
git commit -m "feat: add weather location controls to profile"
```

## Task 6: 文档与最终验证

**Files:**
- Modify: `README.md`
- Verify: `cloudfunctions/coupleOps/review.test.js`
- Verify: `utils/storage.review.test.js`
- Verify: `utils/weather.review.test.js`
- Verify: `pages/index/index.js`
- Verify: `pages/profile/profile.js`

- [ ] **Step 1: 更新 README 天气说明**

在 `README.md` 的功能说明和技术说明处，把单人天气描述改为下面这类文案：

```md
- 实时天气支持绑定双方独立展示
- 优先使用当前位置获取区县级天气
- 定位失败时回退到手动设置位置
- 天气结果缓存 1 小时，首页优先展示缓存再后台刷新
```

- [ ] **Step 2: 跑完整验证**

Run:

```powershell
node --check utils\storage.js
node --check utils\weather.js
node --check pages\index\index.js
node --check pages\profile\profile.js
node utils\storage.review.test.js
node utils\weather.review.test.js
$env:NODE_PATH='C:\CodeLearning\VS\WeChatApp\cloudfunctions\getOpenid\node_modules'; node cloudfunctions\coupleOps\review.test.js
```

Expected:

- 所有 `--check` 通过
- `utils` 两组回归测试通过
- 云函数回归测试通过

- [ ] **Step 3: 手工联调清单**

在微信开发者工具里至少验证：

```text
1. 首次打开首页，允许定位后能看到“我”的区县天气
2. 另一台设备登录后，也能看到自己的区县天气并同步给对方
3. 拒绝定位时，资料页手动选择区县后首页能正常展示
4. 首页 1 小时内重复进入不会重复定位，过期后会重新刷新
5. 对方未设置天气时，首页显示“等待 TA 设置位置”
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document dual weather and location behavior"
```

## Self-Review

### Spec 覆盖检查

- 双方独立天气：Task 2、Task 3、Task 4 覆盖
- 自动定位优先、手动兜底：Task 3、Task 5 覆盖
- 区县级显示：Task 3、Task 4、Task 5 覆盖
- 1 小时缓存：Task 2、Task 4 覆盖
- 失败降级与对方未同步占位：Task 3、Task 4 覆盖
- 资料页手动设置入口：Task 5 覆盖

### Placeholder 扫描

- 未保留 `TODO` / `TBD`
- 所有任务都写了具体文件、命令和预期

### 类型一致性检查

- 统一使用 `WeatherProfile`
- 统一使用 `WeatherSnapshot`
- 统一使用 `my_weather_profile` / `partner_weather_profile`
- 首页统一读取 `weather.getWeatherDisplayData()`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-dual-weather-location.md`.

Two execution options:

1. Subagent-Driven（推荐）- 我为每个任务派发独立子代理执行，再逐步审核整合
2. Inline Execution - 我在当前会话里按这个计划直接实现

你回复 `1` 或 `2` 就行。*** End Patch
