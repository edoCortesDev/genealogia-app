// ui.js
import { checkAuth, logout, loginUsuario, registrarUsuario } from './auth.js';
import { getSupabase } from './config.js';

// ==========================================
// 🚦 EL GUARDIA DE TRÁFICO SEGURO
// ==========================================
async function safeRouteUser(user) {
    if (!user) return;
    const supabase = getSupabase();

    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        // Limpiamos el texto para que coincida exactamente con la lógica de admin.js
        const userRole = profile?.role ? profile.role.toLowerCase().trim() : 'user';

        // Redirigimos sin dejar historial "basura" en el navegador
        if (userRole === 'admin') {
            window.location.replace('admin.html');
        } else {
            window.location.replace('app.html');
        }
    } catch (err) {
        console.error("Error enrutando al usuario:", err);
        window.location.replace('app.html'); // En caso de falla, va a la app normal
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // ==========================================
    // 1. LÓGICA PARA EL INDEX / LANDING PAGE
    // ==========================================
    if (document.body.classList.contains('landing-page')) {
        // Activamos los botones PRIMERO para que el usuario pueda interactuar sin demoras
        setupLandingModals();

        const user = await checkAuth();
        if (user) {
            // Si el usuario entra a la web y ya tenía la sesión iniciada
            await safeRouteUser(user);
        }
    }

    // ==========================================
    // 2. LÓGICA PARA LA APP (ÁRBOL GENEALÓGICO)
    // ==========================================
    if (document.body.classList.contains('app-page')) {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedTreeId = urlParams.get('tree');

        if (sharedTreeId) {
            // 👁️ MODO "SOLO ÁRBOL" ESTRICTO (Invitado de WhatsApp)
            const btnManage = document.getElementById('menu-family');
            const btnProfileBtn = document.getElementById('user-avatar-btn');
            const btnShare = document.getElementById('btn-share-tree');
            const btnMobileMenu = document.getElementById('mobile-menu-toggle');

            // 👇 Agregamos los botones de Inicio y Línea de Tiempo a la lista de ocultos
            const btnDashboard = document.getElementById('menu-dashboard');
            const btnTimeline = document.getElementById('menu-timeline');

            if(btnManage) btnManage.style.display = 'none';
            if(btnProfileBtn) btnProfileBtn.style.display = 'none';
            if(btnShare) btnShare.style.display = 'none';
            if(btnMobileMenu) btnMobileMenu.style.display = 'none';
            if(btnDashboard) btnDashboard.style.display = 'none';
            if(btnTimeline) btnTimeline.style.display = 'none';

            setupViewRouter();
            window.switchView('tree'); // Lanzamos directo al árbol
        } else {
            // 👑 MODO DUEÑO (Login Normal)
            const user = await checkAuth();
            if (!user) {
                window.location.replace('index.html');
                return;
            }
            setupAppNav(user);
            setupViewRouter();
        }
    }
});

// ==========================================
// FUNCIONES DE LA LANDING PAGE (INDEX)
// ==========================================
function setupLandingModals() {
    const modalLogin = document.getElementById('modal-login');
    const modalRegister = document.getElementById('modal-register');

    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const btnHeroStart = document.getElementById('btn-hero-start');

    const closeBtns = document.querySelectorAll('.btn-close');
    const linkToRegister = document.getElementById('link-to-register');

    const openLogin = () => {
        if (modalRegister) modalRegister.classList.add('hidden');
        if (modalLogin) modalLogin.classList.remove('hidden');
    };
    const openRegister = () => {
        if (modalLogin) modalLogin.classList.add('hidden');
        if (modalRegister) modalRegister.classList.remove('hidden');
    };
    const closeAll = () => {
        if (modalLogin) modalLogin.classList.add('hidden');
        if (modalRegister) modalRegister.classList.add('hidden');
    };

    if (btnLogin) btnLogin.addEventListener('click', (e) => { e.preventDefault(); openLogin(); });
    if (btnSignup) btnSignup.addEventListener('click', (e) => { e.preventDefault(); openRegister(); });
    if (btnHeroStart) btnHeroStart.addEventListener('click', (e) => { e.preventDefault(); openRegister(); });
    if (linkToRegister) linkToRegister.addEventListener('click', (e) => { e.preventDefault(); openRegister(); });

    closeBtns.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); closeAll(); }));
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAll);
    });

    // --- Formulario de Login ---
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            if (errorEl) errorEl.classList.add('hidden');
            showLoader();

            const { data, error } = await loginUsuario(email, password);
            hideLoader();

            if (error) {
                if (errorEl) {
                    errorEl.textContent = error.message;
                    errorEl.classList.remove('hidden');
                }
            } else {
                // Al loguearse con éxito, el Guardia de Tráfico decide a dónde va
                const loggedUser = data?.user || await checkAuth();
                if (loggedUser) await safeRouteUser(loggedUser);
            }
        });
    }

    // --- Formulario de Registro ---
    const formRegister = document.getElementById('form-register');
    if (formRegister) {
        formRegister.addEventListener('submit', async (e) => {
            e.preventDefault();
            const firstName = document.getElementById('reg-firstname').value;
            const lastName = document.getElementById('reg-lastname').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            const errorEl = document.getElementById('reg-error');
            const successEl = document.getElementById('reg-success');

            if (errorEl) errorEl.classList.add('hidden');
            if (successEl) successEl.classList.add('hidden');
            showLoader();

            const { data, error } = await registrarUsuario(email, password, firstName, lastName);
            hideLoader();

            if (error) {
                if (errorEl) {
                    errorEl.textContent = error.message;
                    errorEl.classList.remove('hidden');
                }
            } else {
                if (successEl) {
                    successEl.textContent = "¡Registro exitoso! Iniciando sesión...";
                    successEl.classList.remove('hidden');
                }
                setTimeout(async () => {
                    const loggedUser = data?.user || await checkAuth();
                    if (loggedUser) await safeRouteUser(loggedUser);
                }, 1500);
            }
        });
    }
}

