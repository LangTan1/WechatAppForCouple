const assert = require('node:assert/strict');

function createWx(options) {
  const config = options || {};
  const store = {};
  const saveFieldCalls = [];

  return {
    store,
    saveFieldCalls,
    wx: {
      getStorageSync(key) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : '';
      },
      setStorageSync(key, value) {
        store[key] = value;
      },
      removeStorageSync(key) {
        delete store[key];
      },
      clearStorageSync() {
        Object.keys(store).forEach((key) => delete store[key]);
      },
      getFuzzyLocation(payload) {
        if (config.fuzzyLocationError) {
          payload.fail(config.fuzzyLocationError);
          return;
        }
        payload.success(config.fuzzyLocation || { latitude: 30.25, longitude: 120.13 });
      },
      getLocation(payload) {
        if (config.locationError) {
          payload.fail(config.locationError);
          return;
        }
        payload.success(config.location || { latitude: 30.25, longitude: 120.13 });
      },
      request(payload) {
        try {
          const result = config.requestHandler ? config.requestHandler(payload) : null;
          if (!result || result.type === 'success') {
            payload.success((result && result.value) || { statusCode: 200, data: { code: '200' } });
            return;
          }
          payload.fail(result.error || new Error('request failed'));
        } catch (error) {
          payload.fail(error);
        }
      },
      cloud: {
        callFunction({ data }) {
          if (data.action === 'saveField') {
            saveFieldCalls.push(data);
          }
          return Promise.resolve({ result: { success: true } });
        },
        getTempFileURL({ success }) {
          success({ fileList: [] });
        }
      }
    }
  };
}

function loadModules(runtime) {
  global.wx = runtime.wx;
  delete require.cache[require.resolve('./storage.js')];
  delete require.cache[require.resolve('./weather.js')];
  const storage = require('./storage.js');
  const weather = require('./weather.js');
  storage.setCurrentRole('dev');
  runtime.wx.setStorageSync('couple_doc_id', 'doc-1');
  return { storage, weather };
}

(async function run() {
  {
    const runtime = createWx({});
    const { storage, weather } = loadModules(runtime);

    storage.setMyName('阿明');
    storage.setPartnerName('小雨');
    storage.setMyWeatherSnapshot({
      temp: 26,
      minTemp: 23,
      maxTemp: 29,
      text: '多云',
      icon: '⛅',
      clothing: '短袖就好',
      clothingIcon: '👕',
      location: '杭州市 西湖区',
      source: 'auto',
      updatedAt: 1710000000000
    });
    storage.setPartnerWeatherSnapshot({
      temp: 22,
      minTemp: 20,
      maxTemp: 24,
      text: '小雨',
      icon: '🌧️',
      clothing: '带伞',
      clothingIcon: '☂️',
      location: '上海市 浦东新区',
      source: 'manual',
      updatedAt: 1710000001000
    });

    const data = weather.getWeatherDisplayData();
    assert.equal(data.mine.name, '阿明');
    assert.equal(data.mine.location, '杭州市 西湖区');
    assert.equal(data.partner.name, '小雨');
    assert.equal(data.partner.location, '上海市 浦东新区');
  }

  {
    const runtime = createWx({
      fuzzyLocationError: new Error('denied'),
      requestHandler(payload) {
        if (payload.url.indexOf('/v7/weather/now') !== -1) {
          return {
            type: 'success',
            value: {
              statusCode: 200,
              data: {
                code: '200',
                now: { temp: '22', text: '小雨', icon: '305' }
              }
            }
          };
        }
        throw new Error('unexpected request: ' + payload.url);
      }
    });
    const { storage, weather } = loadModules(runtime);
    storage.setMyWeatherProfile({
      mode: 'manual',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      locationId: '101020600',
      displayName: '上海市 浦东新区',
      updatedAt: 1710000000000
    });

    const result = await weather.refreshMyWeather();
    assert.equal(result.snapshot.source, 'manual');
    assert.equal(storage.getMyWeatherSnapshot().location, '上海市 浦东新区');
  }

  {
    const runtime = createWx({
      fuzzyLocationError: new Error('denied')
    });
    const { storage, weather } = loadModules(runtime);

    const result = await weather.refreshMyWeather();
    assert.equal(result.snapshot.source, 'fallback');
    assert.equal(storage.getMyWeatherSnapshot().source, 'fallback');
  }

  {
    const runtime = createWx({
      requestHandler(payload) {
        if (payload.url.indexOf('/geo/v2/city/lookup') !== -1) {
          return {
            type: 'success',
            value: {
              statusCode: 200,
              data: {
                code: '200',
                location: [
                  {
                    id: '101210106',
                    name: '西湖区',
                    adm1: '浙江省',
                    adm2: '杭州市'
                  }
                ]
              }
            }
          };
        }
        if (payload.url.indexOf('/v7/weather/now') !== -1) {
          return {
            type: 'success',
            value: {
              statusCode: 200,
              data: {
                code: '200',
                now: { temp: '26', text: '多云', icon: '101' }
              }
            }
          };
        }
        throw new Error('unexpected request: ' + payload.url);
      }
    });
    const { storage, weather } = loadModules(runtime);

    const result = await weather.saveManualWeatherLocation({
      province: '浙江省',
      city: '杭州市',
      district: '西湖区'
    });

    assert.equal(result.profile.mode, 'manual');
    assert.equal(storage.getMyWeatherProfile().locationId, '101210106');
    assert.equal(storage.getMyWeatherSnapshot().location, '杭州市 西湖区');
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
