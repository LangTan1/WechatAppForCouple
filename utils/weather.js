/**
 * 天气服务
 * - 双方独立天气展示
 * - 自动定位优先
 * - 手动位置兜底
 * - 1 小时缓存
 */
const storage = require('./storage');

const QWEATHER_KEY = 'b547757e14fb4b7093d2277d3fcd1ddd';
const QWEATHER_HOST = 'p86heymt7v.re.qweatherapi.com';
const QWEATHER_GEO_API = `https://${QWEATHER_HOST}/geo/v2/city/lookup`;
const QWEATHER_WEATHER_API = `https://${QWEATHER_HOST}/v7/weather/now`;
const WEATHER_CACHE_TTL = 60 * 60 * 1000;

function getClothingAdvice(maxTemp) {
  if (maxTemp >= 35) return { text: '超级热，出门注意防晒，穿得越凉快越好。', icon: '🧴' };
  if (maxTemp >= 30) return { text: '天气偏热，短袖短裤会更舒服，记得带伞防晒。', icon: '☀️' };
  if (maxTemp >= 25) return { text: '温度舒服，短袖或裙子就很合适。', icon: '👕' };
  if (maxTemp >= 20) return { text: '早晚温差不大，薄外套或衬衫刚刚好。', icon: '🧥' };
  if (maxTemp >= 15) return { text: '有一点凉，建议加一件薄外套。', icon: '🧶' };
  if (maxTemp >= 10) return { text: '有点冷，穿卫衣或厚外套更稳。', icon: '🧣' };
  if (maxTemp >= 5) return { text: '天气偏冷，羽绒服和围巾都可以安排上。', icon: '🧤' };
  if (maxTemp >= 0) return { text: '很冷，厚外套、手套和帽子都别忘了。', icon: '🧥' };
  return { text: '超级冷，注意保暖，尽量别吹风。', icon: '❄️' };
}

function mapQweatherIcon(iconCode) {
  const iconMap = {
    '100': '☀️', '101': '⛅', '102': '⛅', '103': '⛅', '104': '☁️',
    '150': '🌙', '151': '🌙', '153': '🌙',
    '300': '🌦️', '301': '🌦️', '302': '⛈️', '303': '⛈️', '304': '⛈️',
    '305': '🌧️', '306': '🌧️', '307': '🌧️', '308': '🌧️', '309': '🌧️',
    '310': '🌧️', '311': '🌧️', '312': '🌧️', '313': '🌧️', '314': '🌧️',
    '315': '🌧️', '316': '🌧️', '317': '🌧️', '318': '🌧️', '399': '🌧️',
    '400': '❄️', '401': '❄️', '402': '❄️', '403': '❄️', '404': '🌨️',
    '405': '🌨️', '406': '🌨️', '407': '🌨️', '408': '❄️', '409': '❄️',
    '410': '❄️', '499': '❄️',
    '500': '🌫️', '501': '🌫️', '502': '🌫️', '503': '🌫️', '504': '🌫️',
    '507': '🌫️', '508': '🌫️', '509': '🌫️', '510': '🌫️', '511': '🌫️',
    '512': '🌫️', '513': '🌫️', '514': '🌫️', '515': '🌫️',
    '900': '🧴', '901': '🧥', '999': '📍'
  };
  return iconMap[String(iconCode)] || '📍';
}

function requestQWeather(url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      data,
      header: {
        'X-QW-Api-Key': QWEATHER_KEY,
        Accept: 'application/json'
      },
      success: resolve,
      fail: reject
    });
  });
}

function getLocation() {
  return new Promise((resolve, reject) => {
    const onSuccess = (res) => resolve({ latitude: res.latitude, longitude: res.longitude });
    const onFail = (error) => reject(error);

    if (typeof wx.getFuzzyLocation === 'function') {
      wx.getFuzzyLocation({
        type: 'gcj02',
        success: onSuccess,
        fail: onFail
      });
      return;
    }

    reject(new Error('location api unavailable'));
  });
}

