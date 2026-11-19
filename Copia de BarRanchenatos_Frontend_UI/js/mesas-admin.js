/* Administrar mesas: crear, editar, inactivar, activar y eliminar mesas. Las zonas (crear, renombrar, eliminar)
   se manejan desde la ventana de la mesa. Todo se guarda solo en la memoria del navegador (es la simulación
   del frontend); las demás pantallas leen estos datos de datos.js. */

var formMesa = document.getElementById('form-mesa');
var dlgMesa = document.getElementById('dlg-mesa');
var mesaEnEdicion = 0;
var mesaPorBorrar = 0;     // número de la mesa que espera confirmación para borrarse
var modoZona = '';         // '', 'crear' o 'renombrar' (lo que muestra el campo de la zona)

function aviso(texto) { document.getElementById('a-aviso').textContent = texto; }
function errorMesa(texto) { document.getElementById('m-error').textContent = texto; }

function hoyISO() {
  var h = new Date();
  return h.getFullYear() + '-' + ('0' + (h.getMonth() + 1)).slice(-2) + '-' + ('0' + h.getDate()).slice(-2);
}

function tieneReservaVigente(n) {
  return ESTADO.reservas.some(function (r) { return r.mesa === n && (r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA') && r.fecha >= hoyISO(); });
}

function mesasDeZona(nombre) {
  return ESTADO.mesas.filter(function (m) { return claveZona(m.ubicacion) === claveZona(nombre); });
}

// La lista de zonas guardada incluye también las que ya usaban las mesas
function sincronizarZonas() {
  var todas = zonasDelBar();
  if (JSON.stringify(todas) !== JSON.stringify(ESTADO.zonas || [])) { ESTADO.zonas = todas; guardar(); }
}

// Una mesa solo se puede eliminar si no tiene nada pendiente
function motivoNoEliminar(m) {
  if (pedidoDeMesa(m.n)) return 'la Mesa ' + m.n + ' tiene una cuenta abierta: cóbrala o trasládala antes';
  if (tieneReservaVigente(m.n)) return 'la Mesa ' + m.n + ' tiene una reservación pendiente: cámbiala o cancélala antes';
  if (m.unidas && m.unidas.length) return 'la Mesa ' + m.n + ' está unida con ' + m.unidas.join(' + ') + ': sepárala en la pantalla Mesas antes';
  return '';
}

function quitarMesa(m) {
  ESTADO.mesas.splice(ESTADO.mesas.indexOf(m), 1);
  if (mesaEnEdicion === m.n) mesaEnEdicion = 0;
}

// ---------- Tabla de mesas ----------
function pintarTabla() {
  var lista = ESTADO.mesas.slice().sort(function (x, y) { return x.n - y.n; });
  var grupos = [], mapa = {};
  lista.forEach(function (m) {
    var z = m.ubicacion || 'Sin zona', k = claveZona(z);
    if (!mapa[k]) { mapa[k] = { nombre: z, mesas: [] }; grupos.push(mapa[k]); }
    mapa[k].mesas.push(m);
  });
  var h = '';
  grupos.forEach(function (g) {
    h += '<h3 class="grupo-w">' + esc(g.nombre) + '<small>' + g.mesas.length + (g.mesas.length === 1 ? ' mesa' : ' mesas') + '</small></h3><div class="widgets">';
    g.mesas.forEach(function (m) {
      var inactiva = m.estado === 'Inactiva';
      var clase = inactiva ? 'w-apagada' : m.estado === 'Ocupada' ? 'w-activa' : m.estado === 'Reservada' ? 'w-gris' : '';
      var acc = mesaPorBorrar === m.n
        ? '<span class="z-pregunta">¿Eliminar la mesa?</span><button type="button" class="btn-fila" data-mg="si-eliminar" data-n="' + m.n + '">Sí</button><button type="button" class="btn-fila" data-mg="no-eliminar" data-n="' + m.n + '">No</button>'
        : '<button type="button" class="btn-fila" data-mg="editar" data-n="' + m.n + '">Editar</button>' +
          '<button type="button" class="btn-fila" data-mg="' + (inactiva ? 'activar' : 'inactivar') + '" data-n="' + m.n + '">' + (inactiva ? 'Activar' : 'Inactivar') + '</button>' +
          '<button type="button" class="btn-fila" data-mg="eliminar" data-n="' + m.n + '">Eliminar</button>';
      h += '<article class="widget w-adm ' + clase + (m.n === mesaEnEdicion ? ' w-editando' : '') + '">' +
        '<div class="w-cab"><b>MESA ' + m.n + '</b></div>' +
        '<div class="w-plano">' + svgMesa(m.capacidad, m.n, 'mini-mesa est-' + m.estado.toUpperCase()) + '</div>' +
        '<p class="w-valor">' + m.capacidad + (m.capacidad === 1 ? ' puesto' : ' puestos') + '</p>' +
        (m.unidas && m.unidas.length ? '<p class="w-sub">Unida con ' + m.unidas.join(' + ') + '</p>' : '') +
        '<div class="w-pie w-acciones">' + acc + '</div></article>';
    });
    h += '</div>';
  });
  document.getElementById('a-tabla').innerHTML = h || '<p class="vacio-w">Todavía no hay mesas. Crea la primera con "Nueva mesa".</p>';
}

document.getElementById('a-tabla').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-mg]');
  if (!b) return;
  var n = Number(b.dataset.n);
  var accion = b.dataset.mg;
  if (accion === 'editar') { abrirFormularioMesa(n); return; }
  if (accion === 'eliminar') {
    var motivo = motivoNoEliminar(buscarPor(ESTADO.mesas, 'n', n));
    if (motivo) { aviso('No se puede eliminar: ' + motivo + '.'); return; }
    aviso('');
    mesaPorBorrar = n;
    pintarTabla();
    return;
  }
  if (accion === 'no-eliminar') { mesaPorBorrar = 0; pintarTabla(); return; }
  if (accion === 'si-eliminar') {
    quitarMesa(buscarPor(ESTADO.mesas, 'n', n));
    mesaPorBorrar = 0;
    guardar();
    pintarTabla();
    aviso('Mesa ' + n + ' eliminada.');
    return;
  }
  if (accion === 'inactivar') {
    if (pedidoDeMesa(n)) { aviso('La mesa ' + n + ' tiene una cuenta abierta: cóbrala antes de inactivarla.'); return; }
    if (tieneReservaVigente(n)) { aviso('La mesa ' + n + ' tiene una reservación pendiente: cámbiala o cancélala antes de inactivarla.'); return; }
    buscarPor(ESTADO.mesas, 'n', n).estado = 'Inactiva';
    aviso('Mesa ' + n + ' inactiva: ya no recibe clientes.');
  }
  if (accion === 'activar') {
    buscarPor(ESTADO.mesas, 'n', n).estado = 'Disponible';
    aviso('Mesa ' + n + ' activa de nuevo.');
  }
  guardar();
  pintarTabla();
});

