const storage = require('../../utils/storage');
const weather = require('../../utils/weather');

Page({
  data: {
    weatherModeLabel: '',
    weatherLocationLabel: '',
    weatherUpdatedAtLabel: '',
    manualRegion: ['北京市', '北京市', '朝阳区']
  },

  onLoad() {
    this.refreshData();
  },

  onShow() {
    this.syncFromCloud();
  },

  async syncFromCloud() {
    try {
      await storage.loadFromCloud();
    } catch (e) {
      console.error('[weather-settings] loadFromCloud failed:', e);
    }
    this.refreshData();
  },

  refreshData() {
    const myWeatherProfile = storage.getMyWeatherProfile();
    const manualRegion = myWeatherProfile
      ? [
          myWeatherProfile.province || '北京市',
          myWeatherProfile.city || myWeatherProfile.province || '北京市',
          myWeatherProfile.district || myWeatherProfile.city || '朝阳区'
        ]
      : this.data.manualRegion;

    this.setData({
      weatherModeLabel: !myWeatherProfile ? '未设置' : (myWeatherProfile.mode === 'manual' ? '手动位置' : '自动定位'),
      weatherLocationLabel: myWeatherProfile && myWeatherProfile.displayName ? myWeatherProfile.displayName : '暂未设置',
      weatherUpdatedAtLabel: myWeatherProfile && myWeatherProfile.updatedAt
        ? new Date(myWeatherProfile.updatedAt).toLocaleString('zh-CN')
        : '暂无记录',
      manualRegion
    });
  },

  async useCurrentWeatherLocation() {
    wx.showLoading({ title: '更新天气中...' });
    try {
      const result = await Promise.race([
        weather.refreshMyWeather({ forceAuto: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      wx.hideLoading();
      this.refreshData();
      wx.showToast({ title: '已更新当前位置', icon: 'none' });
    } catch (error) {
      wx.hideLoading();
      var msg = '定位失败，请检查授权';
      if (error && error.message === 'timeout') msg = '定位超时，请稍后重试';
      else if (error && error.message) msg = '错误: ' + error.message;
      else if (error) msg = '错误: ' + JSON.stringify(error);
      wx.showModal({ title: '天气更新失败', content: msg, showCancel: false });
    }
  },

  async onManualRegionChange(e) {
    const region = e.detail.value;
    this.setData({ manualRegion: region });
    wx.showLoading({ title: '保存位置中...' });
    try {
      await Promise.race([
        weather.saveManualWeatherLocation({
          province: region[0],
          city: region[1],
          district: region[2]
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      this.refreshData();
      wx.showToast({ title: '手动位置已更新', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error && error.message === 'timeout' ? '请求超时，请稍后重试' : '位置解析失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
