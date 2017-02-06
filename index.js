var Obv = require('obv')
var Append = require('append-batch')
var pull = require('pull-stream')
var pCont = require('pull-cont')

module.exports = function (dir) {
  var since = Obv()
  var name = 'LOG'
  var env = typeof window == 'object' ? window : self;

  var db
  var req = env.indexedDB.open(dir, 1)

  req.onsuccess = function (ev) {
    db = ev.target.result
    db.transaction([name],'readonly').objectStore(name)
    .openKeyCursor(null, 'prev').onsuccess = function (ev) {
      if(!ev.target.result) since.set(-1)
      else since.set(ev.target.result.primaryKey)
    }
  }

  req.onupgradeneeded = function (ev) {
    db = ev.target.result
    db.createObjectStore(name, {autoIncrement: true, keyPath: 'seq'})
  }

  req.onerror = function (ev) {
    throw new Error('could not load indexdb:'+dir)
  }

  var append = Append(function (batch, cb) {
    //delay until log has loaded...
    since.once(function () {
      var tx = db.transaction([name], 'readwrite'), err
      var m = 1
      tx.oncomplete = function (ev) {
        since.set(m)
        cb(null, m)
      }
      tx.onabort = tx.onerror = function (error) { cb(err || error) }
      var store = tx.objectStore(name)

      var n = batch.length
      function onError (_err) {
        err = _err
        tx.abort()
      }
      batch.forEach(function (value) {
        var req = store.put({value: value})
        req.onerror = onError
        req.onsuccess = function (ev) {
          m = Math.max(m, ev.target.result)
        }
      })
    })
  })

  function get (seq, cb) {
    if(!Number.isInteger(seq)) throw new Error('sequence must be integer, was:'+JSON.stringify(seq))
    var tx = db.transaction([name], 'readonly')
    var req = tx.objectStore(name).get(seq)
    req.onsuccess = function (ev) {
      cb(null, ev.target.result)
    }
    req.onerror = function () {
      cb(new Error('key not found:'+seq))
    }
  }

  return {
    append: append,
    since: since,
    get: function (seq, cb) {
      get(seq, function (err, data) {
        if(err) cb(err)
        else cb(null, data.value)
      })
    },
    stream: function (opts) {
      var values = opts.values !== false, seqs = opts.seqs !== false
      var reverse = opts.reverse === true
      var live = opts.live === true
      //if seqs, and not values handle specially

      return pCont(function (cb) {
        since.once(function (_max) {
          var min  = opts.gt != null ? opts.gt + 1 : opts.gte != null ? opts.gte : 1
          var max  = opts.lt != null ? opts.lt - 1 : opts.lte != null ? opts.lte : null
          min = Math.max(min, 1)
          var cursor = reverse ? max || _max : min

          cb(null, function (abort, cb) {

            function next () {
              if(!values) {
                var _cursor = cursor
                cursor += reverse ? -1 : 1
                cb(null, _cursor)
              }
              else get(cursor, function (err, data) {
                cursor += reverse ? -1 : 1
                cb(null, !seqs ? data.value : data)
              })
            }

            if(abort) return cb(abort)
            else if(cursor < min) cb(true)
            else if(max != null && cursor > max) cb(true)
            else if(cursor > since.value) {
              if(!live) cb(true)
              else since.once(next, false)
            }
            else next()
          })
        })
      })
    }
  }
}

