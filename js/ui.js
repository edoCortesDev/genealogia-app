// ui.js
import { checkAuth, logout, loginUsuario, registrarUsuario } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {

    // Si estamos en el index
    if (document.body.classList.contains('landing-page')) {
        setupLandingModals();

        // Si ya está logueado, redirigir a app.html
        const user = await checkAuth();
        if (user) {
            window.location.href = 'app.html';
        }
    }

    // Si estamos en la página de la aplicación, verificamos auth y configuramos UI
    if (document.body.classList.contains('app-page')) {
        const user = await checkAuth();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        setupAppNav(user);
        setupViewRouter();
    }
});

function setupLandingModals() {
    const modalLogin = document.getElementById('modal-login');
    const modalRegister = document.getElementById('modal-register');

    const btnLogin = document.getElementById('btn-login');
    const btnSignup = document.getElementById('btn-signup');
    const btnHeroStart = document.getElementById('btn-hero-start');

    const closeBtns = document.querySelectorAll('.btn-close');
    const linkToRegister = document.getElementById('link-to-register');

    // Funciones para abrir
    const openLogin = () => {
        modalRegister.classList.add('hidden');
        modalLogin.classList.remove('hidden');
    };
    const openRegister = () => {
        modalLogin.classList.add('hidden');
        modalRegister.classList.remove('hidden');
    };
    const closeAll = () => {
        modalLogin.classList.add('hidden');
        modalRegister.classList.add('hidden');
    };

    if (btnLogin) btnLogin.addEventListener('click', openLogin);
    if (btnSignup) btnSignup.addEventListener('click', openRegister);
    if (btnHeroStart) btnHeroStart.addEventListener('click', openRegister);
    if (linkToRegister) {
        linkToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            openRegister();
        });
    }

    closeBtns.forEach(btn => btn.addEventListener('click', closeAll));
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', closeAll);
    });

    // Handle Login Submit
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');

            errorEl.classList.add('hidden');
            showLoader();

            const { data, error } = await loginUsuario(email, password);
            hideLoader();

            if (error) {
                errorEl.textContent = error.message;
                errorEl.classList.remove('hidden');
            } else {
                window.location.href = 'app.html';
            }
        });
    }

    // Handle Register Submit
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

            errorEl.classList.add('hidden');
            successEl.classList.add('hidden');
            showLoader();

            const { data, error } = await registrarUsuario(email, password, firstName, lastName);
            hideLoader();

            if (error) {
                errorEl.textContent = error.message;
                errorEl.classList.remove('hidden');
            } else {
                successEl.textContent = "¡Registro exitoso! Iniciando sesión...";
                successEl.classList.remove('hidden');
                setTimeout(() => window.location.href = 'app.html', 1500);
            }
        });
    }
}

function setupAppNav(user) {
    // User Dropdown toggle
    const btnAvatar = document.getElementById('user-avatar-btn');
    const dropdown = document.getElementById('user-dropdown');

    // Set user initial
    if (user && user.user_metadata && user.user_metadata.first_name) {
        const initial = user.user_metadata.first_name.charAt(0).toUpperCase();
        document.querySelector('.avatar-circle').textContent = initial;
    }

    if (btnAvatar && dropdown) {
        btnAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains('hidden');
            if (isHidden) {
                dropdown.classList.remove('hidden');
                btnAvatar.setAttribute('aria-expanded', 'true');
            } else {
                dropdown.classList.add('hidden');
                btnAvatar.setAttribute('aria-expanded', 'false');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
            btnAvatar.setAttribute('aria-expanded', 'false');
        });
    }

    // Logout
    const btnLogout = document.getElementById('menu-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

function setupViewRouter() {
    // Definimos las vistas disponibles
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

        // Hide dropdown on transition
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.add('hidden');

        // Ocultar menú móvil tras navegar
        const mobileMenu = document.getElementById('nav-links-wrapper');
        if (mobileMenu) mobileMenu.classList.remove('active');

        // Si es el árbol, necesitamos decirle que se redimensione para que el canvas pinte bien
        if (viewId === 'tree' && window.familyTree) {
            window.familyTree.resize();
        }
    };

    // Botones del Headeer
    const btnHome = document.getElementById('menu-dashboard');
    const btnTree = document.getElementById('menu-tree');
    const btnFamily = document.getElementById('menu-family');
    const btnProfile = document.getElementById('menu-profile');
    const btnTimeline = document.getElementById('menu-timeline');
    const logo = document.querySelector('.logo');

    // Menú móvil (Kebab) toggle
    const btnMobileToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('nav-links-wrapper');
    if (btnMobileToggle && mobileMenu) {
        btnMobileToggle.addEventListener('click', (e) => {
            e.preventDefault();
            mobileMenu.classList.toggle('active');
        });
    }

    // Asignar listeners
    if (btnHome) btnHome.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });
    if (logo) logo.addEventListener('click', (e) => { e.preventDefault(); switchView('dashboard'); });

    if (btnTree) btnTree.addEventListener('click', (e) => { e.preventDefault(); switchView('tree'); });
    if (btnTimeline) btnTimeline.addEventListener('click', (e) => { e.preventDefault(); switchView('timeline'); });
    if (btnFamily) btnFamily.addEventListener('click', (e) => { e.preventDefault(); switchView('manage'); });
    if (btnProfile) btnProfile.addEventListener('click', (e) => { e.preventDefault(); switchView('profile'); });

    // Botón volver del detalle
    const btnBack = document.getElementById('btn-back-dashboard');
    if (btnBack) btnBack.addEventListener('click', () => switchView('dashboard'));
}

export function showLoader() {
    document.getElementById('global-loader')?.classList.remove('hidden');
}

export function hideLoader() {
    document.getElementById('global-loader')?.classList.add('hidden');
}
