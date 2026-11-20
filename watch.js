/* watch.js — the game clock. Time is kept in minutes since the first dawn. */
var EM = window.EM = window.EM || {};

EM.Watch = (function () {
  var DAY = 24 * 60;

  function advance(state, minutes) {
    state.clock = (state.clock || 8 * 60) + minutes;
    return state.clock;
  }

  function format(state) {
    var t = state.clock || 8 * 60;
    var day = Math.floor(t / DAY) + 1;
    var m = t % DAY;
    var hh = Math.floor(m / 60), mm = m % 60;
    var hhs = (hh < 10 ? '0' : '') + hh, mms = (mm < 10 ? '0' : '') + mm;
    return 'Day ' + day + ', ' + hhs + ':' + mms;
  }

  // Night brings the dark: the view is only ever shown lit in phase 1, but the time of day is shown.
  function isNight(state) {
    var h = Math.floor(((state.clock || 480) % DAY) / 60);
    return h >= 20 || h < 6;
  }

  return { advance: advance, format: format, isNight: isNight, MINUTES_PER_STEP: 10 };
})();
