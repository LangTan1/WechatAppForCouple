/**
 * 本地存储管理 + 云同步（通过云函数coupleOps操作数据库，绕过安全规则限制）
 */
let _coupleDocId = null;  // 当前设备绑定的情侣文档ID
let _syncingFromCloud = false;  // 防止云端→本地→云端回环

// 云同步字段映射：storage key → cloud field（名字字段单独处理）
const CLOUD_FIELDS = {
  'together_date': 'togetherDate',
  'my_avatar': 'devAvatar',
  'partner_avatar': 'userAvatar',
  'boy_coins': 'devCoins',
  'girl_coins': 'userCoins',
  'custom_menu_items': 'menuItems',
  'custom_anniversaries': 'anniversaries',
  'custom_diaries': 'diaries',
  'custom_whispers': 'whispers',
  'custom_wishes': 'wishes',
  'custom_album': 'albums',
  'custom_moods': 'moods',
  'custom_achievements': 'achievements',
  'order_queue': 'orderQueue',
  'food_requests': 'foodRequests',
  'coin_requests': 'coinRequests',
  'order_total_count': 'orderTotalCount',
  'coin_transactions': 'coinTransactions',
  'custom_angry': 'angry',
  'custom_reflection': 'reflection',
  'custom_learn': 'learn',
  'custom_sweet': 'sweet',
  'custom_avoid': 'avoid'
};

// 角色感知的云字段名
function _myNameCloudField() { return isDeveloper() ? 'devName' : 'userName'; }
function _partnerNameCloudField() { return isDeveloper() ? 'userName' : 'devName'; }
function _myAvatarCloudField() { return isDeveloper() ? 'devAvatar' : 'userAvatar'; }
function _partnerAvatarCloudField() { return isDeveloper() ? 'userAvatar' : 'devAvatar'; }
function _myGenderCloudField() { return isDeveloper() ? 'devGender' : 'userGender'; }
function _partnerGenderCloudField() { return isDeveloper() ? 'userGender' : 'devGender'; }
function _getCloudFieldFor(storageKey) {
  if (storageKey === 'my_name') return _myNameCloudField();
  if (storageKey === 'partner_name') return _partnerNameCloudField();
  if (storageKey === 'my_avatar') return _myAvatarCloudField();
  if (storageKey === 'partner_avatar') return _partnerAvatarCloudField();
  if (storageKey === 'my_gender') return _myGenderCloudField();
  if (storageKey === 'partner_gender') return _partnerGenderCloudField();
  return CLOUD_FIELDS[storageKey];
}

const STORAGE_KEYS = {
  SETUP_DONE: 'setup_done',
  DEV_KEY: 'dev_key',
  USER_KEY: 'user_key',
  TOGETHER_DATE: 'together_date',
  MY_NAME: 'my_name',
  PARTNER_NAME: 'partner_name',
  MY_AVATAR: 'my_avatar',
  PARTNER_AVATAR: 'partner_avatar',
  MY_GENDER: 'my_gender',
  PARTNER_GENDER: 'partner_gender',
  BOY_COINS: 'boy_coins',
  GIRL_COINS: 'girl_coins',
  MENU_ITEMS: 'custom_menu_items',
  ANNIVERSARIES: 'custom_anniversaries',
  DIARIES: 'custom_diaries',
  WHISPERS: 'custom_whispers',
  WISHES: 'custom_wishes',
  ALBUM: 'custom_album',
  LAST_QUOTE_DATE: 'last_quote_date',
  LAST_QUOTE_INDEX: 'last_quote_index',
  LOCK_ENABLED: 'lock_enabled',
  LOCK_PIN: 'lock_pin',
  WEATHER_CACHE: 'weather_cache',
  CURRENT_ROLE: 'current_role',
  LAST_ROLE: 'last_role',
  ORDER_QUEUE: 'order_queue',
  FOOD_REQUESTS: 'food_requests',
  COIN_REQUESTS: 'coin_requests',
  MOODS: 'custom_moods',
  ACHIEVEMENTS: 'custom_achievements',
  ORDER_TOTAL_COUNT: 'order_total_count',
  COIN_TRANSACTIONS: 'coin_transactions',
  LAST_VIEW_TIMESTAMPS: 'last_view_timestamps',
  ANGRY: 'custom_angry',
  REFLECTION: 'custom_reflection',
  LEARN: 'custom_learn',
  SWEET: 'custom_sweet',
  AVOID: 'custom_avoid'
};

function get(key, defaultValue) {
  try {
    const val = wx.getStorageSync(key);
    return val !== '' && val !== undefined ? val : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
    // 自动同步到云端（排除从云端同步下来的场景，避免回环）
    // 名字/头像字段单独处理，不走静态映射
    if (!_syncingFromCloud && key !== 'my_name' && key !== 'partner_name'
        && key !== 'my_avatar' && key !== 'partner_avatar'
        && key !== 'my_gender' && key !== 'partner_gender' && CLOUD_FIELDS[key]) {
      console.log('[set] auto-sync triggered for key:', key, '→ cloud field:', CLOUD_FIELDS[key]);
      saveToCloud(key, value).then(function() {
        console.log('[set] sync OK for key:', key);
      }).catch(function(e) {
        console.error('[set] sync FAIL for key:', key, e);
      });
    }
  } catch (e) {
    console.error('Storage set error:', e);
  }
}

