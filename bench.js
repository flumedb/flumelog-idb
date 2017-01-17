var FlumeLog = require('./')
require('../bench-flumelog')(function () {
  return FlumeLog('/tmp/bench-flumelog-offset'+Date.now())
})

