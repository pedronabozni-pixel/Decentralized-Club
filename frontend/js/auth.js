// ==========================================================================
//  Tela de acesso: alternancia login/registro, submit e redirecionamento.
// ==========================================================================
(function () {
  // Ja autenticado? vai direto ao dashboard.
  if (window.API.Auth.isAuthed) {
    window.location.href = '/pages/dashboard.html';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabs = document.querySelectorAll('.auth-tab');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      loginForm.classList.toggle('hidden', !isLogin);
      registerForm.classList.toggle('hidden', isLogin);
    });
  });

  function onSuccess({ token, user }) {
    window.API.Auth.set(token, user);
    window.location.href = '/pages/dashboard.html';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button');
    btn.disabled = true; btn.textContent = 'Entrando...';
    try {
      const res = await window.API.login(
        document.getElementById('loginEmail').value.trim(),
        document.getElementById('loginPassword').value
      );
      onSuccess(res);
    } catch (err) {
      window.App.toast(err.message || 'Falha ao entrar.', 'error');
      btn.disabled = false; btn.textContent = 'Acessar plataforma';
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('button');
    btn.disabled = true; btn.textContent = 'Criando...';
    try {
      const res = await window.API.register({
        name: document.getElementById('regName').value.trim() || undefined,
        email: document.getElementById('regEmail').value.trim(),
        password: document.getElementById('regPassword').value,
      });
      onSuccess(res);
    } catch (err) {
      const detail = err.details?.[0]?.message;
      window.App.toast(detail || err.message || 'Falha ao criar conta.', 'error');
      btn.disabled = false; btn.textContent = 'Criar conta';
    }
  });
})();
