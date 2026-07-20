// Endpoint base del Backend en el puerto activo 8001
const API_URL = 'http://127.0.0.1:8001/api/tdrs/';
let tdrIdEnEdicion = null;
let listaTdrsCache = [];
let bsCollapse = null;

// =================================================================
// 1. FUNCIONES GLOBALES (Accesibles desde los botones del HTML)
// =================================================================

window.cerrarSesion = function() {
    localStorage.clear();
    window.location.href = 'login.html';
};

window.resetearFormulario = function() {
    tdrIdEnEdicion = null;
    const form = document.getElementById('tdr-form');
    if (form) form.reset();
    const titulo = document.getElementById('form-titulo');
    if (titulo) titulo.innerText = "➕ Registrar Nuevo TDR";
    const btn = document.getElementById('btn-guardar');
    if (btn) {
        btn.innerText = "Guardar TDR en Sistema";
        btn.classList.remove('modo-edicion');
    }
    window.cerrarPanelForm();
};

window.abrirPanelForm = function() { if (bsCollapse) bsCollapse.show(); };
window.cerrarPanelForm = function() { if (bsCollapse) bsCollapse.hide(); };

window.filtrarTDRs = function() {
    const buscador = document.getElementById('buscador');
    if (!buscador) return;
    const query = buscador.value.toLowerCase().trim();
    if (!query) { renderizarTabla(listaTdrsCache); return; }

    const filtrados = listaTdrsCache.filter(t =>
        (t.numero_tdr || '').toLowerCase().includes(query) ||
        (t.responsable_designado || '').toLowerCase().includes(query) ||
        (t.direccion_solicitante || '').toLowerCase().includes(query) ||
        (t.tipo_proceso || '').toLowerCase().includes(query) ||
        (t.nombre_tarea || '').toLowerCase().includes(query)
    );
    renderizarTabla(filtrados);
};

