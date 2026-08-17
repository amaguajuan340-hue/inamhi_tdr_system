// Endpoint base del Backend en el puerto activo 8000
const BASE_URL = 'http://localhost:8000';
const API_URL = `${BASE_URL}/api/tdrs/`;
let tdrIdEnEdicion = null;
let tdrIdDetalle = null;
let listaTdrsCache = [];
let bsCollapse = null;
let catalogos = { tipos_proceso: [], direcciones_solicitantes: [], indicadores_cumplimiento: [], tipos_documento: [] };
let listaAuditoriaCache = [];

const ETIQUETAS_ESTADO = {
    'Borrador': 'En Proceso',
    'Aprobado': 'Completado',
    'Anulado': 'Anulado',
    'Vencido': 'Vencido',
};

function authHeaders(extra = {}) {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}`, ...extra };
}

function getRole() {
    return localStorage.getItem('user_role') || 'tecnico';
}

// =================================================================
// 1. FUNCIONES GLOBALES (Accesibles desde los botones del HTML)
// =================================================================

window.cerrarSesion = function() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
};

window.resetearFormulario = function() {
    tdrIdEnEdicion = null;
    const form = document.getElementById('tdr-form');
    if (form) {
        form.reset();
        form.classList.remove('was-validated');
        form.querySelectorAll('.is-invalid, .is-valid').forEach(campo => campo.classList.remove('is-invalid', 'is-valid'));
    }
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
    renderizarTabla(obtenerTDRsFiltrados());
};

function obtenerTDRsFiltrados() {
    const val = (id) => (document.getElementById(id)?.value || '').toLowerCase().trim();

    const numero = val('filtro-numero');
    const nombre = val('filtro-nombre');
    const direccion = val('filtro-direccion');
    const profesional = val('filtro-profesional');
    const tipo = val('filtro-tipo');
    const estado = val('filtro-estado');
    const fechaDesde = document.getElementById('filtro-fecha-desde')?.value || '';
    const fechaHasta = document.getElementById('filtro-fecha-hasta')?.value || '';

    return listaTdrsCache.filter(t => {
        if (numero && !(t.numero_tdr || '').toLowerCase().includes(numero)) return false;
        if (nombre && !(t.nombre_tarea || '').toLowerCase().includes(nombre)) return false;
        if (direccion && (t.direccion_solicitante || '') !== document.getElementById('filtro-direccion').value) return false;
        if (profesional && !(t.responsable_designado || '').toLowerCase().includes(profesional)) return false;
        if (tipo && (t.tipo_proceso || '') !== document.getElementById('filtro-tipo').value) return false;
        if (estado && (t.estado || '').toLowerCase() !== estado.toLowerCase()) return false;
        if (fechaDesde && t.fecha_creacion && t.fecha_creacion.slice(0, 10) < fechaDesde) return false;
        if (fechaHasta && t.fecha_creacion && t.fecha_creacion.slice(0, 10) > fechaHasta) return false;
        return true;
    });
}

window.limpiarFiltrosAvanzados = function() {
    ['filtro-numero', 'filtro-nombre', 'filtro-direccion', 'filtro-profesional', 'filtro-tipo', 'filtro-estado', 'filtro-fecha-desde', 'filtro-fecha-hasta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    filtrarTDRs();
};

function mostrarNotificacion(mensaje, tipo = 'primary', duracionMs = 4000) {
    const contenedor = document.getElementById('toast-container');
    if (!contenedor) { alert(mensaje); return; }

    const iconos = { success: '✓', danger: '✕', warning: '!', primary: 'i' };

    const toast = document.createElement('div');
    toast.className = `app-toast toast-${tipo}`;
    toast.innerHTML = `
        <div class="toast-icon">${iconos[tipo] || 'i'}</div>
        <div class="toast-text"></div>
        <button type="button" class="toast-close" aria-label="Cerrar">&times;</button>
    `;
    toast.querySelector('.toast-text').textContent = mensaje;

    const cerrar = () => {
        toast.classList.add('closing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    toast.querySelector('.toast-close').addEventListener('click', cerrar);
    contenedor.appendChild(toast);

    setTimeout(cerrar, duracionMs);
}

function mostrarConfirmacion({ titulo, mensaje, tipo = 'primary', textoBoton = 'Aceptar', icono = '❓' }) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('modalConfirmacion');
        if (!modalEl || typeof bootstrap === 'undefined') { resolve(confirm(mensaje)); return; }

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        document.getElementById('confirmTitulo').textContent = titulo;
        document.getElementById('confirmMensaje').textContent = mensaje;

        const iconoEl = document.getElementById('confirmIcon');
        iconoEl.textContent = icono;
        iconoEl.className = `confirm-icon mb-3 confirm-icon-${tipo}`;

        const btnAceptar = document.getElementById('confirmAceptar');
        btnAceptar.textContent = textoBoton;
        btnAceptar.className = `btn px-4 btn-confirm-${tipo}`;

        let resuelto = false;
        const onAceptar = () => { resuelto = true; modal.hide(); resolve(true); };
        const onHidden = () => {
            modalEl.removeEventListener('hidden.bs.modal', onHidden);
            btnAceptar.removeEventListener('click', onAceptar);
            if (!resuelto) resolve(false);
        };

        btnAceptar.addEventListener('click', onAceptar, { once: true });
        modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });

        modal.show();
    });
}

window.cambiarEstadoTDR = async function(id, nuevoEstado) {
    const tdr = listaTdrsCache.find(t => t.id == id);
    if (!tdr) return;

    const etiqueta = ETIQUETAS_ESTADO[nuevoEstado] || nuevoEstado;
    const confirmado = await mostrarConfirmacion({
        titulo: 'Cambiar estado del TDR',
        mensaje: `¿Cambiar el estado de ${tdr.numero_tdr} a "${etiqueta}"?`,
        tipo: nuevoEstado === 'Anulado' ? 'danger' : 'primary',
        textoBoton: 'Sí, confirmar',
        icono: '✎'
    });
    if (!confirmado) { cargarTDRs(); return; }

    try {
        let r;
        if (nuevoEstado === 'Aprobado') {
            r = await fetch(`${API_URL}${id}/aprobar`, { method: 'PUT', headers: authHeaders() });
        } else {
            r = await fetch(`${API_URL}${id}`, {
                method: 'PUT',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ ...tdr, estado: nuevoEstado }),
            });
        }

        if (r.ok) {
            mostrarNotificacion(`Estado actualizado a "${etiqueta}".`, 'success');
        } else {
            const err = await r.json().catch(() => ({}));
            mostrarNotificacion('No se pudo cambiar el estado: ' + (err.detail || 'verifica tus permisos.'), 'danger');
        }
    } catch (e) {
        mostrarNotificacion('Error de red al intentar cambiar el estado.', 'danger');
    } finally {
        cargarTDRs();
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

window.imprimirTDR = async function(id) {
    const tdr = listaTdrsCache.find(t => t.id == id);
    if (!tdr) return;

    const [documentos, soportes] = await Promise.all([
        fetch(`${BASE_URL}/api/documentos/tdrs/${id}`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []),
        fetch(`${BASE_URL}/api/soportes/tdrs/${id}`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []),
    ]);

    const filaLista = (items, columnas) => items.length
        ? items.map(it => `<tr>${columnas.map(c => `<td>${c(it)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columnas.length}" style="color:#94a3b8; text-align:center;">Sin registros</td></tr>`;

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
                .signatures { margin-top: 70px; display: flex; justify-content: center; text-align: center; page-break-inside: avoid; }
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

            <div class="section-title">2. DOCUMENTOS ADJUNTOS</div>
            <table class="meta-info"><tr><th style="text-align:left; padding:6px 12px; font-size:12px;">Tipo de documento</th><th style="text-align:left; padding:6px 12px; font-size:12px;">Nombre de archivo</th><th style="text-align:left; padding:6px 12px; font-size:12px;">Fecha</th></tr>
                ${filaLista(documentos, [d => d.tipo_documento, d => d.nombre_archivo, d => new Date(d.fecha_subida).toLocaleDateString()])}
            </table>

            <div class="section-title">3. SOPORTES / MANTENIMIENTOS</div>
            <table class="meta-info"><tr><th style="text-align:left; padding:6px 12px; font-size:12px;">Número</th><th style="text-align:left; padding:6px 12px; font-size:12px;">Fecha programada</th><th style="text-align:left; padding:6px 12px; font-size:12px;">Cumplimiento</th></tr>
                ${filaLista(soportes, [s => s.numero, s => s.fecha_programada, s => s.indicador_cumplimiento])}
            </table>

            <div class="signatures">
                <div class="signature-block">
                    <div class="signature-line"></div>
                    <strong>${tdr.responsable_designado || ''}</strong><br>
                    Responsable Designado
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
        renderizarTabla(obtenerTDRsFiltrados());
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

    lista.forEach(tdr => {
        const fila = document.createElement('tr');
        const estadoActual = tdr.estado || 'Borrador';
        const estadoLower = estadoActual.toLowerCase();

        const opcionesEstado = Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) =>
            `<option value="${valor}" ${valor === estadoActual ? 'selected' : ''}>${etiqueta}</option>`
        ).join('');

        const selectorEstado = `
            <select class="form-select form-select-sm estado-select estado-${estadoLower}" onchange="cambiarEstadoTDR('${tdr.id}', this.value)">
                ${opcionesEstado}
            </select>
        `;

        let botonesAccion = '<div class="d-flex gap-1 align-items-center flex-wrap">';
        if (estadoLower === 'aprobado') {
            botonesAccion += `<button class="btn btn-sm btn-outline-print" onclick="imprimirTDR('${tdr.id}')">🖨️ Imprimir</button>`;
        } else if (estadoLower !== 'anulado') {
            botonesAccion += `<button class="btn btn-sm btn-outline-warning" onclick="prepararEdicion('${tdr.id}')">Editar</button>`;
        }
        botonesAccion += `<button class="btn btn-sm btn-outline-secondary" onclick="abrirDetalleTDR('${tdr.id}')">Detalle</button>`;
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
            <td>${selectorEstado}</td>
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

function marcarCampo(campo, esValido, mensaje) {
    const feedback = document.getElementById(`feedback-${campo.id}`);
    if (!esValido) {
        campo.classList.add('is-invalid');
        campo.classList.remove('is-valid');
        if (feedback && mensaje) feedback.textContent = mensaje;
    } else {
        campo.classList.remove('is-invalid');
        campo.classList.add('is-valid');
    }
    return esValido;
}

function validarFormulario() {
    const numeroTDR = document.getElementById('numero_tdr');
    const tipoProceso = document.getElementById('tipo_proceso');
    const nombreTarea = document.getElementById('nombre_tarea');
    const direccion = document.getElementById('direccion_solicitante');
    const responsable = document.getElementById('responsable_designado');
    const periodo = document.getElementById('periodo_contrato');
    const presupuesto = document.getElementById('presupuesto_codificado');
    const fechaInicio = document.getElementById('fecha_inicio');
    const fechaFin = document.getElementById('fecha_finalizacion');

    let esValido = true;

    esValido = marcarCampo(numeroTDR, /^TDR-INAMHI-2026-\d{3}$/.test(numeroTDR.value.trim())) && esValido;
    esValido = marcarCampo(tipoProceso, tipoProceso.value.trim().length >= 3) && esValido;
    esValido = marcarCampo(nombreTarea, nombreTarea.value.trim().length >= 10) && esValido;
    esValido = marcarCampo(direccion, direccion.value.trim().length >= 3) && esValido;
    esValido = marcarCampo(responsable, responsable.value.trim().length >= 3) && esValido;
    esValido = marcarCampo(periodo, periodo.value.trim().length >= 2) && esValido;
    esValido = marcarCampo(presupuesto, obtenerPresupuestoLimpio(presupuesto.value) > 0) && esValido;
    esValido = marcarCampo(fechaInicio, !!fechaInicio.value) && esValido;

    let finValido = !!fechaFin.value;
    let mensajeFin = 'Selecciona la fecha de finalización.';
    if (finValido && fechaInicio.value && fechaFin.value < fechaInicio.value) {
        finValido = false;
        mensajeFin = 'La fecha de fin no puede ser anterior a la de inicio.';
    }
    esValido = marcarCampo(fechaFin, finValido, mensajeFin) && esValido;

    return esValido;
}

function inicializarValidaciones() {
    const campoInicio = document.getElementById('fecha_inicio');
    const campoFin = document.getElementById('fecha_finalizacion');

    if (campoInicio && campoFin) {
        campoInicio.addEventListener('change', () => {
            if (campoInicio.value) campoFin.min = campoInicio.value;
            if (campoFin.value && campoFin.value < campoInicio.value) {
                campoFin.value = '';
                mostrarNotificacion('La fecha de finalización no puede ser anterior a la fecha de inicio.', 'warning');
            }
        });
        campoFin.addEventListener('change', () => {
            if (campoInicio.value && campoFin.value < campoInicio.value) {
                campoFin.value = '';
                mostrarNotificacion('La fecha de finalización no puede ser anterior a la fecha de inicio.', 'warning');
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

    const form = document.getElementById('tdr-form');
    if (form) {
        ['numero_tdr', 'tipo_proceso', 'nombre_tarea', 'direccion_solicitante', 'responsable_designado', 'periodo_contrato', 'presupuesto_codificado', 'fecha_inicio', 'fecha_finalizacion'].forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                campo.addEventListener('input', () => { if (form.classList.contains('was-validated')) validarFormulario(); });
                campo.addEventListener('change', () => { if (form.classList.contains('was-validated')) validarFormulario(); });
            }
        });
    }
}

// =================================================================
// 3. CATÁLOGOS (tipo de proceso, dirección, cumplimiento, documentos)
// =================================================================

async function cargarCatalogos() {
    try {
        const r = await fetch(`${BASE_URL}/api/catalogos/`, { headers: authHeaders() });
        if (!r.ok) return;
        catalogos = await r.json();

        llenarSelect('tipo_proceso', catalogos.tipos_proceso);
        llenarSelect('direccion_solicitante', catalogos.direcciones_solicitantes);
        llenarSelect('documento-tipo', catalogos.tipos_documento, null);
        llenarSelect('soporte-cumplimiento', catalogos.indicadores_cumplimiento, null);
        const selectCumplimiento = document.getElementById('soporte-cumplimiento');
        if (selectCumplimiento) selectCumplimiento.value = 'No';
        llenarSelect('filtro-direccion', catalogos.direcciones_solicitantes, 'Todas');
        llenarSelect('filtro-tipo', catalogos.tipos_proceso, 'Todos');
    } catch (e) { console.error('No se pudieron cargar los catálogos', e); }
}

function llenarSelect(idSelect, opciones, placeholder = 'Seleccione...') {
    const select = document.getElementById(idSelect);
    if (!select) return;
    select.innerHTML = placeholder ? `<option value="">${placeholder}</option>` : '';
    (opciones || []).forEach(op => {
        const opt = document.createElement('option');
        opt.value = op;
        opt.textContent = op;
        select.appendChild(opt);
    });
}

// =================================================================
// 4. DETALLE DE TDR: DOCUMENTOS, SOPORTES, ACTAS, INFORME DE CONFORMIDAD
// =================================================================

window.abrirDetalleTDR = async function(id) {
    tdrIdDetalle = id;
    const tdr = listaTdrsCache.find(t => t.id == id);
    document.getElementById('detalleTDRTitulo').textContent = `Detalle de TDR: ${tdr ? tdr.numero_tdr : ''}`;

    await Promise.all([
        cargarDocumentos(),
        cargarSoportes(),
        cargarActas(),
        cargarConformidad(),
    ]);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDetalleTDR')).show();
};

function botonEliminar(fn, id) {
    return getRole() === 'director'
        ? `<button class="btn btn-sm btn-outline-danger" onclick="${fn}('${id}')">Eliminar</button>`
        : '';
}

window.descargarDocumento = async function(id) {
    try {
        const r = await fetch(`${BASE_URL}/api/documentos/${id}/descargar`, { headers: authHeaders() });
        if (!r.ok) { mostrarNotificacion('No se pudo descargar el archivo.', 'danger'); return; }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { mostrarNotificacion('Error de red al descargar el archivo.', 'danger'); }
};

async function cargarDocumentos() {
    const r = await fetch(`${BASE_URL}/api/documentos/tdrs/${tdrIdDetalle}`, { headers: authHeaders() });
    const docs = r.ok ? await r.json() : [];
    const tbody = document.getElementById('lista-documentos');
    tbody.innerHTML = docs.length ? '' : '<tr><td colspan="4" class="text-muted text-center">Sin documentos cargados.</td></tr>';
    docs.forEach(d => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${d.tipo_documento}</td>
            <td><a href="#" onclick="descargarDocumento(${d.id}); return false;">${d.nombre_archivo}</a></td>
            <td>${new Date(d.fecha_subida).toLocaleDateString()}</td>
            <td>${botonEliminar('eliminarDocumento', d.id)}</td>
        `;
        tbody.appendChild(fila);
    });
}

window.eliminarDocumento = async function(id) {
    const confirmado = await mostrarConfirmacion({ titulo: 'Eliminar documento', mensaje: '¿Eliminar este archivo permanentemente?', tipo: 'danger', textoBoton: 'Sí, eliminar', icono: '🗑️' });
    if (!confirmado) return;
    const r = await fetch(`${BASE_URL}/api/documentos/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { mostrarNotificacion('Documento eliminado.', 'success'); cargarDocumentos(); }
    else mostrarNotificacion('No se pudo eliminar el documento.', 'danger');
};

async function cargarSoportes() {
    const r = await fetch(`${BASE_URL}/api/soportes/tdrs/${tdrIdDetalle}`, { headers: authHeaders() });
    const items = r.ok ? await r.json() : [];
    const tbody = document.getElementById('lista-soportes');
    tbody.innerHTML = items.length ? '' : '<tr><td colspan="5" class="text-muted text-center">Sin soportes registrados.</td></tr>';
    items.forEach(s => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${s.numero}</td>
            <td>${s.fecha_programada}</td>
            <td>${s.indicador_cumplimiento}</td>
            <td>${s.documento_id ? `<a href="#" onclick="descargarDocumento(${s.documento_id}); return false;">Ver PDF</a>` : '—'}</td>
            <td>${botonEliminar('eliminarSoporte', s.id)}</td>
        `;
        tbody.appendChild(fila);
    });
}

window.eliminarSoporte = async function(id) {
    const confirmado = await mostrarConfirmacion({ titulo: 'Eliminar soporte', mensaje: '¿Eliminar este registro de soporte/mantenimiento?', tipo: 'danger', textoBoton: 'Sí, eliminar', icono: '🗑️' });
    if (!confirmado) return;
    const r = await fetch(`${BASE_URL}/api/soportes/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { mostrarNotificacion('Soporte eliminado.', 'success'); cargarSoportes(); }
    else mostrarNotificacion('No se pudo eliminar el soporte.', 'danger');
};

async function cargarActas() {
    const r = await fetch(`${BASE_URL}/api/actas/tdrs/${tdrIdDetalle}`, { headers: authHeaders() });
    const items = r.ok ? await r.json() : [];
    const tbody = document.getElementById('lista-actas');
    tbody.innerHTML = items.length ? '' : '<tr><td colspan="3" class="text-muted text-center">Sin actas registradas.</td></tr>';
    items.forEach(a => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${a.fecha_acta}</td>
            <td>${a.documento_id ? `<a href="#" onclick="descargarDocumento(${a.documento_id}); return false;">Ver PDF</a>` : '—'}</td>
            <td>${botonEliminar('eliminarActa', a.id)}</td>
        `;
        tbody.appendChild(fila);
    });
}

window.eliminarActa = async function(id) {
    const confirmado = await mostrarConfirmacion({ titulo: 'Eliminar acta', mensaje: '¿Eliminar esta acta parcial?', tipo: 'danger', textoBoton: 'Sí, eliminar', icono: '🗑️' });
    if (!confirmado) return;
    const r = await fetch(`${BASE_URL}/api/actas/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { mostrarNotificacion('Acta eliminada.', 'success'); cargarActas(); }
    else mostrarNotificacion('No se pudo eliminar el acta.', 'danger');
};

async function cargarConformidad() {
    const r = await fetch(`${BASE_URL}/api/conformidad/tdrs/${tdrIdDetalle}`, { headers: authHeaders() });
    const items = r.ok ? await r.json() : [];
    const tbody = document.getElementById('lista-conformidad');
    tbody.innerHTML = items.length ? '' : '<tr><td colspan="4" class="text-muted text-center">Sin informes registrados.</td></tr>';
    items.forEach(c => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${c.fecha_emision}</td>
            <td>${c.es_final ? '<span class="badge bg-success-subtle text-success-emphasis">Final</span>' : '<span class="badge bg-warning-subtle text-warning-emphasis">Parcial</span>'}</td>
            <td>${c.documento_id ? `<a href="#" onclick="descargarDocumento(${c.documento_id}); return false;">Ver PDF</a>` : '—'}</td>
            <td>${botonEliminar('eliminarConformidad', c.id)}</td>
        `;
        tbody.appendChild(fila);
    });
}

window.eliminarConformidad = async function(id) {
    const confirmado = await mostrarConfirmacion({ titulo: 'Eliminar informe', mensaje: '¿Eliminar este informe de conformidad?', tipo: 'danger', textoBoton: 'Sí, eliminar', icono: '🗑️' });
    if (!confirmado) return;
    const r = await fetch(`${BASE_URL}/api/conformidad/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { mostrarNotificacion('Informe eliminado.', 'success'); cargarConformidad(); }
    else mostrarNotificacion('No se pudo eliminar el informe.', 'danger');
};

function inicializarFormulariosDetalle() {
    document.getElementById('form-documento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('tipo_documento', document.getElementById('documento-tipo').value);
        fd.append('archivo', document.getElementById('documento-archivo').files[0]);
        const r = await fetch(`${BASE_URL}/api/documentos/tdrs/${tdrIdDetalle}`, { method: 'POST', headers: authHeaders(), body: fd });
        if (r.ok) { mostrarNotificacion('Documento subido.', 'success'); e.target.reset(); cargarDocumentos(); }
        else { const err = await r.json().catch(() => ({})); mostrarNotificacion('Error al subir: ' + (err.detail || ''), 'danger'); }
    });

    const campoFechaSoporte = document.getElementById('soporte-fecha');
    const campoCumplimientoSoporte = document.getElementById('soporte-cumplimiento');
    const campoArchivoSoporte = document.getElementById('soporte-archivo');
    const ayudaCumplimientoSoporte = document.getElementById('soporte-cumplimiento-ayuda');

    campoFechaSoporte.addEventListener('change', () => {
        const hoy = new Date().toISOString().slice(0, 10);
        const yaLlegoLaFecha = !!campoFechaSoporte.value && campoFechaSoporte.value <= hoy;
        campoCumplimientoSoporte.disabled = !yaLlegoLaFecha;
        campoArchivoSoporte.disabled = !yaLlegoLaFecha;
        if (!yaLlegoLaFecha) campoCumplimientoSoporte.value = 'No';
        ayudaCumplimientoSoporte.style.display = yaLlegoLaFecha ? 'none' : 'block';
    });

    document.getElementById('form-soporte').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('fecha_programada', campoFechaSoporte.value);
        fd.append('indicador_cumplimiento', campoCumplimientoSoporte.disabled ? 'No' : campoCumplimientoSoporte.value);
        const archivo = campoArchivoSoporte.disabled ? null : campoArchivoSoporte.files[0];
        if (archivo) fd.append('archivo', archivo);
        const r = await fetch(`${BASE_URL}/api/soportes/tdrs/${tdrIdDetalle}`, { method: 'POST', headers: authHeaders(), body: fd });
        if (r.ok) {
            mostrarNotificacion('Soporte registrado.', 'success');
            e.target.reset();
            campoCumplimientoSoporte.disabled = true;
            campoArchivoSoporte.disabled = true;
            ayudaCumplimientoSoporte.style.display = 'block';
            cargarSoportes();
        } else {
            const err = await r.json().catch(() => ({}));
            mostrarNotificacion('Error al registrar: ' + (err.detail || ''), 'danger');
        }
    });

    document.getElementById('btn-agregar-tipo-documento').addEventListener('click', () => {
        const form = document.getElementById('form-nuevo-tipo-documento');
        form.reset();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevoTipoDocumento')).show();
    });

    document.getElementById('form-nuevo-tipo-documento').addEventListener('submit', async (e) => {
        e.preventDefault();
        const campoNombre = document.getElementById('nuevo-tipo-documento-nombre');
        const nombre = campoNombre.value.trim();
        if (!nombre) return;

        const r = await fetch(`${BASE_URL}/api/catalogos/tipos-documento`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ nombre }),
        });
        if (r.ok) {
            mostrarNotificacion('Tipo de documento agregado.', 'success');
            await cargarCatalogos();
            document.getElementById('documento-tipo').value = nombre;
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevoTipoDocumento')).hide();
        } else {
            const err = await r.json().catch(() => ({}));
            mostrarNotificacion('Error: ' + (err.detail || ''), 'danger');
        }
    });

    document.getElementById('form-acta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('fecha_acta', document.getElementById('acta-fecha').value);
        fd.append('archivo', document.getElementById('acta-archivo').files[0]);
        const r = await fetch(`${BASE_URL}/api/actas/tdrs/${tdrIdDetalle}`, { method: 'POST', headers: authHeaders(), body: fd });
        if (r.ok) { mostrarNotificacion('Acta registrada.', 'success'); e.target.reset(); cargarActas(); }
        else { const err = await r.json().catch(() => ({})); mostrarNotificacion('Error al registrar: ' + (err.detail || ''), 'danger'); }
    });

    document.getElementById('form-conformidad').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('fecha_emision', document.getElementById('conformidad-fecha').value);
        fd.append('es_final', document.getElementById('conformidad-final').value);
        fd.append('archivo', document.getElementById('conformidad-archivo').files[0]);
        const r = await fetch(`${BASE_URL}/api/conformidad/tdrs/${tdrIdDetalle}`, { method: 'POST', headers: authHeaders(), body: fd });
        if (r.ok) { mostrarNotificacion('Informe de conformidad registrado.', 'success'); e.target.reset(); cargarConformidad(); }
        else { const err = await r.json().catch(() => ({})); mostrarNotificacion('Error al registrar: ' + (err.detail || ''), 'danger'); }
    });
}

