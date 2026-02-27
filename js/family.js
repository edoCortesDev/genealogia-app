// family.js
// Lógica para gestionar la familia, Perfiles Wikipedia, Guardado Bidireccional y Eventos JSON

import {getSupabase} from './config.js';
import {checkAuth} from './auth.js';
import {showLoader, hideLoader} from './ui.js';

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
    const btnAddDoc = document.getElementById('btn-add-document');
    const btnAddEvent = document.getElementById('btn-add-event');
    const btnAddRel = document.getElementById('btn-add-relation');

    if (btnAddDoc) btnAddDoc.addEventListener('click', () => window.addDocumentRow());
    if (btnAddEvent) btnAddEvent.addEventListener('click', () => window.addEventRow());
    if (btnAddRel) btnAddRel.addEventListener('click', () => window.addRelationRow());

    const relContainer = document.getElementById('relationsContainer');
    const evContainer = document.getElementById('eventsContainer');

    if (window.Sortable) {
        if (relContainer) new Sortable(relContainer, {handle: '.drag-handle', animation: 150});
        if (evContainer) new Sortable(evContainer, {handle: '.drag-handle', animation: 150});
    }

    const btnCancel = document.getElementById('btn-cancel-member');
    const memberForm = document.getElementById('member-form');
    const manageLayout = document.querySelector('.manage-layout');

    // FIX: Al presionar "Agregar Nuevo"
    if (btnAdd && formPanel) {
        btnAdd.addEventListener('click', () => {
            memberForm.reset();
            memberForm.removeAttribute('data-edit-id');
            document.getElementById('member-form-title').textContent = "Agregar Familiar";
            document.getElementById('document-list-container').innerHTML = '';
            if (relContainer) relContainer.innerHTML = '';
            if (evContainer) evContainer.innerHTML = '';
            formPanel.classList.remove('hidden');
            manageLayout.classList.add('form-open'); // Oculta lista en móvil
        });
    }

    // FIX: Al presionar "Cancelar"
    if (btnCancel && formPanel) {
        btnCancel.addEventListener('click', () => {
            memberForm.removeAttribute('data-edit-id');
            formPanel.classList.add('hidden');
            manageLayout.classList.remove('form-open'); // Restaura lista en móvil
        });
    }

    if (memberForm) {
        memberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveMember();
        });
    }

    // Drag and Drop de Fotos
    const dropArea = document.getElementById('photo-drop-area');
    const fileInput = document.querySelector('.file-input');

    if (dropArea && fileInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
        });

        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            handleFiles(dt.files, true);
        });

        fileInput.addEventListener('change', function () {
            handleFiles(this.files, false);
        });

        function handleFiles(files, isDrop) {
            if (files.length > 0) {
                const fileMsg = document.querySelector('.file-msg');
                fileMsg.textContent = files[0].name;

                if (isDrop) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(files[0]);
                    fileInput.files = dataTransfer.files;
                }
                dropArea.dataset.filePending = true;
            }
        }
    }

    // Buscador del Dashboard
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
                (m.rut && m.rut.toLowerCase().includes(query))
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
                            <div style="font-weight: 600; color: var(--text-main);">${mem.first_name} ${mem.last_name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted)">${mem.profession || 'Familiar'}</div>
                        </div>
                    </div>
                `;

                div.addEventListener('click', () => {
                    window.openPersonDetails(mem.id);
                    searchInput.value = '';
                    resultsContainer.innerHTML = '';
                });

                resultsContainer.appendChild(div);
            });
        });
    }
}

// --- FILAS DINÁMICAS (EVENTOS Y RELACIONES) ---

window.addEventRow = function (year = '', type = 'otro', targetId = '', desc = '') {
    const container = document.getElementById('eventsContainer');
    if (!container) return;

    const currentEditId = document.getElementById('member-form').getAttribute('data-edit-id');
    let optionsHtml = '<option value="">-- Sin persona vinculada --</option>';

    familyMembers.forEach(mem => {
        if (mem.id === currentEditId) return;
        const memYear = mem.birth_date ? `(n. ${mem.birth_date.substring(0, 4)})` : '';
        const selected = mem.id === targetId ? 'selected' : '';
        optionsHtml += `<option value="${mem.id}" ${selected}>${mem.first_name} ${mem.last_name} ${memYear}</option>`;
    });

    const row = document.createElement('div');
    row.className = 'event-row draggable-item';
    row.style.cssText = 'display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.6); padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 0.5rem;';

    row.innerHTML = `
        <div class="drag-handle" style="cursor: grab; color: var(--text-muted); font-size: 1.2rem; padding: 0 5px;">☰</div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; gap: 0.5rem;">
                <input type="number" class="ev-year modern-form form-control" placeholder="Año" style="width: 80px;" value="${year}">
                <select class="ev-type modern-form form-control" style="flex: 1;">
                    <option value="matrimonio" ${type === 'matrimonio' ? 'selected' : ''}>💍 Matrimonio / Unión</option>
                    <option value="hijo" ${type === 'hijo' ? 'selected' : ''}>👶 Nacimiento de Hijo/a</option>
                    <option value="graduacion" ${type === 'graduacion' ? 'selected' : ''}>🎓 Graduación / Logro</option>
                    <option value="viaje" ${type === 'viaje' ? 'selected' : ''}>✈️ Viaje / Mudanza</option>
                    <option value="religion" ${type === 'religion' ? 'selected' : ''}>⛪ Bautizo / Religión</option>
                    <option value="premio" ${type === 'premio' ? 'selected' : ''}>🏆 Premio / Reconocimiento</option>
                    <option value="otro" ${type === 'otro' ? 'selected' : ''}>📝 Otro</option>
                </select>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <select class="ev-target modern-form form-control" style="flex: 1;">
                    ${optionsHtml}
                </select>
            </div>
            <input type="text" class="ev-desc modern-form form-control" placeholder="Descripción breve del evento..." value="${desc}">
        </div>
        <button type="button" class="btn-remove-ev" style="background: var(--danger); color: white; border: none; width: 35px; height: 35px; border-radius: 5px; cursor: pointer;">×</button>
    `;

    row.querySelector('.btn-remove-ev').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

window.addRelationRow = function (type = '', targetId = '') {
    const container = document.getElementById('relationsContainer');
    if (!container) return;

    const currentEditId = document.getElementById('member-form').getAttribute('data-edit-id');
    let optionsHtml = '<option value="">-- Seleccionar Persona --</option>';

    familyMembers.forEach(mem => {
        if (mem.id === currentEditId) return;
        const year = mem.birth_date ? `(n. ${mem.birth_date.substring(0, 4)})` : '';
        const selected = mem.id === targetId ? 'selected' : '';
        optionsHtml += `<option value="${mem.id}" ${selected}>${mem.first_name} ${mem.last_name} ${year}</option>`;
    });

    const row = document.createElement('div');
    row.className = 'relation-row draggable-item';
    row.style.cssText = 'display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.6); padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 0.5rem;';

    row.innerHTML = `
        <div class="drag-handle" style="cursor: grab; color: var(--text-muted); font-size: 1.2rem; padding: 0 5px;">☰</div>
        <select class="rel-type modern-form form-control" style="flex: 1; min-width: 110px;">
            <option value="padre" ${type === 'padre' ? 'selected' : ''}>Padre</option>
            <option value="madre" ${type === 'madre' ? 'selected' : ''}>Madre</option>
            <option value="hijo" ${type === 'hijo' ? 'selected' : ''}>Hijo</option>
            <option value="hija" ${type === 'hija' ? 'selected' : ''}>Hija</option>
            <option value="esposo" ${type === 'esposo' ? 'selected' : ''}>Esposo</option>
            <option value="esposa" ${type === 'esposa' ? 'selected' : ''}>Esposa</option>
            <option value="pareja" ${type === 'pareja' ? 'selected' : ''}>Pareja</option>
            <option value="hermano" ${type === 'hermano' ? 'selected' : ''}>Hermano</option>
            <option value="hermana" ${type === 'hermana' ? 'selected' : ''}>Hermana</option>
        </select>
        <select class="rel-target modern-form form-control" style="flex: 2;">
            ${optionsHtml}
        </select>
        <button type="button" class="btn-remove-rel" style="background: var(--danger); color: white; border: none; width: 35px; height: 35px; border-radius: 5px; cursor: pointer;">×</button>
    `;

    row.querySelector('.btn-remove-rel').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

// --- VISOR DE FOTOS (LIGHTBOX) ---
window.openPhotoLightbox = function (url) {
    const lightbox = document.getElementById('photo-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lightbox || !img) return;

    img.src = url;
    lightbox.classList.remove('hidden');
    setTimeout(() => {
        lightbox.style.opacity = '1';
        img.style.transform = 'scale(1)';
    }, 10);
};

window.closePhotoLightbox = function () {
    const lightbox = document.getElementById('photo-lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lightbox) return;

    lightbox.style.opacity = '0';
    img.style.transform = 'scale(0.9)';
    setTimeout(() => {
        lightbox.classList.add('hidden');
        img.src = '';
    }, 300);
};

// --- PERFIL ESTILO WIKIPEDIA ---
window.openPersonDetails = function (id) {
    const mem = familyMembers.find(m => m.id === id);
    if (!mem) return;

    const detailContainer = document.getElementById('person-detail-content');
    if (!detailContainer) return;

    const padre = familyMembers.find(m => m.id === mem.father_id);
    const madre = familyMembers.find(m => m.id === mem.mother_id);
    const pareja = familyMembers.find(m => m.id === mem.spouse_id);
    const hijos = familyMembers.filter(m => m.father_id === id || m.mother_id === id);

    const renderPill = (person) => {
        if (!person) return '';
        const miniPhoto = person.photo_url
            ? `<img src="${person.photo_url}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">`
            : `<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: #F4F2E0; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">${person.first_name.charAt(0)}</div>`;

        return `
            <div onclick="window.openPersonDetails('${person.id}')" 
                 style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; background: rgba(255,255,255,0.6); border: 1px solid var(--glass-border); border-radius: 50px; cursor: pointer; transition: all 0.2s ease; margin: 4px;"
                 onmouseover="this.style.background='rgba(158, 159, 115, 0.2)'; this.style.borderColor='var(--secondary)';"
                 onmouseout="this.style.background='rgba(255,255,255,0.6)'; this.style.borderColor='var(--glass-border)';">
                ${miniPhoto}
                <span style="font-size: 0.85rem; color: var(--text-main); font-weight: 500;">${person.first_name} ${person.last_name.split(' ')[0]}</span>
            </div>
        `;
    };

    const photoSrc = mem.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(mem.first_name)}&background=random`;
    const avatarHtml = `
        <div style="position: relative; display: inline-block; cursor: zoom-in; margin-bottom: 1rem;" onclick="openPhotoLightbox('${photoSrc}')">
            <img src="${photoSrc}" alt="Foto" style="width: 140px; height: 140px; border-radius: 50%; object-fit: cover; border: 4px solid var(--glass-border); box-shadow: 0 10px 25px rgba(50,73,64,0.15); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <div style="position: absolute; bottom: 5px; right: 5px; background: var(--bg-panel); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border); box-shadow: 0 4px 10px rgba(50,73,64,0.1);">🔍</div>
        </div>
    `;

    let bY = mem.birth_date ? mem.birth_date.substring(0, 4) : "";
    let dY = mem.death_date ? mem.death_date.substring(0, 4) : "";
    const dateStr = (bY || dY) ? `${bY || '?'} - ${dY || 'Presente'}` : "";

    let relHtml = '';
    if (padre || madre || pareja || hijos.length > 0) {
        relHtml += `<div style="background: rgba(255,255,255,0.4); border: 1px solid var(--glass-border); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;">`;
        if (padre || madre) relHtml += `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;"><span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Padres</span><div style="display: flex; flex-wrap: wrap;">${renderPill(padre)}${renderPill(madre)}</div></div>`;
        if (pareja) relHtml += `<div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: ${hijos.length > 0 ? '1rem' : '0'};"><span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Pareja / Cónyuge</span><div style="display: flex; flex-wrap: wrap;">${renderPill(pareja)}</div></div>`;
        if (hijos.length > 0) relHtml += `<div style="display: flex; flex-direction: column; gap: 0.5rem;"><span style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Hijos (${hijos.length})</span><div style="display: flex; flex-wrap: wrap;">${hijos.map(h => renderPill(h)).join('')}</div></div>`;
        relHtml += `</div>`;
    }

    const addRow = (label, value) => {
        if (!value) return '';
        return `<div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(50,73,64,0.1);"><span style="color: var(--text-muted); font-size: 0.9rem; flex: 1;">${label}</span><span style="color: var(--text-main); font-weight: 500; flex: 2; text-align: right;">${value}</span></div>`;
    };

    let techHtml = `<div style="background: rgba(255,255,255,0.4); border: 1px solid var(--glass-border); border-radius: 16px; padding: 0.5rem 1.5rem; margin-bottom: 1.5rem;">`;
    techHtml += addRow('Nacimiento', mem.birth_date ? `${mem.birth_date} ${mem.birth_place ? '📍 ' + mem.birth_place : ''}` : null);
    techHtml += addRow('Fallecimiento', mem.death_date ? `${mem.death_date} ${mem.death_place ? '📍 ' + mem.death_place : ''}` : null);
    techHtml += addRow('Nacionalidad', mem.nationality ? `<span style="background: rgba(158, 159, 115, 0.2); color: var(--primary); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${mem.nationality}</span>` : null);
    techHtml += addRow('Identificación', mem.rut);
    techHtml += addRow('Sexo', mem.gender === 'M' ? 'Masculino' : (mem.gender === 'F' ? 'Femenino' : mem.gender));
    techHtml += `</div>`;

    let bioHtml = '';
    if (mem.bio) {
        bioHtml = `<div style="background: rgba(255,255,255,0.4); border: 1px solid var(--glass-border); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.5rem;"><h4 style="color: var(--primary); margin-bottom: 1rem; font-size: 1rem; display: flex; align-items: center; gap: 8px;"><span>📖</span> Historia y Biografía</h4><p style="color: var(--text-main); line-height: 1.6; white-space: pre-wrap; font-size: 0.95rem;">${mem.bio}</p></div>`;
    }

    let docsHtml = '';
    if (mem.document_links && mem.document_links !== "[]") {
        try {
            const docs = JSON.parse(mem.document_links);
            if (docs.length > 0) {
                let listItems = docs.map(d => `<a href="${d.url}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.6); border: 1px solid var(--glass-border); border-radius: 12px; margin-bottom: 0.5rem; text-decoration: none;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 1.5rem;">📄</span><span style="color: var(--text-main); font-weight: 500;">${d.title || 'Documento adjunto'}</span></div><span style="color: var(--primary);">Abrir ↗</span></a>`).join('');
                docsHtml = `<div style="background: rgba(255,255,255,0.4); border: 1px solid var(--glass-border); border-radius: 16px; padding: 1.5rem;"><h4 style="color: var(--primary); margin-bottom: 1rem; font-size: 1rem; display: flex; align-items: center; gap: 8px;"><span>📁</span> Documentos y Evidencias</h4>${listItems}</div>`;
            }
        } catch (e) {
            console.warn("Error renderizando documentos");
        }
    }

    detailContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem; padding-top: 1rem;">
            ${avatarHtml}
            <h2 style="font-size: 2.2rem; background: linear-gradient(135deg, var(--secondary), var(--primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem;">${mem.first_name} ${mem.last_name}</h2>
            <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; color: var(--text-muted); font-size: 0.9rem;">
                ${dateStr ? `<span style="display: flex; align-items: center; gap: 4px;">📅 ${dateStr}</span>` : ''}
                ${mem.profession ? `<span style="display: flex; align-items: center; gap: 4px;">💼 ${mem.profession}</span>` : ''}
            </div>
        </div>
        ${relHtml}
        ${techHtml}
        ${bioHtml}
        ${docsHtml}
    `;

    document.getElementById('view-person-detail').scrollTo({top: 0, behavior: 'smooth'});
    if (window.switchView) window.switchView('detail');
}

export async function loadFamilyMembers() {
    const supabase = getSupabase();
    const listContainer = document.getElementById('members-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = `<div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>`;

    // FIX ÁRBOL: Recuperamos por orden de creación original para que la 'Raíz' del árbol no se rompa
    const {data: members, error} = await supabase.from('family_members').select('*').order('created_at', {ascending: true});

    if (error) {
        listContainer.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        return;
    }

    familyMembers = members || [];

    renderMembersList(); // Se encarga de ordenar A-Z solo visualmente

    if (window.updateDashboardStats) window.updateDashboardStats();
    if (window.familyTree) window.familyTree.updateData(familyMembers); // El árbol recibe el orden original

    buildTimeline(familyMembers);
}

// --- CEREBRO DE LA LÍNEA DE TIEMPO (AHORA LEE EVENTOS JSON) ---
function buildTimeline(members) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    let events = [];

    // Recolectar Nacimientos, Muertes y Eventos JSON
    members.forEach(mem => {
        if (mem.birth_date) {
            events.push({
                date: new Date(mem.birth_date), year: mem.birth_date.split('-')[0],
                type: 'birth', person: `${mem.first_name} ${mem.last_name}`, photo: mem.photo_url,
                description: `<strong>Nacimiento</strong>` + (mem.birth_place ? ` en ${mem.birth_place}` : '')
            });
        }
        if (mem.death_date) {
            events.push({
                date: new Date(mem.death_date), year: mem.death_date.split('-')[0],
                type: 'death', person: `${mem.first_name} ${mem.last_name}`, photo: mem.photo_url,
                description: `<strong>Fallecimiento</strong>` + (mem.death_place ? ` en ${mem.death_place}` : '')
            });
        }

        // Leer eventos personalizados de la columna JSONB
        if (mem.custom_events && mem.custom_events !== "[]") {
            try {
                const customEvts = JSON.parse(mem.custom_events);
                customEvts.forEach(ev => {
                    if (!ev.year) return;

                    let icon = '📌';
                    let titleText = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);

                    if (ev.type === 'matrimonio') {
                        icon = '💍';
                        titleText = 'Matrimonio / Unión';
                    } else if (ev.type === 'graduacion') {
                        icon = '🎓';
                        titleText = 'Graduación';
                    } else if (ev.type === 'viaje') {
                        icon = '✈️';
                        titleText = 'Viaje / Mudanza';
                    } else if (ev.type === 'religion') {
                        icon = '⛪';
                        titleText = 'Ceremonia Religiosa';
                    } else if (ev.type === 'premio') {
                        icon = '🏆';
                        titleText = 'Reconocimiento';
                    } else if (ev.type === 'hijo') {
                        icon = '👶';
                        titleText = 'Nacimiento de Hijo/a';
                    }

                    let extraPerson = '';
                    if (ev.related_person_id) {
                        const rel = members.find(m => m.id === ev.related_person_id);
                        if (rel) extraPerson = ` con ${rel.first_name} ${rel.last_name}`;
                    }

                    events.push({
                        // Usamos enero 1 como aproximación para ordenarlo en ese año
                        date: new Date(ev.year, 0, 1),
                        year: ev.year,
                        type: ev.type,
                        iconOverride: icon,
                        person: `${mem.first_name} ${mem.last_name}`,
                        photo: mem.photo_url,
                        description: `<strong>${titleText}${extraPerson}</strong>. ${ev.description}`
                    });
                });
            } catch (e) {
                console.warn("Error parseando eventos", e);
            }
        }
    });

    if (events.length === 0) {
        container.innerHTML = '<p class="text-muted text-center" style="padding: 2rem;">No hay eventos registrados.</p>';
        return;
    }

    events.sort((a, b) => a.date - b.date);

    let html = '';
    events.forEach((ev, index) => {
        const isLeft = index % 2 === 0;
        let icon = ev.iconOverride || '🌟';
        if (!ev.iconOverride && ev.type === 'death') icon = '🕊️';

        const colorClass = ev.type === 'birth' ? 'text-primary' : (ev.type === 'death' ? 'text-muted' : 'text-cyan');
        const avatarHtml = ev.photo ? `<img src="${ev.photo}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border); margin-right: 10px;">` : `<div class="avatar-circle" style="width: 32px; height: 32px; font-size: 0.8rem; margin-right: 10px; display: inline-flex;">${ev.person.charAt(0).toUpperCase()}</div>`;

        html += `
            <div class="timeline-item ${isLeft ? 'left' : 'right'}">
                <div class="timeline-content glass-panel" style="padding: 1.5rem;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid rgba(50,73,64,0.1); padding-bottom: 0.8rem;">
                        <span style="font-weight: 800; font-size: 1.8rem; color: var(--accent); letter-spacing: -0.03em; line-height: 1;">${ev.year}</span>
                        <span style="font-size: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">${icon}</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; margin-bottom: 0.8rem;">
                        ${avatarHtml}
                        <h4 style="margin: 0; color: var(--primary); font-size: 1.1rem; font-weight: 700;">${ev.person}</h4>
                    </div>
                    
                    <p style="color: var(--text-main); font-size: 0.95rem; margin: 0; line-height: 1.6;">${ev.description}</p>
                    
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.updateDashboardStats = function () {
    if (!familyMembers || familyMembers.length === 0) return;
    const totalMembers = familyMembers.length;
    const uniqueCountries = new Set();
    let nationals = 0, foreigners = 0;

    familyMembers.forEach(mem => {
        if (mem.nationality && mem.nationality.trim() !== '') {
            const nat = mem.nationality.trim().toUpperCase();
            uniqueCountries.add(nat);
            if (nat === 'CL' || nat === 'CHILE') nationals++; else foreigners++;
        }
    });

    let totalFiles = 0;
    familyMembers.forEach(mem => {
        if (mem.photo_url) totalFiles++;
        if (mem.document_links) {
            try { totalFiles += JSON.parse(mem.document_links).length; } catch (e) { totalFiles++; }
        }
    });

    // Animador de números (Tarjetas Superiores)
    const animateValue = (id, end) => {
        const obj = document.getElementById(id);
        if (!obj) return;
        let start = 0;
        const duration = 1000;
        const increment = end > 0 ? Math.ceil(end / 20) : 1;
        const stepTime = end > 0 ? Math.abs(Math.floor(duration / (end / increment))) : duration;

        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                obj.textContent = end;
                clearInterval(timer);
            } else obj.textContent = start;
        }, stepTime);
    };

    animateValue('stat-total', totalMembers);
    animateValue('stat-countries', uniqueCountries.size);
    animateValue('stat-files', totalFiles);

    // =========================================================
    // 🧬 NUEVO: CÁLCULO DE ANALÍTICAS DE LINAJE (INSIGHTS)
    // =========================================================
    let totalLifespan = 0;
    let deceasedCount = 0;
    const monthCounts = {};
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    let oldestPerson = null;
    let oldestYear = 9999;

    familyMembers.forEach(mem => {
        // 1. Promedio de Vida
        if (mem.birth_date && mem.death_date) {
            const bYear = parseInt(mem.birth_date.split('-')[0]);
            const dYear = parseInt(mem.death_date.split('-')[0]);
            if (!isNaN(bYear) && !isNaN(dYear) && dYear >= bYear) {
                totalLifespan += (dYear - bYear);
                deceasedCount++;
            }
        }

        // 2. Mes con más cumpleaños y Ancestro más Antiguo
        if (mem.birth_date) {
            const parts = mem.birth_date.split('-');
            if (parts.length >= 2) {
                const month = parseInt(parts[1]);
                if (!isNaN(month) && month >= 1 && month <= 12) {
                    monthCounts[month] = (monthCounts[month] || 0) + 1;
                }
            }
            const bYear = parseInt(parts[0]);
            if (!isNaN(bYear) && bYear < oldestYear) {
                oldestYear = bYear;
                oldestPerson = mem;
            }
        }
    });

    // 3. Pintar en el HTML
    const insightLifespan = document.getElementById('insight-lifespan');
    const insightMonth = document.getElementById('insight-month');
    const insightOldest = document.getElementById('insight-oldest');
    const panel = document.getElementById('family-insights-panel');

    if (insightLifespan && insightMonth && insightOldest && panel) {
        // Aparecer panel suavemente
        panel.style.opacity = '1';

        // Pintar Promedio
        if (deceasedCount > 0) {
            const avg = Math.round(totalLifespan / deceasedCount);
            insightLifespan.innerHTML = `<strong style="color:var(--primary); font-size:1.3rem;">${avg}</strong> años aprox.`;
        } else {
            insightLifespan.innerHTML = `<span style="font-size: 0.85rem; font-weight: normal; color:var(--text-muted);">Sin fallecimientos registrados</span>`;
        }

        // Pintar Mes
        let maxMonth = null, maxCount = 0;
        for (const [m, count] of Object.entries(monthCounts)) {
            if (count > maxCount) { maxCount = count; maxMonth = parseInt(m); }
        }
        if (maxMonth) {
            insightMonth.innerHTML = `<strong style="color:var(--primary); font-size:1.3rem;">${monthNames[maxMonth - 1]}</strong> (${maxCount})`;
        } else {
            insightMonth.innerHTML = `<span style="font-size: 0.85rem; font-weight: normal; color:var(--text-muted);">Faltan fechas de nacimiento</span>`;
        }

        // Pintar Ancestro
        if (oldestPerson) {
            insightOldest.innerHTML = `<strong style="color:var(--primary);">${oldestPerson.first_name} ${oldestPerson.last_name ? oldestPerson.last_name.split(' ')[0] : ''}</strong> (n. ${oldestYear})`;
        } else {
            insightOldest.innerHTML = `<span style="font-size: 0.85rem; font-weight: normal; color:var(--text-muted);">Faltan fechas de nacimiento</span>`;
        }
    }
};