window.aprobarTDR = async function(id) {
    if (!confirm('¿Está seguro de aprobar este TDR? Una vez aprobado quedará firmado de manera definitiva.')) return;
    const token = localStorage.getItem('token');
    try {
        const r = await fetch(`${API_URL}${id}/aprobar`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (r.ok) {
            alert('TDR aprobado con éxito.');
            cargarTDRs();
        } else {
            alert('No se pudo aprobar el TDR. Verifique los permisos.');
        }
    } catch (e) { alert('Error de red al intentar aprobar.'); }
};

window.anularTDR = async function(id) {
    const tdr = listaTdrsCache.find(t => t.id == id);
    if (!tdr) return;

    if (!confirm(`¿Está seguro de ANULAR el TDR ${tdr.numero_tdr}? \nEl registro no se eliminará de la base de datos, pero quedará inactivo para auditoría.`)) {
        return;
    }

    const token = localStorage.getItem('token');
    
    // Estructura para actualización lógica a estado ANULADO
    const datosAnulacion = {
        ...tdr,
        estado: "Anulado"
    };

    try {
        const r = await fetch(`${API_URL}${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(datosAnulacion)
        });

        if (r.ok) {
            alert(`El TDR ${tdr.numero_tdr} ha sido ANULADO correctamente.`);
            cargarTDRs();
        } else {
            alert('No se pudo anular el registro. Verifique los permisos.');
        }
    } catch (e) {
        alert('Error de red al intentar anular el TDR.');
    }
};

window.prepararEdicion = function(id) {
    const tdr = listaTdrsCache.find(t => t.id == id);
    if (!tdr) return;

    tdrIdEnEdicion = id;
    document.getElementById('numero_tdr').value = tdr.numero_tdr || '';
    document.getElementById('tipo_proceso').value = tdr.tipo_proceso || '';
    document.getElementById('nombre_tarea').value = tdr.nombre_tarea || '';
    document.getElementById('direccion_solicitante').value = tdr.direccion_solicitante || '';
    document.getElementById('responsable_designado').value = tdr.responsable_designado || '';
    document.getElementById('periodo_contrato').value = tdr.periodo_contrato || '';
    document.getElementById('fecha_inicio').value = tdr.fecha_inicio || '';
    document.getElementById('fecha_finalizacion').value = tdr.fecha_finalizacion || '';

    const inputPresupuesto = document.getElementById('presupuesto_codificado');
    const presupuestoNum = parseFloat(tdr.presupuesto_codificado || 0);
    inputPresupuesto.value = (presupuestoNum * 100).toFixed(0);
    inputPresupuesto.dispatchEvent(new Event('input'));

    document.getElementById('form-titulo').innerText = "✏️ Modificar TDR: " + (tdr.numero_tdr || '');
    const btn = document.getElementById('btn-guardar');
    btn.innerText = "Actualizar Cambios";
    btn.classList.add('modo-edicion');

    window.abrirPanelForm();
    const panelForm = document.getElementById('panel-form');
    if (panelForm) panelForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.imprimirTDR = function(id) {
    const tdr = listaTdrsCache.find(t => t.id == id);
    if (!tdr) return;

    const presupuestoNum = parseFloat(tdr.presupuesto_codificado || 0);
    const ventanaImpresion = window.open('', '_blank');
    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>TDR - ${tdr.numero_tdr}</title>
            <style>
                body { font-family: 'Arial', sans-serif; margin: 45px; color: #1e293b; line-height: 1.6; }
                .header { text-align: center; border-bottom: 3px double #003366; padding-bottom: 15px; margin-bottom: 30px; }
                .institution { font-size: 18px; font-weight: bold; color: #003366; text-transform: uppercase; margin: 0; }
                .sub-institution { font-size: 13px; color: #475569; margin: 4px 0 0 0; font-weight: 600; }
                .doc-title { font-size: 20px; font-weight: bold; color: #001f3f; margin-top: 20px; letter-spacing: 0.5px; }
                .meta-info { width: 100%; margin-top: 10px; margin-bottom: 30px; border-collapse: collapse; }
                .meta-info td { padding: 8px 12px; vertical-align: top; border: 1px solid #cbd5e1; font-size: 13px; }
                .meta-label { font-weight: bold; color: #003366; width: 30%; background-color: #f8fafc; }
                .section-title { font-size: 14px; font-weight: bold; color: #003366; text-transform: uppercase; border-bottom: 1.5px solid #004d80; padding-bottom: 4px; margin-top: 30px; margin-bottom: 12px; }
                .content-block { font-size: 13.5px; text-align: justify; margin-bottom: 15px; padding: 5px 0; white-space: pre-line; }
                .signatures { margin-top: 70px; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid; }
                .signature-block { width: 40%; font-size: 12.5px; }
                .signature-line { border-top: 1px solid #334155; margin-top: 60px; margin-bottom: 6px; }
            </style>
        </head>
        <body>
            <div class="header">
                <p class="institution">Instituto Nacional de Meteorología e Hidrología</p>
                <p class="sub-institution">INAMHI - ECUADOR</p>
                <div class="doc-title">TÉRMINOS DE REFERENCIA (TDR)</div>
            </div>
            <table class="meta-info">
                <tr><td class="meta-label">CÓDIGO REFERENCIAL:</td><td><strong>${tdr.numero_tdr || ''}</strong></td></tr>
                <tr><td class="meta-label">TIPO DE PROCESO:</td><td>${tdr.tipo_proceso || ''}</td></tr>
                <tr><td class="meta-label">DIRECCIÓN TÉCNICA SOLICITANTE:</td><td>${tdr.direccion_solicitante || ''}</td></tr>
                <tr><td class="meta-label">SERVIDOR RESPONSABLE:</td><td>${tdr.responsable_designado || ''}</td></tr>
                <tr><td class="meta-label">PLAZO DE EJECUCIÓN:</td><td>${tdr.periodo_contrato || 'N/A'}</td></tr>
                <tr><td class="meta-label">PRESUPUESTO CODIFICADO VALIDADOR:</td><td><strong>$${presupuestoNum.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')} USD</strong></td></tr>
                <tr><td class="meta-label">CRONOGRAMA ESTIMADO:</td><td>Desde: ${tdr.fecha_inicio || ''} &nbsp;|&nbsp; Hasta: ${tdr.fecha_finalizacion || ''}</td></tr>
                <tr><td class="meta-label">ESTADO DE CERTIFICACIÓN:</td><td><strong style="color: #166534;">${(tdr.estado || '').toUpperCase()} / VALIDADO INSTITUCIONALMENTE</strong></td></tr>
            </table>
            <div class="section-title">1. OBJETO DE LA CONTRATACIÓN Y TAREAS DESIGNADAS</div>
            <div class="content-block">${tdr.nombre_tarea || ''}</div>
            <div class="signatures">
                <div class="signature-block">
                    <div class="signature-line"></div>
                    <strong>${tdr.responsable_designado || ''}</strong><br>
                    Responsable Técnico / Elaborado por
                </div>
                <div class="signature-block">
                    <div class="signature-line"></div>
                    <strong>Dirección de Área Requirente</strong><br>
                    Aprobado por / Firma de Autorización
                </div>
            </div>
        </body>
        </html>
    `);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    ventanaImpresion.print();
    ventanaImpresion.close();
};

// =================================================================
// 2. LÓGICA DE CARGA Y COMUNICACIÓN CON EL BACKEND (Puerto 8001)
// =================================================================

async function cargarTDRs() {
    const token = localStorage.getItem('token');
    try {
        const respuesta = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (respuesta.status === 401 || respuesta.status === 413) {
            window.cerrarSesion();
            return;
        }
        listaTdrsCache = await respuesta.json();
        actualizarKPIs(listaTdrsCache);
        renderizarTabla(listaTdrsCache);
    } catch (error) { 
        console.error("Error al cargar TDRs desde el backend:", error); 
    }
}

function actualizarKPIs(lista) {
    let totalPresupuesto = 0;
    let totalBorrador = 0;
    let totalAprobado = 0;

    if (Array.isArray(lista)) {
        lista.forEach(tdr => {
            totalPresupuesto += parseFloat(tdr.presupuesto_codificado || 0);
            const estado = (tdr.estado || '').toLowerCase();
            if (estado === 'aprobado') totalAprobado++;
            else if (estado === 'borrador') totalBorrador++;
        });
    }

    const presupuestoFormateado = totalPresupuesto.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    const elPresupuesto = document.getElementById('kpi-presupuesto');
    const elBorrador = document.getElementById('kpi-borrador');
    const elAprobado = document.getElementById('kpi-aprobado');

    if (elPresupuesto) elPresupuesto.innerText = `$${presupuestoFormateado}`;
    if (elBorrador) elBorrador.innerText = totalBorrador;
    if (elAprobado) elAprobado.innerText = totalAprobado;
}

function renderizarTabla(lista) {
    const tabla = document.getElementById('tdr-body');
    if (!tabla) return;
    tabla.innerHTML = '';

    if (!Array.isArray(lista) || lista.length === 0) {
        tabla.innerHTML = `<tr><td colspan="9" class="text-center text-muted fst-italic py-4">No existen TDRs registrados en el sistema.</td></tr>`;
        return;
    }

    const userRole = localStorage.getItem('user_role') || 'tecnico';

    lista.forEach(tdr => {
        const fila = document.createElement('tr');
        const estadoLower = (tdr.estado || 'borrador').toLowerCase();
        
        let claseBadge = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
        let botonesAccion = '<div class="d-flex gap-1 align-items-center">';

        if (estadoLower === 'aprobado') {
            claseBadge = 'bg-success-subtle text-success-emphasis border border-success-subtle';
            botonesAccion += `<span class="text-success fw-bold small me-2">✓ Firmado</span>`;
            botonesAccion += `<button class="btn btn-sm btn-outline-print" onclick="imprimirTDR('${tdr.id}')">🖨️ Imprimir</button>`;
        } else if (estadoLower === 'anulado') {
            claseBadge = 'bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle';
            botonesAccion += `<span class="text-muted small fst-italic">⛔ Registro Anulado</span>`;
        } else {
            // Estado BORRADOR
            if (userRole === 'director') {
                botonesAccion += `<button class="btn btn-sm btn-outline-success" onclick="aprobarTDR('${tdr.id}')">Aprobar</button>`;
            }
            botonesAccion += `<button class="btn btn-sm btn-outline-warning" onclick="prepararEdicion('${tdr.id}')">Editar</button>`;
            botonesAccion += `<button class="btn btn-sm btn-outline-danger" onclick="anularTDR('${tdr.id}')">Anular</button>`;
        }

        botonesAccion += '</div>';

        const presupuestoNum = parseFloat(tdr.presupuesto_codificado || 0);
        const nombreTareaLimpio = (tdr.nombre_tarea || '').replace(/"/g, '&quot;');

        fila.innerHTML = `
            <td><strong>${tdr.numero_tdr || ''}</strong></td>
            <td>${tdr.tipo_proceso || ''}</td>
            <td><span class="truncate-text" title="${nombreTareaLimpio}">${tdr.nombre_tarea || ''}</span></td>
            <td>${tdr.direccion_solicitante || ''}</td>
            <td>${tdr.responsable_designado || ''}</td>
            <td>${tdr.periodo_contrato || 'N/A'}</td>
            <td><strong>$${presupuestoNum.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</strong></td>
            <td><span class="badge rounded-pill ${claseBadge}">${(tdr.estado || 'BORRADOR').toUpperCase()}</span></td>
            <td>${botonesAccion}</td>
        `;
        tabla.appendChild(fila);
    });
}

function obtenerPresupuestoLimpio(valorFormateado) {
    if (!valorFormateado) return 0.00;
    let value = valorFormateado.toString().replace(/\D/g, "");
    if (!value) return 0.00;
    return parseFloat(value) / 100;
}

function inicializarValidaciones() {
    const campoInicio = document.getElementById('fecha_inicio');
    const campoFin = document.getElementById('fecha_finalizacion');

    if (campoInicio && campoFin) {
        campoInicio.addEventListener('change', () => {
            if (campoInicio.value) campoFin.min = campoInicio.value;
            if (campoFin.value && campoFin.value < campoInicio.value) {
                campoFin.value = '';
                alert('La fecha de finalización no puede ser anterior a la fecha de inicio.');
            }
        });
        campoFin.addEventListener('change', () => {
            if (campoInicio.value && campoFin.value < campoInicio.value) {
                campoFin.value = '';
                alert('La fecha de finalización no puede ser anterior a la fecha de inicio.');
            }
        });
    }

    const campoPresupuesto = document.getElementById('presupuesto_codificado');
    if (campoPresupuesto) {
        campoPresupuesto.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, "");
            if (!value) { e.target.value = ""; return; }
            let numericValue = parseFloat(value) / 100;
            e.target.value = numericValue.toLocaleString('es-EC', { style: 'currency', currency: 'USD' });
        });
    }

    const campoTDR = document.getElementById('numero_tdr');
    const PREFIX_TDR = "TDR-INAMHI-2026-";
    if (campoTDR) {
        campoTDR.addEventListener('focus', () => {
            if (!campoTDR.value.startsWith(PREFIX_TDR)) campoTDR.value = PREFIX_TDR;
        });
        campoTDR.addEventListener('input', (e) => {
            let value = e.target.value;
            if (!value.startsWith(PREFIX_TDR)) {
                let digitosLimpios = value.replace(PREFIX_TDR, "").replace(/\D/g, "");
                e.target.value = PREFIX_TDR + digitosLimpios;
                return;
            }
            let sufijoNumerico = value.substring(PREFIX_TDR.length).replace(/\D/g, "");
            e.target.value = PREFIX_TDR + sufijoNumerico.substring(0, 3);
        });
    }
}

