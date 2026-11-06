/* Info-Leiste: Live-Öffnungsstatus */
(function () {
  AK.ready(function (AK) {
    var item = AK.$('.qi__item--status');
    if (!item) return;
    var lab = AK.$('[data-open-label]', item), det = AK.$('[data-open-detail]', item);
    function upd() {
      var s = AK.openStatus();
      item.classList.toggle('is-open', s.open);
      item.classList.toggle('is-closed', !s.open);
      lab.textContent = s.label;
      det.textContent = s.detail || 'Dienstag Ruhetag';
    }
    upd(); setInterval(upd, 60000);
  });
})();