// ---- 角色管理 ----
function getCurrentRole() {
  return get(STORAGE_KEYS.CURRENT_ROLE, '');
}

function setCurrentRole(role) {
  set(STORAGE_KEYS.CURRENT_ROLE, role);
  // 记录最后使用的角色（不触发云同步）
  try { wx.setStorageSync(STORAGE_KEYS.LAST_ROLE, role); } catch (e) {}
}

function getLastRole() { return get(STORAGE_KEYS.LAST_ROLE, ''); }

function isDeveloper() { return getCurrentRole() === 'dev'; }
function isUser() { return getCurrentRole() === 'user'; }

// ---- 情侣信息 ----
function getTogetherDate() {
  return get(STORAGE_KEYS.TOGETHER_DATE, '2025-05-31');
}
function setTogetherDate(date) { set(STORAGE_KEYS.TOGETHER_DATE, date); }

function getTogetherDays() {
  const start = new Date(getTogetherDate());
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// ---- 通用名字体系 ----
function getMyName() { return get(STORAGE_KEYS.MY_NAME, ''); }
function setMyName(name) {
  set(STORAGE_KEYS.MY_NAME, name);
  // 角色感知云同步
  if (!_syncingFromCloud) {
    saveToCloud(STORAGE_KEYS.MY_NAME, name).catch(function(e) { console.error('Auto sync error:', e); });
  }
}
function getPartnerName() { return get(STORAGE_KEYS.PARTNER_NAME, ''); }
function setPartnerName(name) {
  set(STORAGE_KEYS.PARTNER_NAME, name);
  if (!_syncingFromCloud) {
    saveToCloud(STORAGE_KEYS.PARTNER_NAME, name).catch(function(e) { console.error('Auto sync error:', e); });
  }
}

// ---- 头像 ----
function getMyAvatar() { return get(STORAGE_KEYS.MY_AVATAR, ''); }
function setMyAvatar(path) {
  set(STORAGE_KEYS.MY_AVATAR, path);
  if (!_syncingFromCloud) {
    saveToCloud(STORAGE_KEYS.MY_AVATAR, path).catch(function(e) { console.error('Auto sync error:', e); });
  }
}
function getPartnerAvatar() { return get(STORAGE_KEYS.PARTNER_AVATAR, ''); }
function setPartnerAvatar(path) {
  set(STORAGE_KEYS.PARTNER_AVATAR, path);
  if (!_syncingFromCloud) {
    saveToCloud(STORAGE_KEYS.PARTNER_AVATAR, path).catch(function(e) { console.error('Auto sync error:', e); });
  }
}

// ---- 性别 ----
function getMyGender() { return get(STORAGE_KEYS.MY_GENDER, ''); }
function setMyGender(gender) {
  set(STORAGE_KEYS.MY_GENDER, gender);
  if (!_syncingFromCloud) {
    saveToCloud(STORAGE_KEYS.MY_GENDER, gender).catch(function(e) { console.error('Auto sync error:', e); });
  }
}
function getPartnerGender() { return get(STORAGE_KEYS.PARTNER_GENDER, ''); }
function setPartnerGender(gender) {
  set(STORAGE_KEYS.PARTNER_GENDER, gender);
  if (!_syncingFromCloud) {
    saveToCloud(STORAGE_KEYS.PARTNER_GENDER, gender).catch(function(e) { console.error('Auto sync error:', e); });
  }
}

// 根据性别获取默认头像emoji
function getDefaultAvatar(gender) {
  if (gender === 'male') return '🧑';
  if (gender === 'female') return '👩';
  return '😀';
}

// ---- 爱心币 ----
function getBoyCoins() { return get(STORAGE_KEYS.BOY_COINS, 100); }
function setBoyCoins(n) { set(STORAGE_KEYS.BOY_COINS, n); }
function getGirlCoins() { return get(STORAGE_KEYS.GIRL_COINS, 100); }
function setGirlCoins(n) { set(STORAGE_KEYS.GIRL_COINS, n); }

// 当前使用者余额（根据角色）
function getMyCoins() {
  return isDeveloper() ? getBoyCoins() : getGirlCoins();
}
function setMyCoins(n) {
  if (isDeveloper()) setBoyCoins(n);
  else setGirlCoins(n);
}

// ---- 菜单 ----
function getMenuItems() { return get(STORAGE_KEYS.MENU_ITEMS, []); }
function setMenuItems(items) { set(STORAGE_KEYS.MENU_ITEMS, items); }

// ---- 订单队列（使用者下单后，开发者看到） ----
function getOrderQueue() { return get(STORAGE_KEYS.ORDER_QUEUE, []); }
function setOrderQueue(list) { set(STORAGE_KEYS.ORDER_QUEUE, list); }
function addOrder(item) {
  const queue = getOrderQueue();
  queue.push({
    id: Date.now(),
    foodName: item.name,
    foodEmoji: item.emoji || '🍽️',
    price: item.price || 5,
    orderedBy: getMyName(),
    time: new Date().toLocaleString('zh-CN'),
    createdAt: Date.now(),
    status: 'pending'
  });
  setOrderQueue(queue);
  incrementOrderTotalCount();
}

// ---- 累计订单计数（不被自动清理影响） ----
function getOrderTotalCount() { return get(STORAGE_KEYS.ORDER_TOTAL_COUNT, 0); }
function incrementOrderTotalCount() {
  const count = getOrderTotalCount() + 1;
  set(STORAGE_KEYS.ORDER_TOTAL_COUNT, count);
  return count;
}

// ---- 食物请求（使用者请求新食物，开发者定价） ----
function getFoodRequests() { return get(STORAGE_KEYS.FOOD_REQUESTS, []); }
function setFoodRequests(list) { set(STORAGE_KEYS.FOOD_REQUESTS, list); }
function addFoodRequest(name, emoji, requestedBy) {
  const requests = getFoodRequests();
  requests.push({
    id: Date.now(),
    name, emoji: emoji || '🍽️',
    requestedBy,
    time: new Date().toLocaleString('zh-CN'),
    status: 'pending', // pending | priced | rejected
    price: 0,
    category: 'meal'
  });
  setFoodRequests(requests);
}

// ---- 爱心币交易记录 ----
function getCoinTransactions() { return get(STORAGE_KEYS.COIN_TRANSACTIONS, []); }
function setCoinTransactions(list) { set(STORAGE_KEYS.COIN_TRANSACTIONS, list); }

// ---- 硬币请求（使用者向开发者要硬币） ----
function getCoinRequests() { return get(STORAGE_KEYS.COIN_REQUESTS, []); }
function setCoinRequests(list) { set(STORAGE_KEYS.COIN_REQUESTS, list); }
function addCoinRequest(amount, exchangeItem, requestedBy) {
  const requests = getCoinRequests();
  requests.push({
    id: Date.now(),
    amount,
    exchangeItem,
    requestedBy,
    time: new Date().toLocaleString('zh-CN'),
    status: 'pending' // pending | approved | rejected
  });
  setCoinRequests(requests);
}

// ---- 纪念日 ----
function getAnniversaries() { return get(STORAGE_KEYS.ANNIVERSARIES, []); }
function setAnniversaries(list) { set(STORAGE_KEYS.ANNIVERSARIES, list); }

// ---- 日记 ----
function getDiaries() { return get(STORAGE_KEYS.DIARIES, []); }
function setDiaries(list) { set(STORAGE_KEYS.DIARIES, list); }

// ---- 悄悄话 ----
function getWhispers() { return get(STORAGE_KEYS.WHISPERS, []); }
function setWhispers(list) { set(STORAGE_KEYS.WHISPERS, list); }

// ---- 愿望 ----
function getWishes() { return get(STORAGE_KEYS.WISHES, []); }
function setWishes(list) { set(STORAGE_KEYS.WISHES, list); }

// ---- 相册（相册列表，每个相册内含照片） ----
function getAlbums() {
  const albums = get(STORAGE_KEYS.ALBUM, []);
  // 迁移旧数据
  if (albums.length > 0 && !albums[0].photos) {
    const oldPhotos = albums;
    setAlbums([{ id: 1, name: '默认相册', desc: '我们的回忆', cover: '', photos: oldPhotos }]);
    return get(STORAGE_KEYS.ALBUM, []);
  }
  return albums;
}
function setAlbums(list) { set(STORAGE_KEYS.ALBUM, list); }
function getAlbumPhotos() {
  const albums = getAlbums();
  const allPhotos = [];
  albums.forEach(album => {
    if (album.photos) album.photos.forEach(p => allPhotos.push(p));
  });
  return allPhotos;
}
function setAlbumPhotos(list) {
  // 兼容旧接口：直接存到默认相册
  const albums = getAlbums();
  if (albums.length === 0) {
    setAlbums([{ id: 1, name: '默认相册', desc: '', cover: '', photos: list }]);
  } else {
    albums[0].photos = list;
    setAlbums(albums);
  }
}

// ---- 每日情话 ----
function getLastQuoteDate() { return get(STORAGE_KEYS.LAST_QUOTE_DATE, ''); }
function setLastQuoteDate(date) { set(STORAGE_KEYS.LAST_QUOTE_DATE, date); }
function getLastQuoteIndex() { return get(STORAGE_KEYS.LAST_QUOTE_INDEX, -1); }
function setLastQuoteIndex(idx) { set(STORAGE_KEYS.LAST_QUOTE_INDEX, idx); }

// ---- 气气本 ----
function getAngry() { return get(STORAGE_KEYS.ANGRY, []); }
function setAngry(list) { set(STORAGE_KEYS.ANGRY, list); }

// ---- 醒醒贴 ----
function getReflection() { return get(STORAGE_KEYS.REFLECTION, []); }
function setReflection(list) { set(STORAGE_KEYS.REFLECTION, list); }

// ---- 学学好 ----
function getLearn() { return get(STORAGE_KEYS.LEARN, []); }
function setLearn(list) { set(STORAGE_KEYS.LEARN, list); }

// ---- 甜甜记 ----
function getSweet() { return get(STORAGE_KEYS.SWEET, []); }
function setSweet(list) { set(STORAGE_KEYS.SWEET, list); }

// ---- 避雷贴 ----
function getAvoid() { return get(STORAGE_KEYS.AVOID, []); }
function setAvoid(list) { set(STORAGE_KEYS.AVOID, list); }

// ---- 访问控制 ----
function isSetupDone() { return get(STORAGE_KEYS.SETUP_DONE, false); }
function setSetupDone() { set(STORAGE_KEYS.SETUP_DONE, true); }

function getDevKey() { return get(STORAGE_KEYS.DEV_KEY, ''); }
function setDevKey(key) { set(STORAGE_KEYS.DEV_KEY, key); }
function verifyDevKey(key) {
  const saved = getDevKey();
  return saved && key === saved;
}

function getUserKey() { return get(STORAGE_KEYS.USER_KEY, ''); }
function setUserKey(key) { set(STORAGE_KEYS.USER_KEY, key); }
function verifyUserKey(key) {
  const saved = getUserKey();
  return saved && key === saved;
}

function isLockEnabled() { return get(STORAGE_KEYS.LOCK_ENABLED, false); }
function setLockEnabled(val) { set(STORAGE_KEYS.LOCK_ENABLED, val); }

// ---- 天气缓存 ----
function getWeatherCache() { return get(STORAGE_KEYS.WEATHER_CACHE, null); }
function setWeatherCache(data) { set(STORAGE_KEYS.WEATHER_CACHE, data); }

// ---- 日期辅助 ----
function _formatDate(dt) {
  return dt.getFullYear() + '-' +
    String(dt.getMonth() + 1).padStart(2, '0') + '-' +
    String(dt.getDate()).padStart(2, '0');
}
function _todayStr() { return _formatDate(new Date()); }

// ---- 每日心情 ----
function getMoods() { return get(STORAGE_KEYS.MOODS, []); }
function setMoods(list) { set(STORAGE_KEYS.MOODS, list); }

function getTodayMood() {
  const moods = getMoods();
  const today = _todayStr();
  const role = getCurrentRole();
  for (let i = 0; i < moods.length; i++) {
    if (moods[i].date === today && moods[i].role === role) return moods[i];
  }
  return null;
}

function getPartnerTodayMood() {
  const moods = getMoods();
  const today = _todayStr();
  const role = getCurrentRole();
  const partnerRole = role === 'dev' ? 'user' : 'dev';
  for (let i = 0; i < moods.length; i++) {
    if (moods[i].date === today && moods[i].role === partnerRole) return moods[i];
  }
  return null;
}

function getRecentMoods(days) {
  const moods = getMoods();
  const result = [];
  const now = new Date();
  for (let d = 0; d < days; d++) {
    const dt = new Date(now.getTime() - d * 86400000);
    const dateStr = _formatDate(dt);
    const dayMoods = [];
    for (let i = 0; i < moods.length; i++) {
      if (moods[i].date === dateStr) dayMoods.push(moods[i]);
    }
    result.push({ date: dateStr, moods: dayMoods });
  }
  return result;
}

// ---- 恋爱成就 ----
function getAchievements() { return get(STORAGE_KEYS.ACHIEVEMENTS, []); }
function setAchievements(list) { set(STORAGE_KEYS.ACHIEVEMENTS, list); }

function getUnlockedAchievementCount() {
  const achievements = getAchievements();
  let count = 0;
  for (let i = 0; i < achievements.length; i++) {
    if (achievements[i].unlocked) count++;
  }
  return count;
}

function unlockAchievement(id) {
  const achievements = getAchievements();
  let found = false;
  for (let i = 0; i < achievements.length; i++) {
    if (achievements[i].id === id) {
      if (achievements[i].unlocked) return false;
      achievements[i].unlocked = true;
      achievements[i].unlockedAt = Date.now();
      found = true;
      break;
    }
  }
  if (!found) {
    achievements.push({ id: id, unlocked: true, unlockedAt: Date.now() });
  }
  setAchievements(achievements);
  return true;
}

// ---- 消息提醒（最后查看时间） ----
function getLastViewTimestamps() { return get(STORAGE_KEYS.LAST_VIEW_TIMESTAMPS, {}); }
function updateLastView(type) {
  const ts = getLastViewTimestamps();
  ts[type] = Date.now();
  // 直接写storage，不走set()避免触发云同步
  try { wx.setStorageSync(STORAGE_KEYS.LAST_VIEW_TIMESTAMPS, ts); } catch (e) {}
}

// ============================================================
// 云同步功能
// ============================================================

// 获取当前绑定的情侣文档ID（从本地缓存读取）
function getCoupleDocId() {
  if (!_coupleDocId) {
    _coupleDocId = get('couple_doc_id', '');
  }
  return _coupleDocId;
}

// 生成6位随机邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 创建情侣文档（创建者调用）- 通过云函数创建，拥有管理员权限
async function createCouple(openid, info) {
  const inviteCode = generateInviteCode();

  const docData = {
    inviteCode: inviteCode,
    devOpenid: openid,
    userOpenid: '',
    devName: info.devName || '',
    userName: '',
    devGender: info.devGender || '',
    userGender: '',
    togetherDate: info.togetherDate || '2025-05-31',
    devAvatar: getMyAvatar(),
    userAvatar: '',
    devCoins: getBoyCoins(),
    userCoins: getGirlCoins(),
    menuItems: getMenuItems(),
    diaries: getDiaries(),
    whispers: getWhispers(),
    wishes: getWishes(),
    anniversaries: getAnniversaries(),
    albums: getAlbums(),
    moods: getMoods(),
    achievements: getAchievements(),
    orderQueue: getOrderQueue(),
    foodRequests: getFoodRequests(),
    coinRequests: getCoinRequests(),
    orderTotalCount: getOrderTotalCount(),
    angry: getAngry(),
    reflection: getReflection(),
    learn: getLearn(),
    sweet: getSweet(),
    avoid: getAvoid()
  };

  const res = await wx.cloud.callFunction({
    name: 'coupleOps',
    data: { action: 'createCouple', docData: docData, inviteCode: inviteCode }
  });

  if (!res.result || !res.result.success) {
    throw new Error(res.result ? res.result.error : '创建失败');
  }

  _coupleDocId = res.result.docId;
  set('couple_doc_id', _coupleDocId);
  // 保存邀请码到本地，用于查看邀请码功能
  setLastInviteCode(inviteCode);
  return { docId: res.result.docId, inviteCode: inviteCode };
}

// 通过 openid 查找已有情侣文档（开发者恢复用）
async function findCoupleByOpenid(openid) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'coupleOps',
      data: { action: 'findCoupleByOpenid' }
    });
    if (res.result && res.result.success && res.result.couple) {
      return res.result.couple;
    }
  } catch (e) {
    console.error('findCoupleByOpenid error:', e);
  }
  return null;
}

