// ============================================================
// Clara's Babysitting — Authentication
// ============================================================

const Auth = (() => {

  // ---- Helpers ----
  const $ = id => document.getElementById(id);
  const show  = el => el && el.classList.add('show');
  const hide  = el => el && el.classList.remove('show');

  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn._originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Please wait…';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn._originalText || btn.innerHTML;
      btn.disabled = false;
    }
  }

  // ---- Route Guards ----
  function requireAuth(redirectTo = 'login.html') {
    auth.onAuthStateChanged(async user => {
      if (!user) {
        window.location.href = redirectTo;
        return;
      }
      // Load user data
      const snap = await db.collection('users').doc(user.uid).get();
      const userData = snap.exists ? snap.data() : {};
      window._currentUser = { ...user, ...userData };
      document.dispatchEvent(new CustomEvent('userReady', { detail: window._currentUser }));
    });
  }

  function requireAdmin(redirectTo = 'dashboard.html') {
    auth.onAuthStateChanged(async user => {
      if (!user) { window.location.href = 'login.html'; return; }
      const snap = await db.collection('users').doc(user.uid).get();
      const userData = snap.exists ? snap.data() : {};
      if (userData.role !== 'admin') { window.location.href = redirectTo; return; }
      window._currentUser = { ...user, ...userData };
      document.dispatchEvent(new CustomEvent('userReady', { detail: window._currentUser }));
    });
  }

  function redirectIfLoggedIn(to = 'dashboard.html') {
    auth.onAuthStateChanged(async user => {
      if (user) {
        const snap = await db.collection('users').doc(user.uid).get();
        const role = snap.exists ? snap.data().role : 'user';
        window.location.href = role === 'admin' ? 'admin.html' : to;
      }
    });
  }

  // ---- Sign Up ----
  function initSignup() {
    const form    = $('signup-form');
    const btn     = $('signup-btn');
    const alertEl = $('signup-alert');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name     = $('signup-name').value.trim();
      const email    = $('signup-email').value.trim();
      const pw       = $('signup-password').value;
      const pwConf   = $('signup-confirm').value;

      hide(alertEl);

      // Validate
      if (!name || !email || !pw || !pwConf) {
        alertEl.textContent = 'Please fill in all fields.';
        show(alertEl); alertEl.className = 'alert alert-error show'; return;
      }
      if (pw.length < 6) {
        alertEl.textContent = 'Password must be at least 6 characters.';
        show(alertEl); alertEl.className = 'alert alert-error show'; return;
      }
      if (pw !== pwConf) {
        alertEl.textContent = 'Passwords do not match.';
        show(alertEl); alertEl.className = 'alert alert-error show'; return;
      }

      setLoading(btn, true);
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, pw);
        await cred.user.updateProfile({ displayName: name });
        await db.collection('users').doc(cred.user.uid).set({
          uid:      cred.user.uid,
          fullName: name,
          email:    email,
          role:     'user',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alertEl.textContent = 'Account created! Redirecting…';
        alertEl.className = 'alert alert-success show';
        setTimeout(() => window.location.href = 'dashboard.html', 1200);
      } catch (err) {
        alertEl.textContent = friendlyError(err.code);
        alertEl.className = 'alert alert-error show';
        setLoading(btn, false);
      }
    });
  }

  // ---- Login ----
  function initLogin() {
    const form    = $('login-form');
    const btn     = $('login-btn');
    const alertEl = $('login-alert');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('login-email').value.trim();
      const pw    = $('login-password').value;

      hide(alertEl);
      if (!email || !pw) {
        alertEl.textContent = 'Please enter your email and password.';
        show(alertEl); alertEl.className = 'alert alert-error show'; return;
      }

      setLoading(btn, true);
      try {
        const cred = await auth.signInWithEmailAndPassword(email, pw);
        const snap = await db.collection('users').doc(cred.user.uid).get();
        const role = snap.exists ? snap.data().role : 'user';
        window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
      } catch (err) {
        alertEl.textContent = friendlyError(err.code);
        alertEl.className = 'alert alert-error show';
        setLoading(btn, false);
      }
    });
  }

  // ---- Logout ----
  function logout() {
    auth.signOut().then(() => window.location.href = 'index.html');
  }

  // ---- Error messages ----
  function friendlyError(code) {
    const map = {
      'auth/email-already-in-use':   'This email is already registered. Try logging in.',
      'auth/invalid-email':          'Please enter a valid email address.',
      'auth/weak-password':          'Password is too weak. Use at least 6 characters.',
      'auth/user-not-found':         'No account found with this email.',
      'auth/wrong-password':         'Incorrect password. Please try again.',
      'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  return { requireAuth, requireAdmin, redirectIfLoggedIn, initSignup, initLogin, logout };
})();

window.Auth = Auth;