// ---------- Ventana de la mesa ----------
// Dibujo de la mesa con sus sillas, igual al del plano del salón (una silla por puesto)
function svgMesa(cap, n, clase) {
  var arriba = Math.ceil(cap / 2), abajo = cap - arriba;
  var ancho = Math.max(44, 14 + cap * 10), W = ancho + 28, H = 84;
  var svg = '<svg class="' + clase + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mesa ' + esc(String(n)) + ', ' + cap + ' puestos"><rect class="m" x="14" y="22" width="' + ancho + '" height="40" rx="9"/>';
  for (var i = 0; i < arriba; i++) svg += '<circle class="s" cx="' + (14 + ancho * (i + 0.5) / arriba).toFixed(1) + '" cy="11" r="6"/>';
  for (var k = 0; k < abajo; k++) svg += '<circle class="s" cx="' + (14 + ancho * (k + 0.5) / abajo).toFixed(1) + '" cy="73" r="6"/>';
  return svg + '<text class="n" x="' + (W / 2) + '" y="43">' + esc(String(n)) + '</text></svg>';
}

function dibujarPrevia() {
  var cap = Number(formMesa.m_capacidad.value);
  var caja = document.getElementById('a-previa');
  if (!(cap >= 1 && cap <= 30)) { caja.innerHTML = '<p class="previa-vacia">Escribe los puestos para ver la mesa</p>'; return; }
  caja.innerHTML = svgMesa(cap, formMesa.m_numero.value || '?', 'previa-svg');
}

// Las zonas se eligen con botones redondos (como las categorías de Pedidos); deja elegida la que se pide
function pintarChipsZona() {
  var elegida = formMesa.m_zona.value;
  document.getElementById('m-zona-chips').innerHTML = ESTADO.zonas.length
    ? ESTADO.zonas.map(function (z) {
        return '<button type="button" class="chip-zona" role="radio" aria-checked="' + (z === elegida) + '" aria-pressed="' + (z === elegida) + '" data-zona="' + esc(z) + '">' + esc(z) + '</button>';
      }).join('')
    : '<p class="sin-zonas">Todavía no hay zonas. Crea la primera con "+ Crear zona".</p>';
}