// 通过 openid 查找所有情侣文档（开发者找回旧空间用）
async function findAllCouplesByOpenid() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'coupleOps',
      data: { action: 'findAllCouplesByOpenid' }
    });
    if (res.result && res.result.success) {
      return res.result.couples || [];
    }
  } catch (e) {
    console.error('findAllCouplesByOpenid error:', e);
  }
  return [];
}

// 绑定对方（加入者调用）- 通过云函数操作，绕过安全规则
async function bindCouple(inviteCode, userName, userGender) {
  const res = await wx.cloud.callFunction({
    name: 'coupleOps',
    data: {
      action: 'bindCouple',
      inviteCode: inviteCode,
      userName: userName,
      userGender: userGender
    }
  });

  if (!res.result || !res.result.success) {
    return { success: false, error: res.result ? res.result.error : '绑定失败' };
  }

  const couple = res.result.couple;
  _coupleDocId = res.result.docId;
  set('couple_doc_id', _coupleDocId);
  // 保存邀请码到本地，用于断线恢复
  setLastInviteCode(inviteCode);

  // 同步云端数据到本地
  _syncCloudToLocal(couple);

  // _syncCloudToLocal 已处理对方名字/头像/性别同步，此处仅补充自己的名字/性别
  if (userName) {
    _syncingFromCloud = true;
    set(STORAGE_KEYS.MY_NAME, userName);
    if (userGender) set(STORAGE_KEYS.MY_GENDER, userGender);
    _syncingFromCloud = false;
  }

  return { success: true };
}