// ARRANQUE AUTOMÁTICO DE LA APLICACIÓN AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    let token = localStorage.getItem('token');
    let userRole = localStorage.getItem('user_role') || 'director';
    let userName = localStorage.getItem('user_name') || 'Técnico de Control';

    if (!token) {
        localStorage.setItem('token', 'session_active');
        localStorage.setItem('user_role', userRole);
        localStorage.setItem('user_name', userName);
    }

    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.innerText = `Conectado como: ${userName} (${userRole.toUpperCase()})`;
    }

    const panelKPIs = document.getElementById('panel-kpis');
    if (panelKPIs) {
        panelKPIs.style.display = (userRole === 'director') ? 'flex' : 'none';
    }

    const panelForm = document.getElementById('panel-form');
    const toggleForm = document.getElementById('toggle-form');
    if (panelForm && toggleForm && typeof bootstrap !== 'undefined') {
        bsCollapse = new bootstrap.Collapse(panelForm, { toggle: false });
        panelForm.addEventListener('show.bs.collapse', () => toggleForm.classList.add('abierto'));
        panelForm.addEventListener('hide.bs.collapse', () => toggleForm.classList.remove('abierto'));
    }

    inicializarValidaciones();
    cargarTDRs();

    const form = document.getElementById('tdr-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const presupuestoFormateado = document.getElementById('presupuesto_codificado').value;
            const datos = {
                numero_tdr: document.getElementById('numero_tdr').value,
                tipo_proceso: document.getElementById('tipo_proceso').value,
                nombre_tarea: document.getElementById('nombre_tarea').value,
                direccion_solicitante: document.getElementById('direccion_solicitante').value,
                responsable_designado: document.getElementById('responsable_designado').value,
                periodo_contrato: document.getElementById('periodo_contrato').value,
                presupuesto_codificado: obtenerPresupuestoLimpio(presupuestoFormateado),
                fecha_inicio: document.getElementById('fecha_inicio').value,
                fecha_finalizacion: document.getElementById('fecha_finalizacion').value
            };

            const activeToken = localStorage.getItem('token');
            const url = tdrIdEnEdicion !== null ? `${API_URL}${tdrIdEnEdicion}` : API_URL;
            const metodo = tdrIdEnEdicion !== null ? 'PUT' : 'POST';
            if (tdrIdEnEdicion === null) datos.estado = "Borrador";

            try {
                const r = await fetch(url, {
                    method: metodo,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeToken}` },
                    body: JSON.stringify(datos)
                });
                if (r.ok) {
                    alert('Operación realizada con éxito.');
                    window.resetearFormulario();
                    cargarTDRs();
                } else {
                    const err = await r.json();
                    alert('Error del servidor: ' + JSON.stringify(err.detail || err));
                }
            } catch (e) { alert('Error de red al intentar guardar.'); }
        });
    }
});