const assert = require('node:assert/strict');
const path = require('node:path');

const albumPath = path.resolve(__dirname, 'album.js');
const storagePath = path.resolve(__dirname, '../../utils/storage.js');
const contentSecurityPath = path.resolve(__dirname, '../../utils/content-security.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createPageWithAlbums(initialAlbums, options = {}) {
  const runtime = {
    albums: clone(initialAlbums),
    modalCalls: [],
    toastCalls: [],
    saveAlbumsSuccess: options.saveAlbumsSuccess !== false
  };

  const storageStub = {
    getAlbums() { return clone(runtime.albums); },
    setAlbums(nextAlbums) {
      runtime.albums = clone(nextAlbums);
      return Promise.resolve(runtime.saveAlbumsSuccess);
    },
    getMyName() { return '测试用户'; },
    getCoupleDocId() { return 'doc-1'; },
    updateLastView() {},
    loadFromCloud: async () => {}
  };
  const contentSecurityStub = {
    checkBeforePublish: async () => true,
    checkMediaBeforePublish: async () => ({ success: true, traceId: 'trace-1' })
  };

  global.wx = {
    showModal(options) {
      runtime.modalCalls.push(options);
      if (options && typeof options.success === 'function') {
        options.success({ confirm: true });
      }
    },
    showToast(options) {
      runtime.toastCalls.push(options);
    },
    showLoading() {},
    hideLoading() {},
    chooseImage() {},
    cloud: {
      uploadFile() {}
    }
  };

  let capturedPage = null;
  global.Page = function Page(definition) {
    capturedPage = definition;
  };

  delete require.cache[albumPath];
  require.cache[storagePath] = {
    id: storagePath,
    filename: storagePath,
    loaded: true,
    exports: storageStub
  };
  require.cache[contentSecurityPath] = {
    id: contentSecurityPath,
    filename: contentSecurityPath,
    loaded: true,
    exports: contentSecurityStub
  };
  require(albumPath);

  const page = Object.assign({}, capturedPage);
  page.data = clone(capturedPage.data);
  page.setData = function setData(patch) {
    Object.keys(patch).forEach((key) => {
      const parts = key.split('.');
      let target = this.data;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!target[part]) target[part] = {};
        target = target[part];
      }
      target[parts[parts.length - 1]] = patch[key];
    });
  };

  page.setData({
    albums: clone(initialAlbums),
    currentAlbum: clone(initialAlbums[0]),
    view: 'photos'
  });

  return { page, runtime };
}

function eventForPhoto(photo, index) {
  return {
    currentTarget: {
      dataset: { photo, index }
    }
  };
}

async function testPreviewNavigationUsesCurrentAlbumIndex() {
  const albums = [{
    id: 1,
    name: '测试相册',
    desc: '',
    cover: 'cloud://env/a.jpg',
    photos: [
      { id: 101, fileID: 'cloud://env/a.jpg', url: 'cloud://env/a.jpg', displayUrl: 'https://img/a.jpg', desc: '第一张', date: '2026-05-01' },
      { id: 102, fileID: 'cloud://env/b.jpg', url: 'cloud://env/b.jpg', displayUrl: 'https://img/b.jpg', desc: '第二张', date: '2026-05-02' },
      { id: 103, fileID: 'cloud://env/c.jpg', url: 'cloud://env/c.jpg', displayUrl: 'https://img/c.jpg', desc: '第三张', date: '2026-05-03' }
    ]
  }];
  const { page } = createPageWithAlbums(albums);

  page.viewPhoto(eventForPhoto(albums[0].photos[1], 1));

  assert.equal(page.data.previewPhotoIndex, 1);
  assert.equal(page.data.previewPhoto.id, 102);
  assert.equal(page.data.previewPhoto.displayUrl, 'https://img/b.jpg');

  page.showNextPhoto();
  assert.equal(page.data.previewPhotoIndex, 2);
  assert.equal(page.data.previewPhoto.id, 103);

  page.showPrevPhoto();
  assert.equal(page.data.previewPhotoIndex, 1);
  assert.equal(page.data.previewPhoto.id, 102);

  page.onPreviewTouchStart({ touches: [{ clientX: 300 }] });
  page.onPreviewTouchEnd({ changedTouches: [{ clientX: 120 }] });
  assert.equal(page.data.previewPhotoIndex, 2);
  assert.equal(page.data.previewPhoto.id, 103);

  page.onPreviewTouchStart({ touches: [{ clientX: 120 }] });
  page.onPreviewTouchEnd({ changedTouches: [{ clientX: 300 }] });
  assert.equal(page.data.previewPhotoIndex, 1);
  assert.equal(page.data.previewPhoto.id, 102);
}