// 从云端加载数据到本地缓存（通过云函数，绕过安全规则）
// 返回: true=成功, false=失败(文档不存在或已失效)
async function loadFromCloud() {
  const docId = getCoupleDocId();
  if (!docId) return false;

  try {
    const res = await wx.cloud.callFunction({
      name: 'coupleOps',
      data: { action: 'loadCouple', docId: docId }
    });

    if (!res.result || !res.result.success) {
      // 云函数返回失败，可能是文档不存在
      var errMsg = res.result ? (res.result.error || '') : '';
      if (errMsg.indexOf('not exist') !== -1 || errMsg.indexOf('not found') !== -1) {
        _clearLocalBinding();
        return false;
      }
      // 其他错误保留绑定
      return false;
    }

    var data = res.result.data;
    if (!data) {
      console.error('loadFromCloud: empty data');
      return false;
    }

    console.log('[load] cloud response keys:', Object.keys(data));
    if (data.albums) {
      console.log('[load] albums count:', data.albums.length);
      if (data.albums[0] && data.albums[0].photos) {
        console.log('[load] first album photos:', data.albums[0].photos.length);
        if (data.albums[0].photos[0]) {
          console.log('[load] first photo:', JSON.stringify(data.albums[0].photos[0]).substring(0, 200));
        }
      }
    }

    await _syncCloudToLocal(data);
    return true;
  } catch (e) {
    console.error('loadFromCloud error:', e);
    // 网络错误等临时性故障：保留本地绑定
    return false;
  }
}

