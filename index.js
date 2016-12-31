var Obv = require('obv')
var Append = require('append-batch')
var pull = require('pull-stream')
var pCont = require('pull-cont')

module.exports = function (dir) {
  var since = Obv()

  var env = typeof window == 'object' ? window : self;

//  var DB = ['indexedDB', 'webkitIndexedDB', 'mozIndexedDB'].filter(function (name) {
//      return env[name];
//  })[0]

  var db
  var req = env.indexedDB.open(dir, 2) //{version:1, storage: 'persistent'})

  req.onsuccess = function (ev) {
    db = ev.target.result
    console.log('loaded db', DB = db, req)
    console.log('object store names', [].slice.call(db.objectStoreNames))
//    since.set(-1)
    db.transaction(['LOG'],'readonly').objectStore('LOG')
    .openKeyCursor(null, 'prev').onsuccess = function (cursor) {
      if(!cursor) since.set(-1)
      else since.set(cursor.primaryKey)
    }

  }

  req.onupgradeneeded = function (ev) {
    db = ev.target.result
    console.log('UPGRADE NEEDED')
    var req = db.createObjectStore('LOG', {autoIncrement: true, keyPath: 'seq'})
    req.onsuccess = function () {
      console.log('object store is ready!')
    }
  }

  req.onerror = function (ev) {
    throw new Error('could not load indexdb:'+dir)
  }

  var append = Append(function (batch, cb) {
    //delay until log has loaded...
    since.once(function () {
      var tx = db.transaction(['LOG'], 'readwrite'), err
      tx.oncomplete = function () { cb() }
      tx.onabort = tx.onerror = function (err) { cb(err || error) }
      var store = tx.objectStore('LOG')

      var n = batch.length
      function onError (_err) {
        err = _err
        tx.abort()
      }
      batch.forEach(function (value) {
        var req = store.put({value: value})
        req.onerror = onError
      })
    })
  })

  function get (seq, cb) {
    var tx = db.transaction(["LOG"], 'readonly')
    var req = tx.objectStore("LOG").get(seq)
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
    get: get,
    stream: function (opts) {
      var n = 1
      return pCont(function (cb) {
        since.once(function () {
          cb(null, function (abort, cb) {
            if(n === 0) cb(true)
            else if(n === since.value) cb(true)
            else
              get(n, function (err, value) {
                if(value === undefined) return cb(true)
                n++
                cb(null, value)
              })
          })
        })
      })
    }
  }
}





















