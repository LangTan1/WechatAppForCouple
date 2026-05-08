const storage = require('../../utils/storage');

Page({
  data: {
    view: 'albums',       // albums | photos
    albums: [],
    currentAlbum: { name: '', desc: '', photos: [] },
    previewPhoto: null,
    // 弹窗
    showAlbumModal: false,
    albumForm: { name: '', desc: '' },
    showEditAlbumModal: false,
    showPhotoModal: false,
    photoForm: { url: '', desc: '' }
  },

  onLoad() { this.loadAlbums(); },
  onShow() { this.loadAlbums(); this.syncFromCloud(); },

  loadAlbums() {
    const albums = storage.getAlbums();
    // 自动设置封面为第一张照片
    albums.forEach(a => {
      if (!a.cover && a.photos && a.photos.length > 0) {
        a.cover = a.photos[0].url;
      }
    });
    this.setData({ albums });
  },

  // ========== 相册列表操作 ==========
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

  createAlbum() {
    const { name, desc } = this.data.albumForm;
    if (!name.trim()) { wx.showToast({ title: '请输入相册名称～', icon: 'none' }); return; }
    const albums = storage.getAlbums();
    albums.push({
      id: Date.now(), name: name.trim(), desc: desc.trim(),
      cover: '', photos: []
    });
    storage.setAlbums(albums);
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

  saveAlbum() {
    const { currentAlbum } = this.data;
    let albums = storage.getAlbums();
    albums = albums.map(a => {
      if (a.id === currentAlbum.id) return { ...a, name: currentAlbum.name, desc: currentAlbum.desc };
      return a;
    });
    storage.setAlbums(albums);
    this.setData({ showEditAlbumModal: false });
    this.loadAlbums();
    wx.showToast({ title: '已保存', icon: 'none' });
  },

  deleteAlbum() {
    wx.showModal({
      title: '删除相册', content: '确定要删除这个相册和里面的所有照片吗？',
      confirmColor: '#FF6B8A',
      success: (res) => {
        if (res.confirm) {
          let albums = storage.getAlbums();
          albums = albums.filter(a => a.id !== this.data.currentAlbum.id);
          storage.setAlbums(albums);
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

  savePhoto() {
    const { url, desc } = this.data.photoForm;
    if (!url) { wx.showToast({ title: '请选择照片～', icon: 'none' }); return; }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const newPhoto = {
      id: Date.now(), url, desc: desc.trim() || '美好瞬间', date: dateStr
    };

    let albums = storage.getAlbums();
    albums = albums.map(a => {
      if (a.id === this.data.currentAlbum.id) {
        const photos = a.photos || [];
        return { ...a, cover: a.cover || url, photos: [newPhoto, ...photos] };
      }
      return a;
    });
    storage.setAlbums(albums);

    this.setData({ showPhotoModal: false });
    // 刷新当前相册
    const updated = albums.find(a => a.id === this.data.currentAlbum.id);
    if (updated) this.setData({ currentAlbum: { ...updated } });
    wx.showToast({ title: '照片已保存 📸', icon: 'none' });
  },

  // 预览照片
  viewPhoto(e) {
    this.setData({ previewPhoto: e.currentTarget.dataset.photo });
  },
  closePreview() {
    this.setData({ previewPhoto: null });
  },

  noop() {},

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.loadAlbums();
  }
});