// =================================================================
// 5. GESTIÓN DE USUARIOS (solo Director)
// =================================================================

window.abrirModalUsuarios = async function() {
    await cargarUsuarios();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUsuarios')).show();
};

async function cargarUsuarios() {
    const r = await fetch(`${BASE_URL}/api/users/`, { headers: authHeaders() });
    const usuarios = r.ok ? await r.json() : [];
    const tbody = document.getElementById('lista-usuarios');
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${u.username}</td>
            <td>${u.nombre_completo}</td>
            <td>${u.role === 'director' ? 'Administrador' : 'Técnico'}</td>
            <td><button class="btn btn-sm btn-outline-warning" onclick="resetearPasswordUsuario('${u.id}', '${u.username}')">Resetear contraseña</button></td>
        `;
        tbody.appendChild(fila);
    });
}

let usuarioIdParaResetPassword = null;

window.resetearPasswordUsuario = function(id, username) {
    usuarioIdParaResetPassword = id;
    document.getElementById('reset-password-username').textContent = username;
    document.getElementById('form-reset-password').reset();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalResetPassword')).show();
};

function inicializarFormularioResetPassword() {
    document.getElementById('form-reset-password').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nueva = document.getElementById('reset-password-nueva').value;
        if (!nueva || !usuarioIdParaResetPassword) return;

        const r = await fetch(`${BASE_URL}/api/users/${usuarioIdParaResetPassword}/reset-password`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ nueva_password: nueva }),
        });
        if (r.ok) {
            mostrarNotificacion('Contraseña actualizada con éxito.', 'success');
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalResetPassword')).hide();
        } else {
            mostrarNotificacion('No se pudo actualizar la contraseña.', 'danger');
        }
    });
}

function inicializarFormularioUsuarios() {
    document.getElementById('form-nuevo-usuario').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            username: document.getElementById('nuevo-username').value,
            nombre_completo: document.getElementById('nuevo-nombre').value,
            role: document.getElementById('nuevo-rol').value,
            password: document.getElementById('nuevo-password').value,
        };
        const r = await fetch(`${BASE_URL}/api/users/register`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body),
        });
        if (r.ok) { mostrarNotificacion('Usuario creado con éxito.', 'success'); e.target.reset(); cargarUsuarios(); }
        else { const err = await r.json().catch(() => ({})); mostrarNotificacion('Error: ' + (err.detail || ''), 'danger'); }
    });
}

// =================================================================
// 6. SISTEMA DE ALERTAS DE VENCIMIENTO
// =================================================================

async function cargarAlertas() {
    try {
        const r = await fetch(`${BASE_URL}/api/alertas/tdrs`, { headers: authHeaders() });
        if (!r.ok) return;
        const data = await r.json();

        const proximos = (data.activos || []).filter(t => t.nivel_alerta !== null);
        renderizarBannerAlertas(proximos);

        const bloqueados = (data.activos || []).filter(t => t.bloqueado);
        if (bloqueados.length > 0 && sessionStorage.getItem('alertaDesbloqueada') !== '1') {
            mostrarModalBloqueo(bloqueados);
        }
    } catch (e) { console.error('No se pudieron cargar las alertas', e); }
}

function renderizarBannerAlertas(items) {
    const contenedor = document.getElementById('alertas-flotantes');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    if (!items.length) return;
    if (sessionStorage.getItem('bannerAlertasCerrado') === '1') return;

    const panel = document.createElement('div');
    panel.className = 'card shadow-sm';
    panel.innerHTML = `
        <div class="card-body position-relative">
            <button type="button" class="btn-close position-absolute" style="top: .75rem; right: .75rem;" aria-label="Cerrar" onclick="cerrarBannerAlertas()"></button>
            <h6 class="fw-bold text-warning-emphasis mb-2 pe-4">⏰ TDR próximos a vencer</h6>
            <ul class="small mb-0 ps-3">
                ${items.map(t => `<li><strong>${t.numero_tdr}</strong> — ${t.dias_restantes} día(s) restantes</li>`).join('')}
            </ul>
        </div>
    `;
    contenedor.appendChild(panel);
}

window.cerrarBannerAlertas = function() {
    sessionStorage.setItem('bannerAlertasCerrado', '1');
    const contenedor = document.getElementById('alertas-flotantes');
    if (contenedor) contenedor.innerHTML = '';
};

function mostrarModalBloqueo(bloqueados) {
    const lista = document.getElementById('lista-tdr-bloqueados');
    lista.innerHTML = bloqueados.map(t => `<li><strong>${t.numero_tdr}</strong> — ${t.dias_restantes} día(s) restantes</li>`).join('');

    const modalEl = document.getElementById('modalBloqueoVencimiento');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    document.getElementById('btn-desbloquear').onclick = async () => {
        const errorEl = document.getElementById('error-desbloqueo');
        try {
            const password = document.getElementById('input-password-desbloqueo').value;
            const r = await fetch(`${BASE_URL}/api/alertas/verificar-admin`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ password }),
            });
            const data = r.ok ? await r.json() : { valido: false };
            if (data.valido) {
                sessionStorage.setItem('alertaDesbloqueada', '1');
                errorEl.style.display = 'none';
                document.getElementById('input-password-desbloqueo').value = '';
                modal.hide();
            } else {
                errorEl.textContent = 'Contraseña incorrecta.';
                errorEl.style.display = 'block';
            }
        } catch (e) {
            console.error('Error al verificar contraseña de administrador', e);
            errorEl.textContent = 'Error de red al verificar la contraseña. Intenta de nuevo.';
            errorEl.style.display = 'block';
        }
    };
}

// =================================================================
// 7. INFORME CONSOLIDADO (PDF vía impresión) SEGÚN FILTRO ACTIVO
// =================================================================

window.imprimirInformeConsolidado = function() {
    const items = obtenerTDRsFiltrados();
    if (!items.length) { mostrarNotificacion('No hay TDR que coincidan con el filtro actual.', 'warning'); return; }

    const filas = items.map(t => `
        <tr>
            <td>${t.numero_tdr || ''}</td>
            <td>${t.tipo_proceso || ''}</td>
            <td>${t.nombre_tarea || ''}</td>
            <td>${t.direccion_solicitante || ''}</td>
            <td>${t.responsable_designado || ''}</td>
            <td>$${parseFloat(t.presupuesto_codificado || 0).toFixed(2)}</td>
            <td>${t.fecha_inicio || ''}</td>
            <td>${t.fecha_finalizacion || ''}</td>
            <td>${(t.estado || '').toUpperCase()}</td>
        </tr>
    `).join('');

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Informe Consolidado de TDR</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
                h1 { font-size: 18px; color: #003366; text-align: center; }
                p.sub { text-align: center; color: #475569; font-size: 12px; margin-top: -8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                th { background: #f1f5f9; color: #003366; }
            </style>
        </head>
        <body>
            <h1>Instituto Nacional de Meteorología e Hidrología (INAMHI)</h1>
            <p class="sub">Informe Consolidado de Términos de Referencia — ${items.length} registro(s) — Generado el ${new Date().toLocaleString()}</p>
            <table>
                <thead>
                    <tr><th>N° TDR</th><th>Tipo</th><th>Tarea</th><th>Dirección</th><th>Responsable</th><th>Presupuesto</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </body>
        </html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
    ventana.close();
};

// =================================================================
// 8. AUDITORÍA (solo Director)
// =================================================================

window.abrirModalAuditoria = async function() {
    const r = await fetch(`${BASE_URL}/api/auditoria/`, { headers: authHeaders() });
    listaAuditoriaCache = r.ok ? await r.json() : [];
    document.getElementById('filtro-auditoria').value = '';
    renderizarAuditoria();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalAuditoria')).show();
};

function claseBadgeAccion(accion) {
    const a = (accion || '').toLowerCase();
    if (a.includes('eliminar')) return 'badge-accion-eliminar';
    if (a.includes('aprobar')) return 'badge-accion-aprobar';
    if (a.includes('crear') || a.includes('cargar')) return 'badge-accion-crear';
    if (a.includes('editar') || a.includes('actualizar')) return 'badge-accion-editar';
    if (a.includes('login')) return 'badge-accion-login';
    if (a.includes('reset') || a.includes('desbloqueo')) return 'badge-accion-reset';
    return 'badge-accion-otro';
}

function obtenerAuditoriaFiltrada() {
    const query = (document.getElementById('filtro-auditoria').value || '').toLowerCase().trim();
    if (!query) return listaAuditoriaCache;
    return listaAuditoriaCache.filter(a => {
        const fechaTexto = new Date(a.fecha).toLocaleString().toLowerCase();
        return fechaTexto.includes(query) ||
            (a.usuario_username || '').toLowerCase().includes(query) ||
            (a.accion || '').toLowerCase().includes(query) ||
            (a.entidad || '').toLowerCase().includes(query) ||
            (a.detalle || '').toLowerCase().includes(query);
    });
}

window.renderizarAuditoria = function() {
    const filtrados = obtenerAuditoriaFiltrada();
    const tbody = document.getElementById('lista-auditoria');
    tbody.innerHTML = filtrados.length ? '' : '<tr><td colspan="5" class="text-muted text-center py-4">Sin registros.</td></tr>';
    filtrados.forEach(a => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="text-nowrap">${new Date(a.fecha).toLocaleString()}</td>
            <td>${a.usuario_username || ''}</td>
            <td><span class="badge-accion ${claseBadgeAccion(a.accion)}">${a.accion || ''}</span></td>
            <td>${a.entidad || ''}${a.entidad_id ? ' #' + a.entidad_id : ''}</td>
            <td>${a.detalle || ''}</td>
        `;
        tbody.appendChild(fila);
    });
};

