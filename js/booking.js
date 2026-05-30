// ============================================================
// Clara's Babysitting — Booking Engine
// ============================================================

const Booking = (() => {

  const SERVICES = [
    { id: 'evening',    label: 'Evening Babysitting',  emoji: '🌙' },
    { id: 'weekend',    label: 'Weekend Care',          emoji: '☀️' },
    { id: 'afterschool',label: 'After-School Care',    emoji: '📚' },
    { id: 'emergency',  label: 'Emergency Childcare',  emoji: '🚨' },
  ];

  const TIME_SLOTS = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM',  '2:00 PM',  '3:00 PM',
    '4:00 PM',  '5:00 PM',  '6:00 PM',  '7:00 PM',
    '8:00 PM',
  ];

  // ---- Check if a specific date+time is blocked ----
  async function isBlocked(dateStr, timeStr) {
    // Check full-day block
    const daySnap = await db.collection('blockedSlots')
      .where('date', '==', dateStr)
      .where('time', '==', 'ALL_DAY')
      .limit(1).get();
    if (!daySnap.empty) return true;

    if (timeStr) {
      // Check specific time block
      const slotSnap = await db.collection('blockedSlots')
        .where('date', '==', dateStr)
        .where('time', '==', timeStr)
        .limit(1).get();
      if (!slotSnap.empty) return true;
    }
    return false;
  }

  // ---- Check if a slot already has a booking ----
  async function isBooked(dateStr, timeStr) {
    const snap = await db.collection('bookings')
      .where('date', '==', dateStr)
      .where('time', '==', timeStr)
      .where('status', 'in', ['Pending', 'Approved'])
      .limit(1).get();
    return !snap.empty;
  }

  // ---- Get all blocked slots (for rendering) ----
  async function getBlockedSlots() {
    const snap = await db.collection('blockedSlots').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ---- Get slot statuses for a given date ----
  async function getSlotsForDate(dateStr) {
    const [blocked, bookingsSnap] = await Promise.all([
      getBlockedSlots(),
      db.collection('bookings')
        .where('date', '==', dateStr)
        .where('status', 'in', ['Pending', 'Approved'])
        .get()
    ]);

    const blockedTimes = new Set(
      blocked
        .filter(b => b.date === dateStr)
        .map(b => b.time)
    );
    const isAllDayBlocked = blockedTimes.has('ALL_DAY');

    const bookedTimes = new Set(
      bookingsSnap.docs.map(d => d.data().time)
    );

    return TIME_SLOTS.map(t => ({
      time: t,
      status: isAllDayBlocked || blockedTimes.has(t)
        ? 'blocked'
        : bookedTimes.has(t)
          ? 'booked'
          : 'available'
    }));
  }

  // ---- Create a booking ----
  async function createBooking({ userId, parentName, email, service, date, time }) {
    // Double-check: block + duplicate
    const [blocked, booked] = await Promise.all([
      isBlocked(date, time),
      isBooked(date, time)
    ]);

    if (blocked) throw new Error('This date or time is not available for booking.');
    if (booked)  throw new Error('This time slot has already been booked. Please choose another.');

    const ref = await db.collection('bookings').add({
      userId,
      parentName,
      email,
      service,
      date,
      time,
      status:    'Pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  // ---- Cancel a booking (user-facing) ----
  async function cancelBooking(bookingId, userId) {
    const ref  = db.collection('bookings').doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Booking not found.');
    const data = snap.data();
    if (data.userId !== userId) throw new Error('Unauthorised.');
    if (data.status === 'Cancelled') throw new Error('Booking is already cancelled.');

    // Can only cancel if date is in future
    const bookingDate = new Date(data.date + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    if (bookingDate < today) throw new Error('Cannot cancel a past booking.');

    await ref.update({ status: 'Cancelled' });
  }

  // ---- Get bookings for a user ----
  async function getUserBookings(userId) {
    const snap = await db.collection('bookings')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ---- Helpers ----
  function formatDate(dateStr) {
    const [y,m,d] = dateStr.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function isPast(dateStr) {
    const [y,m,d] = dateStr.split('-').map(Number);
    const date = new Date(y, m-1, d);
    const today = new Date(); today.setHours(0,0,0,0);
    return date < today;
  }

  function serviceName(id) {
    return SERVICES.find(s => s.id === id)?.label || id;
  }

  return {
    SERVICES, TIME_SLOTS,
    isBlocked, isBooked, getBlockedSlots,
    getSlotsForDate, createBooking, cancelBooking,
    getUserBookings, formatDate, toDateStr, isPast, serviceName
  };
})();

window.Booking = Booking;
