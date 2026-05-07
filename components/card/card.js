Component({
  options: {
    multipleSlots: true
  },
  properties: {
    title: { type: String, value: '' },
    moreText: { type: String, value: '' },
    shadow: { type: Boolean, value: true },
    customStyle: { type: String, value: '' },
    showHeader: { type: Boolean, value: true }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    },
    onMore() {
      this.triggerEvent('more');
    }
  }
});
