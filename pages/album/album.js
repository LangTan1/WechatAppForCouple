const storage = require('../../utils/storage');
const contentSecurity = require('../../utils/content-security');

Page({
  data: {
    view: 'albums',       // albums | photos
    albums: [],
    currentAlbum: { name: '', desc: '', photos: [] },
    previewPhoto: null,
    previewPhotoIndex: -1,
    previewScale: 1,
    previewTouchStartX: 0,
    commentText: '',
    // 弹窗
    showAlbumModal: false,
    albumForm: { name: '', desc: '' },
    showEditAlbumModal: false,
    showPhotoModal: false,
    photoForm: { url: '', desc: '' }
  },

  onLoad() { this.loadAlbums(); },
  async onShow() {
    await this.syncFromCloud();
    await this.loadAlbums();
    storage.updateLastView('album');
  },

  async loadAlbums() {
    const albums = storage.getAlbums();
    const displayAlbums = await this._decorateAlbumsForDisplay(albums);
    // 自动设置封面为第一张照片
    albums.forEach(a => {
      if (!a.cover && a.photos && a.photos.length > 0) {
        a.cover = a.photos[0].displayUrl || a.photos[0].url;
      }
    });
    this.setData({ albums: displayAlbums });
    if (this.data.view === 'photos' && this.data.currentAlbum && this.data.currentAlbum.id) {
      const currentAlbum = displayAlbums.find(a => a.id === this.data.currentAlbum.id);
      if (currentAlbum) {
        this.setData({ currentAlbum: { ...currentAlbum } });
      }
    }
  },

  // ========== 相册列表操作 ==========
  _isCloudFileID(value) {
    return typeof value === 'string' && value.indexOf('cloud://') === 0;
  },

  async _decorateAlbumsForDisplay(albums) {
    const baseAlbums = (Array.isArray(albums) ? albums : []).map((album) => ({
      ...album,
      photos: Array.isArray(album.photos) ? album.photos.map((photo) => ({ ...photo })) : []
    }));
    return baseAlbums.map((album) => {
      const nextAlbum = { ...album };
      const albumCover = nextAlbum.cover || '';
      nextAlbum.photos = (album.photos || []).map((photo) => {
        const nextPhoto = { ...photo };
        const localUrl = nextPhoto.displayUrl
          || nextPhoto.url
          || nextPhoto.fileID
          || '';
        nextPhoto.displayUrl = localUrl;
        nextPhoto.url = localUrl;
        return nextPhoto;
      });
      nextAlbum.displayCoverUrl = nextAlbum.photos.length > 0
        ? (nextAlbum.photos[0].displayUrl || nextAlbum.photos[0].url || albumCover)
        : albumCover;
      nextAlbum.cover = nextAlbum.displayCoverUrl || '';
      return nextAlbum;
    });
  },

  openAlbum(e) {
    const id = e.currentTarget.dataset.id;
    const album = this.data.albums.find(a => a.id === id);
    if (album) {
      this.setData({ view: 'photos', currentAlbum: { ...album } });
    }
  },

  backToAlbums() {
    this.loadAlbums();
    this.setData({ view: 'albums', currentAlbum: { name: '', desc: '', photos: [] } });
  },

  // 添加相册
  showAddAlbum() {
    this.setData({ showAlbumModal: true, albumForm: { name: '', desc: '' } });
  },
  hideAlbumModal() { this.setData({ showAlbumModal: false }); },
  onAlbumName(e) { this.setData({ 'albumForm.name': e.detail.value }); },
  onAlbumDesc(e) { this.setData({ 'albumForm.desc': e.detail.value }); },

  async createAlbum() {
    const { name, desc } = this.data.albumForm;
    if (!name.trim()) { wx.showToast({ title: '请输入相册名称～', icon: 'none' }); return; }
    const albums = storage.getAlbums();
    if (!(await contentSecurity.checkBeforePublish([name, desc]))) return;
    albums.push({
      id: Date.now(), name: name.trim(), desc: desc.trim(),
      cover: '', photos: []
    });
    await storage.setAlbums(albums);
    this.setData({ showAlbumModal: false });
    this.loadAlbums();
    wx.showToast({ title: '相册已创建 📸', icon: 'none' });
  },

  // 编辑/删除相册
  editAlbumDesc() {
    this.setData({ showEditAlbumModal: true });
  },
  hideEditAlbumModal() { this.setData({ showEditAlbumModal: false }); },
  onEditAlbumName(e) { this.setData({ 'currentAlbum.name': e.detail.value }); },
  onEditAlbumDesc(e) { this.setData({ 'currentAlbum.desc': e.detail.value }); },

  async saveAlbum() {
    const { currentAlbum } = this.data;
    if (!(await contentSecurity.checkBeforePublish([currentAlbum.name, currentAlbum.desc]))) return;
    let albums = storage.getAlbums();
    albums = albums.map(a => {
      if (a.id === currentAlbum.id) return { ...a, name: currentAlbum.name, desc: currentAlbum.desc };
      return a;
    });
    await storage.setAlbums(albums);
    this.setData({ showEditAlbumModal: false });
    this.loadAlbums();
    wx.showToast({ title: '已保存', icon: 'none' });
  },

  deleteAlbum() {
    wx.showModal({
      title: '删除相册', content: '确定要删除这个相册和里面的所有照片吗？',
      confirmColor: '#FF6B8A',
      success: async (res) => {
        if (res.confirm) {
          let albums = storage.getAlbums();
          albums = albums.filter(a => a.id !== this.data.currentAlbum.id);
          await storage.setAlbums(albums);
          this.setData({ showEditAlbumModal: false });
          this.backToAlbums();
          wx.showToast({ title: '相册已删除', icon: 'none' });
        }
      }
    });
  },

  // ========== 照片操作 ==========
  addPhotoToAlbum() {
    this.setData({ showPhotoModal: true, photoForm: { url: '', desc: '' } });
  },
  hidePhotoModal() { this.setData({ showPhotoModal: false }); },
  onPhotoDesc(e) { this.setData({ 'photoForm.desc': e.detail.value }); },

  choosePhoto() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'], sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ 'photoForm.url': res.tempFilePaths[0] });
      }
    });
  },

  async savePhoto() {
    const { url, desc } = this.data.photoForm;
    if (!url) { wx.showToast({ title: '请选择照片～', icon: 'none' }); return; }
    if (!(await contentSecurity.checkBeforePublish(desc))) return;

    wx.showLoading({ title: '上传中…' });

    // 上传到云存储
    const cloudPath = 'album/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.jpg';
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: url,
      success: async (uploadRes) => {
        const fileID = uploadRes.fileID;
        const photoId = Date.now();
        const mediaCheck = await contentSecurity.checkMediaBeforePublish(fileID, {
          docId: storage.getCoupleDocId(),
          albumId: this.data.currentAlbum.id,
          photoId: photoId,
          mediaType: 2
        });
        if (!mediaCheck.success) {
          wx.hideLoading();
          return;
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const newPhoto = {
          id: photoId, fileID: fileID, url: fileID, displayUrl: url,
          mediaCheckStatus: 'pending',
          mediaCheckTraceId: mediaCheck.traceId || '',
          desc: desc.trim() || '美好瞬间', date: dateStr
        };

        let albums = storage.getAlbums();
        albums = albums.map(a => {
          if (a.id === this.data.currentAlbum.id) {
            const photos = a.photos || [];
            return { ...a, cover: a.cover || fileID, photos: [newPhoto, ...photos] };
          }
          return a;
        });
        await storage.setAlbums(albums);

        this.setData({ showPhotoModal: false });
        const displayAlbums = await this._decorateAlbumsForDisplay(albums);
        const updated = displayAlbums.find(a => a.id === this.data.currentAlbum.id);
        if (updated) this.setData({ currentAlbum: { ...updated } });
        this.setData({ albums: displayAlbums });
        wx.hideLoading();
        wx.showToast({ title: '照片已保存 📸', icon: 'none' });
      },
      fail: (err) => {
        console.error('上传照片失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      }
    });
  },

  // 预览照片
  _buildPreviewPhoto(photo) {
    const sourcePhoto = photo || {};
    const displayUrl = sourcePhoto.displayUrl
      || sourcePhoto.url
      || sourcePhoto.fileID
      || '';
    return {
      ...sourcePhoto,
      url: displayUrl,
      displayUrl: displayUrl,
      comments: sourcePhoto.comments || []
    };
  },

  viewPhoto(e) {
    const photo = e.currentTarget.dataset.photo || {};
    const photos = this.data.currentAlbum.photos || [];
    let index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index) || index < 0) {
      index = photos.findIndex(item => item.id === photo.id);
    }
    this.setData({
      previewPhoto: this._buildPreviewPhoto(photo),
      previewPhotoIndex: index >= 0 ? index : 0,
      previewScale: 1,
      commentText: ''
    });
  },
  closePreview() {
    this.setData({ previewPhoto: null, previewPhotoIndex: -1, previewScale: 1, commentText: '' });
  },

  showPreviewPhotoAt(index) {
    const photos = this.data.currentAlbum.photos || [];
    if (photos.length === 0) {
      this.closePreview();
      return;
    }
    if (index < 0 || index >= photos.length) return;
    this.setData({
      previewPhoto: this._buildPreviewPhoto(photos[index]),
      previewPhotoIndex: index,
      previewScale: 1,
      commentText: ''
    });
  },

  showPrevPhoto() {
    this.showPreviewPhotoAt(this.data.previewPhotoIndex - 1);
  },

  showNextPhoto() {
    this.showPreviewPhotoAt(this.data.previewPhotoIndex + 1);
  },

  onPreviewTouchStart(e) {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    this.setData({ previewTouchStartX: touch.clientX });
  },

  onPreviewTouchEnd(e) {
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - this.data.previewTouchStartX;
    if (Math.abs(deltaX) < 60) return;
    if (deltaX < 0) this.showNextPhoto();
    else this.showPrevPhoto();
  },

  _photoMatchesCover(photo, cover) {
    if (!photo || !cover) return false;
    return photo.fileID === cover || photo.url === cover;
  },

  async _deletePhotoById(photoId) {
    const albumId = this.data.currentAlbum.id;
    const currentIndex = this.data.previewPhotoIndex;
    let albums = storage.getAlbums();
    let nextPreviewIndex = -1;
    let targetAlbum = null;
    let deletedPhoto = null;

    albums = albums.map(album => {
      if (album.id !== albumId) return album;
      const photos = album.photos || [];
      const deletedIndex = photos.findIndex(photo => photo.id === photoId);
      if (deletedIndex === -1) {
        targetAlbum = album;
        return album;
      }

      deletedPhoto = photos[deletedIndex];
      const nextPhotos = photos.filter(photo => photo.id !== photoId);
      let nextCover = album.cover || '';
      if (nextPhotos.length === 0) {
        nextCover = '';
      } else if (!nextCover || this._photoMatchesCover(deletedPhoto, nextCover)) {
        nextCover = nextPhotos[0].fileID || nextPhotos[0].url || '';
      }
      nextPreviewIndex = Math.min(currentIndex, nextPhotos.length - 1);
      targetAlbum = { ...album, cover: nextCover, photos: nextPhotos };
      return targetAlbum;
    });

    if (!deletedPhoto || !targetAlbum) return;

    await storage.setAlbums(albums);
    const displayAlbums = await this._decorateAlbumsForDisplay(albums);
    const displayAlbum = displayAlbums.find(album => album.id === albumId) || { ...targetAlbum };
    this.setData({
      albums: displayAlbums,
      currentAlbum: { ...displayAlbum }
    });

    if (!displayAlbum.photos || displayAlbum.photos.length === 0) {
      this.closePreview();
      return;
    }

    this.showPreviewPhotoAt(nextPreviewIndex);
  },

  deletePreviewPhoto() {
    const photo = this.data.previewPhoto;
    if (!photo) return Promise.resolve();

    return new Promise((resolve) => {
      wx.showModal({
        title: '删除照片',
        content: '确定要删除这张照片吗？相册会保留。',
        confirmColor: '#FF6B8A',
        success: async (res) => {
          if (res.confirm) {
            await this._deletePhotoById(photo.id);
            wx.showToast({ title: '照片已删除', icon: 'none' });
          }
          resolve();
        },
        fail: () => resolve()
      });
    });
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value });
  },

  async addComment() {
    const text = this.data.commentText.trim();
    if (!text) return;
    const photo = this.data.previewPhoto;
    if (!photo) return;
    if (!(await contentSecurity.checkBeforePublish(text))) return;

    const comment = {
      id: Date.now(),
      text: text,
      by: storage.getMyName() || '匿名',
      time: new Date().toLocaleString('zh-CN')
    };

    // 更新相册数据
    let albums = storage.getAlbums();
    let updated = false;
    albums = albums.map(a => {
      if (a.id === this.data.currentAlbum.id) {
        const photos = (a.photos || []).map(p => {
          if (p.id === photo.id) {
            const comments = p.comments || [];
            comments.push(comment);
            updated = true;
            return { ...p, comments };
          }
          return p;
        });
        return { ...a, photos };
      }
      return a;
    });
    if (updated) {
      await storage.setAlbums(albums);
      // 更新当前预览照片和相册
      const album = albums.find(a => a.id === this.data.currentAlbum.id);
      const updatedPhoto = album.photos.find(p => p.id === photo.id);
      this.setData({
        previewPhoto: updatedPhoto,
        commentText: '',
        currentAlbum: { ...album }
      });
    }
  },

  noop() {},

  async syncFromCloud() {
    try { await storage.loadFromCloud(); } catch (e) { console.error('[album] loadFromCloud failed:', e); }
    await this.loadAlbums();
  }
});
