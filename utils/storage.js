/**
 * 本地存储管理
 */
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
  COIN_REQUESTS: 'coin_requests'
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

module.exports = {
  STORAGE_KEYS,
  get, set,
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
  getWeatherCache, setWeatherCache
};