function renderMembersList() {
    const listContainer = document.getElementById('members-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (familyMembers.length === 0) {
        listContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 2rem;">Aún no has agregado familiares. ¡Sé el primero!</p>';
        return;
    }

    // FIX A-Z: Clonamos el array original y lo ordenamos solo para dibujarlo aquí en la lista.
    const sortedMembers = [...familyMembers].sort((a, b) => {
        const nameA = (a.first_name || '').toLowerCase();
        const nameB = (b.first_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    sortedMembers.forEach(mem => {
        const el = document.createElement('div');
        el.className = 'glass-panel mb-1 flex-between';
        el.style.padding = '1rem';
        const initial = mem.first_name.charAt(0).toUpperCase();
        const avatarHtml = mem.photo_url ? `<img src="${mem.photo_url}" alt="Foto" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border);">` : `<div class="avatar-circle" style="width: 40px; height: 40px; font-size: 1rem;">${initial}</div>`;

        el.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                ${avatarHtml}
                <div><div style="font-weight: 600; color: var(--text-main);">${mem.first_name} ${mem.last_name}</div><div style="font-size: 0.85rem; color: var(--text-muted)">ID: ${mem.id.substring(0, 8)}</div></div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-ghost btn-small text-primary btn-edit-mem" data-id="${mem.id}">Editar</button>
                <button class="btn btn-ghost btn-small text-danger btn-delete-mem" data-id="${mem.id}">Eliminar</button>
            </div>
        `;
        listContainer.appendChild(el);
    });

    document.querySelectorAll('.btn-edit-mem').forEach(btn => btn.addEventListener('click', (e) => openEditForm(e.target.dataset.id)));
    document.querySelectorAll('.btn-delete-mem').forEach(btn => btn.addEventListener('click', async (e) => {
        if (confirm("¿Estás seguro de eliminar a este familiar?")) await deleteMember(e.target.dataset.id);
    }));
}

function openEditForm(id) {
    const mem = familyMembers.find(m => m.id === id);
    if (!mem) return;

    const formPanel = document.getElementById('member-form-panel');
    const memberForm = document.getElementById('member-form');

    document.getElementById('mem-system-id').value = mem.id.substring(0, 8);
    document.getElementById('mem-firstname').value = mem.first_name || '';
    document.getElementById('mem-lastname').value = mem.last_name || '';
    document.getElementById('mem-rut').value = mem.rut || '';
    document.getElementById('mem-gender').value = mem.gender || '';
    document.getElementById('mem-profession').value = mem.profession || '';
    document.getElementById('mem-nationality').value = mem.nationality || '';
    document.getElementById('mem-birth').value = mem.birth_date || '';
    document.getElementById('mem-birth-place').value = mem.birth_place || '';
    document.getElementById('mem-death').value = mem.death_date || '';
    document.getElementById('mem-death-place').value = mem.death_place || '';
    document.getElementById('mem-bio').value = mem.bio || '';

    // Cargar Documentos
    document.getElementById('document-list-container').innerHTML = '';
    if (mem.document_links) {
        try {
            JSON.parse(mem.document_links).forEach(doc => window.addDocumentRow(doc.title, doc.url));
        } catch (e) {
            console.warn("Formato antiguo de documentos.");
        }
    }

    // Cargar Relaciones (Arrastrar y Soltar)
    const relContainer = document.getElementById('relationsContainer');
    if (relContainer) relContainer.innerHTML = '';

    if (mem.father_id) window.addRelationRow('padre', mem.father_id);
    if (mem.mother_id) window.addRelationRow('madre', mem.mother_id);
    if (mem.spouse_id) window.addRelationRow('esposo', mem.spouse_id);

    const misHijos = familyMembers.filter(m => m.father_id === id || m.mother_id === id);
    misHijos.forEach(hijo => window.addRelationRow(hijo.gender === 'F' ? 'hija' : 'hijo', hijo.id));

    // Cargar Eventos (NUEVO JSONB)
    const evContainer = document.getElementById('eventsContainer');
    if (evContainer) evContainer.innerHTML = '';
    if (mem.custom_events && mem.custom_events !== "[]") {
        try {
            const evs = JSON.parse(mem.custom_events);
            evs.forEach(ev => window.addEventRow(ev.year, ev.type, ev.related_person_id, ev.description));
        } catch (e) {
        }
    }

    memberForm.setAttribute('data-edit-id', id);
    document.getElementById('member-form-title').textContent = "Editar Persona";
    formPanel.classList.remove('hidden');
    document.querySelector('.manage-layout').classList.add('form-open'); // Activa vista móvil
}

async function uploadPhoto(file) {
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${currentUser.id}/${fileName}`;
    const {data, error} = await supabase.storage.from('family_photos').upload(filePath, file);
    if (error) throw error;
    const {data: {publicUrl}} = supabase.storage.from('family_photos').getPublicUrl(filePath);
    return publicUrl;
}

async function deletePhotoFromStorage(photoUrl) {
    if (!photoUrl) return;
    const supabase = getSupabase();
    try {
        const urlParts = photoUrl.split('/family_photos/');
        if (urlParts.length === 2) await supabase.storage.from('family_photos').remove([urlParts[1]]);
    } catch (err) {
        console.error("Error borrando foto:", err);
    }
}

async function saveMember() {
    const supabase = getSupabase();
    const memberForm = document.getElementById('member-form');
    const editId = memberForm.getAttribute('data-edit-id');

    const firstName = document.getElementById('mem-firstname').value;
    const lastName = document.getElementById('mem-lastname').value;
    const rut = document.getElementById('mem-rut').value;
    const gender = document.getElementById('mem-gender').value;
    const profession = document.getElementById('mem-profession').value;
    const nationality = document.getElementById('mem-nationality').value;
    const birth = document.getElementById('mem-birth').value;
    const birthPlace = document.getElementById('mem-birth-place').value;
    const death = document.getElementById('mem-death').value;
    const deathPlace = document.getElementById('mem-death-place').value;
    const bio = document.getElementById('mem-bio').value;

    const docsArray = [];
    document.querySelectorAll('.doc-row').forEach(row => {
        const title = row.querySelector('.doc-title').value.trim();
        const url = row.querySelector('.doc-url').value.trim();
        if (title || url) docsArray.push({title, url});
    });
    const documentLinks = JSON.stringify(docsArray);

    // --- NUEVO: Capturar eventos JSON ---
    const customEventsArray = [];
    document.querySelectorAll('.event-row').forEach(row => {
        const year = row.querySelector('.ev-year').value.trim();
        const type = row.querySelector('.ev-type').value;
        const targetId = row.querySelector('.ev-target').value;
        const desc = row.querySelector('.ev-desc').value.trim();

        if (year || desc) {
            customEventsArray.push({
                year: year,
                type: type,
                related_person_id: targetId || null,
                description: desc
            });
        }
    });
    const customEventsJson = JSON.stringify(customEventsArray);

    showLoader();

    try {
        let photoUrl = null;
        let oldPhotoUrl = null;
        const fileInput = document.querySelector('.file-input');

        if (editId) {
            const existingMember = familyMembers.find(m => m.id === editId);
            if (existingMember) oldPhotoUrl = existingMember.photo_url;
        }

        if (fileInput.files.length > 0) {
            photoUrl = await uploadPhoto(fileInput.files[0]);
            if (oldPhotoUrl) await deletePhotoFromStorage(oldPhotoUrl);
        }

        let myFatherId = null;
        let myMotherId = null;
        let mySpouseId = null;
        const updatesForOthers = [];

        document.querySelectorAll('.relation-row').forEach(row => {
            const type = row.querySelector('.rel-type').value;
            const targetId = row.querySelector('.rel-target').value;

            if (!targetId) return;

            if (type === 'padre') myFatherId = targetId;
            if (type === 'madre') myMotherId = targetId;
            if (type === 'esposo' || type === 'esposa' || type === 'pareja') {
                mySpouseId = targetId;
                updatesForOthers.push({id: targetId, spouse_id: 'MY_NEW_ID'});
            }

            if (type === 'hijo' || type === 'hija') {
                if (gender === 'M') updatesForOthers.push({id: targetId, father_id: 'MY_NEW_ID'});
                else if (gender === 'F') updatesForOthers.push({
                    id: targetId,
                    mother_id: 'MY_NEW_ID'
                });
                else updatesForOthers.push({id: targetId, father_id: 'MY_NEW_ID'});
            }
        });

        const memberData = {
            user_id: currentUser.id,
            first_name: firstName,
            last_name: lastName,
            rut: rut || null,
            gender: gender || null,
            profession: profession || null,
            nationality: nationality || null,
            father_id: myFatherId,
            mother_id: myMotherId,
            spouse_id: mySpouseId,
            birth_date: birth || null,
            birth_place: birthPlace || null,
            death_date: death || null,
            death_place: deathPlace || null,
            bio: bio || null,
            document_links: documentLinks || null,
            custom_events: customEventsJson // Guardamos el JSONB mágico
        };

        if (photoUrl) memberData.photo_url = photoUrl;

        let savedMemberId = editId;

        if (editId) {
            const {error} = await supabase.from('family_members').update(memberData).eq('id', editId);
            if (error) throw error;
        } else {
            const {
                data,
                error
            } = await supabase.from('family_members').insert([memberData]).select();
            if (error) throw error;
            savedMemberId = data[0].id;
        }

        if (updatesForOthers.length > 0 && savedMemberId) {
            for (const update of updatesForOthers) {
                const payload = {};
                if (update.father_id) payload.father_id = savedMemberId;
                if (update.mother_id) payload.mother_id = savedMemberId;
                if (update.spouse_id) payload.spouse_id = savedMemberId;
                await supabase.from('family_members').update(payload).eq('id', update.id);
            }
        }

        memberForm.reset();
        memberForm.removeAttribute('data-edit-id');
        document.querySelector('.file-msg').textContent = "Arrastra una foto aquí o haz clic";
        document.getElementById('member-form-panel').classList.add('hidden');
        document.querySelector('.manage-layout').classList.remove('form-open'); // Cierra vista móvil

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
    const memberToDelete = familyMembers.find(m => m.id === id);

    showLoader();
    const {error} = await supabase.from('family_members').delete().eq('id', id);
    hideLoader();

    if (error) {
        alert("No se pudo eliminar: " + error.message);
    } else {
        if (memberToDelete && memberToDelete.photo_url) await deletePhotoFromStorage(memberToDelete.photo_url);
        await loadFamilyMembers();
    }
}

let draggedDocRow = null;

window.addDocumentRow = function (title = '', url = '') {
    const container = document.getElementById('document-list-container');
    const row = document.createElement('div');
    row.className = 'doc-row';
    row.draggable = true;
    row.style.cssText = 'display: flex; gap: 1rem; align-items: center; background: rgba(255,255,255,0.6); padding: 1rem; border-radius: 8px; border: 1px solid var(--glass-border); cursor: grab;';

    row.innerHTML = `
        <div class="drag-handle" style="color: var(--text-muted); padding: 0 0.5rem;">≡</div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
            <input type="text" class="doc-title modern-form form-control" placeholder="Título del Documento" value="${title}">
            <input type="text" class="doc-url modern-form form-control" placeholder="Enlace o Ubicación" value="${url}">
        </div>
        <button type="button" class="btn-remove-doc" style="background: var(--danger); color: white; border: none; border-radius: 8px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">×</button>
    `;

    row.querySelector('.btn-remove-doc').addEventListener('click', () => row.remove());

    row.addEventListener('dragstart', function () {
        draggedDocRow = row;
        setTimeout(() => row.style.opacity = '0.4', 0);
    });
    row.addEventListener('dragend', function () {
        setTimeout(() => {
            row.style.opacity = '1';
            draggedDocRow = null;
        }, 0);
    });
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', function () {
        if (draggedDocRow !== this) {
            const allRows = Array.from(container.querySelectorAll('.doc-row'));
            const draggedIndex = allRows.indexOf(draggedDocRow);
            const droppedIndex = allRows.indexOf(this);
            if (draggedIndex < droppedIndex) this.after(draggedDocRow);
            else this.before(draggedDocRow);
        }
    });

    container.appendChild(row);
}