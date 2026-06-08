const assert = require('node:assert/strict');

function createWx(cloudData) {
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
      cloud: {
        callFunction(options) {
          const data = options.data || {};
          if (data.action === 'loadCouple') {
            return Promise.resolve({
              result: { success: true, data: cloudData }
            });
          }
          if (data.action === 'resolveFileURLs') {
            const result = {
              success: true,
              fileList: (data.fileIDs || []).map((fileID) => ({
                fileID,
                status: 0,
                tempFileURL: `https://temp.example.com/${encodeURIComponent(fileID)}`
              }))
            };
            if (typeof options.success === 'function') {
              options.success({ result });
            }
            return Promise.resolve({ result });
          }
          if (data.action === 'saveField') {
            saveFieldCalls.push(data);
            return Promise.resolve({
              result: { success: true }
            });
          }
          return Promise.resolve({
            result: { success: true }
          });
        },
        getTempFileURL({ fileList, success }) {
          success({
            fileList: fileList.map((fileID) => ({
              fileID,
              status: 0,
              tempFileURL: `https://temp.example.com/${encodeURIComponent(fileID)}`
            }))
          });
        }
      }
    }
  };
}

async function loadStorage(cloudData) {
  const runtime = createWx(cloudData);
  global.wx = runtime.wx;
  delete require.cache[require.resolve('./storage.js')];
  const storage = require('./storage.js');
  runtime.wx.setStorageSync('couple_doc_id', 'doc-1');
  storage.setCurrentRole('dev');
  await storage.loadFromCloud();
  return { storage, runtime };
}

async function flushQueuedSaves() {
  await Promise.resolve();
  await Promise.resolve();
}

