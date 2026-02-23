// tree.js
// Lógica para dibujar el árbol genealógico en el DOM

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
        this.container = document.getElementById(containerId);
        this.nodesMap = new Map();
        this.adjacency = new Map();
    }

    updateData(dbMembers) {
        if (!this.container) return;
        this.container.innerHTML = '';

        if (!dbMembers || dbMembers.length === 0) {
            this.container.innerHTML = '<p class="text-muted">No hay familiares registrados.</p>';
            return;
        }

        // Build adjacency map
        this.nodesMap.clear();
        this.adjacency.clear();

        dbMembers.forEach(m => {
            this.nodesMap.set(m.id, m);
            if (!this.adjacency.has(m.id)) this.adjacency.set(m.id, []);
            if (m.related_to && !this.adjacency.has(m.related_to)) this.adjacency.set(m.related_to, []);

            if (m.related_to) {
                // Bidireccional
                this.adjacency.get(m.id).push({ id: m.related_to, rel: m.relationship_type, dir: 'up' });
                this.adjacency.get(m.related_to).push({ id: m.id, rel: m.relationship_type, dir: 'down' });
            }
        });

        // Encontrar raíz (self)
        const selfMem = dbMembers.find(m => m.relationship_type === 'self' || !m.related_to) || dbMembers[0];
        const visited = new Set(); // Prevenir loops

        const treeHtml = `<ul>${this.buildNode(selfMem, visited)}</ul>`;
        this.container.innerHTML = treeHtml;

        // Auto center scroll
        setTimeout(() => {
            const wrapper = this.container.parentElement;
            if (wrapper) {
                const s = (this.container.scrollWidth - wrapper.clientWidth) / 2;
                const topScroll = (this.container.scrollHeight - wrapper.clientHeight); // scroll to bottom to see root si crece arriba
                if (s > 0) wrapper.scrollLeft = s;
                if (topScroll > 0) wrapper.scrollTop = topScroll;
            }
        }, 50);
    }

    buildNode(p, visited) {
        if (!p || visited.has(p.id)) return '';
        visited.add(p.id);

        const n1 = (p.first_name || "").split(' ')[0];
        const s1 = (p.last_name || "").split(' ')[0];

        let bY = p.birth_date ? p.birth_date.substring(0, 4) : "";
        let dY = p.death_date ? p.death_date.substring(0, 4) : "";
        const dd = dY ? `${bY} - ${dY}` : bY;

        const isDead = p.death_date ? true : false;
        const crossSymbol = isDead ? `<span style="color:#ccc; margin-right:3px; font-weight:normal;">†</span>` : '';

        const flag = getFlagEmoji(p.nationality);
        const flagHTML = flag ? `<span style="font-size:0.8rem; margin-left:4px;">${flag}</span>` : '';

        const photo = p.photo_url || `img/default.jpg`;

        let h = `<li>
            <a href="#" onclick="if(window.openPersonDetails){window.openPersonDetails('${p.id}');} return false;" class="tree-node">
                <img src="${photo}" onerror="this.src='https://ui-avatars.com/api/?name=${n1}+${s1}&background=random'">
                <span class="name" style="margin-top:0.5rem; display:block;">${crossSymbol}${n1} ${s1}${flagHTML}</span>
                <span class="role" style="font-size:0.8rem;opacity:0.8; display:block;">${dd}</span>
            </a>`;

        // Find parents
        const neighbors = this.adjacency.get(p.id) || [];
        const parents = [];

        neighbors.forEach(n => {
            let resolvedRole = '';
            // Si yo apunto a X como PADRE (dir=up, rel=parent), X es mi Parent.
            // Si X me apunta a mi como HIJO (dir=down, rel=child), X es mi Parent.
            if (n.dir === 'up') {
                if (n.rel === 'parent') resolvedRole = 'child'; // Subiendo hacia un hijo? Espera.
                else if (n.rel === 'child') resolvedRole = 'parent';
                else resolvedRole = n.rel;
            } else {
                if (n.rel === 'parent') resolvedRole = 'parent';
                else if (n.rel === 'child') resolvedRole = 'child';
                else resolvedRole = n.rel;
            }

            // CORRECCION SIMPLE: 
            // Si la db dice que p.id is child of n.id (meaning n is parent), then n is parent.
            if (resolvedRole === 'parent' && !visited.has(n.id)) {
                const parMem = this.nodesMap.get(n.id);
                if (parMem) parents.push(parMem);
            }
        });

        if (parents.length > 0) {
            h += '<ul>';
            parents.forEach(par => h += this.buildNode(par, new Set(visited))); // pass a clone of visited so branches don't block each other
            h += '</ul>';
        }

        h += '</li>';
        return h;
    }
}
