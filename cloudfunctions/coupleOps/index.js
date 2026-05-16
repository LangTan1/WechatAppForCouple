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
    return { success: false, error: e.message || '服务器错误' };
  }
};

async function createCouple(event, openid) {
  const { docData, inviteCode } = event;
  const safeDocData = sanitizeCreateDoc(docData);

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

  const updateData = { updatedAt: db.serverDate() };
  updateData[cloudField] = value;
  await couples.doc(docId).update({ data: updateData });
  return { success: true };
}

async function saveBatch(event, openid) {
  const { docId, updates } = event;
  const safeUpdates = filterAllowedUpdates(updates);

  await requireAuthorizedCouple(docId, openid);

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
  toPublicCouple
};
