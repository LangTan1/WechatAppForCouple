/**
 * 天气服务 - 和风天气实时数据 + 本地季节模拟降级
 */
const storage = require('./storage');

// 和风天气配置
const QWEATHER_KEY = 'b547757e14fb4b7093d2277d3fcd1ddd';
const QWEATHER_HOST = 'p86heymt7v.re.qweatherapi.com';
const QWEATHER_GEO_API = `https://${QWEATHER_HOST}/geo/v2/city/lookup`;
const QWEATHER_WEATHER_API = `https://${QWEATHER_HOST}/v7/weather/now`;

function getClothingAdvice(maxTemp) {
  if (maxTemp >= 35) return { text: '超级热！出门注意防晒，穿得越凉快越好 🧴', icon: '🥵' };
  if (maxTemp >= 30) return { text: '天气较热，建议穿短袖短裤，带上遮阳伞 ☂️', icon: '☀️' };
  if (maxTemp >= 25) return { text: '温度舒适，穿件薄T恤或裙子就很好～', icon: '👕' };
  if (maxTemp >= 20) return { text: '温暖宜人，薄长袖或衬衫刚好合适', icon: '👔' };
  if (maxTemp >= 15) return { text: '微凉，建议穿薄外套或针织衫出门', icon: '🧥' };
  if (maxTemp >= 10) return { text: '有点冷哦，穿件厚外套或卫衣吧', icon: '🧣' };
  if (maxTemp >= 5)  return { text: '天气冷，羽绒服、围巾都安排上！', icon: '🧤' };
  if (maxTemp >= 0)  return { text: '很冷！厚羽绒服 + 手套 + 帽子不能少', icon: '🥶' };
  return { text: '超级冷！能不出门就不出门，裹紧小被子～', icon: '☃️' };
}

// 和风天气图标映射为emoji
function mapQweatherIcon(iconCode) {
  const iconMap = {
    '100': '☀️', '101': '⛅', '102': '⛅', '103': '⛅', '104': '☁️',
    '150': '🌙', '151': '🌙', '153': '🌙',
    '300': '🌧️', '301': '🌧️', '302': '⛈️', '303': '⛈️',
    '304': '⛈️', '305': '🌧️', '306': '🌧️', '307': '🌧️',
    '308': '🌧️', '309': '🌧️', '310': '🌧️', '311': '🌧️',
    '312': '🌧️', '313': '🌧️', '314': '🌧️', '315': '🌧️',
    '316': '🌧️', '317': '🌧️', '318': '🌧️',
    '399': '🌧️', '400': '❄️', '401': '❄️', '402': '❄️',
    '403': '❄️', '404': '🌨️', '405': '🌨️', '406': '🌨️',
    '407': '🌨️', '408': '❄️', '409': '❄️', '410': '❄️',
    '499': '❄️', '500': '🌫️', '501': '🌫️', '502': '🌫️',
    '503': '🌫️', '504': '🌫️', '507': '🌫️', '508': '🌫️',
    '509': '🌫️', '510': '🌫️', '511': '🌫️', '512': '🌫️',
    '513': '🌫️', '514': '🌫️', '515': '🌫️',
    '900': '🥵', '901': '🥶', '999': '❓'
  };
  return iconMap[iconCode] || '🌤️';
}

// 获取模糊位置
function getLocation() {
  return new Promise((resolve, reject) => {
    console.log('[Weather] 尝试获取位置...');
    console.log('[Weather] wx.getFuzzyLocation 是否可用:', typeof wx.getFuzzyLocation);
    wx.getFuzzyLocation({
      type: 'wgs84',
      success: (res) => {
        console.log('[Weather] 位置获取成功:', res);
        resolve({ latitude: res.latitude, longitude: res.longitude });
      },
      fail: (err) => {
        console.error('[Weather] 位置获取失败:', err);
        // 尝试检查权限
        wx.getSetting({
          success: (settingRes) => {
            console.log('[Weather] 当前权限设置:', settingRes.authSetting);
          },
          fail: (settingErr) => {
            console.error('[Weather] 获取权限设置失败:', settingErr);
          }
        });
        reject(err);
      }
    });
  });
}

// 调用和风天气GeoAPI获取城市信息
function getCityByLocation(lat, lon) {
  return new Promise((resolve, reject) => {
    const locationStr = `${lon.toFixed(2)},${lat.toFixed(2)}`;
    console.log('[Weather] 查询城市，经纬度:', locationStr);
    console.log('[Weather] 使用API Key:', QWEATHER_KEY.substring(0, 6) + '...');

    wx.request({
      url: QWEATHER_GEO_API,
      data: {
        location: locationStr,
        number: 1
      },
      header: {
        'X-QW-Api-Key': QWEATHER_KEY,
        'Accept': 'application/json'
      },
      success: (res) => {
        console.log('[Weather] 城市查询HTTP状态:', res.statusCode);
        console.log('[Weather] 城市查询响应:', res.data);

        if (res.statusCode === 200) {
          if (res.data && res.data.code === '200' && res.data.location && res.data.location.length > 0) {
            resolve({
              name: res.data.location[0].name,
              id: res.data.location[0].id
            });
          } else {
            reject(new Error('城市查询失败: ' + (res.data ? res.data.code : '无响应')));
          }
        } else if (res.statusCode === 404) {
          reject(new Error('API端点不存在，请检查和风天气API配置'));
        } else {
          reject(new Error('HTTP错误: ' + res.statusCode));
        }
      },
      fail: (err) => {
        console.error('[Weather] 城市查询请求失败:', err);
        reject(err);
      }
    });
  });
}