window.exportarAuditoriaExcel = function() {
    const datos = obtenerAuditoriaFiltrada();
    if (!datos.length) { mostrarNotificacion('No hay registros para exportar.', 'warning'); return; }

    const escaparCsv = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
    const encabezados = ['Fecha', 'Usuario', 'Acción', 'Entidad', 'Detalle'];
    const filas = datos.map(a => [
        new Date(a.fecha).toLocaleString(),
        a.usuario_username || '',
        a.accion || '',
        `${a.entidad || ''}${a.entidad_id ? ' #' + a.entidad_id : ''}`,
        a.detalle || '',
    ]);

    const contenidoCsv = [encabezados, ...filas].map(fila => fila.map(escaparCsv).join(';')).join('\r\n');
    const bom = '﻿';
    const blob = new Blob([bom + contenidoCsv], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `auditoria_tdr_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);

    mostrarNotificacion(`Se exportaron ${datos.length} registro(s) a Excel.`, 'success');
};

// =================================================================
// 9. SOPORTE PARA MODALES ANIDADOS (ej. confirmación sobre el modal de Detalle)
// =================================================================
// Bootstrap no ajusta el z-index cuando un modal se abre encima de otro ya
// visible, así que el backdrop del segundo puede terminar tapando al primero.
// Aquí se recalcula manualmente cada vez que se abre/cierra un modal.
document.addEventListener('show.bs.modal', (evento) => {
    const modalesAbiertos = document.querySelectorAll('.modal.show').length;
    const zIndexModal = 1055 + (modalesAbiertos * 20);
    evento.target.style.zIndex = zIndexModal;

    setTimeout(() => {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        const ultimoBackdrop = backdrops[backdrops.length - 1];
        if (ultimoBackdrop) ultimoBackdrop.style.zIndex = zIndexModal - 1;
    }, 0);
});

// ARRANQUE AUTOMÁTICO DE LA APLICACIÓN AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    let token = localStorage.getItem('token');
    let userRole = localStorage.getItem('user_role');
    let userName = localStorage.getItem('user_name');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        const etiquetaRol = userRole === 'director' ? 'ADMINISTRADOR' : 'TÉCNICO';
        userDisplay.innerText = `Conectado como: ${userName} (${etiquetaRol})`;
    }

    const panelKPIs = document.getElementById('panel-kpis');
    if (panelKPIs) {
        panelKPIs.style.display = (userRole === 'director') ? 'flex' : 'none';
    }

    const btnUsuarios = document.getElementById('btn-usuarios');
    if (btnUsuarios) {
        btnUsuarios.style.display = (userRole === 'director') ? 'inline-flex' : 'none';
    }

    const btnAuditoria = document.getElementById('btn-auditoria');
    if (btnAuditoria) {
        btnAuditoria.style.display = (userRole === 'director') ? 'inline-flex' : 'none';
    }

    const panelForm = document.getElementById('panel-form');
    const toggleForm = document.getElementById('toggle-form');
    if (panelForm && toggleForm && typeof bootstrap !== 'undefined') {
        bsCollapse = new bootstrap.Collapse(panelForm, { toggle: false });
        panelForm.addEventListener('show.bs.collapse', () => toggleForm.classList.add('abierto'));
        panelForm.addEventListener('hide.bs.collapse', () => toggleForm.classList.remove('abierto'));
    }

    inicializarValidaciones();
    inicializarFormulariosDetalle();
    inicializarFormularioUsuarios();
    inicializarFormularioResetPassword();
    cargarCatalogos();
    cargarTDRs();
    cargarAlertas();

    const form = document.getElementById('tdr-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            form.classList.add('was-validated');
            if (!validarFormulario()) {
                const primerInvalido = form.querySelector('.is-invalid');
                if (primerInvalido) primerInvalido.focus();
                return;
            }

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

            const esActualizacion = tdrIdEnEdicion !== null;

            if (esActualizacion) {
                const confirmado = await mostrarConfirmacion({
                    titulo: 'Actualizar TDR',
                    mensaje: '¿Está seguro de guardar los cambios realizados en este TDR?',
                    tipo: 'primary',
                    textoBoton: 'Sí, actualizar',
                    icono: '✎'
                });
                if (!confirmado) return;
            }

            const activeToken = localStorage.getItem('token');
            const url = esActualizacion ? `${API_URL}${tdrIdEnEdicion}` : API_URL;
            const metodo = esActualizacion ? 'PUT' : 'POST';
            if (!esActualizacion) datos.estado = "Borrador";

            try {
                const r = await fetch(url, {
                    method: metodo,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeToken}` },
                    body: JSON.stringify(datos)
                });
                if (r.ok) {
                    mostrarNotificacion('Operación realizada con éxito.', 'success');
                    window.resetearFormulario();
                    cargarTDRs();
                } else {
                    const err = await r.json();
                    mostrarNotificacion('Error del servidor: ' + JSON.stringify(err.detail || err), 'danger');
                }
            } catch (e) { mostrarNotificacion('Error de red al intentar guardar.', 'danger'); }
        });
    }
});