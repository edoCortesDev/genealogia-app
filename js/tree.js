// tree.js
// Lógica de Renderizado Híbrido (HTML + SVG) con Algoritmo de Linaje Directo

const FLAGS = {
    "CL": "🇨🇱", "AR": "🇦🇷", "PE": "🇵🇪", "CO": "🇨🇴", "VE": "🇻🇪", "EC": "🇪🇨",
    "BO": "🇧🇴", "PY": "🇵🇾", "UY": "🇺🇾", "BR": "🇧🇷", "MX": "🇲🇽", "US": "🇺🇸",
    "CA": "🇨🇦", "ES": "🇪🇸", "FR": "🇫🇷", "IT": "🇮🇹", "DE": "🇩🇪", "GB": "🇬🇧",
    "PT": "🇵🇹", "CN": "🇨🇳", "JP": "🇯🇵", "KR": "🇰🇷", "RU": "🇷🇺", "UA": "🇺🇦"
};

function getFlagEmoji(code) {
    if (!code) return "";
    if (/\p{Emoji}/u.test(code)) return code;
    return FLAGS[code.toUpperCase()] || "";
}

class FamilyTree {
    constructor(containerId) {
        this.wrapper = document.getElementById('tree-canvas-wrapper');
        this.transformLayer = document.getElementById('tree-transform-layer');
        this.svgLayer = document.getElementById('tree-svg-layer');
        this.htmlLayer = document.getElementById('tree-html-layer');

        this.nodesMap = new Map();
        this.nodes = [];
        this.links = [];

        // Cámara
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;

        this.init();
    }

    init() {
        if (!this.wrapper) return;
        this.centerCamera();
        this.setupEvents();
    }

    resize() {
        if (this.panX === 0 && this.panY === 0) {
            this.centerCamera();
        }
    }

    centerCamera() {
        if (!this.wrapper) return;
        const width = this.wrapper.clientWidth;
        const height = this.wrapper.clientHeight;
        this.panX = width / 2;
        this.panY = height / 2; // Centrar al medio de la pantalla
        this.zoom = 1;
        this.applyTransform();
    }

    applyTransform() {
        if (this.transformLayer) {
            this.transformLayer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        }
    }

    flyToNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || !this.wrapper) return;

        const width = this.wrapper.clientWidth;
        const height = this.wrapper.clientHeight;

        // Objetivo: Centrar el nodo con un zoom perfecto (ej: 1.2x)
        const targetZoom = 1.2;
        const targetPanX = (width / 2) - (node.x * targetZoom);
        const targetPanY = (height / 2) - (node.y * targetZoom);

        // Variables de animación
        const duration = 800; // 0.8 segundos de vuelo
        const startPanX = this.panX;
        const startPanY = this.panY;
        const startZoom = this.zoom;
        const startTime = performance.now();

        // Bucle de animación suave (Curva Ease Out)
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Función matemática para que desacelere al llegar
            const ease = 1 - Math.pow(1 - progress, 3);

            this.panX = startPanX + (targetPanX - startPanX) * ease;
            this.panY = startPanY + (targetPanY - startPanY) * ease;
            this.zoom = startZoom + (targetZoom - startZoom) * ease;

            this.applyTransform();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Al aterrizar, hacemos brillar la tarjeta
                const nodes = Array.from(this.htmlLayer.children);
                const targetEl = nodes.find(el => el.style.left === `${node.x}px` && el.style.top === `${node.y}px`);

                if (targetEl) {
                    targetEl.style.transition = 'all 0.3s';
                    targetEl.style.boxShadow = '0 0 50px rgba(168, 85, 247, 0.8), inset 0 0 0 2px #a855f7';
                    targetEl.style.transform = 'translate(-50%, -50%) scale(1.1)';
                    targetEl.style.zIndex = '20';

                    // Apagar el brillo después de 2 segundos
                    setTimeout(() => {
                        targetEl.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.4)';
                        targetEl.style.transform = 'translate(-50%, -50%) scale(1)';
                        targetEl.style.zIndex = '1';
                    }, 2000);
                }
            }
        };
        requestAnimationFrame(animate);
    }

    setupEvents() {
        const viewTree = document.getElementById('view-tree');
        if (!viewTree) return;

        // --- EVENTOS DE RATÓN (ESCRITORIO) ---
        viewTree.addEventListener('mousedown', (e) => {
            if (e.target.closest('button') || e.target.closest('.glass-panel')) return;
            this.isDragging = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            viewTree.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            if (viewTree) viewTree.style.cursor = 'grab';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this.applyTransform();
        });

        // --- EVENTOS TÁCTILES (MÓVILES) ---
        viewTree.addEventListener('touchstart', (e) => {
            if (e.target.closest('button') || e.target.closest('.glass-panel')) return;
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.startX = e.touches[0].clientX - this.panX;
                this.startY = e.touches[0].clientY - this.panY;
            }
        }, {passive: false});

        window.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        window.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault(); // Evita que la pantalla entera haga scroll nativo al arrastrar
            this.panX = e.touches[0].clientX - this.startX;
            this.panY = e.touches[0].clientY - this.startY;
            this.applyTransform();
        }, {passive: false});

        // --- CONTROLES DE ZOOM ---
        const btnIn = document.getElementById('btn-zoom-in');
        const btnOut = document.getElementById('btn-zoom-out');
        const btnReset = document.getElementById('btn-zoom-reset');

        if (btnIn) btnIn.addEventListener('click', () => {
            this.zoom *= 1.2;
            this.applyTransform();
        });
        if (btnOut) btnOut.addEventListener('click', () => {
            this.zoom /= 1.2;
            this.applyTransform();
        });
        if (btnReset) btnReset.addEventListener('click', () => {
            this.centerCamera();
        });

        // --- CONTROLES DE BÚSQUEDA Y VUELO ---
        const searchBtn = document.getElementById('btn-tree-search');
        const searchInput = document.getElementById('tree-search-input');
        const searchResults = document.getElementById('tree-search-results');

        if (searchBtn && searchInput && searchResults) {
            // Desplegar/Ocultar el input
            searchBtn.addEventListener('click', () => {
                const isClosed = searchInput.style.width === '0px' || searchInput.style.width === '';
                if (isClosed) {
                    searchInput.style.width = '200px';
                    searchInput.style.opacity = '1';
                    searchInput.style.padding = '0.3rem 1rem';
                    searchInput.focus();
                } else {
                    searchInput.style.width = '0';
                    searchInput.style.opacity = '0';
                    searchInput.style.padding = '0';
                    searchResults.classList.add('hidden');
                    searchInput.value = '';
                }
            });

            // Filtrar resultados al escribir
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                searchResults.innerHTML = '';

                if (query.length < 2) {
                    searchResults.classList.add('hidden');
                    return;
                }

                const matches = this.nodes.filter(n => n.name.toLowerCase().includes(query));

                if (matches.length > 0) {
                    searchResults.classList.remove('hidden');
                    matches.forEach(match => {
                        const div = document.createElement('div');
                        div.innerHTML = `<span style="font-size: 0.8rem; opacity: 0.5; margin-right: 5px;">👤</span> ${match.name}`;
                        div.style.cssText = 'padding: 0.6rem 1rem; cursor: pointer; color: var(--text-light); font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;';
                        div.onmouseover = () => div.style.background = 'rgba(255,255,255,0.05)';
                        div.onmouseout = () => div.style.background = 'transparent';

                        // ¡El clic activa el vuelo!
                        div.addEventListener('click', () => {
                            this.flyToNode(match.id);
                            // Cerrar el buscador
                            searchResults.classList.add('hidden');
                            searchInput.style.width = '0';
                            searchInput.style.opacity = '0';
                            searchInput.style.padding = '0';
                            searchInput.value = '';
                        });
                        searchResults.appendChild(div);
                    });
                } else {
                    searchResults.classList.add('hidden');
                }
            });
        }
    }

    updateData(dbMembers) {
        this.nodes = [];
        this.links = [];

        if (!dbMembers || dbMembers.length === 0) {
            this.renderDOM();
            return;
        }

        const xSpacing = 150;
        const ySpacing = 300;

        // 1. Mapeo de Relaciones Estrictas
        const nodesMap = new Map();
        dbMembers.forEach(m => {
            nodesMap.set(m.id, {
                ...m,
                parents: [], children: [], spouses: [], siblings: [],
                x: 0, y: 0
            });
        });

        dbMembers.forEach(m => {
            if (!m.related_to || m.relationship_type === 'self') return;
            const source = nodesMap.get(m.id);
            const target = nodesMap.get(m.related_to);
            if (!source || !target) return;

            if (m.relationship_type === 'parent') {
                source.children.push(target.id);
                target.parents.push(source.id);
                this.links.push({source: source.id, target: target.id, type: 'parent-child'});
            } else if (m.relationship_type === 'child') {
                source.parents.push(target.id);
                target.children.push(source.id);
                this.links.push({source: target.id, target: source.id, type: 'parent-child'});
            } else if (m.relationship_type === 'spouse') {
                source.spouses.push(target.id);
                target.spouses.push(source.id);
                if (!this.links.some(l => l.type === 'spouse' && l.target === source.id)) {
                    this.links.push({source: source.id, target: target.id, type: 'spouse'});
                }
            } else if (m.relationship_type === 'sibling') {
                source.siblings.push(target.id);
                target.siblings.push(source.id);
                if (!this.links.some(l => l.type === 'sibling' && l.target === source.id)) {
                    this.links.push({source: source.id, target: target.id, type: 'sibling'});
                }
            }
        });

        const root = dbMembers.find(m => m.relationship_type === 'self') || dbMembers[0];
        let positioned = new Set();

        // 2. Funciones Algoritmo de Linaje

        // Calcula qué tan lejos llegan los ancestros para asignar el ancho matemático perfecto
        function getAncestorDepth(nodeId) {
            const node = nodesMap.get(nodeId);
            if (!node || !node.parents || node.parents.length === 0) return 0;
            return 1 + Math.max(...node.parents.map(pId => getAncestorDepth(pId)));
        }

        const actualDepth = root ? getAncestorDepth(root.id) : 0;
        const maxAncDepth = Math.min(actualDepth, 5); // Tope de seguridad

        // Dibuja hacia ARRIBA de forma binaria (Padres, Abuelos)
        function positionAncestors(nodeId, x, y, level) {
            const node = nodesMap.get(nodeId);
            if (!node || positioned.has(nodeId)) return;

            node.x = x;
            node.y = y;
            positioned.add(nodeId);

            if (node.parents && node.parents.length > 0) {
                let parents = node.parents.map(id => nodesMap.get(id)).filter(Boolean);
                let p1 = parents.find(p => p.gender === 'M') || parents[0]; // Padre idealmente a la izquierda
                let p2 = parents.find(p => p.gender === 'F') || parents[1]; // Madre idealmente a la derecha
                if (p1 === p2 && parents.length > 1) p2 = parents[1];

                // El espacio horizontal se divide por la mitad en cada generación más vieja
                const currentSpacing = (xSpacing / 1.5) * Math.pow(2, maxAncDepth - level - 1);

                if (p1) positionAncestors(p1.id, x - currentSpacing, y - ySpacing, level + 1);
                if (p2 && p2 !== p1) positionAncestors(p2.id, x + currentSpacing, y - ySpacing, level + 1);
            }
        }

        // Dibuja hacia ABAJO (Hijos) y LATERAL (Hermanos/Cónyuges)
        function positionDescendants(nodeId, x, y, level) {
            const node = nodesMap.get(nodeId);
            if (!node || positioned.has(nodeId)) return;

            node.x = x;
            node.y = y;
            positioned.add(nodeId);

            // Cónyuges a la derecha
            if (node.spouses && node.spouses.length > 0) {
                node.spouses.forEach((spId, i) => {
                    const spNode = nodesMap.get(spId);
                    if (spNode && !positioned.has(spId)) {
                        spNode.x = x + (xSpacing * (i + 1));
                        spNode.y = y;
                        positioned.add(spId);
                    }
                });
            }

            // Hermanos a la izquierda (Solo si es el root para no distorsionar)
            if (level === 0 && node.siblings && node.siblings.length > 0) {
                node.siblings.forEach((sibId, i) => {
                    const sibNode = nodesMap.get(sibId);
                    if (sibNode && !positioned.has(sibId)) {
                        sibNode.x = x - (xSpacing * (i + 1));
                        sibNode.y = y;
                        positioned.add(sibId);
                    }
                });
            }

            // Hijos hacia abajo, centrados
            if (node.children && node.children.length > 0) {
                const totalChildren = node.children.length;
                const startX = x - ((totalChildren - 1) * xSpacing) / 2;

                node.children.forEach((childId, i) => {
                    positionDescendants(childId, startX + (i * xSpacing), y + ySpacing, level + 1);
                });
            }
        }

        // 3. Ejecutar posicionamiento empezando por el ROOT (Yo)
        if (root) {
            positionAncestors(root.id, 0, 0, 0);
            positioned.delete(root.id); // Remover del tracking para procesar sus hijos
            positionDescendants(root.id, 0, 0, 0);
        }

        // 4. Mapear datos limpios
        Array.from(nodesMap.values()).forEach(mem => {
            const fName = mem.first_name ? mem.first_name.split(' ')[0] : '';
            const lName = mem.last_name ? mem.last_name.split(' ')[0] : '';

            // Si quedó alguien "huérfano" lo ponemos lejos para que no rompa el diseño
            if (!positioned.has(mem.id)) {
                mem.x = (this.nodes.length + 1) * xSpacing;
                mem.y = ySpacing * 2;
            }

            this.nodes.push({
                id: mem.id,
                x: mem.x,
                y: mem.y,
                name: `${fName} ${lName}`.trim(),
                photo: mem.photo_url || null,
                birthDate: mem.birth_date,
                deathDate: mem.death_date,
                nationality: mem.nationality,
                gender: mem.gender
            });
        });

        this.renderDOM();
    }

    renderDOM() {
        if (!this.svgLayer || !this.htmlLayer) return;

        this.svgLayer.innerHTML = '';
        this.htmlLayer.innerHTML = '';

        const offsetX = 5000;
        const offsetY = 5000;

        // 1. Dibujar Líneas Vectoriales (Mejora 1: Curvas Bezier)
        let svgContent = '';
        this.links.forEach(link => {
            const source = this.nodes.find(n => n.id === link.source);
            const target = this.nodes.find(n => n.id === link.target);
            if (!source || !target) return;

            if (link.type === 'spouse' || link.type === 'sibling') {
                const isLeft = source.x > target.x;
                const sEdge = source.x + (isLeft ? -80 : 80) + offsetX;
                const tEdge = target.x + (isLeft ? 80 : -80) + offsetX;
                const sY = source.y + offsetY;
                const tY = target.y + offsetY;

                svgContent += `<line x1="${sEdge}" y1="${sY}" x2="${tEdge}" y2="${tY}" stroke="rgba(168, 85, 247, 0.4)" stroke-width="2" stroke-dasharray="6,6" />`;
            } else if (link.type === 'parent-child') {
                let parent = source;
                let child = target;
                if (source.y > target.y) {
                    parent = target;
                    child = source;
                }

                const sX = parent.x + offsetX;
                const sY = parent.y + 70 + offsetY; // Base del padre
                const tX = child.x + offsetX;
                const tY = child.y - 70 + offsetY; // Tope del hijo

                // Distancia vertical para suavizar la curva
                const midY = sY + (tY - sY) / 2;

                // Curva Bezier Cúbica Suave
                // M: Mover a inicio | C: Punto control 1, Punto control 2, Punto final
                svgContent += `<path d="M ${sX} ${sY} C ${sX} ${midY}, ${tX} ${midY}, ${tX} ${tY}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" />`;
            }
        });
        this.svgLayer.innerHTML = svgContent;

        // 2. Dibujar Tarjetas (Mejora 2 y 3: Glassmorphism y Foco)
        let htmlContent = '';
        this.nodes.forEach(node => {
            const isDead = node.deathDate ? true : false;
            const crossSymbol = isDead ? `<span style="color:rgba(255,255,255,0.4); margin-right:4px; font-weight:normal;">†</span>` : '';

            const flagHTML = getFlagEmoji(node.nationality)
                ? `<span style="display: block; font-size: 1.1rem; margin-top: 4px; margin-bottom: 2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${getFlagEmoji(node.nationality)}</span>`
                : '';

            const photoSrc = node.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(node.name)}&background=random`;

            let bY = node.birthDate ? node.birthDate.substring(0, 4) : "";
            let dY = node.deathDate ? node.deathDate.substring(0, 4) : "";
            const dateStr = (bY || dY) ? `${bY || '?'} - ${dY || 'Presente'}` : "Sin fecha";

            let borderColor = 'rgba(255,255,255,0.1)';
            let glowColor = 'rgba(255,255,255,0.1)';
            if (node.gender === 'F') {
                borderColor = 'rgba(236, 72, 153, 0.5)';
                glowColor = 'rgba(236, 72, 153, 0.2)';
            } else if (node.gender === 'M') {
                borderColor = 'rgba(6, 182, 212, 0.5)';
                glowColor = 'rgba(6, 182, 212, 0.2)';
            }

            // Lógica de Foco en Hover
            const hoverScript = `
                this.style.transform='translate(-50%, -50%) scale(1.08)'; 
                this.style.boxShadow='0 10px 30px ${glowColor}, inset 0 0 0 1px ${borderColor}';
                this.style.zIndex='10';
                this.style.background='rgba(30, 30, 45, 0.8)';
                Array.from(this.parentElement.children).forEach(el => { if(el !== this) el.style.opacity = '0.3'; });
            `;
            const outScript = `
                this.style.transform='translate(-50%, -50%) scale(1)'; 
                this.style.boxShadow='0 8px 32px 0 rgba(0, 0, 0, 0.4)';
                this.style.zIndex='1';
                this.style.background='rgba(20, 20, 30, 0.6)';
                Array.from(this.parentElement.children).forEach(el => el.style.opacity = '1');
            `;

            htmlContent += `
                <div class="tree-node glass-panel" 
                     style="position: absolute; left: ${node.x}px; top: ${node.y}px; transform: translate(-50%, -50%); width: 160px; padding: 15px; text-align: center; cursor: pointer; 
                            background: rgba(20, 20, 30, 0.6); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); 
                            border: 1px solid rgba(255,255,255,0.05); border-top: 1px solid rgba(255,255,255,0.1); border-radius: 16px; 
                            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 1;" 
                     onmouseover="${hoverScript.replace(/\n/g, ' ')}" 
                     onmouseout="${outScript.replace(/\n/g, ' ')}"
                     onclick="if(window.openPersonDetails){window.openPersonDetails('${node.id}');}">
                    
                    <img src="${photoSrc}" style="width: 75px; height: 75px; border-radius: 50%; border: 2px solid ${borderColor}; object-fit: cover; margin-bottom: 12px; background: #111; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    
                    <span style="display: block; font-weight: 600; font-size: 0.95rem; color: #f8fafc; line-height: 1.2; letter-spacing: -0.01em;">${crossSymbol}${node.name}</span>
                    
                    ${flagHTML}
                    
                    <span style="display: block; font-size: 0.75rem; color: #8b8d9b; margin-top: 6px; font-weight: 500; letter-spacing: 0.02em;">${dateStr}</span>
                    
                </div>
            `;
        });
        this.htmlLayer.innerHTML = htmlContent;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('view-tree')) {
        window.familyTree = new FamilyTree('tree-canvas-wrapper');
    }
});