// family.js
// Lógica para gestionar la familia utilizando Supabase con Relaciones Dinámicas (Drag & Drop)

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

    if (btnAddDoc) {
        btnAddDoc.addEventListener('click', () => window.addDocumentRow());
    }

    // NUEVO: Botón para agregar filas de relación
    const btnAddRel = document.getElementById('btn-add-relation');
    if (btnAddRel) {
        btnAddRel.addEventListener('click', () => window.addRelationRow());
    }

    // Inicializar SortableJS para las relaciones si está disponible
    const relContainer = document.getElementById('relationsContainer');
    if (relContainer && window.Sortable) {
        new Sortable(relContainer, {
            handle: '.drag-handle',
            animation: 150
        });
    }

    const btnCancel = document.getElementById('btn-cancel-member');
    const memberForm = document.getElementById('member-form');

    // Toggle sidebar
    if (btnAdd && formPanel) {
        btnAdd.addEventListener('click', () => {
            memberForm.reset();
            memberForm.removeAttribute('data-edit-id');
            document.getElementById('member-form-title').textContent = "Agregar Familiar";

            // Limpiar contenedores dinámicos
            document.getElementById('document-list-container').innerHTML = '';
            if (relContainer) relContainer.innerHTML = '';

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
            const files = dt.files;
            handleFiles(files, true);
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
                            <div style="font-weight: 600; color: var(--text-light);">${mem.first_name} ${mem.last_name}</div>
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

// --- NUEVO: Generador Dinámico de Filas de Relación ---
window.addRelationRow = function (type = '', targetId = '') {
    const container = document.getElementById('relationsContainer');
    if (!container) return;

    const currentEditId = document.getElementById('member-form').getAttribute('data-edit-id');
    let optionsHtml = '<option value="">-- Seleccionar Persona --</option>';

    familyMembers.forEach(mem => {
        if (mem.id === currentEditId) return; // No puede relacionarse consigo mismo

        const year = mem.birth_date ? `(n. ${mem.birth_date.substring(0, 4)})` : '';
        const selected = mem.id === targetId ? 'selected' : '';
        optionsHtml += `<option value="${mem.id}" ${selected}>${mem.first_name} ${mem.last_name} ${year}</option>`;
    });

    const row = document.createElement('div');
    row.className = 'relation-row draggable-item';
    row.style.cssText = 'display: flex; gap: 10px; align-items: center; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.5rem;';

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

window.openPersonDetails = function (id) {
    const mem = familyMembers.find(m => m.id === id);
    if (!mem) return;

    const detailContainer = document.getElementById('person-detail-content');
    if (!detailContainer) return;

    const avatarHtml = mem.photo_url
        ? `<img src="${mem.photo_url}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); margin: 0 auto 1.5rem auto; display: block;">`
        : `<div class="avatar-circle" style="width: 120px; height: 120px; font-size: 3rem; margin: 0 auto 1.5rem auto; display: flex;">${mem.first_name.charAt(0).toUpperCase()}</div>`;

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

    let bioHtml = '';
    if (mem.bio) {
        bioHtml = `
        <div class="mt-2" style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px;">
            <h4 style="color: var(--primary); margin-bottom: 0.5rem; font-size: 0.95rem;">Biografía e Historia</h4>
            <p style="color: var(--text-light); line-height: 1.6; white-space: pre-wrap;">${mem.bio}</p>
        </div>`;
    }

    let docsHtml = '';
    if (mem.document_links) {
        try {
            const docs = JSON.parse(mem.document_links);
            if (docs.length > 0) {
                let listItems = docs.map(d => {
                    const titleText = d.title || 'Documento adjunto';
                    const isLink = d.url.startsWith('http');

                    if (isLink) {
                        return `
                        <div style="padding: 0.8rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            📄 <a href="${d.url}" target="_blank" rel="noopener noreferrer" style="color: #a855f7; text-decoration: none; font-weight: 500; display: block; width: 100%;">${titleText} ↗</a>
                        </div>`;
                    } else {
                        return `
                        <div style="padding: 0.8rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.2rem;">
                            <strong style="color: var(--text-light); font-size: 0.95rem;">📄 ${titleText}</strong>
                            <span style="color: var(--text-muted); font-size: 0.85rem;">${d.url}</span>
                        </div>`;
                    }
                }).join('');

                docsHtml = `
                <div class="mt-2" style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px;">
                    <h4 style="color: var(--primary); margin-bottom: 1rem; font-size: 0.95rem;">📁 Documentos</h4>
                    ${listItems}
                </div>`;
            }
        } catch (e) {
            console.warn("Error renderizando documentos:", e);
        }
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
        ${docsHtml}
    `;

    if (window.switchView) {
        window.switchView('detail');
    }
}

export async function loadFamilyMembers() {
    const supabase = getSupabase();
    const listContainer = document.getElementById('members-list-container');

    if (!listContainer) return;

    listContainer.innerHTML = `
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
    `;

    const {data: members, error} = await supabase
        .from('family_members')
        .select('*')
        .order('created_at', {ascending: true});

    if (error) {
        console.error("Error loading family members:", error);
        listContainer.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        return;
    }

    familyMembers = members || [];
    renderMembersList();

    if (window.updateDashboardStats) window.updateDashboardStats();

    if (window.familyTree) {
        window.familyTree.updateData(familyMembers);
    }

    buildTimeline(familyMembers);
}

function buildTimeline(members) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

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
        container.innerHTML = '<p class="text-muted text-center" style="padding: 2rem;">No hay eventos registrados.</p>';
        return;
    }

    events.sort((a, b) => a.date - b.date);

    let html = '';
    events.forEach((ev, index) => {
        const isLeft = index % 2 === 0;
        const icon = ev.type === 'birth' ? '🌟' : '🕊️';
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

// NUEVO: Motor de Dashboard Avanzado
window.updateDashboardStats = function () {
    if (!familyMembers || familyMembers.length === 0) return;

    const totalMembers = familyMembers.length;
    const uniqueCountries = new Set();
    let nationals = 0;
    let foreigners = 0;

    familyMembers.forEach(mem => {
        if (mem.nationality && mem.nationality.trim() !== '') {
            const nat = mem.nationality.trim().toUpperCase();
            uniqueCountries.add(nat);
            if (nat === 'CL' || nat === 'CHILE') nationals++;
            else foreigners++;
        }
    });

    let totalFiles = 0;
    familyMembers.forEach(mem => {
        if (mem.photo_url) totalFiles++;
        if (mem.document_links) {
            try {
                totalFiles += JSON.parse(mem.document_links).length;
            } catch (e) {
                totalFiles++;
            }
        }
    });

    let men = 0;
    let women = 0;
    familyMembers.forEach(mem => {
        if (mem.gender === 'M') men++;
        if (mem.gender === 'F') women++;
    });

    let oldestName = "Sin datos";
    let maxAge = 0;
    const currentYear = new Date().getFullYear();

    familyMembers.forEach(mem => {
        if (mem.birth_date) {
            const birthYear = parseInt(mem.birth_date.substring(0, 4));
            if (!isNaN(birthYear)) {
                let endYear = currentYear;
                if (mem.death_date) endYear = parseInt(mem.death_date.substring(0, 4));
                const age = endYear - birthYear;
                if (age > maxAge) {
                    maxAge = age;
                    const fName = mem.first_name ? mem.first_name.split(' ')[0] : '';
                    const lName = mem.last_name ? mem.last_name.split(' ')[0] : '';
                    oldestName = `${fName} ${lName}`.trim();
                }
            }
        }
    });

    const elGender = document.getElementById('stat-gender');
    const elNats = document.getElementById('stat-nationals');
    const elAge = document.getElementById('stat-oldest-age');
    const elName = document.getElementById('stat-oldest-name');

    if (elGender) elGender.textContent = `${men} / ${women}`;
    if (elNats) elNats.textContent = `${nationals} / ${foreigners}`;
    if (elAge) elAge.textContent = `${maxAge} años`;
    if (elName) elName.textContent = oldestName ? `RÉCORD: ${oldestName}` : 'RÉCORD LONGEVIDAD';

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
};

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

        const avatarHtml = mem.photo_url
            ? `<img src="${mem.photo_url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border);">`
            : `<div class="avatar-circle" style="width: 40px; height: 40px; font-size: 1rem;">${initial}</div>`;

        el.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                ${avatarHtml}
                <div>
                    <div style="font-weight: 600">${mem.first_name} ${mem.last_name}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted)">ID: ${mem.id.substring(0, 8)}</div>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-ghost btn-small text-primary btn-edit-mem" data-id="${mem.id}">Editar</button>
                <button class="btn btn-ghost btn-small text-danger btn-delete-mem" data-id="${mem.id}">Eliminar</button>
            </div>
        `;
        listContainer.appendChild(el);
    });

    document.querySelectorAll('.btn-edit-mem').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            openEditForm(id);
        });
    });

    document.querySelectorAll('.btn-delete-mem').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm("¿Estás seguro de eliminar a este familiar?")) {
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

    // Cargar documentos
    document.getElementById('document-list-container').innerHTML = '';
    if (mem.document_links) {
        try {
            const docs = JSON.parse(mem.document_links);
            docs.forEach(doc => window.addDocumentRow(doc.title, doc.url));
        } catch (e) {
            console.warn("Formato antiguo de documentos.");
        }
    }

    // --- NUEVO: Cargar Relaciones de Arrastrar y Soltar ---
    const relContainer = document.getElementById('relationsContainer');
    if (relContainer) relContainer.innerHTML = ''; // Limpiamos

    // Cargamos los padres y pareja
    if (mem.father_id) window.addRelationRow('padre', mem.father_id);
    if (mem.mother_id) window.addRelationRow('madre', mem.mother_id);
    if (mem.spouse_id) window.addRelationRow('esposo', mem.spouse_id);

    // Cargamos a los hijos (Buscamos quién nos tiene como padre o madre)
    const misHijos = familyMembers.filter(m => m.father_id === id || m.mother_id === id);
    misHijos.forEach(hijo => {
        window.addRelationRow(hijo.gender === 'F' ? 'hija' : 'hijo', hijo.id);
    });

    memberForm.setAttribute('data-edit-id', id);
    document.getElementById('member-form-title').textContent = "Editar Persona";
    formPanel.classList.remove('hidden');
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
        if (urlParts.length === 2) {
            const filePath = urlParts[1];
            await supabase.storage.from('family_photos').remove([filePath]);
        }
    } catch (err) {
        console.error("Error borrando foto:", err);
    }
}

