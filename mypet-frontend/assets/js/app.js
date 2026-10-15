/* mypet front-end behaviour (vanilla JS + Bootstrap 5)
   - No localStorage / sessionStorage / JSON files.
   - Data lives in the HTML. State that must travel between pages (e.g. the chosen
     clinic or the booking summary) is passed through the URL query string. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var params = new URLSearchParams(window.location.search);

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    var box = $('#mp-toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'mp-toasts';
      box.className = 'toast-container position-fixed top-0 end-0 p-3';
      box.style.zIndex = 2000;
      document.body.appendChild(box);
    }
    var el = document.createElement('div');
    el.className = 'toast align-items-center text-bg-' + (type || 'dark') + ' border-0';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="d-flex"><div class="toast-body"></div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>';
    el.querySelector('.toast-body').textContent = msg;
    box.appendChild(el);
    var t = new bootstrap.Toast(el, { delay: 2400 });
    t.show();
    el.addEventListener('hidden.bs.toast', function () { el.remove(); });
  }
  window.mpToast = toast;

  /* ---------- Misc small things ---------- */
  $$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });

  $$('input[type=date][data-min-today]').forEach(function (i) {
    i.min = new Date().toISOString().slice(0, 10);
  });

  // password show/hide
  $$('.pw-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var inp = b.parentElement.querySelector('input');
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = show ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    });
  });

  // admin sidebar toggle (mobile)
  var sideBtn = $('#adminSideToggle');
  if (sideBtn) sideBtn.addEventListener('click', function () { $('.admin-side').classList.toggle('open'); });

  /* ---------- Fill content from query string (data-q="key") ---------- */
  $$('[data-q]').forEach(function (el) {
    var v = params.get(el.getAttribute('data-q'));
    if (v === null || v === '') return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.value = v; else el.textContent = v;
  });
  $$('[data-q-href]').forEach(function (el) {
    var v = params.get(el.getAttribute('data-q-href'));
    if (v && /^[a-z0-9-]+\.html$/.test(v)) el.setAttribute('href', v);
  });
  if (params.get('name')) $$('[data-edit-title]').forEach(function (e) { e.textContent = e.getAttribute('data-edit-title'); });
  // pre-select pet chip from ?pet=
  var qPet = params.get('pet');

  /* ---------- Dependent selects: governorate -> area ---------- */
  var AREAS = {
    'Amman': ['Abdoun', 'Jabal Amman', 'Khalda', 'Marka', 'Shmeisani', 'Sweifieh'],
    'Irbid': ['Irbid City', 'Aydoun', 'Ramtha', 'Al-Husn'],
    'Zarqa': ['Zarqa City', 'Russeifa'],
    'Aqaba': ['Aqaba City', 'Tala Bay'],
    'Balqa': ['Salt', 'Fuheis']
  };
  $$('select[data-gov]').forEach(function (gov) {
    var area = $('select[data-area="' + gov.getAttribute('data-gov') + '"]');
    if (!area) return;
    function fill() {
      var list = AREAS[gov.value] || [];
      var keep = area.value;
      area.innerHTML = '<option value="">All areas</option>' + list.map(function (a) { return '<option>' + a + '</option>'; }).join('');
      if (list.indexOf(keep) > -1) area.value = keep;
    }
    gov.addEventListener('change', function () { fill(); area.dispatchEvent(new Event('change', { bubbles: true })); });
    fill();
  });

  /* ---------- Generic list filtering / sorting ----------
     container:  [data-filter-list]
     items:      .filter-item  with data-<key> attributes
     controls:   [data-filter-key="gov"]   (select | checkbox group | range with data-op="max")
                 [data-filter-search]      (text search over item text)
                 [data-sort]               (select: key-asc / key-desc, numeric when data-num)
     optional:   [data-count], .no-results                                            */
  $$('[data-filter-list]').forEach(function (list) {
    var scope = document;
    var items = $$('.filter-item', list);
    var controls = $$('[data-filter-key]', scope);
    // prefill filters from the URL, e.g. shop.html?pet=Cats
    $$('[data-from-q]', scope).forEach(function (c) {
      var v = params.get(c.getAttribute('data-from-q'));
      if (!v) return;
      if (c.type === 'checkbox') c.checked = (c.value === v); else c.value = v;
    });
    var search = $('[data-filter-search]', scope);
    var sorter = $('[data-sort]', scope);
    var count = $('[data-count]', scope);
    var none = $('.no-results', scope);

    function apply() {
      var groups = {};
      controls.forEach(function (c) {
        var k = c.getAttribute('data-filter-key');
        groups[k] = groups[k] || { op: c.getAttribute('data-op') || 'eq', vals: [], checkbox: c.type === 'checkbox' };
        if (c.type === 'checkbox') { if (c.checked) groups[k].vals.push(c.value); }
        else if (c.value !== '' && c.value !== 'all') groups[k].vals.push(c.value);
      });
      var q = search ? search.value.trim().toLowerCase() : '';
      var shown = 0;
      items.forEach(function (it) {
        var ok = true;
        Object.keys(groups).forEach(function (k) {
          var g = groups[k];
          if (!g.vals.length) return;
          var v = it.getAttribute('data-' + k) || '';
          if (g.op === 'max') { if (parseFloat(v) > parseFloat(g.vals[0])) ok = false; }
          else if (g.vals.indexOf(v) === -1) ok = false;
        });
        if (ok && q && it.textContent.toLowerCase().indexOf(q) === -1) ok = false;
        it.classList.toggle('d-none', !ok);
        if (ok) shown++;
      });
      if (sorter && sorter.value) {
        var parts = sorter.value.split(':'), key = parts[0], dir = parts[1] === 'desc' ? -1 : 1;
        var parent = items[0] && items[0].parentElement;
        if (parent) {
          items.slice().sort(function (a, b) {
            var x = a.getAttribute('data-' + key) || '', y = b.getAttribute('data-' + key) || '';
            var nx = parseFloat(x), ny = parseFloat(y);
            if (!isNaN(nx) && !isNaN(ny)) return (nx - ny) * dir;
            return x.localeCompare(y) * dir;
          }).forEach(function (it) { parent.appendChild(it); });
        }
      }
      if (count) count.textContent = shown;
      if (none) none.classList.toggle('d-none', shown !== 0);
    }
    controls.forEach(function (c) { c.addEventListener('input', apply); c.addEventListener('change', apply); });
    if (search) search.addEventListener('input', apply);
    if (sorter) sorter.addEventListener('change', apply);
    $$('[data-filter-reset]').forEach(function (b) {
      b.addEventListener('click', function () {
        controls.forEach(function (c) { if (c.type === 'checkbox') c.checked = false; else if (c.type === 'range') c.value = c.max; else c.value = ''; });
        if (search) search.value = '';
        $$('select[data-gov]').forEach(function (g) { g.dispatchEvent(new Event('change')); });
        apply();
      });
    });
    var rv = $('[data-range-out]'); // live label for the price slider
    controls.forEach(function (c) { if (c.type === 'range' && rv) c.addEventListener('input', function () { rv.textContent = c.value; }); });
    apply();
  });

  // highlight the card the user clicked on a provider list
  $$('.provider-card').forEach(function (card) {
    card.addEventListener('click', function () {
      $$('.provider-card').forEach(function (c) { c.classList.remove('selected'); });
      card.classList.add('selected');
    });
  });

  /* ---------- Pick groups (pet chips, time slots) ----------
     <div data-pick="time"> <button class="slot-btn" data-value="10:00"> ... </div>
     <input type="hidden" name="time">   and optional summary  <span data-sum="time"> */
  $$('[data-pick]').forEach(function (group) {
    var key = group.getAttribute('data-pick');
    var hidden = $('input[type=hidden][name="' + key + '"]');
    function select(btn) {
      $$('button', group).forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var v = btn.getAttribute('data-value') || btn.textContent.trim();
      if (hidden) hidden.value = v;
      $$('[data-sum="' + key + '"]').forEach(function (s) { s.textContent = v; });
      var err = group.parentElement.querySelector('.pick-error');
      if (err) err.classList.add('d-none');
    }
    $$('button', group).forEach(function (b) {
      b.type = 'button';
      b.addEventListener('click', function () { select(b); });
      if (key === 'pet' && qPet && (b.getAttribute('data-value') || '') === qPet) select(b);
    });
  });

  /* ---------- available times: depend on the chosen date ----------
     Demo only: some slots are shown as already booked (the back-end will return the real ones
     and mark a slot as booked as soon as one user reserves it). Closed days come from data-closed. */
  $$('[data-avail]').forEach(function (group) {
    var form = group.closest('form'), dateInp = $('input[name=date]', form);
    var hidden = $('input[type=hidden][name=time]', form), hint = $('.avail-hint', group.parentElement);
    var closed = (group.getAttribute('data-closed') || '').split(',').filter(Boolean).map(Number);
    var seed = location.pathname.split('/').pop();
    if (dateInp) { var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); dateInp.min = t.toISOString().slice(0, 10); }
    function h(str) { var x = 0; for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return x; }
    function render() {
      var d = dateInp && dateInp.value, btns = $$('button', group), free = 0;
      btns.forEach(function (b) { b.classList.remove('active', 'taken'); b.disabled = true; b.removeAttribute('title'); });
      if (hidden) hidden.value = '';
      $$('[data-sum="time"]').forEach(function (s) { s.textContent = '-'; });
      if (!d) { if (hint) hint.textContent = 'Choose a date to see the available times.'; return; }
      var dow = new Date(d + 'T12:00:00').getDay();
      if (closed.indexOf(dow) > -1) { if (hint) hint.textContent = 'Closed on this day. Please choose another date.'; return; }
      btns.forEach(function (b, i) {
        var taken = h(seed + d + b.textContent.trim()) % 10 < 3;
        if (taken) { b.classList.add('taken'); b.title = 'Already booked'; } else { b.disabled = false; free++; }
      });
      if (!free) { btns.slice(0, 2).forEach(function (b) { b.classList.remove('taken'); b.disabled = false; b.removeAttribute('title'); }); free = 2; }
      if (hint) hint.textContent = free + ' time' + (free > 1 ? 's' : '') + ' available. Booked times are crossed out.';
    }
    if (dateInp) { dateInp.addEventListener('change', render); dateInp.addEventListener('input', render); }
    render();
  });

  // mirror normal inputs into the summary box: <input data-sum="date">
  $$('input[data-sum], select[data-sum]').forEach(function (inp) {
    function upd() { $$('[data-sum="' + inp.getAttribute('data-sum') + '"]').forEach(function (s) { if (s !== inp) s.textContent = inp.value || '-'; }); }
    inp.addEventListener('input', upd); inp.addEventListener('change', upd);
  });

  // day-care: nights x rate
  var stay = $('[data-rate]');
  if (stay) {
    var rate = parseFloat(params.get('rate')) || parseFloat(stay.getAttribute('data-rate')) || 0;
    var ci = $('input[name=checkin]'), co = $('input[name=checkout]');
    var room = $('select[name=room]');
    $$('select[name=room] option[data-mult]').forEach(function (o) {
      o.textContent = o.getAttribute('data-label') + ' \u2014 ' + (rate * parseFloat(o.getAttribute('data-mult'))) + ' JD/night';
    });
    function calc() {
      var r = rate;
      if (room && room.selectedOptions[0]) r = rate * (parseFloat(room.selectedOptions[0].getAttribute('data-mult')) || 1);
      var n = 0;
      if (ci && co && ci.value && co.value) n = Math.max(0, Math.round((new Date(co.value) - new Date(ci.value)) / 86400000));
      $$('[data-sum="nights"]').forEach(function (e) { e.textContent = n; });
      $$('[data-rate-out]').forEach(function (e) { e.textContent = r; });
      $$('[data-sum="total"]').forEach(function (e) { e.textContent = (n * r).toFixed(1); });
      var f = $('input[name=fee]'); if (f) f.value = (n * r).toFixed(1);
      if (co && ci && ci.value) co.min = ci.value;
    }
    [ci, co, room].forEach(function (e) { if (e) e.addEventListener('change', calc); });
    calc();
  }


  /* ---------- unit price x multiplier (dog walking duration) ---------- */
  var unitForm = $('[data-unit-fee]');
  if (unitForm) {
    var unit = parseFloat(params.get('fee')) || parseFloat(unitForm.getAttribute('data-unit-fee')) || 0;
    var multSel = $('select[data-mult-select]', unitForm);
    var calcUnit = function () {
      var m = multSel && multSel.selectedOptions[0] ? (parseFloat(multSel.selectedOptions[0].getAttribute('data-mult')) || 1) : 1;
      var tot = unit * m;
      $$('[data-sum="total"]').forEach(function (e) { e.textContent = tot; });
      var h = $('input[name=total]', unitForm); if (h) h.value = tot;
    };
    if (multSel) multSel.addEventListener('change', calcUnit);
    calcUnit();
  }

  /* ---------- pill buttons that drive a hidden select filter ---------- */
  $$('[data-pill]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-pill]', b.parentElement).forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      var sel = $(b.getAttribute('data-pill'));
      sel.value = b.getAttribute('data-value');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  /* ---------- Forms ---------- */
  $$('form.needs-validation').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var ok = form.checkValidity();

      // password confirmation
      var pw = $('input[name=password]', form), pw2 = $('input[name=confirm]', form);
      if (pw && pw2) {
        if (pw.value !== pw2.value) { pw2.setCustomValidity('mismatch'); ok = false; } else pw2.setCustomValidity('');
      }
      // custom "must pick one" groups
      $$('[data-required-pick]', form).forEach(function (g) {
        var h = $('input[type=hidden][name="' + g.getAttribute('data-required-pick') + '"]', form);
        var err = g.querySelector('.pick-error');
        if (h && !h.value) { ok = false; if (err) err.classList.remove('d-none'); }
      });
      // stay must have at least 1 night
      var nights = $('[data-sum="nights"]', form) || $('[data-sum="nights"]');
      if (stay && nights && parseInt(nights.textContent, 10) < 1) { ok = false; toast('Check-out must be after check-in', 'danger'); }

      form.classList.add('was-validated');
      if (!ok) {
        var bad = $(':invalid', form);
        if (bad) bad.focus();
        return;
      }

      var next = form.getAttribute('data-next');
      if (form.getAttribute('data-auth') === 'signin') {
        var email = ($('input[name=email]', form).value || '').toLowerCase();
        next = email.indexOf('admin') > -1 ? '../admin/dashboard.html' : 'home.html';
      }
      if (form.getAttribute('data-auth') === 'signup') {
        toast('Account created. Please sign in.', 'success');
      }
      if (next) {
        var qs = new URLSearchParams();
        $$('input, select, textarea', form).forEach(function (f) {
          if (!f.name || f.type === 'password' || f.type === 'file' || f.disabled) return;
          if ((f.type === 'checkbox' || f.type === 'radio') && !f.checked) return;
          if (form.getAttribute('data-auth')) return; // never put credentials in the URL
          qs.append(f.name, f.value);
        });
        var extra = form.getAttribute('data-extra'); // e.g. "type=Clinic"
        if (extra) extra.split('&').forEach(function (p) { var kv = p.split('='); qs.set(kv[0], decodeURIComponent(kv[1] || '')); });
        var q = qs.toString();
        setTimeout(function () { window.location.href = next + (q ? '?' + q : ''); }, form.getAttribute('data-auth') === 'signup' ? 700 : 0);
      } else {
        toast(form.getAttribute('data-ok') || 'Saved', 'success');
        form.classList.remove('was-validated');
      }
    });
  });

  // payment method toggle on checkout
  $$('input[name=payment]').forEach(function (r) {
    r.addEventListener('change', function () {
      var card = $('#cardFields'); if (!card) return;
      var isCard = r.value === 'card' && r.checked;
      card.classList.toggle('d-none', !isCard);
      $$('input', card).forEach(function (i) { i.disabled = !isCard; });
      $$('.pay-opt').forEach(function (o) { o.classList.toggle('border-primary', o.querySelector('input').checked); });
    });
  });

  // image preview (admin add pages)
  $$('input[type=file][data-preview]').forEach(function (inp) {
    var zone = $(inp.getAttribute('data-preview'));
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f || !zone) return;
      var url = URL.createObjectURL(f);
      var old = zone.querySelector('img'); if (old) old.remove();
      var img = document.createElement('img'); img.src = url; img.alt = 'Preview'; zone.appendChild(img);
    });
  });

  /* ---------- Cart ---------- */
  var cartRows = $$('[data-cart-row]');
  if (cartRows.length || $('#cartTotals')) {
    var discount = 0;
    var money = function (n) { return n.toFixed(1) + ' JD'; };
    function recalc() {
      var rows = $$('[data-cart-row]');
      var sub = 0, items = 0;
      rows.forEach(function (r) {
        var qty = parseInt(r.querySelector('.qty-val').textContent, 10);
        var price = parseFloat(r.getAttribute('data-price'));
        r.querySelector('.line-total').textContent = money(qty * price);
        sub += qty * price; items += qty;
      });
      var ship = sub === 0 ? 0 : (sub >= 50 ? 0 : 3);
      var disc = sub * discount;
      $('#subTotal').textContent = money(sub);
      $('#shipTotal').textContent = ship === 0 && sub > 0 ? 'Free' : money(ship);
      $('#discTotal').textContent = '-' + money(disc);
      $('#grandTotal').textContent = money(sub + ship - disc);
      $$('[data-cart-count]').forEach(function (e) { e.textContent = items; });
      var empty = $('#cartEmpty'), full = $('#cartFull');
      if (empty && full) { empty.classList.toggle('d-none', rows.length !== 0); full.classList.toggle('d-none', rows.length === 0); }
      var co = $('#checkoutBtn'); if (co) co.classList.toggle('disabled', rows.length === 0);
    }
    $$('[data-cart-row]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var q = row.querySelector('.qty-val'), n = parseInt(q.textContent, 10);
        if (b.hasAttribute('data-plus')) q.textContent = Math.min(n + 1, 20);
        if (b.hasAttribute('data-minus')) q.textContent = Math.max(n - 1, 1);
        if (b.hasAttribute('data-remove')) { row.remove(); toast('Item removed'); }
        recalc();
      });
    });
    var promoBtn = $('#applyPromo');
    if (promoBtn) promoBtn.addEventListener('click', function () {
      var code = ($('#promoInput').value || '').trim().toUpperCase();
      var msg = $('#promoMsg');
      if (code === 'PET10') { discount = 0.1; msg.textContent = '10% discount applied'; msg.className = 'small text-success mt-1'; }
      else { discount = 0; msg.textContent = code ? 'Invalid code. Try PET10' : 'Enter a code'; msg.className = 'small text-danger mt-1'; }
      recalc();
    });
    recalc();
  }

  // add to cart on the shop (page-level counter + toast)
  $$('[data-add-cart]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.mp-badge[data-cart-badge]').forEach(function (bd) { bd.textContent = (parseInt(bd.textContent, 10) || 0) + 1; });
      toast('"' + b.getAttribute('data-add-cart') + '" added to cart', 'success');
    });
  });

  /* ---------- Account: bookings tabs, cancel, pets ---------- */
  var tabBtns = $$('[data-state-tab]');
  if (tabBtns.length) {
    function showState(s) {
      tabBtns.forEach(function (b) { b.classList.toggle('btn-primary', b.getAttribute('data-state-tab') === s); b.classList.toggle('btn-outline-secondary', b.getAttribute('data-state-tab') !== s); });
      var n = 0;
      $$('.booking-item').forEach(function (it) { var m = it.getAttribute('data-state') === s; it.classList.toggle('d-none', !m); if (m) n++; });
      var e = $('.no-results'); if (e) e.classList.toggle('d-none', n !== 0);
    }
    tabBtns.forEach(function (b) { b.addEventListener('click', function () { showState(b.getAttribute('data-state-tab')); }); });
    var toCancel = null;
    $$('[data-cancel-booking]').forEach(function (b) { b.addEventListener('click', function () { toCancel = b.closest('.booking-item'); new bootstrap.Modal($('#cancelModal')).show(); }); });
    var yes = $('#cancelYes');
    if (yes) yes.addEventListener('click', function () {
      if (toCancel) {
        toCancel.setAttribute('data-state', 'cancelled');
        var p = toCancel.querySelector('.state-pill'); if (p) { p.className = 'pill pill-red state-pill'; p.textContent = 'Cancelled'; }
        var c = toCancel.querySelector('[data-cancel-booking]'); if (c) c.remove();
        toast('Booking cancelled');
      }
      bootstrap.Modal.getInstance($('#cancelModal')).hide();
      showState('upcoming');
    });
    showState('upcoming');
  }

  var petForm = $('#petForm');
  if (petForm) {
    petForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      petForm.classList.add('was-validated');
      if (!petForm.checkValidity()) return;
      var name = petForm.elements.petname.value.trim(), type = petForm.elements.pettype.value, age = petForm.elements.petage.value.trim();
      var ico = { Cat: 'bi-emoji-smile', Dog: 'bi-emoji-sunglasses', Bird: 'bi-feather', Fish: 'bi-water', Other: 'bi-heart' }[type] || 'bi-heart';
      var col = $$('#petGrid .pet-col').length % 2 ? 'c-clinic' : 'c-daycare';
      var col_ = document.createElement('div'); col_.className = 'col-6 col-md-4 pet-col';
      col_.innerHTML = '<div class="mp-card"><div class="mp-card-img ' + col + '"><i class="bi ' + ico + '"></i></div><div class="p-3"><div class="fw-semibold"></div><div class="small text-muted"></div><div class="d-flex gap-2 mt-2"><a class="btn btn-sm btn-outline-secondary flex-fill" href="#">Edit</a><a class="btn btn-sm btn-primary flex-fill" href="clinics.html">Book</a></div></div></div>';
      col_.querySelector('.fw-semibold').textContent = name;
      col_.querySelector('.text-muted').textContent = type + ' · ' + age;
      var add = $('#addPetTile'); $('#petGrid').insertBefore(col_, add);
      petForm.reset(); petForm.classList.remove('was-validated');
      bootstrap.Modal.getInstance($('#petModal')).hide();
      toast(name + ' added to your pets', 'success');
    });
  }

  /* ---------- Admin: delete confirm, dismiss rows ---------- */
  var delTarget = null;
  $$('.act-btn.del').forEach(function (b) {
    b.addEventListener('click', function () {
      delTarget = b.closest('tr, .del-row');
      var lbl = $('#delName'); if (lbl) lbl.textContent = (delTarget.getAttribute('data-label') || 'this item');
      new bootstrap.Modal($('#deleteModal')).show();
    });
  });
  var delYes = $('#deleteYes');
  if (delYes) delYes.addEventListener('click', function () {
    if (delTarget) { delTarget.remove(); toast('Deleted', 'success'); }
    bootstrap.Modal.getInstance($('#deleteModal')).hide();
    var c = $('[data-count]'); if (c) c.textContent = $$('.filter-item').filter(function (r) { return !r.classList.contains('d-none'); }).length;
  });
  $$('[data-row-action]').forEach(function (b) {
    b.addEventListener('click', function () {
      var row = b.closest('.del-row, tr'); var a = b.getAttribute('data-row-action');
      toast(a === 'approve' ? 'Request approved' : 'Request declined', a === 'approve' ? 'success' : 'secondary');
      if (row) row.remove();
    });
  });
  $$('[data-toggle-status]').forEach(function (b) {
    b.addEventListener('click', function () {
      var row = b.closest('tr'); var pill = row.querySelector('.status-pill');
      var on = pill.classList.contains('pill-green');
      pill.className = 'pill dot status-pill ' + (on ? 'pill-red' : 'pill-green');
      var ic = b.querySelector('i'); if (ic) ic.className = on ? 'bi bi-check2' : 'bi bi-slash-circle';
      pill.textContent = on ? b.getAttribute('data-off') : b.getAttribute('data-on');
      row.setAttribute('data-status', pill.textContent.toLowerCase());
      toast('Status updated');
    });
  });


  /* ---------- admin: change a status pill from a button or a select ---------- */
  var PILL = { Confirmed: 'pill-green', Approved: 'pill-green', Active: 'pill-green', Delivered: 'pill-green', Published: 'pill-green', Completed: 'pill-green',
               Pending: 'pill-amber', 'Checked in': 'pill-blue', Processing: 'pill-amber', Declined: 'pill-red', Cancelled: 'pill-red', Banned: 'pill-red', Shipped: 'pill-blue' };
  function setPill(scope, label) {
    var pill = scope.querySelector('.status-pill'); if (!pill) return;
    pill.className = 'pill status-pill sp ' + (PILL[label] || 'pill-gray');
    pill.textContent = label;
    if (scope.tagName === 'TR') scope.setAttribute('data-status', label);
  }
  $$('[data-set-status]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var label = b.getAttribute('data-set-status');
      setPill(b.closest('tr') || document, label);
      toast(b.getAttribute('data-msg') || ('Status changed to ' + label), 'success');
    });
  });
  $$('select[data-status-select]').forEach(function (sel) {
    sel.addEventListener('change', function () { setPill(document, sel.value); });
  });

  // today's date (save confirmation) and radio-option highlight
  $$('[data-today]').forEach(function (e) { e.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); });
  $$('.status-opt input').forEach(function (r) {
    r.addEventListener('change', function () { $$('.status-opt').forEach(function (o) { o.classList.toggle('on', o.querySelector('input').checked); }); });
  });

  // generic "coming from the form" buttons
  $$('[data-toast]').forEach(function (b) { b.addEventListener('click', function (e) { if (b.tagName === 'A' && b.getAttribute('href') === '#') e.preventDefault(); toast(b.getAttribute('data-toast')); }); });
  $$('a[href="#"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
})();