function buildDisplayName(cityName, districtName) {
  const parts = [];
  if (cityName) parts.push(cityName);
  if (districtName && districtName !== cityName) parts.push(districtName);
  return parts.join(' ').trim();
}

function normalizeLocationRecord(item) {
  const province = item && item.adm1 ? item.adm1 : '';
  const city = item && item.adm2 ? item.adm2 : (item && item.city ? item.city : '');
  const district = item && item.name ? item.name : '';
  return {
    province,
    city,
    district,
    locationId: item && item.id ? item.id : '',
    displayName: buildDisplayName(city, district) || city || district || province
  };
}

async function getCityByLocation(lat, lon) {
  const location = `${lon.toFixed(2)},${lat.toFixed(2)}`;
  const res = await requestQWeather(QWEATHER_GEO_API, { location, number: 1 });
  if (!res || res.statusCode !== 200 || !res.data || res.data.code !== '200' || !res.data.location || res.data.location.length === 0) {
    throw new Error('city lookup failed');
  }
  return res.data.location[0];
}

async function getLocationCandidatesByText(region) {
  const keyword = region && (region.district || region.city || region.province);
  if (!keyword) throw new Error('manual location missing');

  const res = await requestQWeather(QWEATHER_GEO_API, {
    location: keyword,
    adm: region.city || region.province || '',
    range: 'cn',
    number: 10
  });

  if (!res || res.statusCode !== 200 || !res.data || res.data.code !== '200' || !Array.isArray(res.data.location) || res.data.location.length === 0) {
    throw new Error('manual location lookup failed');
  }

  return res.data.location;
}

async function resolveManualLocation(region) {
  const candidates = await getLocationCandidatesByText(region);
  const matched = candidates.find((item) => item.name === region.district && item.adm2 === region.city)
    || candidates.find((item) => item.name === region.district)
    || candidates.find((item) => item.adm2 === region.city)
    || candidates[0];

  if (!matched) {
    throw new Error('manual location not found');
  }

  return matched;
}

async function getRealtimeWeather(locationId) {
  const res = await requestQWeather(QWEATHER_WEATHER_API, {
    location: locationId,
    lang: 'zh',
    unit: 'm'
  });
  if (!res || !res.data || res.data.code !== '200' || !res.data.now) {
    throw new Error('weather lookup failed');
  }
  return res.data.now;
}

function buildWeatherProfileFromCity(cityRecord, mode, coords) {
  const normalized = normalizeLocationRecord(cityRecord);
  return {
    mode,
    province: normalized.province,
    city: normalized.city,
    district: normalized.district,
    locationId: normalized.locationId,
    displayName: normalized.displayName,
    lat: coords ? coords.latitude : null,
    lon: coords ? coords.longitude : null,
    updatedAt: Date.now()
  };
}

function buildWeatherProfileFromRegion(region, cityRecord) {
  const normalized = normalizeLocationRecord(cityRecord || {});
  const city = normalized.city || region.city || '';
  const district = normalized.district || region.district || '';
  return {
    mode: 'manual',
    province: normalized.province || region.province || '',
    city: city,
    district: district,
    locationId: normalized.locationId,
    displayName: buildDisplayName(city, district) || region.city || region.district || region.province || '',
    lat: null,
    lon: null,
    updatedAt: Date.now()
  };
}

function buildWeatherSnapshot(now, profile, source) {
  const parsedTemp = parseInt(now.temp, 10);
  const temp = Number.isNaN(parsedTemp) ? 0 : parsedTemp;
  const maxTemp = temp + 3;
  const minTemp = temp - 3;
  const clothing = getClothingAdvice(maxTemp);
  return {
    temp,
    minTemp,
    maxTemp,
    text: now.text || '未知天气',
    icon: mapQweatherIcon(now.icon),
    clothing: clothing.text,
    clothingIcon: clothing.icon,
    location: profile && profile.displayName ? profile.displayName : '',
    source,
    updatedAt: Date.now()
  };
}

