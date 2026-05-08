/**
 * 本地存储管理 + 云同步
 */
let _db = null;
let _couples = null;
let _coupleDocId = null;  // 当前设备绑定的情侣文档ID
let _syncingFromCloud = false;  // 防止云端→本地→云端回环

function _getCloudDB() {
  if (!_db) {
    _db = wx.cloud.database();
    _couples = _db.collection('couples');
  }
  return { db: _db, couples: _couples };
}

// 云同步字段映射：storage key → cloud field
const CLOUD_FIELDS = {
  'together_date': 'togetherDate',
  'boy_name': 'boyName',
  'girl_name': 'girlName',
  'boy_avatar': 'boyAvatar',
  'girl_avatar': 'girlAvatar',
  'boy_coins': 'boyCoins',
  'girl_coins': 'girlCoins',
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
  'order_total_count': 'orderTotalCount'
};

const STORAGE_KEYS = {
  SETUP_DONE: 'setup_done',
  DEV_KEY: 'dev_key',
  USER_KEY: 'user_key',
  TOGETHER_DATE: 'together_date',
  BOY_NAME: 'boy_name',
  GIRL_NAME: 'girl_name',
  BOY_AVATAR: 'boy_avatar',
  GIRL_AVATAR: 'girl_avatar',
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
  ORDER_QUEUE: 'order_queue',
  FOOD_REQUESTS: 'food_requests',
  COIN_REQUESTS: 'coin_requests',
  MOODS: 'custom_moods',
  ACHIEVEMENTS: 'custom_achievements',
  ORDER_TOTAL_COUNT: 'order_total_count'
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
    if (!_syncingFromCloud && CLOUD_FIELDS[key]) {
      saveToCloud(key, value).catch(function(e) { console.error('Auto sync error:', e); });
    }
  } catch (e) {
    console.error('Storage set error:', e);
  }
}

// ---- 角色管理 ----
function getCurrentRole() {
  return get(STORAGE_KEYS.CURRENT_ROLE, '');
}

function setCurrentRole(role) { set(STORAGE_KEYS.CURRENT_ROLE, role); }

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

function getBoyName() { return get(STORAGE_KEYS.BOY_NAME, '浪'); }
function setBoyName(name) { set(STORAGE_KEYS.BOY_NAME, name); }
function getGirlName() { return get(STORAGE_KEYS.GIRL_NAME, '琳琳'); }
function setGirlName(name) { set(STORAGE_KEYS.GIRL_NAME, name); }

// ---- 头像 ----
function getBoyAvatar() { return get(STORAGE_KEYS.BOY_AVATAR, ''); }
function setBoyAvatar(path) { set(STORAGE_KEYS.BOY_AVATAR, path); }
function getGirlAvatar() { return get(STORAGE_KEYS.GIRL_AVATAR, ''); }
function setGirlAvatar(path) { set(STORAGE_KEYS.GIRL_AVATAR, path); }

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
    orderedBy: getGirlName(),
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

// 创建情侣文档（创建者调用）- 用本地数据初始化云端文档
async function createCouple(openid, info) {
  const { couples } = _getCloudDB();
  const inviteCode = generateInviteCode();

  const docData = {
    inviteCode: inviteCode,
    devOpenid: openid,
    userOpenid: '',
    boyName: info.boyName || '浪',
    girlName: info.girlName || '琳琳',
    togetherDate: info.togetherDate || '2025-05-31',
    boyAvatar: getBoyAvatar(),
    girlAvatar: getGirlAvatar(),
    boyCoins: getBoyCoins(),
    girlCoins: getGirlCoins(),
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
    createdAt: _db.serverDate(),
    updatedAt: _db.serverDate()
  };

  const res = await couples.add({ data: docData });
  _coupleDocId = res._id;
  set('couple_doc_id', _coupleDocId);
  return { docId: res._id, inviteCode: inviteCode };
}