// 清除本地绑定信息
function _clearLocalBinding() {
  _coupleDocId = null;
  try { wx.removeStorageSync('couple_doc_id'); } catch (e) {}
}

// 安全清除本地数据：保留邀请码和身份信息用于恢复绑定
function clearStorageKeepIdentity() {
  var inviteCode = getLastInviteCode();
  var myName = getMyName();
  var myGender = getMyGender();
  var partnerName = getPartnerName();
  var partnerGender = getPartnerGender();
  try { wx.clearStorageSync(); } catch (e) {}
  if (inviteCode) setLastInviteCode(inviteCode);
  if (myName) set(STORAGE_KEYS.MY_NAME, myName);
  if (myGender) set(STORAGE_KEYS.MY_GENDER, myGender);
  if (partnerName) set(STORAGE_KEYS.PARTNER_NAME, partnerName);
  if (partnerGender) set(STORAGE_KEYS.PARTNER_GENDER, partnerGender);
}

// 邀请码本地缓存（用于断线恢复）
function getLastInviteCode() { return get('last_invite_code', ''); }
function setLastInviteCode(code) {
  try { wx.setStorageSync('last_invite_code', code); } catch (e) {}
}

// 将云端数据写入本地缓存（_syncingFromCloud 防止回环）
// 只同步对方的名字/头像到本地，不覆盖自己的（自己的名字由本地维护，通过setMyName同步到云端）
function _syncCloudToLocal(data) {
  console.log('[sync] cloud data keys:', Object.keys(data));
  console.log('[sync] albums:', data.albums ? ('count=' + data.albums.length + ', photos=' + (data.albums[0] && data.albums[0].photos ? data.albums[0].photos.length : 0)) : 'null');
  console.log('[sync] devAvatar:', data.devAvatar ? data.devAvatar.substring(0, 60) : 'null');
  console.log('[sync] userAvatar:', data.userAvatar ? data.userAvatar.substring(0, 60) : 'null');
  _syncingFromCloud = true;
  if (data.togetherDate) set(STORAGE_KEYS.TOGETHER_DATE, data.togetherDate);

  // 名字/头像/性别：只同步对方的，不覆盖自己的
  const isDev = isDeveloper();
  if (isDev) {
    // dev端：对方是user
    if (data.userName) set(STORAGE_KEYS.PARTNER_NAME, data.userName);
    if (data.userAvatar !== undefined) set(STORAGE_KEYS.PARTNER_AVATAR, data.userAvatar);
    if (data.userGender) set(STORAGE_KEYS.PARTNER_GENDER, data.userGender);
    // 首次绑定时本地还没有名字，才从云端同步自己的
    if (!getMyName() && data.devName) set(STORAGE_KEYS.MY_NAME, data.devName);
    if (!getMyAvatar() && data.devAvatar !== undefined) set(STORAGE_KEYS.MY_AVATAR, data.devAvatar);
    if (!getMyGender() && data.devGender) set(STORAGE_KEYS.MY_GENDER, data.devGender);
  } else {
    // user端：对方是dev
    if (data.devName) set(STORAGE_KEYS.PARTNER_NAME, data.devName);
    if (data.devAvatar !== undefined) set(STORAGE_KEYS.PARTNER_AVATAR, data.devAvatar);
    if (data.devGender) set(STORAGE_KEYS.PARTNER_GENDER, data.devGender);
    // 首次绑定时本地还没有名字，才从云端同步自己的
    if (!getMyName() && data.userName) set(STORAGE_KEYS.MY_NAME, data.userName);
    if (!getMyAvatar() && data.userAvatar !== undefined) set(STORAGE_KEYS.MY_AVATAR, data.userAvatar);
    if (!getMyGender() && data.userGender) set(STORAGE_KEYS.MY_GENDER, data.userGender);
  }

  if (data.devCoins !== undefined) set(STORAGE_KEYS.BOY_COINS, data.devCoins);
  if (data.userCoins !== undefined) set(STORAGE_KEYS.GIRL_COINS, data.userCoins);
  if (data.menuItems) set(STORAGE_KEYS.MENU_ITEMS, data.menuItems);
  if (data.diaries) set(STORAGE_KEYS.DIARIES, data.diaries);
  if (data.whispers) set(STORAGE_KEYS.WHISPERS, data.whispers);
  if (data.wishes) set(STORAGE_KEYS.WISHES, data.wishes);
  if (data.anniversaries) set(STORAGE_KEYS.ANNIVERSARIES, data.anniversaries);
  if (data.albums) set(STORAGE_KEYS.ALBUM, data.albums);
  if (data.moods) set(STORAGE_KEYS.MOODS, data.moods);
  if (data.achievements) set(STORAGE_KEYS.ACHIEVEMENTS, data.achievements);
  if (data.orderQueue) set(STORAGE_KEYS.ORDER_QUEUE, data.orderQueue);
  if (data.foodRequests) set(STORAGE_KEYS.FOOD_REQUESTS, data.foodRequests);
  if (data.coinRequests) set(STORAGE_KEYS.COIN_REQUESTS, data.coinRequests);
  if (data.orderTotalCount !== undefined) set(STORAGE_KEYS.ORDER_TOTAL_COUNT, data.orderTotalCount);
  if (data.coinTransactions) set(STORAGE_KEYS.COIN_TRANSACTIONS, data.coinTransactions);
  if (data.angry) set(STORAGE_KEYS.ANGRY, data.angry);
  if (data.reflection) set(STORAGE_KEYS.REFLECTION, data.reflection);
  if (data.learn) set(STORAGE_KEYS.LEARN, data.learn);
  if (data.sweet) set(STORAGE_KEYS.SWEET, data.sweet);
  if (data.avoid) set(STORAGE_KEYS.AVOID, data.avoid);
  _syncingFromCloud = false;

  // 将cloud fileID转为HTTP URL（解决跨用户无法直接访问cloud fileID的问题）
  // 注意：_resolveCloudFileIDs内部需保持_syncingFromCloud=true，防止HTTP URL回传云端
  return _resolveCloudFileIDs(data);
}

