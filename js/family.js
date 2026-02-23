// family.js
// Lógica para gestionar la familia utilizando Supabase

import { getSupabase } from './config.js';
import { checkAuth } from './auth.js';
import { showLoader, hideLoader } from './ui.js';

let currentUser = null;
let familyMembers = []; // Cache local

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('view-manage')) return;

    currentUser = await checkAuth();
    if (!currentUser) return;

    setupUIEvents();
    await loadFamilyMembers();
});

function setupUIEvents() {
    const btnAdd = document.getElementById('btn-add-member');
    const formPanel = document.getElementById('member-form-panel');
    const btnCancel = document.getElementById('btn-cancel-member');
    const memberForm = document.getElementById('member-form');

    // Toggle sidebar
    if (btnAdd && formPanel) {
        btnAdd.addEventListener('click', () => {
            // Reset form for new addition
            memberForm.reset();
            memberForm.removeAttribute('data-edit-id');
            document.getElementById('member-form-title').textContent = "Agregar Familiar";
            formPanel.classList.remove('hidden');
        });
    }

    if (btnCancel && formPanel) {
        btnCancel.addEventListener('click', () => {
            memberForm.removeAttribute('data-edit-id');
            formPanel.classList.add('hidden');
        });
    }

    if (memberForm) {
        memberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveMember();
        });
    }

    // Handlers para Foto (Arrastrar y Soltar)
    const dropArea = document.getElementById('photo-drop-area');
    const fileInput = document.querySelector('.file-input');

    if (dropArea && fileInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
        });

        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });

        fileInput.addEventListener('change', function () {
            handleFiles(this.files);
        });

        function handleFiles(files) {
            if (files.length > 0) {
                const fileMsg = document.querySelector('.file-msg');
                fileMsg.textContent = files[0].name;
                // Guardar referencia al archivo en el DOM provisionalmente
                dropArea.dataset.filePending = true;
            }
        }
    }

    // Funcionalidad de Búsqueda en el Dashboard
    const searchInput = document.getElementById('search-person');
    const resultsContainer = document.getElementById('search-results-container');

    if (searchInput && resultsContainer) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            resultsContainer.innerHTML = '';

            if (query.length < 2) return;

            const results = familyMembers.filter(m =>
                (m.first_name && m.first_name.toLowerCase().includes(query)) ||
                (m.last_name && m.last_name.toLowerCase().includes(query)) ||
                (m.rut && m.rut.toLowerCase().includes(query)) ||
                (m.profession && m.profession.toLowerCase().includes(query))
            );

            if (results.length === 0) {
                resultsContainer.innerHTML = '<p class="text-muted">No se encontraron resultados.</p>';
                return;
            }

            results.forEach(mem => {
                const div = document.createElement('div');
                div.className = 'glass-panel mb-1';
                div.style.padding = '1rem';
                div.style.cursor = 'pointer';
                div.style.transition = 'transform 0.2s';
                div.onmouseover = () => div.style.transform = 'translateY(-2px)';
                div.onmouseout = () => div.style.transform = 'translateY(0)';

                const avatarHtml = mem.photo_url
                    ? `<img src="${mem.photo_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`
                    : `<div class="avatar-circle" style="width: 40px; height: 40px;">${mem.first_name.charAt(0).toUpperCase()}</div>`;

                div.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        ${avatarHtml}
                        <div>
                            <div style="font-weight: 600; color: var(--text-light);">${mem.first_name} ${mem.last_name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted)">${mem.profession || 'Familiar'}</div>
                        </div>
                    </div>
                `;

                div.addEventListener('click', () => {
                    window.openPersonDetails(mem.id);
                    searchInput.value = '';
                    resultsContainer.innerHTML = ''; // Limpiar tras hacer clic
                });

                resultsContainer.appendChild(div);
            });
        });
    }
}

window.openPersonDetails = function (id) {
    const mem = familyMembers.find(m => m.id === id);
    if (!mem) return;

    const detailContainer = document.getElementById('person-detail-content');
    if (!detailContainer) return;

    const avatarHtml = mem.photo_url
        ? `<img src="${mem.photo_url}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); margin: 0 auto 1.5rem auto; display: block;">`
        : `<div class="avatar-circle" style="width: 120px; height: 120px; font-size: 3rem; margin: 0 auto 1.5rem auto; display: flex;">${mem.first_name.charAt(0).toUpperCase()}</div>`;

    const getRelStr = getRelationshipString(mem.relationship_type);

    let infoHtml = '';

    const addRow = (label, value) => {
        if (value) {
            infoHtml += `
            <div style="padding: 1rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted); font-size: 0.9rem;">${label}</span>
                <span style="color: var(--text-light); font-weight: 500;">${value}</span>
            </div>`;
        }
    };

    addRow('Nacimiento', mem.birth_date ? `${mem.birth_date} ${mem.birth_place ? 'en ' + mem.birth_place : ''}` : null);
    addRow('Fallecimiento', mem.death_date ? `${mem.death_date} ${mem.death_place ? 'en ' + mem.death_place : ''}` : null);
    addRow('RUT', mem.rut);
    addRow('Nacionalidad', mem.nationality);
    addRow('Profesión', mem.profession);
    addRow('Sexo', mem.gender === 'M' ? 'Masculino' : (mem.gender === 'F' ? 'Femenino' : mem.gender));
    addRow('Relación familiar', getRelStr);

    let bioHtml = '';
    if (mem.bio) {
        bioHtml = `
        <div class="mt-2" style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px;">
            <h4 style="color: var(--primary); margin-bottom: 0.5rem; font-size: 0.95rem;">Biografía e Historia</h4>
            <p style="color: var(--text-light); line-height: 1.6; white-space: pre-wrap;">${mem.bio}</p>
        </div>`;
    }

    detailContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem;">
            ${avatarHtml}
            <h2 style="font-size: 2rem; background: linear-gradient(135deg, #a855f7, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${mem.first_name} ${mem.last_name}</h2>
            <p style="color: var(--text-muted); margin-top: 0.5rem;">Registro ID: ${mem.id.substring(0, 8)}</p>
        </div>
        
        <div style="background: var(--bg-dark-accent); border: 1px solid rgba(255,255,255,0.02); border-radius: 12px; padding: 1rem 1.5rem;">
            ${infoHtml}
        </div>
        
        ${bioHtml}
    `;

    // Si UI switchView existe en scope global:
    if (window.switchView) {
        window.switchView('detail');
    }
}

function updateRelatedToDropdown() {
    const select = document.getElementById('mem-related-to');
    if (!select) return;

    // Mantener la opción "Yo"
    let optionsHtml = '<option value="self">Yo (Yo mismo)</option>';

    familyMembers.forEach(mem => {
        optionsHtml += `<option value="${mem.id}">${mem.first_name} ${mem.last_name}</option>`;
    });

    select.innerHTML = optionsHtml;
}

export async function loadFamilyMembers() {
    const supabase = getSupabase();
    const listContainer = document.getElementById('members-list-container');

    if (!listContainer) return;

    // Mostrar Skeletons
    listContainer.innerHTML = `
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
    `;

    const { data: members, error } = await supabase
        .from('family_members')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error loading family members:", error);
        listContainer.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        return;
    }

    familyMembers = members || [];
    renderMembersList();
    updateRelatedToDropdown();
    updateDashboardStats(familyMembers);

    // Avisar al árbol que los datos se actualizaron y debe repintarse
    if (window.familyTree) {
        window.familyTree.updateData(familyMembers);
    }

    // Construir línea de tiempo
    buildTimeline(familyMembers);
}

