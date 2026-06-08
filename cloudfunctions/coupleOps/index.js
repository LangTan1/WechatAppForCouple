const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const couples = db.collection('couples');

const ALLOWED_COUPLE_FIELDS = new Set([
  'devName',
  'userName',
  'devGender',
  'userGender',
  'devAvatar',
  'userAvatar',
  'togetherDate',
  'devCoins',
  'userCoins',
  'menuItems',
  'diaries',
  'whispers',
  'wishes',
  'anniversaries',
  'albums',
  'moods',
  'achievements',
  'orderQueue',
  'foodRequests',
  'coinRequests',
  'orderTotalCount',
  'coinTransactions',
  'devWeatherProfile',
  'userWeatherProfile',
  'devWeatherSnapshot',
  'userWeatherSnapshot',
  'angry',
  'reflection',
  'learn',
  'sweet',
  'avoid'
]);

const CONTENT_SECURITY_REJECTED_ERROR = 'content security rejected';
const MSG_SEC_CHECK_SCENE = 2;
const MSG_SEC_CHECK_MAX_LENGTH = 2500;
const MEDIA_CHECK_SCENE = 2;
const MEDIA_CHECK_IMAGE_TYPE = 2;
const SECURITY_SKIP_KEYS = new Set([
  '_id',
  'id',
  'openid',
  'devopenid',
  'useropenid',
  'invitecode',
  'role',
  'status',
  'type',
  'category',
  'mood',
  'date',
  'time',
  'createdat',
  'updatedat',
  'fileid',
  'url',
  'displayurl',
  'displaycoverurl',
  'cover',
  'avatar',
  'devavatar',
  'useravatar',
  'mediachecks',
  'mediachecktraceid',
  'mediacheckstatus',
  'mediachecksuggest'
]);

const PUBLIC_COUPLE_FIELDS = [
  '_id',
  'inviteCode',
  'devName',
  'userName',
  'devGender',
  'userGender',
  'devAvatar',
  'userAvatar',
  'togetherDate',
  'createdAt',
  'updatedAt'
];

function pickFields(source, fields) {
  const result = {};
  if (!source) return result;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }
  return result;
}

function toPublicCouple(couple) {
  return pickFields(couple, PUBLIC_COUPLE_FIELDS);
}

function canAccessCouple(couple, openid) {
  if (!couple || !openid) return false;
  return couple.devOpenid === openid || couple.userOpenid === openid;
}

function canUnbindCouple(couple, openid) {
  if (!couple || !openid) return false;
  return couple.devOpenid === openid;
}

function toEpoch(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value.getTime === 'function') return value.getTime();
  return 0;
}

function compareCouplesForRecency(a, b) {
  const timeB = toEpoch(b && (b.updatedAt || b.createdAt));
  const timeA = toEpoch(a && (a.updatedAt || a.createdAt));
  if (timeB !== timeA) return timeB - timeA;
  const idB = String((b && b._id) || '');
  const idA = String((a && a._id) || '');
  return idB.localeCompare(idA);
}

function pickLatestCouple(couplesList) {
  if (!Array.isArray(couplesList) || couplesList.length === 0) return null;
  return couplesList.slice().sort(compareCouplesForRecency)[0];
}

function filterAllowedUpdates(updates) {
  return pickFields(updates, Array.from(ALLOWED_COUPLE_FIELDS));
}

function sanitizeCreateDoc(docData) {
  return filterAllowedUpdates(docData);
}

function isCloudOrHttpUrl(value) {
  return typeof value === 'string' && (
    value.indexOf('cloud://') === 0 || /^https?:\/\//.test(value)
  );
}

function isDateLikeText(value) {
  return typeof value === 'string' && /^[0-9:\-/.\s]+$/.test(value);
}

function shouldSkipSecurityText(path, value) {
  if (typeof value !== 'string') return true;
  const text = value.trim();
  if (!text) return true;
  if (isCloudOrHttpUrl(text)) return true;
  if (isDateLikeText(text)) return true;

  const key = String(path[path.length - 1] || '').toLowerCase();
  return SECURITY_SKIP_KEYS.has(key);
}

