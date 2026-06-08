const CONTENT_SECURITY_REJECTED_CODE = 'CONTENT_SECURITY_REJECTED';
const CONTENT_SECURITY_REJECTED_ERROR = 'content security rejected';
const VIOLATION_MESSAGE = '内容含违规信息';
const CHECK_FAILED_MESSAGE = '内容审核失败，请稍后再试';

function normalizeContentList(content) {
  const list = [];
  const seen = {};

  function add(value) {
    if (typeof value !== 'string') return;
    const text = value.trim();
    if (!text || seen[text]) return;
    seen[text] = true;
    list.push(text);
  }

  function walk(value) {
    if (typeof value === 'string') {
      add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function(key) {
        walk(value[key]);
      });
    }
  }

  walk(content);
  return list;
}

function isRejected(result) {
  if (!result) return false;
  return result.code === CONTENT_SECURITY_REJECTED_CODE
    || result.error === CONTENT_SECURITY_REJECTED_ERROR
    || result.message === CONTENT_SECURITY_REJECTED_ERROR;
}

function showToast(title) {
  if (typeof wx !== 'undefined' && wx.showToast) {
    wx.showToast({ title: title, icon: 'none' });
  }
}

async function checkBeforePublish(content) {
  const contentList = normalizeContentList(content);
  if (contentList.length === 0) return true;

  try {
    const res = await wx.cloud.callFunction({
      name: 'coupleOps',
      data: {
        action: 'securityCheckText',
        contentList: contentList
      }
    });
    const result = res && res.result ? res.result : {};
    if (result.success) return true;
    console.error('[content-security] text check rejected or failed:', result);
    showToast(isRejected(result) ? VIOLATION_MESSAGE : CHECK_FAILED_MESSAGE);
    return false;
  } catch (e) {
    console.error('[content-security] text check call failed:', e);
    showToast(isRejected(e) ? VIOLATION_MESSAGE : CHECK_FAILED_MESSAGE);
    return false;
  }
}

async function checkMediaBeforePublish(fileID, context) {
  const options = context || {};
  if (!fileID) {
    showToast(CHECK_FAILED_MESSAGE);
    return { success: false };
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'coupleOps',
      data: {
        action: 'securityCheckMedia',
        docId: options.docId,
        fileID: fileID,
        mediaType: options.mediaType || 2,
        albumId: options.albumId,
        photoId: options.photoId
      }
    });
    const result = res && res.result ? res.result : {};
    if (result.success) return { success: true, traceId: result.traceId || result.trace_id || '' };
    console.error('[content-security] media check rejected or failed:', result);
    showToast(isRejected(result) ? VIOLATION_MESSAGE : CHECK_FAILED_MESSAGE);
    return { success: false };
  } catch (e) {
    console.error('[content-security] media check call failed:', e);
    showToast(isRejected(e) ? VIOLATION_MESSAGE : CHECK_FAILED_MESSAGE);
    return { success: false };
  }
}

module.exports = {
  VIOLATION_MESSAGE,
  CHECK_FAILED_MESSAGE,
  normalizeContentList,
  isRejected,
  checkBeforePublish,
  checkMediaBeforePublish
};
