// admin.js
// Lógica de Panel CEO, Navegación por pestañas y Mobile

import { getSupabase } from './config.js';
import { checkAuth, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();

    if (!user) {
        window.location.replace('index.html');
        return;
    }

    const supabase = getSupabase();

    try {
        // 1. Verificamos el nivel de acceso en la bóveda
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        const userRole = roleData?.role ? roleData.role.toLowerCase().trim() : 'user';

        if (roleError || userRole !== 'admin') {
            window.location.replace('app.html');
            return;
        }

        // 2. Traemos el nombre del perfil solo para la interfaz gráfica
        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

        // --- SISTEMA INICIADO CORRECTAMENTE ---
        setupAdminNavigation();
        setupAdminTopNav(profile);
        setupAdminEvents();
        await loadDashboardData(supabase);

    } catch (err) {
        console.error("Error validando admin:", err);
        window.location.replace('app.html');
    }
});

function setupAdminNavigation() {
    // 1. Lógica de Pestañas (Menú izquierdo)
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const views = document.querySelectorAll('.admin-view');

    navItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Quitar clase active de todos los botones y vistas
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => view.classList.remove('active'));

            // Añadir active al clickeado
            item.classList.add('active');

            // Lógica simple para este ejemplo:
            // Botón 0 abre view-dashboard, Botón 1 abre view-users
            if (index === 0) document.getElementById('admin-view-dashboard')?.classList.add('active');
            else document.getElementById('admin-view-users')?.classList.add('active');

            // Si estamos en móvil, cerrar el menú tras hacer clic
            closeMobileMenu();
        });
    });

    // 2. Lógica para Celulares (Menú Hamburguesa)
    const btnToggle = document.getElementById('admin-menu-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.getElementById('admin-overlay');

    const openMobileMenu = () => {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    };

    const closeMobileMenu = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    };

    if (btnToggle) btnToggle.addEventListener('click', openMobileMenu);
    if (overlay) overlay.addEventListener('click', closeMobileMenu);
}

function setupAdminEvents() {
    // 🛠️ FIX: Ahora busca todos los botones de cerrar sesión (el del sidebar y el del menú)
    const btnLogouts = document.querySelectorAll('.btn-logout');
    btnLogouts.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            btn.innerHTML = '<span class="spinner" style="width: 15px; height: 15px; border-width: 2px; margin-right: 8px; display: inline-block; vertical-align: middle;"></span> Saliendo...';
            btn.style.opacity = '0.7';
            btn.style.pointerEvents = 'none';
            await logout();
        });
    });

    const btnExport = document.getElementById('btn-export-csv');
    // ... mantén el resto del código de btnExport igual ...
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const table = document.querySelector('.admin-table');
            if (!table) return;
            let csv = [];
            for (let i = 0; i < table.rows.length; i++) {
                let row = [];
                let cols = table.rows[i].querySelectorAll('td, th');
                for (let j = 0; j < cols.length; j++) {
                    let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
                    row.push('"' + data + '"');
                }
                csv.push(row.join(','));
            }
            const csvString = csv.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "usuarios_raices_digital.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
}

// 👑 NUEVA FUNCIÓN: Lógica del menú desplegable del CEO
function setupAdminTopNav(profile) {
    const btnAvatar = document.getElementById('admin-avatar-btn');
    const dropdown = document.getElementById('admin-dropdown');
    const avatarCircle = document.querySelector('.avatar-circle');

    // Ponemos tu inicial real
    if (profile && profile.first_name) {
        avatarCircle.textContent = profile.first_name.charAt(0).toUpperCase();
    }

    if (btnAvatar && dropdown) {
        btnAvatar.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        // Cerrar al hacer clic en cualquier otra parte
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btnAvatar.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }
}

// ... Mantén tus funciones loadDashboardData() y loadRecentUsers() exactamente igual que antes ...
async function loadDashboardData(supabase) {
    try {
        const { count: totalUsers, error: errUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (!errUsers && totalUsers !== null) document.querySelector('.kpi-grid .stat-card:nth-child(1) .stat-number').textContent = totalUsers;

        const { count: totalMembers, error: errMembers } = await supabase.from('family_members').select('*', { count: 'exact', head: true });
        if (!errMembers && totalMembers !== null) document.querySelector('.kpi-grid .stat-card:nth-child(2) .stat-number').textContent = totalMembers;

        await loadRecentUsers(supabase);
    } catch (error) {
        console.error("Error cargando métricas:", error);
    }
}

async function loadRecentUsers(supabase) {
    const { data: perfiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5);
    if (error) return;

    const tbody = document.querySelector('.admin-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    perfiles.forEach(perfil => {
        const fecha = new Date(perfil.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        const nombre = perfil.first_name ? `${perfil.first_name} ${perfil.last_name || ''}`.trim() : 'Usuario Nuevo';
        const pais = perfil.country ? `🌍 ${perfil.country}` : 'Oculto';
        const badgePlan = perfil.role === 'admin' ? '<span class="badge badge-pro">Admin</span>' : '<span class="badge badge-free">Semilla</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${nombre}</strong><span style="display: block; font-size: 0.8rem; color: gray;">Se unió: ${fecha}</span></td>
            <td>${badgePlan}</td>
            <td>--</td>
            <td><span style="font-size: 0.8rem; color: gray;">${pais}</span></td>
            <td><span class="badge badge-active">Activo</span></td>
        `;
        tbody.appendChild(tr);
    });
}