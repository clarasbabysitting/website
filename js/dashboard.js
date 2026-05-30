// ============================================================
// Clara's Babysitting — Parent Dashboard
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- Auth guard ----
  Auth.requireAuth();

  // ---- State ----
  let currentUser   = null;
  let selectedDate  = null;
  let selectedTime  = null;
  let selectedService = 'evening';
  let allBookings   = [];
  let blockedSlots  = [];

  // ---- Toast ----
  const toastContainer = document.getElementById('toast-container');
  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ---- Sidebar nav ----
  function setView(id) {
    document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const view = document.getElementById(`view-${id}`);
    const link = document.querySelector(`[data-view="${id}"]`);
    if (view) view.classList.add('active');
    if (link) link.classList.add('active');

    // Update top-bar title
    const titles = {
      overview: 'Dashboard Overview',
      book:     'Book a Session',
      history:  'Booking History',
      account:  'My Account'
    };
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = titles[id] || 'Dashboard';
  }

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      const v = link.dataset.view;
      if (v) setView(v);
    });
  });

  // ---- Mobile sidebar ----
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
  document.addEventListener('click', e => {
    if (sidebar && !sidebar.contains(e.target) && e.target !== sidebarToggle) {
      sidebar.classList.remove('open');
    }
  });

  // ---- User ready ----
  document.addEventListener('userReady', async ({ detail: user }) => {
    currentUser = user;

    // Populate UI
    document.querySelectorAll('.user-display-name').forEach(el => el.textContent = user.fullName || user.email);
    document.querySelectorAll('.user-display-avatar').forEach(el => {
      el.textContent = (user.fullName || user.email || 'U').charAt(0).toUpperCase();
    });
    document.querySelectorAll('.user-display-email').forEach(el => el.textContent = user.email);

    // Account form
    const nameInput = document.getElementById('account-name');
    const emailInput = document.getElementById('account-email');
    if (nameInput) nameInput.value = user.fullName || '';
    if (emailInput) emailInput.value = user.email || '';

    await loadData();
    setView('overview');
  });

  // ---- Load all data ----
  async function loadData() {
    try {
      [allBookings, blockedSlots] = await Promise.all([
        Booking.getUserBookings(currentUser.uid),
        Booking.getBlockedSlots()
      ]);
      renderOverview();
      renderHistory();
      initBookingCalendar();
    } catch (err) {
      console.error(err);
      toast('Failed to load data. Please refresh.', 'error');
    }
  }

  // ---- Overview ----
  function renderOverview() {
    const upcoming = allBookings.filter(b =>
      ['Pending','Approved'].includes(b.status) && !Booking.isPast(b.date)
    );
    const past = allBookings.filter(b =>
      b.status === 'Approved' && Booking.isPast(b.date)
    );
    const pending = allBookings.filter(b => b.status === 'Pending');

    // Stats
    const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    setEl('stat-upcoming',  upcoming.length);
    setEl('stat-past',      past.length);
    setEl('stat-pending',   pending.length);
    setEl('stat-total',     allBookings.length);

    // Upcoming list
    const upList = document.getElementById('upcoming-list');
    if (upList) {
      if (upcoming.length === 0) {
        upList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📅</div>
            <p class="empty-title">No upcoming bookings</p>
            <p class="empty-sub">Ready to book a session?</p>
          </div>`;
      } else {
        upList.innerHTML = `
          <table><thead><tr>
            <th>Date</th><th>Time</th><th>Service</th><th>Status</th><th>Action</th>
          </tr></thead><tbody>
          ${upcoming.slice(0,5).map(b => `
            <tr>
              <td>${Booking.formatDate(b.date)}</td>
              <td>${b.time}</td>
              <td>${Booking.serviceName(b.service)}</td>
              <td>${statusBadge(b.status)}</td>
              <td><button class="action-btn action-cancel" onclick="cancelBooking('${b.id}')">Cancel</button></td>
            </tr>
          `).join('')}
          </tbody></table>`;
      }
    }
  }

  // ---- Booking History ----
  function renderHistory() {
    const histTable = document.getElementById('history-body');
    if (!histTable) return;
    if (allBookings.length === 0) {
      histTable.innerHTML = `<tr><td colspan="5"><div class="empty-state">
        <div class="empty-icon">📋</div>
        <p class="empty-title">No bookings yet</p>
        <p class="empty-sub">Your booking history will appear here.</p>
      </div></td></tr>`;
      return;
    }
    histTable.innerHTML = allBookings.map(b => `
      <tr>
        <td>${Booking.formatDate(b.date)}</td>
        <td>${b.time}</td>
        <td>${Booking.serviceName(b.service)}</td>
        <td>${statusBadge(b.status)}</td>
        <td>${canCancel(b) ? `<button class="action-btn action-cancel" onclick="cancelBooking('${b.id}')">Cancel</button>` : '—'}</td>
      </tr>
    `).join('');
  }

  function canCancel(b) {
    return ['Pending','Approved'].includes(b.status) && !Booking.isPast(b.date);
  }

  function statusBadge(status) {
    const map = {
      Pending:   'badge-pending',
      Approved:  'badge-approved',
      Rejected:  'badge-rejected',
      Cancelled: 'badge-cancelled',
    };
    return `<span class="badge ${map[status]||''}">${status}</span>`;
  }

  // ---- Cancel booking ----
  window.cancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await Booking.cancelBooking(bookingId, currentUser.uid);
      toast('Booking cancelled successfully.');
      await loadData();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // ---- Booking Calendar ----
  function initBookingCalendar() {
    // Determine blocked/booked dates for calendar highlighting
    const blockedDateSet = new Set(
      blockedSlots.filter(s => s.time === 'ALL_DAY').map(s => s.date)
    );
    const bookedDateSet = new Set(
      allBookings
        .filter(b => ['Pending','Approved'].includes(b.status))
        .map(b => b.date)
    );

    Calendar.init({
      containerId: 'cal-widget',
      blockedDates: [...blockedDateSet],
      bookedDates:  [...bookedDateSet],
      onSelect: handleDateSelect
    });

    // Service select
    const serviceEl = document.getElementById('service-select');
    if (serviceEl) {
      serviceEl.innerHTML = Booking.SERVICES.map(s =>
        `<option value="${s.id}">${s.emoji} ${s.label}</option>`
      ).join('');
      serviceEl.addEventListener('change', () => { selectedService = serviceEl.value; });
    }
  }

  async function handleDateSelect(dateStr) {
    selectedDate = dateStr;
    selectedTime = null;

    const slotsEl = document.getElementById('slots-list');
    const dateLabel = document.getElementById('selected-date-label');
    if (dateLabel) dateLabel.textContent = Booking.formatDate(dateStr);

    if (slotsEl) {
      slotsEl.innerHTML = `<div style="text-align:center;padding:24px"><span class="spinner spinner-dark"></span></div>`;
    }

    try {
      const slots = await Booking.getSlotsForDate(dateStr);
      renderSlots(slots);
    } catch (err) {
      console.error(err);
      if (slotsEl) slotsEl.innerHTML = `<p style="color:var(--muted);text-align:center;padding:24px">Failed to load slots.</p>`;
    }
  }

  function renderSlots(slots) {
    const slotsEl = document.getElementById('slots-list');
    if (!slotsEl) return;
    slotsEl.innerHTML = slots.map(s => {
      const cls = s.status === 'blocked' ? 'slot-blocked'
        : s.status === 'booked' ? 'slot-booked' : 'slot-avail';
      const label = s.status === 'blocked' ? 'Blocked'
        : s.status === 'booked' ? 'Booked' : 'Available';
      const disabled = s.status !== 'available' ? 'pointer-events:none' : '';
      return `
        <div class="time-slot ${cls}" style="${disabled}" data-time="${s.time}" onclick="selectSlot('${s.time}')">
          <span>${s.time}</span>
          <span class="badge ${s.status==='available'?'badge-approved':s.status==='booked'?'badge-pending':'badge-rejected'}">${label}</span>
        </div>
      `;
    }).join('');
  }

  window.selectSlot = (time) => {
    selectedTime = time;
    document.querySelectorAll('.time-slot').forEach(el => {
      el.classList.toggle('slot-selected', el.dataset.time === time);
    });
  };

  // ---- Submit booking ----
  const bookBtn = document.getElementById('book-submit-btn');
  if (bookBtn) {
    bookBtn.addEventListener('click', async () => {
      if (!selectedDate || !selectedTime) {
        toast('Please select a date and time.', 'error'); return;
      }
      const serviceEl = document.getElementById('service-select');
      selectedService = serviceEl ? serviceEl.value : 'evening';

      bookBtn.disabled = true;
      bookBtn.innerHTML = '<span class="spinner"></span> Booking…';
      try {
        await Booking.createBooking({
          userId:     currentUser.uid,
          parentName: currentUser.fullName || currentUser.email,
          email:      currentUser.email,
          service:    selectedService,
          date:       selectedDate,
          time:       selectedTime
        });
        toast('Booking request submitted! Awaiting approval.');
        selectedDate = null; selectedTime = null;
        await loadData();
        setView('history');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        bookBtn.disabled = false;
        bookBtn.innerHTML = 'Confirm Booking Request';
      }
    });
  }

  // ---- Logout ----
  document.querySelectorAll('[data-action="logout"]').forEach(el => {
    el.addEventListener('click', Auth.logout);
  });
});
