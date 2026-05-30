// ============================================================
// Clara's Babysitting — Calendar Widget
// ============================================================

const Calendar = (() => {
  const MONTHS = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let _year, _month, _selected = null;
  let _onSelect = null;
  let _blockedDates = new Set();
  let _bookedDates  = new Set();
  let _containerId  = null;

  function init({ containerId, onSelect, blockedDates = [], bookedDates = [] }) {
    _containerId = containerId;
    _onSelect    = onSelect;
    _blockedDates = new Set(blockedDates);
    _bookedDates  = new Set(bookedDates);
    const now    = new Date();
    _year  = now.getFullYear();
    _month = now.getMonth();
    render();
  }

  function render() {
    const container = document.getElementById(_containerId);
    if (!container) return;

    const firstDay = new Date(_year, _month, 1).getDay();
    const daysInMonth = new Date(_year, _month+1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    // Build header
    let html = `
      <div class="calendar-nav">
        <button class="cal-btn" id="cal-prev">&#8249;</button>
        <span class="calendar-nav-title">${MONTHS[_month]} ${_year}</span>
        <button class="cal-btn" id="cal-next">&#8250;</button>
      </div>
      <div class="calendar-days-header">
        ${DAYS.map(d => `<div class="calendar-day-label">${d}</div>`).join('')}
      </div>
      <div class="calendar-grid">
    `;

    // Leading blanks
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="cal-day other-month disabled"></div>`;
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${_year}-${String(_month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cellDate = new Date(_year, _month, d);
      const isToday   = cellDate.getTime() === today.getTime();
      const isPast    = cellDate < today;
      const isBlocked = _blockedDates.has(dateStr);
      const hasBooking = _bookedDates.has(dateStr);
      const isSelected = _selected === dateStr;

      let cls = 'cal-day';
      if (isToday)   cls += ' today';
      if (isPast)    cls += ' disabled';
      if (isBlocked) cls += ' blocked';
      else if (hasBooking && !isPast) cls += ' has-booking';
      if (isSelected) cls += ' selected';

      html += `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Bind prev/next
    container.querySelector('#cal-prev').addEventListener('click', () => {
      _month--;
      if (_month < 0) { _month = 11; _year--; }
      render();
    });
    container.querySelector('#cal-next').addEventListener('click', () => {
      _month++;
      if (_month > 11) { _month = 0; _year++; }
      render();
    });

    // Bind day clicks
    container.querySelectorAll('.cal-day:not(.disabled):not(.blocked)').forEach(el => {
      el.addEventListener('click', () => {
        _selected = el.dataset.date;
        render();
        if (_onSelect) _onSelect(_selected);
      });
    });
  }

  function updateBookedDates(dates) {
    _bookedDates = new Set(dates);
    render();
  }

  function updateBlockedDates(dates) {
    _blockedDates = new Set(dates);
    render();
  }

  function getSelected() { return _selected; }

  return { init, render, updateBookedDates, updateBlockedDates, getSelected };
})();

window.Calendar = Calendar;