function collectSecurityTexts(value, path, output, seen) {
  const currentPath = Array.isArray(path) ? path : [];
  const texts = Array.isArray(output) ? output : [];
  const seenTexts = seen || new Set();

  if (typeof value === 'string') {
    if (!shouldSkipSecurityText(currentPath, value)) {
      const text = value.trim();
      if (!seenTexts.has(text)) {
        seenTexts.add(text);
        texts.push(text);
      }
    }
    return texts;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectSecurityTexts(value[i], currentPath.concat(String(i)), texts, seenTexts);
    }
    return texts;
  }

  if (value && typeof value === 'object') {
    for (const key in value) {
      collectSecurityTexts(value[key], currentPath.concat(key), texts, seenTexts);
    }
  }

  return texts;
}

function buildMsgSecCheckRequests(texts, openid, scene, maxLength) {
  const requests = [];
  const effectiveScene = scene || MSG_SEC_CHECK_SCENE;
  const effectiveMaxLength = maxLength || MSG_SEC_CHECK_MAX_LENGTH;
  if (!openid) return requests;

  for (const rawText of texts || []) {
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    if (!text) continue;
    for (let i = 0; i < text.length; i += effectiveMaxLength) {
      requests.push({
        content: text.slice(i, i + effectiveMaxLength),
        openid,
        scene: effectiveScene,
        version: 2
      });
    }
  }

  return requests;
}

function isMsgSecCheckPass(result) {
  if (!result) return false;
  const errCode = result.errCode !== undefined ? result.errCode : result.errcode;
  if (errCode !== undefined && errCode !== 0) return false;

  const suggest = result.result && result.result.suggest ? result.result.suggest : result.suggest;
  if (suggest) return suggest === 'pass';
  return true;
}

function isContentSecurityRejected(error) {
  return !!(error && error.message === CONTENT_SECURITY_REJECTED_ERROR);
}

function buildMediaCheckAsyncRequest(mediaUrl, openid, mediaType, scene) {
  return {
    media_url: mediaUrl,
    media_type: mediaType || MEDIA_CHECK_IMAGE_TYPE,
    openid,
    scene: scene || MEDIA_CHECK_SCENE,
    version: 2
  };
}

function getMediaCheckSuggest(mediaResult) {
  if (!mediaResult) return '';
  if (mediaResult.result && mediaResult.result.suggest) return mediaResult.result.suggest;
  if (mediaResult.suggest) return mediaResult.suggest;
  return '';
}

function isMediaCheckPass(mediaResult) {
  if (!mediaResult) return false;
  const errCode = mediaResult.errCode !== undefined ? mediaResult.errCode : mediaResult.errcode;
  if (errCode !== undefined && errCode !== 0) return false;
  return getMediaCheckSuggest(mediaResult) === 'pass';
}

function getMediaCheckTraceId(mediaResult) {
  if (!mediaResult) return '';
  return mediaResult.trace_id || mediaResult.traceId || '';
}

function applyMediaCheckResultToAlbums(albums, mediaResult) {
  const traceId = getMediaCheckTraceId(mediaResult);
  if (!traceId || !Array.isArray(albums)) return albums || [];

  const nextStatus = isMediaCheckPass(mediaResult) ? 'pass' : 'rejected';
  return albums.map((album) => {
    const photos = Array.isArray(album.photos) ? album.photos.map((photo) => {
      if (!photo || photo.mediaCheckTraceId !== traceId) return photo;
      return Object.assign({}, photo, {
        mediaCheckStatus: nextStatus,
        mediaCheckSuggest: getMediaCheckSuggest(mediaResult) || nextStatus
      });
    }) : [];
    return Object.assign({}, album, { photos });
  });
}

