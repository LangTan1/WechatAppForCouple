const storage = require('../../utils/storage');

Page({
  data: {
    togetherDate: '',
    togetherDateStr: '',
    togetherDays: 0,
    anniversaries: [],
    // 弹窗
    showModal: false,
    showDatePicker: false,
    editingId: null,
    formTitle: '',
    formIcon: '',
    formDate: '',
    formType: 'annual'
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const togetherDate = storage.getTogetherDate();
    const togetherDays = storage.getTogetherDays();
    const d = new Date(togetherDate);
    const togetherDateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const anniversaries = storage.getAnniversaries().map(a => {
      const ad = new Date(a.date);
      const thisYear = new Date(ad);
      thisYear.setFullYear(today.getFullYear());
      const daysLeft = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const displayDate = `${ad.getFullYear()}年${ad.getMonth() + 1}月${ad.getDate()}日`;
      return { ...a, displayDate, daysLeft };
    });

    anniversaries.sort((a, b) => {
      if (a.daysLeft < 0 && b.daysLeft >= 0) return 1;
      if (b.daysLeft < 0 && a.daysLeft >= 0) return -1;
      return Math.abs(a.daysLeft) - Math.abs(b.daysLeft);
    });

    this.setData({
      togetherDate, togetherDateStr, togetherDays, anniversaries
    });
  },

  // ========== 在一起日期 ==========
  editTogetherDate() {
    this.setData({ showDatePicker: true });
  },

  hideDatePicker() {
    this.setData({ showDatePicker: false });
  },

  onTogetherDateChange(e) {
    this.setData({ togetherDate: e.detail.value });
  },

  saveTogetherDate() {
    storage.setTogetherDate(this.data.togetherDate);
    this.setData({ showDatePicker: false });
    wx.showToast({ title: '日期已更新 💕', icon: 'none' });
    this.loadData();
  },

  // ========== 纪念日 CRUD ==========
  showAdd() {
    this.setData({
      showModal: true,
      editingId: null,
      formTitle: '',
      formIcon: '',
      formDate: '',
      formType: 'annual'
    });
  },

  editAnniversary(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showModal: true,
      editingId: item.id,
      formTitle: item.title,
      formIcon: item.icon || '',
      formDate: item.date,
      formType: item.type || 'annual'
    });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onFormTitle(e) { this.setData({ formTitle: e.detail.value }); },
  onFormIcon(e) { this.setData({ formIcon: e.detail.value }); },
  onFormDate(e) { this.setData({ formDate: e.detail.value }); },
  onFormType(e) {
    this.setData({ formType: e.detail.value === '0' ? 'annual' : 'once' });
  },

  saveAnniversary() {
    const { editingId, formTitle, formIcon, formDate, formType } = this.data;
    if (!formTitle.trim()) {
      wx.showToast({ title: '请输入名称～', icon: 'none' });
      return;
    }
    if (!formDate) {
      wx.showToast({ title: '请选择日期～', icon: 'none' });
      return;
    }

    let anniversaries = storage.getAnniversaries();

    if (editingId) {
      anniversaries = anniversaries.map(a => {
        if (a.id === editingId) {
          return { ...a, title: formTitle.trim(), icon: formIcon || '💝', date: formDate, type: formType };
        }
        return a;
      });
    } else {
      const newItem = {
        id: Date.now(),
        title: formTitle.trim(),
        icon: formIcon || '💝',
        date: formDate,
        type: formType
      };
      anniversaries.push(newItem);
    }

    storage.setAnniversaries(anniversaries);
    this.setData({ showModal: false });
    wx.showToast({ title: editingId ? '已更新' : '已添加', icon: 'none' });
    this.loadData();
  },

  deleteAnniversary(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除纪念日',
      content: '确定要删除这个纪念日吗？',
      success: (res) => {
        if (res.confirm) {
          let anniversaries = storage.getAnniversaries();
          anniversaries = anniversaries.filter(a => a.id !== id);
          storage.setAnniversaries(anniversaries);
          this.loadData();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  noop() {}
});