// 绑定对方（加入者调用）
async function bindCouple(inviteCode, openid) {
  const { couples } = _getCloudDB();

  const res = await couples.where({ inviteCode: inviteCode }).get();
  if (res.data.length === 0) {
    return { success: false, error: '邀请码不存在' };
  }

  const couple = res.data[0];
  if (couple.userOpenid && couple.userOpenid !== openid) {
    return { success: false, error: '该邀请码已被其他人绑定' };
  }

  await couples.doc(couple._id).update({
    data: { userOpenid: openid, updatedAt: _db.serverDate() }
  });

  _coupleDocId = couple._id;
  set('couple_doc_id', _coupleDocId);

  // 同步云端数据到本地
  _syncCloudToLocal(couple);

  return { success: true };
}

// 从云端加载数据到本地缓存
async function loadFromCloud() {
  const docId = getCoupleDocId();
  if (!docId) return false;

  try {
    const { couples } = _getCloudDB();
    const res = await couples.doc(docId).get();
    const data = res.data;
    _syncCloudToLocal(data);
    return true;
  } catch (e) {
    console.error('loadFromCloud error:', e);
    return false;
  }
}

// 将云端数据写入本地缓存（_syncingFromCloud 防止回环）
function _syncCloudToLocal(data) {
  _syncingFromCloud = true;
  if (data.togetherDate) set(STORAGE_KEYS.TOGETHER_DATE, data.togetherDate);
  if (data.boyName) set(STORAGE_KEYS.BOY_NAME, data.boyName);
  if (data.girlName) set(STORAGE_KEYS.GIRL_NAME, data.girlName);
  if (data.boyAvatar !== undefined) set(STORAGE_KEYS.BOY_AVATAR, data.boyAvatar);
  if (data.girlAvatar !== undefined) set(STORAGE_KEYS.GIRL_AVATAR, data.girlAvatar);
  if (data.boyCoins !== undefined) set(STORAGE_KEYS.BOY_COINS, data.boyCoins);
  if (data.girlCoins !== undefined) set(STORAGE_KEYS.GIRL_COINS, data.girlCoins);
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
  _syncingFromCloud = false;
}

// 保存单个字段到云端
async function saveToCloud(storageKey, value) {
  const docId = getCoupleDocId();
  if (!docId) return;

  const cloudField = CLOUD_FIELDS[storageKey];
  if (!cloudField) return;

  try {
    const { couples } = _getCloudDB();
    const updateData = {};
    updateData[cloudField] = value;
    updateData.updatedAt = _db.serverDate();
    await couples.doc(docId).update({ data: updateData });
  } catch (e) {
    console.error('saveToCloud error:', e);
  }
}

// 批量保存到云端
async function saveBatchToCloud(updates) {
  const docId = getCoupleDocId();
  if (!docId) return;

  const cloudUpdates = { updatedAt: _db.serverDate() };
  for (const key in updates) {
    const cloudField = CLOUD_FIELDS[key];
    if (cloudField) cloudUpdates[cloudField] = updates[key];
  }

  try {
    const { couples } = _getCloudDB();
    await couples.doc(docId).update({ data: cloudUpdates });
  } catch (e) {
    console.error('saveBatchToCloud error:', e);
  }
}

// ============================================================
// 导出
// ============================================================
module.exports = {
  STORAGE_KEYS,
  get, set,
  getCurrentRole, setCurrentRole, isDeveloper, isUser,
  getCurrentRole, setCurrentRole, isDeveloper, isUser,
  getTogetherDate, setTogetherDate, getTogetherDays,
  getBoyName, setBoyName, getGirlName, setGirlName,
  getBoyAvatar, setBoyAvatar, getGirlAvatar, setGirlAvatar,
  getBoyCoins, setBoyCoins, getGirlCoins, setGirlCoins,
  getMyCoins, setMyCoins,
  getMenuItems, setMenuItems,
  getOrderQueue, setOrderQueue, addOrder,
  getFoodRequests, setFoodRequests, addFoodRequest,
  getCoinRequests, setCoinRequests, addCoinRequest,
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
  getCoupleDocId, generateInviteCode, createCouple, bindCouple,
  loadFromCloud, saveToCloud, saveBatchToCloud
};
