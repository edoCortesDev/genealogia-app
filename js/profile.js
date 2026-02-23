// profile.js
// Lógica para gestionar el perfil del usuario utilizando Supabase

import { getSupabase } from './config.js';
import { checkAuth } from './auth.js';
import { showLoader, hideLoader } from './ui.js';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('view-profile')) return;

    currentUser = await checkAuth();
    if (!currentUser) return;

    // Load initial profile data
    await loadProfileData();

    // Handle form submit
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProfileData();
        });
    }
});

async function loadProfileData() {
    const supabase = getSupabase();
    showLoader();

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    hideLoader();

    if (error) {
        console.error("Error loading profile:", error);
        return;
    }

    if (profile) {
        document.getElementById('prof-firstname').value = profile.first_name || '';
        document.getElementById('prof-lastname').value = profile.last_name || '';
        document.getElementById('prof-country').value = profile.country || '';

        // Update avatar preview
        const preview = document.getElementById('profile-avatar-preview');
        if (profile.first_name) {
            preview.textContent = profile.first_name.charAt(0).toUpperCase();
        }
    }
}

async function saveProfileData() {
    const supabase = getSupabase();
    const firstName = document.getElementById('prof-firstname').value;
    const lastName = document.getElementById('prof-lastname').value;
    const country = document.getElementById('prof-country').value;

    showLoader();

    const { error } = await supabase
        .from('profiles')
        .update({
            first_name: firstName,
            last_name: lastName,
            country: country
        })
        .eq('id', currentUser.id);

    hideLoader();

    if (error) {
        console.error("Error saving profile:", error);
        alert("Error al guardar el perfil: " + error.message);
    } else {
        // Actualizar UI si es necesario
        const preview = document.getElementById('profile-avatar-preview');
        preview.textContent = firstName.charAt(0).toUpperCase();
        document.querySelector('.avatar-circle').textContent = firstName.charAt(0).toUpperCase();

        // Efecto visual de guardado exitoso (glow extra temporal)
        const btn = document.querySelector('#profile-form button[type="submit"]');
        btn.textContent = "¡Guardado!";
        btn.classList.add('btn-glow');
        btn.style.boxShadow = "0 0 20px var(--success)";
        setTimeout(() => {
            btn.textContent = "Guardar Cambios";
            btn.style.boxShadow = "";
        }, 2000);
    }
}