function buildTimeline(members) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    // Extraer eventos (nacimientos y fallecimientos)
    let events = [];

    members.forEach(mem => {
        if (mem.birth_date) {
            events.push({
                date: new Date(mem.birth_date),
                year: mem.birth_date.split('-')[0],
                type: 'birth',
                person: `${mem.first_name} ${mem.last_name}`,
                photo: mem.photo_url,
                description: `Nacimiento de ${mem.first_name}` + (mem.birth_place ? ` en ${mem.birth_place}` : '')
            });
        }

        if (mem.death_date) {
            events.push({
                date: new Date(mem.death_date),
                year: mem.death_date.split('-')[0],
                type: 'death',
                person: `${mem.first_name} ${mem.last_name}`,
                photo: mem.photo_url,
                description: `Fallecimiento de ${mem.first_name}` + (mem.death_place ? ` en ${mem.death_place}` : '')
            });
        }
    });

    if (events.length === 0) {
        container.innerHTML = '<p class="text-muted text-center" style="padding: 2rem;">No hay eventos registrados (fechas de nacimiento/defunción) para construir la línea de tiempo.</p>';
        return;
    }

    // Ordenar cronológicamente (más antiguo primero)
    events.sort((a, b) => a.date - b.date);

    let html = '';

    events.forEach((ev, index) => {
        const isLeft = index % 2 === 0;
        const icon = ev.type === 'birth' ? '🌟' : '✝️';
        const colorClass = ev.type === 'birth' ? 'text-primary' : 'text-muted';

        const avatarHtml = ev.photo
            ? `<img src="${ev.photo}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border); margin-right: 10px;">`
            : `<div class="avatar-circle" style="width: 32px; height: 32px; font-size: 0.8rem; margin-right: 10px; display: inline-flex;">${ev.person.charAt(0).toUpperCase()}</div>`;

        html += `
            <div class="timeline-item ${isLeft ? 'left' : 'right'}">
                <div class="timeline-content glass-panel" style="padding: 1.5rem;">
                    <span class="timeline-date ${colorClass}" style="font-weight: bold; font-size: 1.2rem; display: block; margin-bottom: 0.5rem;">${ev.year} ${icon}</span>
                    <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                        ${avatarHtml}
                        <h4 style="margin: 0; color: var(--text-light);">${ev.person}</h4>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">${ev.description}</p>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateDashboardStats(members) {
    const elPersonas = document.getElementById('stat-personas');
    const elFamilias = document.getElementById('stat-familias');
    const elHombres = document.getElementById('stat-hombres');
    const elMujeres = document.getElementById('stat-mujeres');

    if (!elPersonas) return;

    let hombres = members.filter(m => m.gender === 'M').length;
    let mujeres = members.filter(m => m.gender === 'F').length;

    // Simplificación: Unidades familiares (simuladas por ahora)
    let familias = new Set(members.map(m => m.last_name.split(' ')[0])).size;

    elPersonas.textContent = members.length;
    elFamilias.textContent = familias || 0;
    elHombres.textContent = hombres;
    elMujeres.textContent = mujeres;
}

function renderMembersList() {
    const listContainer = document.getElementById('members-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (familyMembers.length === 0) {
        listContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 2rem;">Aún no has agregado familiares. ¡Sé el primero!</p>';
        return;
    }

    familyMembers.forEach(mem => {
        const el = document.createElement('div');
        el.className = 'glass-panel mb-1 flex-between';
        el.style.padding = '1rem';

        const initial = mem.first_name.charAt(0).toUpperCase();
        const relStr = getRelationshipString(mem.relationship_type);

        // Fix image load using supabase storage direct link if photo exists
        const avatarHtml = mem.photo_url
            ? `<img src="${mem.photo_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border);">`
            : `<div class="avatar-circle" style="width: 40px; height: 40px; font-size: 1rem;">${initial}</div>`;

        el.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                ${avatarHtml}
                <div>
                    <div style="font-weight: 600">${mem.first_name} ${mem.last_name}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted)">${relStr}</div>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-ghost btn-small text-primary btn-edit-mem" data-id="${mem.id}">Editar</button>
                <button class="btn btn-ghost btn-small text-danger btn-delete-mem" data-id="${mem.id}">Eliminar</button>
            </div>
        `;
        listContainer.appendChild(el);
    });

    // Attach edit handlers
    document.querySelectorAll('.btn-edit-mem').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            openEditForm(id);
        });
    });

    // Attach delete handlers
    document.querySelectorAll('.btn-delete-mem').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm("¿Estás seguro de eliminar a este familiar? Se eliminará del árbol.")) {
                await deleteMember(id);
            }
        });
    });
}