function pintarZonas(elegida) {
  var zonas = ESTADO.zonas;
  var buscada = zonas.filter(function (z) { return claveZona(z) === claveZona(elegida); })[0];
  formMesa.m_zona.value = buscada || (zonas.length ? zonas[0] : '');
  pintarChipsZona();
  document.getElementById('mz-renombrar').disabled = !zonas.length;
  document.getElementById('mz-eliminar').disabled = !zonas.length;
}

document.getElementById('m-zona-chips').addEventListener('click', function (e) {
  var b = e.target.closest('.chip-zona');
  if (!b) return;
  formMesa.m_zona.value = b.dataset.zona;
  pintarChipsZona();
  document.getElementById('mz-pregunta').hidden = true; // la pregunta de eliminar era de otra zona
  errorMesa('');
  formMesa.dispatchEvent(new Event('input'));
});

function cerrarPanelZona() {
  modoZona = '';
  document.getElementById('mz-panel').hidden = true;
  document.getElementById('mz-pregunta').hidden = true;
  document.getElementById('mz_nombre').value = '';
}

function abrirFormularioMesa(n) {
  mesaEnEdicion = n;
  var m = n ? buscarPor(ESTADO.mesas, 'n', n) : null;
  var siguiente = 0;
  ESTADO.mesas.forEach(function (x) { siguiente = Math.max(siguiente, x.n); });
  document.getElementById('m-titulo-texto').textContent = m ? 'Editar mesa ' + m.n : 'Nueva mesa';
  formMesa.m_numero.value = m ? m.n : siguiente + 1;
  formMesa.m_numero.disabled = !!m;
  formMesa.m_capacidad.value = m ? m.capacidad : 4;
  var unida = !!(m && m.unidas && m.unidas.length);
  formMesa.m_capacidad.disabled = unida; // sus puestos son la suma de las mesas unidas: se cambian separándolas en la pantalla Mesas
  pintarZonas(m ? m.ubicacion : '');
  cerrarPanelZona();
  document.getElementById('m-guardar').textContent = m ? 'Guardar cambios' : 'Guardar mesa';
  errorMesa(unida ? 'Esta mesa está unida con ' + (m.unidas.length === 1 ? 'la mesa ' : 'las mesas ') + m.unidas.join(' + ') + '. Sepárala en la pantalla Mesas para cambiar sus puestos.' : '');
  aviso('');
  formMesa.dispatchEvent(new Event('input')); // la validación general de la app revisa los valores nuevos
  pintarTabla();
  dibujarPrevia();
  if (dlgMesa.showModal) { if (!dlgMesa.open) dlgMesa.showModal(); } else dlgMesa.setAttribute('open', '');
}

function cerrarFormularioMesa() {
  if (dlgMesa.open) { if (dlgMesa.close) dlgMesa.close(); else dlgMesa.removeAttribute('open'); }
  mesaEnEdicion = 0;
  pintarTabla();
}
dlgMesa.addEventListener('close', function () { mesaEnEdicion = 0; pintarTabla(); });
document.getElementById('m-cerrar').addEventListener('click', cerrarFormularioMesa);
document.getElementById('m-cancelar').addEventListener('click', cerrarFormularioMesa);
dlgMesa.addEventListener('click', function (e) { if (e.target === dlgMesa) cerrarFormularioMesa(); }); // toque en el fondo oscuro
formMesa.addEventListener('input', dibujarPrevia);
document.getElementById('a-nueva').addEventListener('click', function () { abrirFormularioMesa(0); });

// ---------- Zonas: crear, renombrar y eliminar desde la ventana de la mesa ----------
function mostrarPanelZona(modo) {
  modoZona = modo;
  document.getElementById('mz-pregunta').hidden = true;
  document.getElementById('mz-panel').hidden = false;
  document.getElementById('mz-aceptar').textContent = modo === 'crear' ? 'Crear' : 'Guardar nombre';
  document.getElementById('mz_nombre').value = modo === 'renombrar' ? formMesa.m_zona.value : '';
  errorMesa('');
  document.getElementById('mz_nombre').focus();
}

document.getElementById('mz-crear').addEventListener('click', function () { mostrarPanelZona('crear'); });
document.getElementById('mz-renombrar').addEventListener('click', function () { if (formMesa.m_zona.value) mostrarPanelZona('renombrar'); });
document.getElementById('mz-cancelar').addEventListener('click', function () { cerrarPanelZona(); errorMesa(''); });