// 将所有cloud fileID转为临时HTTP URL，使<image>可直接加载
// 返回Promise，调方可await确保URL已解析
function _resolveCloudFileIDs(data) {
  var fileIDs = [];
  var avatarFileID = null;

  // 收集对方头像的cloud fileID
  var isDev = isDeveloper();
  var partnerAvatarField = isDev ? 'userAvatar' : 'devAvatar';
  avatarFileID = data[partnerAvatarField];
  if (avatarFileID && typeof avatarFileID === 'string' && avatarFileID.indexOf('cloud://') === 0) {
    fileIDs.push(avatarFileID);
  }

  // 收集自己的头像cloud fileID
  var myAvatarField = isDev ? 'devAvatar' : 'userAvatar';
  var myAvatarFileID = data[myAvatarField];
  if (myAvatarFileID && typeof myAvatarFileID === 'string' && myAvatarFileID.indexOf('cloud://') === 0) {
    fileIDs.push(myAvatarFileID);
  }

  // 收集相册照片的cloud fileID
  var albums = data.albums;
  if (albums && Array.isArray(albums)) {
    for (var i = 0; i < albums.length; i++) {
      var photos = albums[i].photos;
      if (!photos || !Array.isArray(photos)) continue;
      for (var j = 0; j < photos.length; j++) {
        var photo = photos[j];
        if (!photo) continue;
        var photoFileID = (photo.url && typeof photo.url === 'string' && photo.url.indexOf('cloud://') === 0) ? photo.url
          : (photo.fileID && typeof photo.fileID === 'string' && photo.fileID.indexOf('cloud://') === 0) ? photo.fileID
          : null;
        if (photoFileID && fileIDs.indexOf(photoFileID) === -1) {
          fileIDs.push(photoFileID);
        }
      }
    }
  }

  console.log('[resolve] cloud data:', JSON.stringify(data).substring(0, 300));
  console.log('[resolve] fileIDs to resolve:', fileIDs.length, fileIDs);

  if (fileIDs.length === 0) return Promise.resolve();

  // 保持_syncingFromCloud=true，防止HTTP URL通过set()回传云端覆盖原始cloud fileID
  _syncingFromCloud = true;

  return new Promise(function(resolve) {
    wx.cloud.getTempFileURL({
      fileList: fileIDs,
      success: function(res) {
        console.log('[resolve] getTempFileURL result:', JSON.stringify(res).substring(0, 500));

        if (!res.fileList || res.fileList.length === 0) {
          console.error('[resolve] getTempFileURL returned empty fileList');
          _syncingFromCloud = false;
          resolve(); return;
        }

        var urlMap = {};
        for (var k = 0; k < res.fileList.length; k++) {
          var item = res.fileList[k];
          console.log('[resolve] file[' + k + '] status:', item.status, 'url:', item.tempFileURL ? item.tempFileURL.substring(0, 80) : 'null');
          if (item.status === 0 && item.tempFileURL) {
            urlMap[item.fileID] = item.tempFileURL;
          }
        }

        console.log('[resolve] urlMap keys:', Object.keys(urlMap).length);

        // 更新对方头像
        if (avatarFileID && urlMap[avatarFileID]) {
          console.log('[resolve] updating partner avatar:', urlMap[avatarFileID].substring(0, 80));
          _syncingFromCloud = true;
          try { wx.setStorageSync(STORAGE_KEYS.PARTNER_AVATAR, urlMap[avatarFileID]); } catch (e) {}
          _syncingFromCloud = false;
        } else if (avatarFileID) {
          console.warn('[resolve] partner avatar fileID not resolved:', avatarFileID);
        }

        // 更新自己的头像
        if (myAvatarFileID && urlMap[myAvatarFileID]) {
          console.log('[resolve] updating my avatar:', urlMap[myAvatarFileID].substring(0, 80));
          _syncingFromCloud = true;
          try { wx.setStorageSync(STORAGE_KEYS.MY_AVATAR, urlMap[myAvatarFileID]); } catch (e) {}
          _syncingFromCloud = false;
        }

        // 更新相册照片URL
        if (albums && Array.isArray(albums)) {
          var albumChanged = false;
          for (var i = 0; i < albums.length; i++) {
            var photos = albums[i].photos;
            if (!photos || !Array.isArray(photos)) continue;
            for (var j = 0; j < photos.length; j++) {
              var photo = photos[j];
              if (!photo) continue;
              var currentUrl = photo.url || '';
              var fid = photo.fileID || '';
              var matchedFileID = (currentUrl.indexOf('cloud://') === 0) ? currentUrl
                : (fid.indexOf('cloud://') === 0) ? fid : null;
              if (matchedFileID && urlMap[matchedFileID]) {
                albums[i].photos[j].url = urlMap[matchedFileID];
                albumChanged = true;
                console.log('[resolve] photo[' + i + '][' + j + '] resolved:', urlMap[matchedFileID].substring(0, 80));
              } else if (matchedFileID) {
                console.warn('[resolve] photo[' + i + '][' + j + '] NOT resolved, fileID:', matchedFileID);
              }
            }
          }
          if (albumChanged) {
            _syncingFromCloud = true;
            try { wx.setStorageSync(STORAGE_KEYS.ALBUM, albums); } catch (e) {}
            _syncingFromCloud = false;
            console.log('[resolve] albums updated in storage');
          }
        }

        _syncingFromCloud = false;
        resolve();
      },
      fail: function(e) {
        console.error('[resolve] getTempFileURL FAIL:', JSON.stringify(e));
        _syncingFromCloud = false;
        resolve();
      }
    });
  });
}