(async function run() {
  {
    const cloudData = {
      devAvatar: 'cloud://avatars/dev-avatar.png',
      userAvatar: 'cloud://avatars/user-avatar.png',
      albums: [
        {
          id: 1,
          name: '默认相册',
          desc: '',
          cover: 'cloud://album/photo-1.jpg',
          photos: [
            {
              id: 101,
              fileID: 'cloud://album/photo-1.jpg',
              url: 'cloud://album/photo-1.jpg',
              desc: 'first photo'
            }
          ]
        }
      ]
    };

    const { storage, runtime } = await loadStorage(cloudData);

    assert.equal(
      runtime.store.my_avatar,
      'cloud://avatars/dev-avatar.png',
      '头像原始存储应保留 cloud fileID，而不是被临时 URL 覆盖'
    );
    assert.equal(
      runtime.store.custom_album[0].cover,
      'cloud://album/photo-1.jpg',
      '相册封面原始存储应保留 cloud fileID'
    );
    assert.equal(
      runtime.store.custom_album[0].photos[0].url,
      'cloud://album/photo-1.jpg',
      '相册照片原始存储应保留 cloud fileID'
    );

    assert.match(
      storage.getMyAvatar(),
      /^https:\/\/temp\.example\.com\//,
      '头像展示值应使用临时 URL'
    );
    assert.match(
      storage.getAlbums()[0].cover,
      /^https:\/\/temp\.example\.com\//,
      '相册封面展示值应使用临时 URL'
    );
    assert.match(
      storage.getAlbums()[0].photos[0].url,
      /^https:\/\/temp\.example\.com\//,
      '相册照片展示值应使用临时 URL'
    );
  }

  {
    const cloudData = {
      albums: [
        {
          id: 1,
          name: '默认相册',
          desc: '',
          cover: 'cloud://album/photo-1.jpg',
          photos: [
            {
              id: 101,
              fileID: 'cloud://album/photo-1.jpg',
              url: 'cloud://album/photo-1.jpg',
              desc: 'first photo'
            }
          ]
        }
      ]
    };

    const { storage, runtime } = await loadStorage(cloudData);
    await storage.setAlbums(storage.getAlbums());

    assert.equal(runtime.saveFieldCalls.length > 0, true, '保存相册时应触发云同步');
    assert.deepEqual(runtime.saveFieldCalls[0].value, [
      {
        id: 1,
        name: '默认相册',
        desc: '',
        cover: 'cloud://album/photo-1.jpg',
        photos: [
          {
            id: 101,
            fileID: 'cloud://album/photo-1.jpg',
            url: 'cloud://album/photo-1.jpg',
            desc: 'first photo'
          }
        ]
      }
    ], '写回云端的相册数据应保持 canonical fileID，不能把临时 URL 回传');
  }

  {
    const cloudData = {
      devAvatar: 'cloud://avatars/dev-avatar.png'
    };

    const { storage, runtime } = await loadStorage(cloudData);
    const displayAvatar = storage.getMyAvatar();
    storage.setMyAvatar(displayAvatar);

    assert.equal(
      runtime.store.my_avatar,
      'cloud://avatars/dev-avatar.png',
      '头像 setter 接收到展示 URL 时，也应继续保留 canonical fileID'
    );
    assert.equal(
      runtime.saveFieldCalls[runtime.saveFieldCalls.length - 1].value,
      'cloud://avatars/dev-avatar.png',
      '头像写回云端时应继续使用 canonical fileID'
    );
  }

  {
    const cloudData = {};
    const { storage, runtime } = await loadStorage(cloudData);

    await storage.setMyWeatherProfile({
      mode: 'auto',
      city: '杭州市',
      district: '西湖区'
    });

    await storage.setPartnerWeatherSnapshot({
      temp: 22,
      location: '上海市 浦东新区',
      source: 'manual',
      updatedAt: 1710000000000
    });

    assert.equal(runtime.saveFieldCalls[0].cloudField, 'devWeatherProfile');
    assert.equal(runtime.saveFieldCalls[1].cloudField, 'userWeatherSnapshot');
  }

  {
    const pendingSaves = [];
    let cloudAlbums = null;
    const runtime = createWx({});
    runtime.wx.cloud.callFunction = function({ data }) {
      if (data.action === 'loadCouple') {
        return Promise.resolve({ result: { success: true, data: {} } });
      }
      if (data.action === 'saveField') {
        return new Promise((resolve) => {
          pendingSaves.push({
            value: data.value,
            resolve() {
              cloudAlbums = data.value;
              resolve({ result: { success: true } });
            }
          });
        });
      }
      return Promise.resolve({ result: { success: true } });
    };

    global.wx = runtime.wx;
    delete require.cache[require.resolve('./storage.js')];
    const storage = require('./storage.js');
    runtime.wx.setStorageSync('couple_doc_id', 'doc-1');
    storage.setCurrentRole('dev');

    const firstSave = storage.setAlbums([{ id: 1, name: 'A', desc: '', cover: '', photos: [] }]);
    const secondSave = storage.setAlbums([{
      id: 1,
      name: 'A',
      desc: '',
      cover: 'cloud://album/photo.jpg',
      photos: [{ id: 101, fileID: 'cloud://album/photo.jpg', url: 'cloud://album/photo.jpg' }]
    }]);

    await flushQueuedSaves();
    assert.equal(pendingSaves.length, 1, '相册云同步应按顺序排队，不应并发发出旧版空相册保存');

    pendingSaves[0].resolve();
    await firstSave;
    assert.equal(cloudAlbums[0].photos.length, 0, '第一轮空相册保存完成后，才应继续最新的照片保存');

    await flushQueuedSaves();
    assert.equal(pendingSaves.length, 2, '第一轮保存完成后，才应发出第二轮最新保存');

    pendingSaves[1].resolve();
    await secondSave;
    assert.equal(cloudAlbums[0].photos.length, 1, '最终云端应保留带照片的最新数据');
  }

  {
    const runtime = createWx({ albums: [] });
    let shouldFailSave = true;
    runtime.wx.cloud.callFunction = function({ data }) {
      if (data.action === 'loadCouple') {
        return Promise.resolve({
          result: { success: true, data: { albums: [] } }
        });
      }
      if (data.action === 'saveField') {
        if (shouldFailSave) return Promise.reject(new Error('timeout'));
        return Promise.resolve({ result: { success: true } });
      }
      return Promise.resolve({ result: { success: true, data: {} } });
    };

    global.wx = runtime.wx;
    delete require.cache[require.resolve('./storage.js')];
    const storage = require('./storage.js');
    runtime.wx.setStorageSync('couple_doc_id', 'doc-1');
    storage.setCurrentRole('dev');

    const success = await storage.setAlbums([{ id: 1, name: 'A', desc: '', cover: '', photos: [{ id: 101 }] }]);
    assert.equal(success, true, '云同步超时时，相册仍应完成本地保存');

    await storage.loadFromCloud();
    assert.equal(storage.getAlbums()[0].photos.length, 1, '有本地待同步相册时，云端旧相册不应覆盖本地照片');

    shouldFailSave = false;
    await storage.setAlbums(storage.getAlbums());
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