async function testDeleteMiddlePhotoKeepsAlbumAndShowsNeighbor() {
  const albums = [{
    id: 1,
    name: '测试相册',
    desc: '',
    cover: 'cloud://env/a.jpg',
    photos: [
      { id: 101, fileID: 'cloud://env/a.jpg', url: 'cloud://env/a.jpg', desc: '第一张', date: '2026-05-01' },
      { id: 102, fileID: 'cloud://env/b.jpg', url: 'cloud://env/b.jpg', desc: '第二张', date: '2026-05-02' },
      { id: 103, fileID: 'cloud://env/c.jpg', url: 'cloud://env/c.jpg', desc: '第三张', date: '2026-05-03' }
    ]
  }];
  const { page, runtime } = createPageWithAlbums(albums);

  page.viewPhoto(eventForPhoto(albums[0].photos[1], 1));
  await page.deletePreviewPhoto();

  assert.deepEqual(runtime.albums[0].photos.map((photo) => photo.id), [101, 103]);
  assert.equal(page.data.currentAlbum.photos.length, 2);
  assert.equal(page.data.previewPhoto.id, 103);
  assert.equal(page.data.previewPhotoIndex, 1);
}

async function testDeleteOnlyPhotoKeepsEmptyAlbumAndClosesPreview() {
  const albums = [{
    id: 1,
    name: '测试相册',
    desc: '',
    cover: 'cloud://env/a.jpg',
    photos: [
      { id: 101, fileID: 'cloud://env/a.jpg', url: 'cloud://env/a.jpg', desc: '唯一照片', date: '2026-05-01' }
    ]
  }];
  const { page, runtime } = createPageWithAlbums(albums);

  page.viewPhoto(eventForPhoto(albums[0].photos[0], 0));
  await page.deletePreviewPhoto();

  assert.equal(runtime.albums.length, 1);
  assert.equal(runtime.albums[0].photos.length, 0);
  assert.equal(runtime.albums[0].cover, '');
  assert.equal(page.data.currentAlbum.photos.length, 0);
  assert.equal(page.data.previewPhoto, null);
  assert.equal(page.data.previewPhotoIndex, -1);
}

async function testCreateAlbumContinuesWhenCloudSaveFails() {
  const albums = [{ id: 1, name: '已有相册', desc: '', cover: '', photos: [] }];
  const { page, runtime } = createPageWithAlbums(albums, { saveAlbumsSuccess: false });

  page.setData({
    albumForm: { name: '新相册', desc: '' },
    showAlbumModal: true
  });

  await page.createAlbum();

  assert.equal(page.data.showAlbumModal, false);
  assert.equal(runtime.albums.length, 2);
  assert.equal(runtime.toastCalls.some((call) => String(call.title).includes('已创建')), true);
}

async function testCloudFileIdRemainsDisplayableWithoutTempUrl() {
  const albums = [{
    id: 1,
    name: '云相册',
    desc: '',
    cover: 'cloud://env/photo.jpg',
    photos: [
      { id: 101, fileID: 'cloud://env/photo.jpg', url: 'cloud://env/photo.jpg', desc: '云照片' }
    ]
  }];
  const { page } = createPageWithAlbums(albums);

  await page.loadAlbums();

  assert.equal(page.data.albums[0].displayCoverUrl, 'cloud://env/photo.jpg');
  assert.equal(page.data.currentAlbum.photos[0].displayUrl, 'cloud://env/photo.jpg');

  page.viewPhoto(eventForPhoto(page.data.currentAlbum.photos[0], 0));
  assert.equal(page.data.previewPhoto.displayUrl, 'cloud://env/photo.jpg');
}

async function run() {
  await testPreviewNavigationUsesCurrentAlbumIndex();
  await testDeleteMiddlePhotoKeepsAlbumAndShowsNeighbor();
  await testDeleteOnlyPhotoKeepsEmptyAlbumAndClosesPreview();
  await testCreateAlbumContinuesWhenCloudSaveFails();
  await testCloudFileIdRemainsDisplayableWithoutTempUrl();
  console.log('album review tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