// ==========================================
// FUNCIONES DE LA APLICACIÓN (APP.HTML)
// ==========================================
async function setupAppNav(user) {
    const btnAvatar = document.getElementById('user-avatar-btn');
    const dropdown = document.getElementById('user-dropdown');

    // 🔗 LÓGICA DEL BOTÓN COMPARTIR
    const btnShare = document.getElementById('btn-share-tree');
    if (btnShare && user) {
        btnShare.addEventListener('click', async (e) => {
            e.preventDefault();
            // Creamos el enlace único con el ID del usuario
            const shareUrl = `${window.location.origin}/app.html?tree=${user.id}`;
            try {
                await navigator.clipboard.writeText(shareUrl);
                btnShare.textContent = "✅ ¡Enlace copiado!";
                setTimeout(() => btnShare.innerHTML = "🔗 Compartir", 3000);
            } catch (err) {
                // Plan B por si el navegador bloquea el portapapeles
                alert("Tu enlace para compartir por WhatsApp es:\n\n" + shareUrl);
            }
        });
    }

    // Inicial del usuario en el avatar... (Mantén el resto de tu código setupAppNav igual desde aquí hacia abajo)
    if (user && user.user_metadata && user.user_metadata.first_name) {
        const initial = user.user_metadata.first_name.charAt(0).toUpperCase();
        const avatarCircle = document.querySelector('.avatar-circle');
        if (avatarCircle) avatarCircle.textContent = initial;
    }

    const supabase = getSupabase();
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (profile && profile.role && profile.role.toLowerCase().trim() === 'admin') {
        const ul = dropdown.querySelector('ul');
        if (ul) {
            const li = document.createElement('li');
            li.innerHTML = '<a href="admin.html" class="dropdown-item" style="color: var(--accent); font-weight: bold;">👑 Panel CEO</a>';
            ul.insertBefore(li, ul.firstChild);
            const div = document.createElement('li');
            div.className = 'divider';
            ul.insertBefore(div, li.nextSibling);
        }
    }

    if (btnAvatar && dropdown) {
        btnAvatar.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btnAvatar.contains(e.target)) dropdown.classList.add('hidden');
        });
    }

    const btnLogout = document.getElementById('menu-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }
}

function setupViewRouter() {
    const views = {
        'dashboard': document.getElementById('view-dashboard'),
        'tree': document.getElementById('view-tree'),
        'profile': document.getElementById('view-profile'),
        'manage': document.getElementById('view-manage'),
        'detail': document.getElementById('view-person-detail'),
        'timeline': document.getElementById('view-timeline')
    };

    window.switchView = function (viewId) {
        Object.values(views).forEach(v => {
            if (v) v.classList.add('hidden');
        });
        if (views[viewId]) {
            views[viewId].classList.remove('hidden');
        }

        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.add('hidden');

        const mobileMenu = document.getElementById('nav-links-wrapper');
        if (mobileMenu) mobileMenu.classList.remove('active');

        if (viewId === 'tree' && window.familyTree) {
            window.familyTree.resize();
        }
    };

    const btnHome = document.getElementById('menu-dashboard');
    const btnTree = document.getElementById('menu-tree');
    const btnFamily = document.getElementById('menu-family');
    const btnProfile = document.getElementById('menu-profile');
    const btnTimeline = document.getElementById('menu-timeline');
    const logo = document.querySelector('.logo');

    const btnMobileToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('nav-links-wrapper');
    if (btnMobileToggle && mobileMenu) {
        btnMobileToggle.addEventListener('click', (e) => {
            e.preventDefault();
            mobileMenu.classList.toggle('active');
        });
    }

    if (btnHome) btnHome.addEventListener('click', (e) => { e.preventDefault(); window.switchView('dashboard'); });
    if (logo) logo.addEventListener('click', (e) => { e.preventDefault(); window.switchView('dashboard'); });
    if (btnTree) btnTree.addEventListener('click', (e) => { e.preventDefault(); window.switchView('tree'); });
    if (btnTimeline) btnTimeline.addEventListener('click', (e) => { e.preventDefault(); window.switchView('timeline'); });
    if (btnFamily) btnFamily.addEventListener('click', (e) => { e.preventDefault(); window.switchView('manage'); });
    if (btnProfile) btnProfile.addEventListener('click', (e) => { e.preventDefault(); window.switchView('profile'); });

    const btnBack = document.getElementById('btn-back-dashboard');
    if (btnBack) btnBack.addEventListener('click', () => window.switchView('dashboard'));
}

export function showLoader() {
    document.getElementById('global-loader')?.classList.remove('hidden');
}

export function hideLoader() {
    document.getElementById('global-loader')?.classList.add('hidden');
}