function getSeasonalWeather() {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const hour = now.getHours();

  const seasonData = [
    { maxAvg: 7, minAvg: -3, icons: ['☁️', '🌫️', '☀️', '❄️'], texts: ['阴天', '薄雾', '晴天', '小雪'] },
    { maxAvg: 11, minAvg: 0, icons: ['☁️', '🌤️', '☀️', '🌧️'], texts: ['多云', '少云', '晴天', '小雨'] },
    { maxAvg: 17, minAvg: 5, icons: ['🌤️', '☀️', '🌧️', '☁️'], texts: ['少云', '晴天', '小雨', '多云'] },
    { maxAvg: 23, minAvg: 11, icons: ['☀️', '🌤️', '🌧️', '⛅'], texts: ['晴天', '少云', '小雨', '多云'] },
    { maxAvg: 28, minAvg: 16, icons: ['☀️', '🌤️', '⛈️', '🌧️'], texts: ['晴天', '少云', '雷阵雨', '小雨'] },
    { maxAvg: 32, minAvg: 21, icons: ['☀️', '⛈️', '🌤️', '🌧️'], texts: ['晴天', '雷阵雨', '少云', '小雨'] },
    { maxAvg: 34, minAvg: 24, icons: ['☀️', '⛈️', '🌤️', '🌧️'], texts: ['晴天', '雷阵雨', '少云', '阵雨'] },
    { maxAvg: 33, minAvg: 23, icons: ['☀️', '⛈️', '🌤️', '🌧️'], texts: ['晴天', '雷阵雨', '少云', '阵雨'] },
    { maxAvg: 28, minAvg: 17, icons: ['☀️', '🌤️', '☁️', '🌧️'], texts: ['晴天', '少云', '多云', '小雨'] },
    { maxAvg: 22, minAvg: 11, icons: ['🌤️', '☀️', '☁️', '🌧️'], texts: ['少云', '晴天', '多云', '小雨'] },
    { maxAvg: 15, minAvg: 4, icons: ['☁️', '🌤️', '🌧️', '🌫️'], texts: ['多云', '少云', '小雨', '薄雾'] },
    { maxAvg: 9, minAvg: -1, icons: ['☁️', '🌫️', '☀️', '❄️'], texts: ['阴天', '多云', '晴天', '小雪'] }
  ];

  const season = seasonData[month];
  const seed = (month * 37 + day * 13 + Math.floor(hour / 3)) % 4;
  const variation = (seed - 1.5) * 2;
  const maxTemp = season.maxAvg + Math.round(variation);
  const minTemp = season.minAvg + Math.round(variation * 0.6);
  const midTemp = Math.round((maxTemp + minTemp) / 2);
  const temp = hour > 14 ? Math.round(maxTemp - (hour - 14) * 0.5) : hour > 10 ? maxTemp : midTemp;
  const clothing = getClothingAdvice(maxTemp);

  return {
    temp,
    minTemp,
    maxTemp,
    text: season.texts[seed],
    icon: season.icons[seed],
    clothing: clothing.text,
    clothingIcon: clothing.icon
  };
}