// 保存单个字段到云端（通过云函数，绕过安全规则）
async function saveToCloud(storageKey, value) {
  const docId = getCoupleDocId();
  if (!docId) {
    console.warn('[saveToCloud] no docId, skipping. key:', storageKey);
    return;
  }

  const cloudField = _getCloudFieldFor(storageKey);
  if (!cloudField) {
    console.warn('[saveToCloud] no cloudField for key:', storageKey);
    return;
  }

  console.log('[saveToCloud] saving key:', storageKey, '→ field:', cloudField, 'docId:', docId);
  try {
    const res = await wx.cloud.callFunction({
      name: 'coupleOps',
      data: { action: 'saveField', docId: docId, cloudField: cloudField, value: value }
    });
    console.log('[saveToCloud] result:', JSON.stringify(res.result));
  } catch (e) {
    console.error('[saveToCloud] error:', e);
  }
}

// 批量保存到云端（通过云函数，绕过安全规则）
async function saveBatchToCloud(updates) {
  const docId = getCoupleDocId();
  if (!docId) return;

  const cloudUpdates = {};
  for (const key in updates) {
    const cloudField = _getCloudFieldFor(key);
    if (cloudField) cloudUpdates[cloudField] = updates[key];
  }

  try {
    await wx.cloud.callFunction({
      name: 'coupleOps',
      data: { action: 'saveBatch', docId: docId, updates: cloudUpdates }
    });
  } catch (e) {
    console.error('saveBatchToCloud error:', e);
  }
}