function openEditForm(id) {
    const mem = familyMembers.find(m => m.id === id);
    if (!mem) return;

    const formPanel = document.getElementById('member-form-panel');
    const memberForm = document.getElementById('member-form');

    // Populate the form fields
    document.getElementById('mem-system-id').value = mem.id.substring(0, 8);
    document.getElementById('mem-firstname').value = mem.first_name || '';
    document.getElementById('mem-lastname').value = mem.last_name || '';
    document.getElementById('mem-rut').value = mem.rut || '';
    document.getElementById('mem-gender').value = mem.gender || '';
    document.getElementById('mem-profession').value = mem.profession || '';
    document.getElementById('mem-nationality').value = mem.nationality || '';

    document.getElementById('mem-relation').value = mem.relationship_type || '';
    document.getElementById('mem-related-to').value = mem.related_to || 'self';

    document.getElementById('mem-birth').value = mem.birth_date || '';
    document.getElementById('mem-birth-place').value = mem.birth_place || '';
    document.getElementById('mem-death').value = mem.death_date || '';
    document.getElementById('mem-death-place').value = mem.death_place || '';

    document.getElementById('mem-bio').value = mem.bio || '';

    // Set to Edit Mode
    memberForm.setAttribute('data-edit-id', id);
    document.getElementById('member-form-title').textContent = "Editar Persona";
    formPanel.classList.remove('hidden');
}

