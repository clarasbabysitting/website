// ============================================================
// Clara's Babysitting — Admin Dashboard
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  Auth.requireAdmin();

  // ---- State ----
  let allBookings = [];
  let allUsers    = [];
  let blockedSlots = [];
  let statusFilter = 'all';

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

  // ---- Nav ----
  function setView(id) {
    document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const view = document.getElementById(`view-${id}`);
    const link = document.querySelector(`[data-view="${id}"]`);
    if (view) view.classList.add('active');
    if (link) link.classList.add('active');

    const titles = {
      overview:     'Admin Overview',
      bookings:     'Booking Management',
      availability: 'Availability Manager',
      calendar:     'Calendar View',
      customers:    'Customer Management',
      export:       'Export Data'
    };
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = titles[id] || 'Admin';
  }

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      const v = link.dataset.view;
      if (v) { setView(v); if(v==='calendar') renderAdminCalendar(); }
    });
  });

  // ---- Mobile sidebar ----
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  // ---- User ready ----
  document.addEventListener('userReady', async ({ detail: user }) => {
    document.querySelectorAll('.user-display-name').forEach(el => el.textContent = user.fullName || user.email);
    document.querySelectorAll('.user-display-avatar').forEach(el => {
      el.textContent = (user.fullName || user.email || 'A').charAt(0).toUpperCase();
    });
    await loadAll();
    setView('overview');
  });

  // ---- Load everything ----
  async function loadAll() {
    try {
      const [bSnap, uSnap, blSnap] = await Promise.all([
        db.collection('bookings').orderBy('createdAt','desc').get(),
        db.collection('users').where('role','==','user').get(),
        db.collection('blockedSlots').orderBy('date','asc').get()
      ]);
      allBookings  = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      allUsers     = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      blockedSlots = blSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      renderOverview();
      renderBookingsTable();
      renderBlockedList();
      renderCustomers();
      updatePendingBadge();
    } catch(err) {
      console.error(err);
      toast('Failed to load data.', 'error');
    }
  }

  // ---- Overview ----
  function renderOverview() {
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('stat-total-bookings', allBookings.length);
    set('stat-pending',   allBookings.filter(b=>b.status==='Pending').length);
    set('stat-approved',  allBookings.filter(b=>b.status==='Approved').length);
    set('stat-customers', allUsers.length);

    // Recent bookings
    const tbody = document.getElementById('recent-body');
    if (tbody) {
      const recent = allBookings.slice(0,8);
      tbody.innerHTML = recent.length ? recent.map(b => bookingRow(b, true)).join('') :
        `<tr><td colspan="7"><div class="empty-state"><p>No bookings yet.</p></div></td></tr>`;
    }
  }

  function updatePendingBadge() {
    const badge = document.getElementById('pending-badge');
    const count = allBookings.filter(b=>b.status==='Pending').length;
    if (badge) { badge.textContent = count; badge.style.display = count ? 'inline' : 'none'; }
  }

  // ---- Bookings table ----
  function renderBookingsTable() {
    const tbody = document.getElementById('bookings-body');
    if (!tbody) return;
    const filtered = statusFilter === 'all'
      ? allBookings
      : allBookings.filter(b => b.status === statusFilter);

    tbody.innerHTML = filtered.length ? filtered.map(b => bookingRow(b, true)).join('') :
      `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📭</div><p class="empty-title">No bookings found</p></div></td></tr>`;
  }

  function bookingRow(b, showActions) {
    return `
      <tr>
        <td>${b.parentName || '—'}</td>
        <td>${b.email||'—'}</td>
        <td>${Booking.formatDate(b.date)}</td>
        <td>${b.time}</td>
        <td>${Booking.serviceName(b.service)}</td>
        <td>${statusBadge(b.status)}</td>
        ${showActions ? `<td><div class="table-actions">${actionButtons(b)}</div></td>` : ''}
      </tr>
    `;
  }

  function actionButtons(b) {
    const btns = [];
    if (b.status === 'Pending') {
      btns.push(`<button class="action-btn action-approve" onclick="adminAction('${b.id}','Approved')">Approve</button>`);
      btns.push(`<button class="action-btn action-reject"  onclick="adminAction('${b.id}','Rejected')">Reject</button>`);
    }
    if (['Pending','Approved'].includes(b.status) && !Booking.isPast(b.date)) {
      btns.push(`<button class="action-btn action-cancel" onclick="adminAction('${b.id}','Cancelled')">Cancel</button>`);
    }
    return btns.join('') || '<span style="color:var(--muted);font-size:.8rem">—</span>';
  }

  window.adminAction = async (bookingId, newStatus) => {
    if (!confirm(`Set booking to "${newStatus}"?`)) return;
    try {
      await db.collection('bookings').doc(bookingId).update({ status: newStatus });
      toast(`Booking ${newStatus.toLowerCase()}.`);
      await loadAll();
    } catch(err) {
      toast(err.message, 'error');
    }
  };

  // ---- Status filter ----
  const filterSel = document.getElementById('status-filter');
  if (filterSel) {
    filterSel.addEventListener('change', () => {
      statusFilter = filterSel.value;
      renderBookingsTable();
    });
  }

  // ---- Block date (entire day) ----
  const blockDayBtn = document.getElementById('block-day-btn');
  if (blockDayBtn) {
    blockDayBtn.addEventListener('click', async () => {
      const date   = document.getElementById('block-date').value;
      const reason = document.getElementById('block-reason').value.trim() || 'Blocked';
      if (!date) { toast('Please select a date.','error'); return; }

      // Check if already blocked
      const existing = blockedSlots.find(s => s.date===date && s.time==='ALL_DAY');
      if (existing) { toast('Date is already blocked.','info'); return; }

      blockDayBtn.disabled = true;
      try {
        await db.collection('blockedSlots').add({ date, time: 'ALL_DAY', reason });
        toast('Date blocked successfully.');
        document.getElementById('block-date').value = '';
        document.getElementById('block-reason').value = '';
        await loadAll();
      } catch(err) {
        toast(err.message,'error');
      } finally { blockDayBtn.disabled = false; }
    });
  }

  // ---- Block specific time slot ----
  const blockSlotBtn = document.getElementById('block-slot-btn');
  if (blockSlotBtn) {
    // Populate time select
    const timeEl = document.getElementById('block-slot-time');
    if (timeEl) {
      timeEl.innerHTML = Booking.TIME_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('');
    }

    blockSlotBtn.addEventListener('click', async () => {
      const date   = document.getElementById('block-slot-date').value;
      const time   = timeEl ? timeEl.value : '';
      const reason = document.getElementById('block-slot-reason').value.trim() || 'Blocked';
      if (!date || !time) { toast('Please fill in all fields.','error'); return; }

      const existing = blockedSlots.find(s => s.date===date && s.time===time);
      if (existing) { toast('This slot is already blocked.','info'); return; }

      blockSlotBtn.disabled = true;
      try {
        await db.collection('blockedSlots').add({ date, time, reason });
        toast('Time slot blocked.');
        document.getElementById('block-slot-date').value = '';
        await loadAll();
      } catch(err) {
        toast(err.message,'error');
      } finally { blockSlotBtn.disabled = false; }
    });
  }

  // ---- Render blocked list ----
  function renderBlockedList() {
    const el = document.getElementById('blocked-list');
    if (!el) return;
    if (!blockedSlots.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div><p class="empty-title">No blocked slots</p></div>`;
      return;
    }
    el.innerHTML = blockedSlots.map(s => `
      <div class="blocked-item">
        <div class="blocked-item-info">
          <div class="blocked-date">${Booking.formatDate(s.date)} — ${s.time === 'ALL_DAY' ? 'All Day' : s.time}</div>
          <div class="blocked-reason">${s.reason}</div>
        </div>
        <button class="action-btn action-unblock" onclick="unblockSlot('${s.id}')">Unblock</button>
      </div>
    `).join('');
  }

  window.unblockSlot = async (slotId) => {
    if (!confirm('Unblock this date/time?')) return;
    try {
      await db.collection('blockedSlots').doc(slotId).delete();
      toast('Unblocked successfully.');
      await loadAll();
    } catch(err) {
      toast(err.message,'error');
    }
  };

  // ---- Customers ----
  function renderCustomers() {
    const el = document.getElementById('customers-grid');
    if (!el) return;
    if (!allUsers.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p class="empty-title">No customers yet</p></div>`;
      return;
    }
    el.innerHTML = allUsers.map(u => {
      const ubs = allBookings.filter(b => b.userId === u.uid || b.userId === u.id);
      const approved = ubs.filter(b=>b.status==='Approved').length;
      const pending  = ubs.filter(b=>b.status==='Pending').length;
      const initial  = (u.fullName||u.email||'?').charAt(0).toUpperCase();
      return `
        <div class="customer-card">
          <div class="customer-card-top">
            <div class="customer-avatar">${initial}</div>
            <div>
              <div class="customer-name">${u.fullName||'—'}</div>
              <div class="customer-email">${u.email}</div>
            </div>
          </div>
          <div class="customer-stats">
            <div class="customer-stat"><span class="customer-stat-val">${ubs.length}</span><span class="customer-stat-label">Total</span></div>
            <div class="customer-stat"><span class="customer-stat-val">${approved}</span><span class="customer-stat-label">Approved</span></div>
            <div class="customer-stat"><span class="customer-stat-val">${pending}</span><span class="customer-stat-label">Pending</span></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Admin Calendar ----
  function renderAdminCalendar() {
    const blockedDateSet = new Set(
      blockedSlots.filter(s=>s.time==='ALL_DAY').map(s=>s.date)
    );
    const bookedDateSet = new Set(
      allBookings.filter(b=>['Pending','Approved'].includes(b.status)).map(b=>b.date)
    );
    Calendar.init({
      containerId: 'admin-cal-widget',
      blockedDates: [...blockedDateSet],
      bookedDates:  [...bookedDateSet],
      onSelect: dateStr => {
        const dayBookings = allBookings.filter(b=>b.date===dateStr);
        const dayEl = document.getElementById('cal-day-bookings');
        if (!dayEl) return;
        if (!dayBookings.length) {
          dayEl.innerHTML = `<p style="color:var(--muted);padding:16px 0">No bookings for this day.</p>`;
        } else {
          dayEl.innerHTML = `<table><thead><tr><th>Time</th><th>Parent</th><th>Service</th><th>Status</th></tr></thead>
          <tbody>${dayBookings.map(b=>`
            <tr>
              <td>${b.time}</td><td>${b.parentName}</td>
              <td>${Booking.serviceName(b.service)}</td>
              <td>${statusBadge(b.status)}</td>
            </tr>
          `).join('')}</tbody></table>`;
        }
      }
    });
  }

  // ---- Export CSV ----
  window.exportCSV = () => {
    const filter = document.getElementById('export-filter') ? document.getElementById('export-filter').value : 'all';
    const data = filter === 'all' ? allBookings : allBookings.filter(b=>b.status===filter);

    const headers = ['Booking ID','Parent Name','Email','Date','Time','Service','Status','Created'];
    const rows = data.map(b => [
      b.id, b.parentName, b.email, b.date, b.time,
      Booking.serviceName(b.service), b.status,
      b.createdAt?.toDate ? b.createdAt.toDate().toLocaleDateString() : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='claras-bookings.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported successfully.');
  };

  // ---- Status helpers ----
  function statusBadge(status) {
    const map = { Pending:'badge-pending', Approved:'badge-approved', Rejected:'badge-rejected', Cancelled:'badge-cancelled' };
    return `<span class="badge ${map[status]||''}">${status}</span>`;
  }

  // ---- Logout ----
  document.querySelectorAll('[data-action="logout"]').forEach(el => {
    el.addEventListener('click', Auth.logout);
  });
});
