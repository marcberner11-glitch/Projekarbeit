/* Video: eigener Play-Button, 3D-Kippen + Heranzoomen beim Scrollen */
(function () {
  AK.ready(function (AK) {
    var sec = document.getElementById('video');
    if (!sec) return;
    var v = AK.$('.vid__player', sec), btn = AK.$('.vid__play', sec), frame = AK.$('.vid__frame', sec);

    btn.addEventListener('click', function () {
      v.controls = true;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      sec.classList.add('is-playing');
      AK.track('video_play');
    });
    v.addEventListener('play', function () { sec.classList.add('is-playing'); v.controls = true; });

    if (!AK.motion) return;
    gsap.fromTo(frame, { rotateX: 18, scale: .84, y: 40, autoAlpha: .55 }, {
      rotateX: 0, scale: 1, y: 0, autoAlpha: 1, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top 85%', end: 'center 55%', scrub: .6 }
    });
  });
})();