function getRelationshipString(type) {
    const map = {
        'self': 'Yo',
        'parent': 'Padre/Madre',
        'child': 'Hijo/Hija',
        'sibling': 'Hermano/Hermana',
        'spouse': 'Cónyuge'
    };
    return map[type] || type;
}

async function uploadPhoto(file) {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${currentUser.id}/${fileName}`;

    const { data, error } = await supabase.storage
        .from('family_photos')
        .upload(filePath, file);

    if (error) throw error;

    // Obtener public URL
    const { data: { publicUrl } } = supabase.storage
        .from('family_photos')
        .getPublicUrl(filePath);

    return publicUrl;
}

async function saveMember() {
    const supabase = getSupabase();

    const memberForm = document.getElementById('member-form');
    const firstName = document.getElementById('mem-firstname').value;
    const lastName = document.getElementById('mem-lastname').value;
    const rut = document.getElementById('mem-rut').value;
    const gender = document.getElementById('mem-gender').value;
    const profession = document.getElementById('mem-profession').value;
    const nationality = document.getElementById('mem-nationality').value;

    const relation = document.getElementById('mem-relation').value;
    const relatedToVal = document.getElementById('mem-related-to').value;

    const birth = document.getElementById('mem-birth').value;
    const birthPlace = document.getElementById('mem-birth-place').value;
    const death = document.getElementById('mem-death').value;
    const deathPlace = document.getElementById('mem-death-place').value;

    const bio = document.getElementById('mem-bio').value;

    const editId = memberForm.getAttribute('data-edit-id');
    let relatedToId = relatedToVal === 'self' ? null : relatedToVal;

    showLoader();

    try {
        let photoUrl = null;
        const fileInput = document.querySelector('.file-input');

        if (fileInput.files.length > 0) {
            photoUrl = await uploadPhoto(fileInput.files[0]);
        }

        const memberData = {
            user_id: currentUser.id,
            first_name: firstName,
            last_name: lastName,
            rut: rut || null,
            gender: gender || null,
            profession: profession || null,
            nationality: nationality || null,
            relationship_type: relation || null,
            related_to: relatedToId,
            birth_date: birth || null,
            birth_place: birthPlace || null,
            death_date: death || null,
            death_place: deathPlace || null,
            bio: bio || null
        };

        if (photoUrl) {
            memberData.photo_url = photoUrl;
        }

        let result;
        if (editId) {
            // Update existing
            result = await supabase
                .from('family_members')
                .update(memberData)
                .eq('id', editId);
        } else {
            // Insert new
            result = await supabase
                .from('family_members')
                .insert([memberData]);
        }

        if (result.error) throw result.error;

        // Reset form UI y ocultar
        memberForm.reset();
        memberForm.removeAttribute('data-edit-id');
        document.querySelector('.file-msg').textContent = "Arrastra una foto aquí o haz clic";
        document.getElementById('member-form-panel').classList.add('hidden');

        // Recargar la lista
        await loadFamilyMembers();

    } catch (err) {
        console.error("Error saving member:", err);
        alert("Error: " + err.message);
    } finally {
        hideLoader();
    }
}

async function deleteMember(id) {
    const supabase = getSupabase();
    showLoader();

    const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', id);

    hideLoader();

    if (error) {
        alert("No se pudo eliminar: " + error.message);
    } else {
        await loadFamilyMembers();
    }
}