function normalizeDisplayItem(name, snapshot, isMine) {
  if (!snapshot) {
    return {
      name,
      hasData: false,
      location: isMine ? '等待定位或手动设置位置' : '等待 TA 设置位置',
      temp: null,
      minTemp: null,
      maxTemp: null,
      text: isMine ? '暂未获取天气' : '暂未同步',
      icon: '📍',
      clothing: '',
      clothingIcon: '',
      source: '',
      updatedAt: 0
    };
  }

  return {
    name,
    hasData: true,
    location: snapshot.location || (isMine ? '当前位置' : 'TA 的位置'),
    temp: snapshot.temp,
    minTemp: snapshot.minTemp,
    maxTemp: snapshot.maxTemp,
    text: snapshot.text || '未知天气',
    icon: snapshot.icon || '📍',
    clothing: snapshot.clothing || '',
    clothingIcon: snapshot.clothingIcon || '',
    source: snapshot.source || '',
    updatedAt: snapshot.updatedAt || 0
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

function persistWeatherResult(profile, snapshot) {
  if (profile) storage.setMyWeatherProfile(profile);
  if (snapshot) storage.setMyWeatherSnapshot(snapshot);
  return { profile, snapshot };
}

async function refreshMyWeatherByAutoLocation() {
  const coords = await getLocation();
  const city = await getCityByLocation(coords.latitude, coords.longitude);
  const profile = buildWeatherProfileFromCity(city, 'auto', coords);
  const now = await getRealtimeWeather(profile.locationId);
  const snapshot = buildWeatherSnapshot(now, profile, 'auto');
  return persistWeatherResult(profile, snapshot);
}

async function refreshMyWeatherByManualProfile(profile) {
  let targetProfile = profile || storage.getMyWeatherProfile();
  if (!targetProfile) {
    throw new Error('manual weather profile missing');
  }

  if (!targetProfile.locationId) {
    const matched = await resolveManualLocation(targetProfile);
    targetProfile = buildWeatherProfileFromRegion(targetProfile, matched);
  } else {
    targetProfile = Object.assign({}, targetProfile, {
      mode: 'manual',
      displayName: targetProfile.displayName || buildDisplayName(targetProfile.city, targetProfile.district),
      updatedAt: Date.now()
    });
  }

  const now = await getRealtimeWeather(targetProfile.locationId);
  const snapshot = buildWeatherSnapshot(now, targetProfile, 'manual');
  return persistWeatherResult(targetProfile, snapshot);
}

function refreshMyWeatherFallback() {
  const base = getSeasonalWeather();
  const profile = storage.getMyWeatherProfile();
  const location = profile && profile.displayName ? profile.displayName : '和你在一起的地方';
  const snapshot = {
    temp: base.temp,
    minTemp: base.minTemp,
    maxTemp: base.maxTemp,
    text: base.text,
    icon: base.icon,
    clothing: base.clothing,
    clothingIcon: base.clothingIcon,
    location,
    source: 'fallback',
    updatedAt: Date.now()
  };
  storage.setMyWeatherSnapshot(snapshot);
  return { profile: profile || null, snapshot };
}

async function refreshMyWeather(options) {
  const opts = options || {};
  try {
    return await refreshMyWeatherByAutoLocation();
  } catch (autoError) {
    if (opts.forceAuto) throw autoError;

    const manualProfile = storage.getMyWeatherProfile();
    if (manualProfile && manualProfile.mode === 'manual') {
      try {
        return await refreshMyWeatherByManualProfile(manualProfile);
      } catch (manualError) {
        console.error('[Weather] manual weather refresh failed:', manualError);
      }
    }

    console.error('[Weather] auto weather refresh failed:', autoError);
    return refreshMyWeatherFallback();
  }
}

async function saveManualWeatherLocation(region) {
  const matched = await resolveManualLocation(region);
  const profile = buildWeatherProfileFromRegion(region, matched);
  storage.setMyWeatherProfile(profile);
  return refreshMyWeatherByManualProfile(profile);
}

async function fetchWeather() {
  const mySnapshot = storage.getMyWeatherSnapshot();
  if (storage.isWeatherSnapshotExpired(mySnapshot, WEATHER_CACHE_TTL)) {
    await refreshMyWeather().catch((error) => {
      console.error('[Weather] fetchWeather refresh failed:', error);
    });
  }
  return getWeatherDisplayData();
}

module.exports = {
  WEATHER_CACHE_TTL,
  fetchWeather,
  getClothingAdvice,
  getWeatherDisplayData,
  refreshMyWeather,
  resolveManualLocation,
  saveManualWeatherLocation
};
