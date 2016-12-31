# flumelog-idb

A flumelog implemented on top of IndexedDB, for use in the browser.

see [flumedb](https://github.com/flumedb/flumedb)

## example

``` js
var Flume = require('flumedb')
var IDBLog = require('flumelog-idb')

var db = Flume(IDBLog('database_name'))
//then install views...
```

## License

MIT

