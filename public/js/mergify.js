onlyChanges = function(older, newer) {
  var changed, changes, k, obj;
  if ((older instanceof Array || newer instanceof Array) && older.length !== newer.length) {
    return newer;
  }
  if (typeof older !== 'object' || typeof newer !== 'object' || !older || !newer) {
    return (newer === older ? null : newer);
  }
  obj = older instanceof Array ? [] : {};
  changed = false;
  for (k in newer) {
    if (typeof older[k] === 'object' && typeof newer[k] === 'object') {
      changes = this.onlyChanges(older[k], newer[k]);
      if (changes) {
        obj[k] = changes;
        changed = true;
      } else if (older instanceof Array) {
        if (newer[k] instanceof Array) {
          obj[k] = newer[k];
        } else {
          obj[k] = {};
        }
      }
    } else {
      if (newer[k] !== older[k]) {
        obj[k] = newer[k];
        changed = true;
      } else if (older instanceof Array) {
        obj[k] = newer[k];
      }
    }
  }
  if (changed) {
    return obj;
  } else {
    return null;
  }
};

deepMerge = function(dst, src) {
  var dstv, k, srcv, _results;
  _results = [];
  for (k in src) {
    srcv = src[k];
    dstv = dst[k];
    if (typeof dstv === 'object' && typeof srcv === 'object') {
      if ((dstv instanceof Array) && (srcv instanceof Array) && dstv.length === srcv.length) {
        _results.push(deepMerge(dstv, srcv));
      } else if ((!dstv instanceof Array) && (!srcv instanceof Array)) {
        _results.push(deepMerge(dstv, srcv));
      } else {
        _results.push(dst[k] = srcv);
      }
    } else {
      _results.push(dst[k] = srcv);
    }
  }
  return _results;
};