function aceptarZona() {
  var campo = document.getElementById('mz_nombre');
  var nombre = campo.value.trim();
  if (!nombre) { errorMesa('Escribe el nombre de la zona.'); campo.focus(); return; }
  nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  var actual = formMesa.m_zona.value;
  var repetida = ESTADO.zonas.some(function (z) { return claveZona(z) === claveZona(nombre) && !(modoZona === 'renombrar' && z === actual); });
  if (repetida) { errorMesa('Ya existe la zona "' + nombre + '".'); campo.focus(); return; }
  if (modoZona === 'renombrar') {
    var i = ESTADO.zonas.indexOf(actual);
    mesasDeZona(actual).forEach(function (m) { m.ubicacion = nombre; }); // las mesas siguen en la zona con su nuevo nombre
    ESTADO.zonas[i] = nombre;
    aviso('Zona renombrada: ' + actual + ' → ' + nombre + '.');
  } else {
    ESTADO.zonas.push(nombre);
    aviso('Zona ' + nombre + ' creada.');
  }
  guardar();
  errorMesa('');
  cerrarPanelZona();
  pintarZonas(nombre);
  pintarTabla();
  formMesa.dispatchEvent(new Event('input'));
}
document.getElementById('mz-aceptar').addEventListener('click', aceptarZona);
document.getElementById('mz_nombre').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); aceptarZona(); } });

document.getElementById('mz-eliminar').addEventListener('click', function () {
  var zona = formMesa.m_zona.value;
  if (!zona) return;
  var mesas = mesasDeZona(zona);
  var bloqueada = mesas.map(motivoNoEliminar).filter(function (t) { return t; })[0];
  if (bloqueada) { errorMesa('No se puede eliminar "' + zona + '": ' + bloqueada + '.'); return; }
  errorMesa('');
  document.getElementById('mz-panel').hidden = true;
  modoZona = '';
  document.getElementById('mz-pregunta-texto').textContent = mesas.length
    ? '¿Eliminar la zona ' + zona + ' junto con ' + (mesas.length === 1 ? 'su mesa' : 'sus ' + mesas.length + ' mesas') + '?'
    : '¿Eliminar la zona ' + zona + '?';
  document.getElementById('mz-pregunta').hidden = false;
});
document.getElementById('mz-no').addEventListener('click', function () { document.getElementById('mz-pregunta').hidden = true; });
document.getElementById('mz-si').addEventListener('click', function () {
  var zona = formMesa.m_zona.value;
  var mesas = mesasDeZona(zona);
  var editada = mesas.some(function (m) { return m.n === mesaEnEdicion; });
  mesas.forEach(quitarMesa);
  ESTADO.zonas.splice(ESTADO.zonas.indexOf(zona), 1);
  guardar();
  document.getElementById('mz-pregunta').hidden = true;
  aviso('Zona ' + zona + ' eliminada' + (mesas.length ? ' junto con ' + (mesas.length === 1 ? 'su mesa' : 'sus ' + mesas.length + ' mesas') : '') + '.');
  if (editada) { cerrarFormularioMesa(); return; } // la mesa que se editaba ya no existe
  pintarZonas('');
  pintarTabla();
  formMesa.dispatchEvent(new Event('input'));
});

// ---------- Guardar la mesa ----------
formMesa.addEventListener('submit', function (e) {
  e.preventDefault();
  var numero = Number(formMesa.m_numero.value);
  var capacidad = Number(formMesa.m_capacidad.value);
  var zona = formMesa.m_zona.value;
  if (!mesaEnEdicion) {
    if (!(numero >= 1) || numero !== Math.floor(numero)) { errorMesa('El número de la mesa debe ser un entero desde 1.'); formMesa.m_numero.focus(); return; }
    if (buscarPor(ESTADO.mesas, 'n', numero)) { errorMesa('Ya existe la mesa ' + numero + '. Escribe otro número.'); formMesa.m_numero.focus(); return; }
  }
  if (!(capacidad >= 1 && capacidad <= 30) || capacidad !== Math.floor(capacidad)) { errorMesa('Los puestos deben ser un entero entre 1 y 30.'); formMesa.m_capacidad.focus(); return; }
  if (!zona) { errorMesa('Elige la zona de la mesa o crea una con "+ Crear zona".'); return; }
  var texto;
  if (mesaEnEdicion) {
    var m = buscarPor(ESTADO.mesas, 'n', mesaEnEdicion);
    m.capacidad = capacidad;
    m.ubicacion = zona;
    texto = 'Mesa ' + m.n + ' actualizada.';
  } else {
    ESTADO.mesas.push({ n: numero, capacidad: capacidad, ubicacion: zona, estado: 'Disponible' });
    ESTADO.mesas.sort(function (a, b) { return a.n - b.n; });
    texto = 'Mesa ' + numero + ' creada.';
  }
  guardar();
  cerrarFormularioMesa();
  aviso(texto);
});

sincronizarZonas();
pintarTabla();