// 调用和风天气实时天气API
function getRealtimeWeather(locationId) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: QWEATHER_WEATHER_API,
      data: {
        location: locationId,
        lang: 'zh',
        unit: 'm'
      },
      header: {
        'X-QW-Api-Key': QWEATHER_KEY,
        'Accept': 'application/json'
      },
      success: (res) => {
        if (res.data && res.data.code === '200' && res.data.now) {
          resolve(res.data.now);
        } else {
          reject(new Error('天气查询失败'));
        }
      },
      fail: (err) => reject(err)
    });
  });
}

function getSeasonalWeather() {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const hour = now.getHours();

  const seasonData = [
    { maxAvg: 7,  minAvg: -3, icons: ['☁️','🌫️','☀️','❄️'], texts: ['阴天','薄雾','晴天','小雪'] },
    { maxAvg: 11, minAvg: 0,  icons: ['☁️','🌤️','☀️','🌧️'], texts: ['多云','少云','晴天','小雨'] },
    { maxAvg: 17, minAvg: 5,  icons: ['🌤️','☀️','🌧️','☁️'], texts: ['少云','晴天','小雨','多云'] },
    { maxAvg: 23, minAvg: 11, icons: ['☀️','🌤️','🌧️','⛅'], texts: ['晴天','少云','小雨','多云'] },
    { maxAvg: 28, minAvg: 16, icons: ['☀️','🌤️','⛈️','🌧️'], texts: ['晴天','少云','雷阵雨','小雨'] },
    { maxAvg: 32, minAvg: 21, icons: ['☀️','⛈️','🌤️','🌧️'], texts: ['晴天','雷阵雨','少云','小雨'] },
    { maxAvg: 34, minAvg: 24, icons: ['☀️','⛈️','🌤️','🌧️'], texts: ['晴天','雷阵雨','少云','阵雨'] },
    { maxAvg: 33, minAvg: 23, icons: ['☀️','⛈️','🌤️','🌧️'], texts: ['晴天','雷阵雨','少云','阵雨'] },
    { maxAvg: 28, minAvg: 17, icons: ['☀️','🌤️','☁️','🌧️'], texts: ['晴天','少云','多云','小雨'] },
    { maxAvg: 22, minAvg: 11, icons: ['🌤️','☀️','☁️','🌧️'], texts: ['少云','晴天','多云','小雨'] },
    { maxAvg: 15, minAvg: 4,  icons: ['☁️','🌤️','🌧️','🌫️'], texts: ['多云','少云','小雨','薄雾'] },
    { maxAvg: 9,  minAvg: -1, icons: ['☁️','🌫️','☀️','❄️'], texts: ['阴天','多云','晴天','小雪'] },
  ];

  const s = seasonData[month];
  const seed = (month * 37 + day * 13 + Math.floor(hour / 3)) % 4;
  const tempVariation = (seed - 1.5) * 2;

  const maxTemp = s.maxAvg + Math.round(tempVariation);
  const minTemp = s.minAvg + Math.round(tempVariation * 0.6);
  const midTemp = Math.round((maxTemp + minTemp) / 2);
  const temp = hour > 14 ? Math.round(maxTemp - (hour - 14) * 0.5) : hour > 10 ? maxTemp : midTemp;

  const clothing = getClothingAdvice(maxTemp);

  return {
    temp, maxTemp, minTemp,
    icon: s.icons[seed],
    text: s.texts[seed],
    clothing: clothing.text,
    clothingIcon: clothing.icon,
    location: ''
  };
}

function fetchWeather() {
  return new Promise((resolve) => {
    const cached = storage.getWeatherCache();
    console.log('[Weather] 检查缓存:', cached ? '有缓存' : '无缓存');
    if (cached && Date.now() - cached.time < 30 * 60 * 1000) {
      console.log('[Weather] 使用缓存数据，缓存时间:', new Date(cached.time).toLocaleString());
      // 缓存有效，但名字始终读最新值
      cached.data.myName = storage.getMyName() || '我';
      cached.data.partnerName = storage.getPartnerName() || 'TA';
      resolve(cached.data);
      return;
    }

    // 尝试获取实时天气
    fetchRealtimeWeather().then(data => {
      console.log('[Weather] 实时天气获取成功:', data);
      data.myName = storage.getMyName() || '我';
      data.partnerName = storage.getPartnerName() || 'TA';
      storage.setWeatherCache({ time: Date.now(), data });
      resolve(data);
    }).catch((err) => {
      console.error('[Weather] 实时天气获取失败，降级到本地模拟:', err);
      // 降级到本地模拟
      const data = getSeasonalWeather();
      data.myName = storage.getMyName() || '我';
      data.partnerName = storage.getPartnerName() || 'TA';
      data.location = '📍 和你在一起的地方';
      storage.setWeatherCache({ time: Date.now(), data });
      resolve(data);
    });
  });
}

// 获取实时天气（和风天气API）
async function fetchRealtimeWeather() {
  // 1. 获取位置
  const location = await getLocation();

  // 2. 获取城市信息
  const city = await getCityByLocation(location.latitude, location.longitude);

  // 3. 获取实时天气
  const now = await getRealtimeWeather(city.id);

  // 4. 组装返回数据
  const temp = parseInt(now.temp);
  const maxTemp = temp + 3;
  const minTemp = temp - 3;
  const clothing = getClothingAdvice(maxTemp);

  return {
    temp: temp,
    maxTemp: maxTemp,
    minTemp: minTemp,
    icon: mapQweatherIcon(now.icon),
    text: now.text,
    clothing: clothing.text,
    clothingIcon: clothing.icon,
    location: '📍 ' + city.name
  };
}

module.exports = { fetchWeather, getClothingAdvice };