// 解绑情侣（开发者重置时调用）- 通过云函数删除云端文档
async function unbindCouple() {
  const docId = getCoupleDocId();
  if (docId) {
    try {
      await wx.cloud.callFunction({
        name: 'coupleOps',
        data: { action: 'unbindCouple', docId: docId }
      });
    } catch (e) {
      console.error('unbindCouple cloud error:', e);
    }
  }
  _clearLocalBinding();
}

// ============================================================
// 导出
// ============================================================
module.exports = {
  STORAGE_KEYS,
  get, set,
  getCurrentRole, setCurrentRole, getLastRole, isDeveloper, isUser,
  getTogetherDate, setTogetherDate, getTogetherDays,
  getMyName, setMyName, getPartnerName, setPartnerName,
  getMyAvatar, setMyAvatar, getPartnerAvatar, setPartnerAvatar,
  getMyGender, setMyGender, getPartnerGender, setPartnerGender, getDefaultAvatar,
  getBoyCoins, setBoyCoins, getGirlCoins, setGirlCoins,
  getMyCoins, setMyCoins,
  getMenuItems, setMenuItems,
  getOrderQueue, setOrderQueue, addOrder,
  getFoodRequests, setFoodRequests, addFoodRequest,
  getCoinRequests, setCoinRequests, addCoinRequest,
  getCoinTransactions, setCoinTransactions,
  getAnniversaries, setAnniversaries,
  getDiaries, setDiaries,
  getWhispers, setWhispers,
  getWishes, setWishes,
  getAlbums, setAlbums, getAlbumPhotos, setAlbumPhotos,
  getLastQuoteDate, setLastQuoteDate,
  getLastQuoteIndex, setLastQuoteIndex,
  isSetupDone, setSetupDone,
  getDevKey, setDevKey, verifyDevKey,
  getUserKey, setUserKey, verifyUserKey,
  isLockEnabled, setLockEnabled,
  getWeatherCache, setWeatherCache,
  _formatDate, _todayStr,
  getMoods, setMoods, getTodayMood, getPartnerTodayMood, getRecentMoods,
  getAchievements, setAchievements, getUnlockedAchievementCount, unlockAchievement,
  getOrderTotalCount, incrementOrderTotalCount,
  getLastViewTimestamps, updateLastView,
  getCoupleDocId, generateInviteCode, createCouple, bindCouple,
  loadFromCloud, saveToCloud, saveBatchToCloud, unbindCouple,
  getLastInviteCode, setLastInviteCode, findCoupleByOpenid, findAllCouplesByOpenid,
  clearStorageKeepIdentity,
  getAngry, setAngry, getReflection, setReflection, getLearn, setLearn,
  getSweet, setSweet, getAvoid, setAvoid
};