// --- NUEVO: CEREBRO LOGICO DE GUARDADO ---
async function saveMember() {
    const supabase = getSupabase();
    const memberForm = document.getElementById('member-form');
    const editId = memberForm.getAttribute('data-edit-id');

    // Leer campos básicos
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

    // Documentos
    const docRows = document.querySelectorAll('.doc-row');
    const docsArray = [];
    docRows.forEach(row => {
        const title = row.querySelector('.doc-title').value.trim();
        const url = row.querySelector('.doc-url').value.trim();
        if (title || url) docsArray.push({title, url});
    });
    const documentLinks = JSON.stringify(docsArray);

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

        // --- MAGIA: Leer Filas Dinámicas de Relaciones ---
        let myFatherId = null;
        let myMotherId = null;
        let mySpouseId = null;
        const updatesForOthers = []; // Guardaremos las IDs de quienes debemos actualizar mutuamente

        const relRows = document.querySelectorAll('.relation-row');
        relRows.forEach(row => {
            const type = row.querySelector('.rel-type').value;
            const targetId = row.querySelector('.rel-target').value;

            if (!targetId) return;

            // Datos para MI propio perfil
            if (type === 'padre') myFatherId = targetId;
            if (type === 'madre') myMotherId = targetId;
            if (type === 'esposo' || type === 'esposa' || type === 'pareja') {
                mySpouseId = targetId;
                // Vínculo bidireccional (Yo también soy su pareja)
                updatesForOthers.push({id: targetId, spouse_id: 'MY_NEW_ID'});
            }

            // Datos para OTROS perfiles (Yo soy el padre/madre)
            if (type === 'hijo' || type === 'hija') {
                if (gender === 'M') updatesForOthers.push({id: targetId, father_id: 'MY_NEW_ID'});
                else if (gender === 'F') updatesForOthers.push({
                    id: targetId,
                    mother_id: 'MY_NEW_ID'
                });
                else updatesForOthers.push({id: targetId, father_id: 'MY_NEW_ID'}); // Fallback
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
            document_links: documentLinks || null
        };

        if (photoUrl) memberData.photo_url = photoUrl;

        let savedMemberId = editId;

        // Guardar o Actualizar a la persona actual
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

        // --- SEGUNDA PARTE DE LA MAGIA: Actualizar a los Familiares (Hijos, Parejas) ---
        if (updatesForOthers.length > 0 && savedMemberId) {
            for (const update of updatesForOthers) {
                const payload = {};
                // Reemplazamos el marcador por nuestra ID real generada
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
        if (memberToDelete && memberToDelete.photo_url) {
            await deletePhotoFromStorage(memberToDelete.photo_url);
        }
        await loadFamilyMembers();
    }
}

// Drag & Drop de Documentos (Mantenemos tu código actual intacto)
let draggedDocRow = null;

window.addDocumentRow = function (title = '', url = '') {
    const container = document.getElementById('document-list-container');
    const row = document.createElement('div');
    row.className = 'doc-row';
    row.draggable = true;
    row.style.cssText = 'display: flex; gap: 1rem; align-items: center; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: grab;';

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