async function assertContentSafe(value, openid) {
  const texts = collectSecurityTexts(value);
  const requests = buildMsgSecCheckRequests(texts, openid);
  if (requests.length === 0) return;

  if (!cloud.openapi || !cloud.openapi.security || !cloud.openapi.security.msgSecCheck) {
    throw new Error('content security api unavailable');
  }

  for (const request of requests) {
    const result = await cloud.openapi.security.msgSecCheck(request);
    if (!isMsgSecCheckPass(result)) {
      throw new Error(CONTENT_SECURITY_REJECTED_ERROR);
    }
  }
}

async function loadCoupleRecord(docId) {
  try {
    const res = await couples.doc(docId).get();
    return res.data;
  } catch (e) {
    const msg = e && e.message ? e.message : '';
    if (msg.indexOf('not exist') !== -1 || msg.indexOf('not found') !== -1) {
      throw new Error('document not exist');
    }
    throw e;
  }
}

async function requireAuthorizedCouple(docId, openid) {
  const couple = await loadCoupleRecord(docId);
  if (!canAccessCouple(couple, openid)) {
    throw new Error('permission denied');
  }
  return couple;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  try {
    switch (action) {
      case 'createCouple':
        return await createCouple(event, openid);
      case 'bindCouple':
        return await bindCouple(event, openid);
      case 'loadCouple':
        return await loadCouple(event, openid);
      case 'saveField':
        return await saveField(event, openid);
      case 'saveBatch':
        return await saveBatch(event, openid);
      case 'resolveFileURLs':
        return await resolveFileURLs(event, openid);
      case 'securityCheckText':
        return await securityCheckText(event, openid);
      case 'securityCheckMedia':
        return await securityCheckMedia(event, openid);
      case 'applyMediaCheckResult':
        return await applyMediaCheckResult(event, openid);
      case 'findCoupleByOpenid':
        return await findCoupleByOpenid(openid);
      case 'findAllCouplesByOpenid':
        return await findAllCouplesByOpenid(openid);
      case 'findCoupleByCode':
        return await findCoupleByCode(event);
      case 'unbindCouple':
        return await unbindCouple(event, openid);
      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (e) {
    console.error('coupleOps error:', action, e);
    if (isContentSecurityRejected(e)) {
      return { success: false, error: CONTENT_SECURITY_REJECTED_ERROR, code: 'CONTENT_SECURITY_REJECTED' };
    }
    return { success: false, error: e.message || '服务器错误' };
  }
};

async function createCouple(event, openid) {
  const { docData, inviteCode } = event;
  const safeDocData = sanitizeCreateDoc(docData);
  await assertContentSafe(safeDocData, openid);

  safeDocData.devOpenid = openid;
  safeDocData.userOpenid = '';
  safeDocData.inviteCode = inviteCode;
  safeDocData.createdAt = db.serverDate();
  safeDocData.updatedAt = db.serverDate();

  const res = await couples.add({ data: safeDocData });
  return { success: true, docId: res._id, inviteCode: inviteCode };
}

async function bindCouple(event, openid) {
  const { inviteCode, userName, userGender } = event;
  await assertContentSafe({ userName }, openid);

  const res = await couples.where({ inviteCode: inviteCode }).orderBy('createdAt', 'desc').get();
  if (res.data.length === 0) {
    return { success: false, error: '邀请码不存在' };
  }

  const couple = pickLatestCouple(res.data);
  if (couple.userOpenid && couple.userOpenid !== openid) {
    return { success: false, error: '该邀请码已被其他人绑定' };
  }

  const updateData = { userOpenid: openid, updatedAt: db.serverDate() };
  if (userName) updateData.userName = userName;
  if (userGender) updateData.userGender = userGender;

  await couples.doc(couple._id).update({ data: updateData });

  // 用户已绑定成功，是授权参与者，返回完整文档供 _syncCloudToLocal 同步业务数据
  const updated = await loadCoupleRecord(couple._id);
  return { success: true, docId: couple._id, couple: updated };
}

async function loadCouple(event, openid) {
  const { docId } = event;
  const couple = await requireAuthorizedCouple(docId, openid);
  return { success: true, data: couple };
}

async function saveField(event, openid) {
  const { docId, cloudField, value } = event;
  if (!ALLOWED_COUPLE_FIELDS.has(cloudField)) {
    throw new Error('invalid field');
  }

  await requireAuthorizedCouple(docId, openid);
  await assertContentSafe(value, openid);

  const updateData = { updatedAt: db.serverDate() };
  updateData[cloudField] = value;
  await couples.doc(docId).update({ data: updateData });
  return { success: true };
}

async function saveBatch(event, openid) {
  const { docId, updates } = event;
  const safeUpdates = filterAllowedUpdates(updates);

  await requireAuthorizedCouple(docId, openid);
  await assertContentSafe(safeUpdates, openid);

  if (Object.keys(safeUpdates).length === 0) {
    return { success: true };
  }

  const updateData = { updatedAt: db.serverDate() };
  for (const key in safeUpdates) {
    updateData[key] = safeUpdates[key];
  }
  await couples.doc(docId).update({ data: updateData });
  return { success: true };
}

async function securityCheckText(event, openid) {
  const content = event.contentList !== undefined ? event.contentList : event.content;
  await assertContentSafe(content, openid);
  return { success: true, safe: true };
}

async function securityCheckMedia(event, openid) {
  const { docId, fileID, albumId, photoId } = event;
  const mediaType = event.mediaType || MEDIA_CHECK_IMAGE_TYPE;
  if (!docId) throw new Error('missing docId');
  if (!fileID || typeof fileID !== 'string' || !fileID.startsWith('cloud://')) {
    throw new Error('invalid media file');
  }

  const couple = await requireAuthorizedCouple(docId, openid);
  const urlRes = await cloud.getTempFileURL({ fileList: [fileID] });
  const fileInfo = urlRes && urlRes.fileList && urlRes.fileList[0] ? urlRes.fileList[0] : null;
  if (!fileInfo || fileInfo.status !== 0 || !fileInfo.tempFileURL) {
    throw new Error('media url unavailable');
  }

  if (!cloud.openapi || !cloud.openapi.security || !cloud.openapi.security.mediaCheckAsync) {
    throw new Error('media security api unavailable');
  }

  const checkRes = await cloud.openapi.security.mediaCheckAsync(
    buildMediaCheckAsyncRequest(fileInfo.tempFileURL, openid, mediaType)
  );
  const errCode = checkRes && checkRes.errCode !== undefined ? checkRes.errCode : checkRes && checkRes.errcode;
  if (errCode !== undefined && errCode !== 0) {
    throw new Error(checkRes.errmsg || checkRes.errMsg || 'media security check failed');
  }

  const traceId = getMediaCheckTraceId(checkRes);
  if (traceId) {
    const mediaChecks = Object.assign({}, couple.mediaChecks || {});
    mediaChecks[traceId] = {
      traceId,
      fileID,
      albumId,
      photoId,
      mediaType,
      status: 'pending',
      createdAt: Date.now()
    };
    await couples.doc(docId).update({
      data: {
        mediaChecks,
        updatedAt: db.serverDate()
      }
    });
  }

  return { success: true, traceId, trace_id: traceId };
}

async function findCoupleByMediaTrace(traceId) {
  try {
    const res = await couples.where({
      ['mediaChecks.' + traceId + '.traceId']: traceId
    }).limit(1).get();
    if (res.data && res.data.length > 0) return res.data[0];
  } catch (e) {
    console.error('findCoupleByMediaTrace failed:', e);
  }
  return null;
}

async function applyMediaCheckResult(event, openid) {
  const mediaResult = event.mediaResult || event;
  const traceId = getMediaCheckTraceId(mediaResult);
  if (!traceId) throw new Error('missing trace_id');

  let couple;
  if (event.docId) {
    couple = openid ? await requireAuthorizedCouple(event.docId, openid) : await loadCoupleRecord(event.docId);
  } else {
    couple = await findCoupleByMediaTrace(traceId);
  }
  if (!couple || !couple._id) throw new Error('media trace not found');

  const status = isMediaCheckPass(mediaResult) ? 'pass' : 'rejected';
  const albums = applyMediaCheckResultToAlbums(couple.albums || [], mediaResult);
  const mediaChecks = Object.assign({}, couple.mediaChecks || {});
  mediaChecks[traceId] = Object.assign({}, mediaChecks[traceId] || { traceId }, {
    status,
    suggest: getMediaCheckSuggest(mediaResult) || status,
    checkedAt: Date.now()
  });

  await couples.doc(couple._id).update({
    data: {
      albums,
      mediaChecks,
      updatedAt: db.serverDate()
    }
  });
  return { success: true, traceId, status };
}

async function resolveFileURLs(event, openid) {
  const { docId, fileIDs } = event;
  await requireAuthorizedCouple(docId, openid);

  const uniqueFileIDs = [];
  const seen = new Set();
  if (Array.isArray(fileIDs)) {
    for (const fileID of fileIDs) {
      if (typeof fileID !== 'string') continue;
      if (!fileID.startsWith('cloud://')) continue;
      if (seen.has(fileID)) continue;
      seen.add(fileID);
      uniqueFileIDs.push(fileID);
    }
  }

  if (uniqueFileIDs.length === 0) {
    return { success: true, fileList: [] };
  }

  const fileList = [];
  const chunkSize = 50;
  for (let i = 0; i < uniqueFileIDs.length; i += chunkSize) {
    const chunk = uniqueFileIDs.slice(i, i + chunkSize);
    try {
      const res = await cloud.getTempFileURL({ fileList: chunk });
      if (res && Array.isArray(res.fileList)) {
        for (const item of res.fileList) {
          fileList.push(item);
        }
      }
    } catch (e) {
      console.error('resolveFileURLs chunk failed:', e);
      for (const fileID of chunk) {
        fileList.push({
          fileID,
          tempFileURL: '',
          maxAge: 86400,
          status: 1,
          errMsg: e && e.message ? e.message : 'resolve failed'
        });
      }
    }
  }

  return { success: true, fileList };
}

async function findCoupleByOpenid(openid) {
  const res = await couples.where({ devOpenid: openid }).orderBy('createdAt', 'desc').get();
  const couple = pickLatestCouple(res.data);
  if (couple) {
    return { success: true, couple: toPublicCouple(couple) };
  }
  return { success: false, error: '未找到情侣文档' };
}

async function findAllCouplesByOpenid(openid) {
  const res = await couples.where({ devOpenid: openid }).orderBy('createdAt', 'desc').get();
  return { success: true, couples: res.data.map(toPublicCouple) };
}

async function findCoupleByCode(event) {
  const { inviteCode } = event;
  const res = await couples.where({ inviteCode: inviteCode }).orderBy('createdAt', 'desc').get();
  const couple = pickLatestCouple(res.data);
  if (couple) {
    return { success: true, couple: toPublicCouple(couple) };
  }
  return { success: false, error: '邀请码不存在' };
}

async function unbindCouple(event, openid) {
  const { docId } = event;
  const couple = await requireAuthorizedCouple(docId, openid);
  if (!canUnbindCouple(couple, openid)) {
    throw new Error('permission denied');
  }
  await couples.doc(docId).remove();
  return { success: true };
}

exports.__test__ = {
  canAccessCouple,
  canUnbindCouple,
  pickLatestCouple,
  filterAllowedUpdates,
  collectSecurityTexts,
  buildMsgSecCheckRequests,
  isMsgSecCheckPass,
  isContentSecurityRejected,
  buildMediaCheckAsyncRequest,
  isMediaCheckPass,
  applyMediaCheckResultToAlbums,
  toPublicCouple
};
