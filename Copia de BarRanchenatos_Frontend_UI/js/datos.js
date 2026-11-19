/* Bar Ranchenatos - datos compartidos entre las páginas.
   Todo se guarda en el navegador (localStorage), no en una base de datos: sirve para probar el flujo
   pedido -> venta -> caja -> facturación -> inventario -> reportes sin servidor.
   Los nombres siguen las tablas del diseño de la base (pedido, venta, insumo...), pero no se toca la base. */

var CLAVE = 'rn_estado_v2';
var ESTADO;

// Datos de ejemplo: los mismos de la base de datos del proyecto
function estadoInicial() {
  return {
    usuario: 'Carlos Ranchenatos',
    zonas: ['Salón', 'Tarima', 'Barra'], // zonas del bar; las mesas se asignan a una
    mesasUnidas: [], // mesas que se juntaron a otra (se guardan aquí para poder separarlas)
    mesas: [
      { n: 1, capacidad: 4, ubicacion: 'Salón', estado: 'Ocupada' },
      { n: 2, capacidad: 4, ubicacion: 'Salón', estado: 'Disponible' },
      { n: 3, capacidad: 6, ubicacion: 'Tarima', estado: 'Disponible' },
      { n: 4, capacidad: 8, ubicacion: 'Tarima', estado: 'Reservada' },
      { n: 5, capacidad: 2, ubicacion: 'Barra', estado: 'Disponible' }
    ],
    // Carta real del bar (74 productos). Solo los que ya tienen insumo en el inventario descuentan existencias; el resto no controla inventario.
    productos: [
      { nombre: 'Aguardiente Nariño (botella)', cat: 'Aguardiente', precio: 120000, iva: 8, receta: [['Aguardiente Nariño 750 ml', 1]] },
      { nombre: 'Aguardiente Nariño (media)', cat: 'Aguardiente', precio: 65000, iva: 8, receta: [['Aguardiente Nariño 750 ml', 0.5]] },
      { nombre: 'Aguardiente Antioqueño (botella)', cat: 'Aguardiente', precio: 120000, iva: 8, receta: [] },
      { nombre: 'Aguardiente Antioqueño (media)', cat: 'Aguardiente', precio: 65000, iva: 8, receta: [] },
      { nombre: 'Aguardiente Blanco del Valle (botella)', cat: 'Aguardiente', precio: 120000, iva: 8, receta: [] },
      { nombre: 'Aguardiente Blanco del Valle (media)', cat: 'Aguardiente', precio: 65000, iva: 8, receta: [] },
      { nombre: 'Aguardiente Amarillo (botella)', cat: 'Aguardiente', precio: 120000, iva: 8, receta: [] },
      { nombre: 'Aguardiente Amarillo (media)', cat: 'Aguardiente', precio: 65000, iva: 8, receta: [] },
      { nombre: 'Aguardiente Rosado (botella)', cat: 'Aguardiente', precio: 120000, iva: 8, receta: [] },
      { nombre: 'Aguardiente Rosado (media)', cat: 'Aguardiente', precio: 65000, iva: 8, receta: [] },
      { nombre: 'Ron Viejo de Caldas (botella)', cat: 'Ron', precio: 120000, iva: 8, receta: [['Ron Viejo de Caldas 750 ml', 1]] },
      { nombre: 'Ron Viejo de Caldas (media)', cat: 'Ron', precio: 65000, iva: 8, receta: [['Ron Viejo de Caldas 750 ml', 0.5]] },
      { nombre: 'Ron 8 años (botella)', cat: 'Ron', precio: 180000, iva: 8, receta: [] },
      { nombre: 'Ron Roble Blanco (botella)', cat: 'Ron', precio: 100000, iva: 8, receta: [] },
      { nombre: 'Bacardi Limón (botella)', cat: 'Ron', precio: 130000, iva: 8, receta: [] },
      { nombre: 'Bacardi Limón (media)', cat: 'Ron', precio: 80000, iva: 8, receta: [] },
      { nombre: 'Bacardi Carta Blanca (botella)', cat: 'Ron', precio: 130000, iva: 8, receta: [] },
      { nombre: 'Brandy Domecq (botella)', cat: 'Brandy', precio: 120000, iva: 8, receta: [] },
      { nombre: 'Brandy Domecq (media)', cat: 'Brandy', precio: 65000, iva: 8, receta: [] },
      { nombre: 'Don Julio Reposado (botella)', cat: 'Tequila', precio: 570000, iva: 8, receta: [] },
      { nombre: 'Don Julio Blanco (botella)', cat: 'Tequila', precio: 460000, iva: 8, receta: [] },
      { nombre: '1800 Silver (botella)', cat: 'Tequila', precio: 350000, iva: 8, receta: [] },
      { nombre: 'Jimador (botella)', cat: 'Tequila', precio: 230000, iva: 8, receta: [] },
      { nombre: 'Jimador (media)', cat: 'Tequila', precio: 130000, iva: 8, receta: [] },
      { nombre: 'Tres Caballos (litro)', cat: 'Tequila', precio: 210000, iva: 8, receta: [] },
      { nombre: 'Tres Caballos (botella)', cat: 'Tequila', precio: 170000, iva: 8, receta: [] },
      { nombre: 'Tres Caballos (media)', cat: 'Tequila', precio: 100000, iva: 8, receta: [] },
      { nombre: 'Olmeca Reposado (botella)', cat: 'Tequila', precio: 170000, iva: 8, receta: [] },
      { nombre: 'Olmeca Reposado (media)', cat: 'Tequila', precio: 100000, iva: 8, receta: [] },
      { nombre: 'Olmeca Blanco (botella)', cat: 'Tequila', precio: 170000, iva: 8, receta: [] },
      { nombre: 'Olmeca Blanco (media)', cat: 'Tequila', precio: 100000, iva: 8, receta: [] },
      { nombre: 'José Cuervo Reposado (botella)', cat: 'Tequila', precio: 170000, iva: 8, receta: [] },
      { nombre: 'José Cuervo Reposado (media)', cat: 'Tequila', precio: 100000, iva: 8, receta: [] },
      { nombre: "Buchanan's Master (botella)", cat: 'Whisky', precio: 370000, iva: 8, receta: [] },
      { nombre: "Buchanan's Deluxe (botella)", cat: 'Whisky', precio: 300000, iva: 8, receta: [] },
      { nombre: "Buchanan's Deluxe (media)", cat: 'Whisky', precio: 190000, iva: 8, receta: [] },
      { nombre: 'Old Parr (botella)', cat: 'Whisky', precio: 320000, iva: 8, receta: [] },
      { nombre: 'Old Parr (media)', cat: 'Whisky', precio: 210000, iva: 8, receta: [] },
      { nombre: 'Chivas Regal (botella)', cat: 'Whisky', precio: 280000, iva: 8, receta: [] },
      { nombre: 'Something Special (botella)', cat: 'Whisky', precio: 140000, iva: 8, receta: [] },
      { nombre: "Jack Daniel's Honey (botella)", cat: 'Whisky', precio: 250000, iva: 8, receta: [] },
      { nombre: 'Red Label (botella)', cat: 'Whisky', precio: 150000, iva: 8, receta: [] },
      { nombre: 'Red Label (media)', cat: 'Whisky', precio: 100000, iva: 8, receta: [] },
      { nombre: 'Ballantines (botella)', cat: 'Whisky', precio: 140000, iva: 8, receta: [] },
      { nombre: 'Black and White (botella)', cat: 'Whisky', precio: 130000, iva: 8, receta: [] },
      { nombre: 'Black and White (media)', cat: 'Whisky', precio: 70000, iva: 8, receta: [] },
      { nombre: 'Baileys (botella)', cat: 'Whisky', precio: 170000, iva: 8, receta: [] },
      { nombre: 'Vodka Absolut (botella)', cat: 'Vodka', precio: 170000, iva: 8, receta: [] },
      { nombre: 'Smirnoff Lulo (botella)', cat: 'Vodka', precio: 110000, iva: 8, receta: [] },
      { nombre: 'Smirnoff Tamarindo (botella)', cat: 'Vodka', precio: 110000, iva: 8, receta: [] },
      { nombre: 'Smirnoff Red (botella)', cat: 'Vodka', precio: 190000, iva: 8, receta: [] },
      { nombre: 'Michelada Smirnoff', cat: 'Micheladas', precio: 20000, iva: 8, receta: [] },
      { nombre: 'Michelada Corona', cat: 'Micheladas', precio: 13000, iva: 8, receta: [] },
      { nombre: 'Michelada Club Colombia', cat: 'Micheladas', precio: 9000, iva: 8, receta: [['Cerveza Club Colombia', 1], ['Limón', 1], ['Sal', 10]] },
      { nombre: 'Michelada Budweiser', cat: 'Micheladas', precio: 9000, iva: 8, receta: [] },
      { nombre: 'Michelada Águila', cat: 'Micheladas', precio: 9000, iva: 8, receta: [] },
      { nombre: "Michelada Redd's", cat: 'Micheladas', precio: 9000, iva: 8, receta: [] },
      { nombre: 'Michelada Poker', cat: 'Micheladas', precio: 9000, iva: 8, receta: [] },
      { nombre: 'Michelada Soda', cat: 'Micheladas', precio: 9000, iva: 8, receta: [] },
      { nombre: 'Cerveza Corona', cat: 'Cerveza', precio: 10000, iva: 8, receta: [] },
      { nombre: 'Cerveza Club Colombia', cat: 'Cerveza', precio: 6000, iva: 8, receta: [['Cerveza Club Colombia', 1]] },
      { nombre: 'Cerveza Budweiser', cat: 'Cerveza', precio: 6000, iva: 8, receta: [] },
      { nombre: 'Cerveza Águila', cat: 'Cerveza', precio: 6000, iva: 8, receta: [] },
      { nombre: "Cerveza Redd's", cat: 'Cerveza', precio: 6000, iva: 8, receta: [] },
      { nombre: 'Cerveza Poker', cat: 'Cerveza', precio: 6000, iva: 8, receta: [] },
      { nombre: 'Cerveza Smirnoff', cat: 'Cerveza', precio: 17000, iva: 8, receta: [] },
      { nombre: 'Monster', cat: 'Sin alcohol', precio: 16000, iva: 0, receta: [] },
      { nombre: 'Red Bull', cat: 'Sin alcohol', precio: 16000, iva: 0, receta: [] },
      { nombre: 'Electrolit', cat: 'Sin alcohol', precio: 16000, iva: 0, receta: [] },
      { nombre: 'Gatorade', cat: 'Sin alcohol', precio: 6000, iva: 0, receta: [] },
      { nombre: 'Coca-Cola', cat: 'Sin alcohol', precio: 6000, iva: 0, receta: [['Gaseosa 400 ml', 1]] },
      { nombre: 'Soda', cat: 'Sin alcohol', precio: 6000, iva: 0, receta: [] },
      { nombre: 'Agua', cat: 'Sin alcohol', precio: 3000, iva: 0, receta: [] },
      { nombre: 'Bonfiest Lua', cat: 'Sin alcohol', precio: 6000, iva: 0, receta: [] }
    ],
    insumos: [
      { nombre: 'Aguardiente Nariño 750 ml', unidad: 'Botella', existencia: 24, minimo: 6, costo: 52000 },
      { nombre: 'Ron Viejo de Caldas 750 ml', unidad: 'Botella', existencia: 12, minimo: 4, costo: 60000 },
      { nombre: 'Cerveza Club Colombia', unidad: 'Unidad', existencia: 120, minimo: 48, costo: 3200 },
      { nombre: 'Limón', unidad: 'Unidad', existencia: 18, minimo: 20, costo: 300 },
      { nombre: 'Sal', unidad: 'g', existencia: 2000, minimo: 500, costo: 0.01 },
      { nombre: 'Gaseosa 400 ml', unidad: 'Unidad', existencia: 48, minimo: 12, costo: 1800 }
    ],
    movimientos: [
      { fecha: '2026-10-13 20:10', insumo: 'Aguardiente Nariño 750 ml', quien: 'Paola Rosero', linea: 'Línea 1', tipo: 'Salida', cant: 1, obs: 'Despacho pedido 1' },
      { fecha: '2026-10-12 16:00', insumo: 'Cerveza Club Colombia', quien: 'Laura Martínez', linea: '—', tipo: 'Entrada', cant: 48, obs: 'Compra a distribuidor' },
      { fecha: '2026-10-13 17:30', insumo: 'Limón', quien: 'Laura Martínez', linea: '—', tipo: 'Merma', cant: 3, obs: 'Limones en mal estado' }
    ],
    alertas: [{ insumo: 'Limón', existencia: 18, fecha: '2026-10-13 17:30', estado: 'Activa', quien: '—', atencion: '—' }],
    pedidos: [
      { n: 1, mesa: 3, mesero: 'Paola Rosero', cliente: 'María Benavides', canal: 'Mesero', fecha: '2026-10-13 20:05', estado: 'Facturado', venta: 1,
        lineas: [{ producto: 'Aguardiente Nariño botella 750 ml', cant: 1, precio: 85000, iva: 8, esp: '', despacho: 'Despachado' },
                 { producto: 'Michelada Club Colombia', cant: 2, precio: 9000, iva: 8, esp: 'Con sal y limón extra', despacho: 'Despachado' }] },
      { n: 2, mesa: 1, mesero: '—', cliente: 'Jorge Pantoja', canal: 'App', fecha: '2026-10-13 20:20', estado: 'Abierto', venta: 0,
        lineas: [{ producto: 'Cerveza Club Colombia', cant: 3, precio: 6000, iva: 8, esp: '', despacho: 'Pendiente' }] }
    ],
    metodos: [
      { nombre: 'Efectivo', referencia: false },
      { nombre: 'Transferencia PSE', referencia: true },
      { nombre: 'Tarjeta débito/crédito', referencia: true },
      { nombre: 'Nequi', referencia: true },
      { nombre: 'Daviplata', referencia: true }
    ],
    promociones: [
      { nombre: '10% en botellas Noche Ranchera', tipo: 'PORCENTAJE', pct: 10, aplicaA: 'CATEGORIAS', categorias: ['Aguardiente', 'Ron', 'Whisky', 'Tequila', 'Vodka', 'Brandy'], evento: 'Noche Ranchera', soloEvento: false, desde: '2026-10-12', hasta: '2026-10-18', dias: [], horaDesde: '', horaHasta: '', segmento: 'TODOS', minCompra: 0, tope: 0, condiciones: '', activa: true },
      { nombre: '2x1 en micheladas los jueves', tipo: 'NXM', lleva: 2, paga: 1, aplicaA: 'CATEGORIAS', categorias: ['Micheladas'], evento: '', soloEvento: false, desde: '2026-10-01', hasta: '2026-12-31', dias: [4], horaDesde: '17:00', horaHasta: '22:00', segmento: 'TODOS', minCompra: 0, tope: 0, condiciones: 'Jueves de 5 a 10 de la noche', activa: true }
    ],
    eventos: [
      { nombre: 'Noche Ranchera', artista: 'Mariachi Sol de Pasto', inicio: '2026-10-16 21:00', fin: '2026-10-17 01:00', descripcion: 'Serenata en vivo' },
      { nombre: 'Viernes Vallenato', artista: 'Los del Galeras', inicio: '2026-10-22 21:00', fin: '2026-10-23 02:00', descripcion: 'Conjunto vallenato en vivo' }
    ],
    envios: [
      { cliente: 'María Benavides', tipo: 'Promoción', promocion: '10% en botellas', evento: 'Noche Ranchera', reserva: '', canal: 'WhatsApp', fecha: '2026-10-12 12:00', estado: 'Enviado' },
      { cliente: 'María Benavides', tipo: 'Recordatorio', promocion: '', evento: 'Noche Ranchera', reserva: 'Reserva 1', canal: 'Correo', fecha: '2026-10-15 09:00', estado: 'Pendiente' }
    ],
    roles: [
      { nombre: 'Administrador', cobra: true, areas: ['admin', 'cajera', 'mesas', 'ventas', 'bar', 'cocina'], solicitables: [], descripcion: 'Acceso total: inventario, usuarios, reportes, balance y precios', modulos: ['pedidos', 'mesas', 'reservas', 'despacho', 'caja', 'productos', 'inventario', 'eventos', 'clientes', 'reportes', 'usuarios'] },
      { nombre: 'Cajero', cobra: true, areas: ['cajera'], solicitables: ['mesas'], descripcion: 'Facturación, pagos y cierre de caja', modulos: ['pedidos', 'mesas', 'caja', 'clientes'] },
      { nombre: 'Mesero', cobra: false, areas: ['mesas'], solicitables: ['cajera'], descripcion: 'Registro de pedidos, clientes y reservas', modulos: ['pedidos', 'mesas', 'reservas', 'clientes'] },
      { nombre: 'Cocinero', cobra: false, areas: ['cocina'], solicitables: ['bar'], descripcion: 'Prepara y despacha la comida', modulos: ['despacho', 'productos', 'inventario'] },
      { nombre: 'Bartender', cobra: false, areas: ['bar'], solicitables: ['cocina'], descripcion: 'Prepara y despacha las bebidas', modulos: ['despacho', 'productos', 'inventario'] },
      { nombre: 'Encargado de ventas', cobra: false, areas: ['ventas'], solicitables: ['mesas'], descripcion: 'Reservaciones, eventos, promociones y clientes', modulos: ['reservas', 'eventos', 'clientes', 'reportes'] }
    ],
    avisos: [],
    solicitudesArea: [],
    empleados: [
      { nombre: 'Carlos', apellidos: 'Ranchenatos', usuario: 'admin', rol: 'Administrador', tipoDoc: 'CC', numDoc: '1085000001', telefono: '3001112233', correo: 'dueno@ranchenatos.co', ingreso: '2020-01-10', activo: true, notas: '' },
      { nombre: 'Laura', apellidos: 'Martínez', usuario: 'lmartinez', rol: 'Cajero', tipoDoc: 'CC', numDoc: '1085000002', telefono: '3002223344', correo: 'admin@ranchenatos.co', ingreso: '2022-03-01', activo: true, notas: '' },
      { nombre: 'Paola', apellidos: 'Rosero', usuario: 'prosero', rol: 'Mesero', tipoDoc: 'CC', numDoc: '1085000003', telefono: '3003334455', correo: '', ingreso: '2024-06-15', activo: true, notas: '' },
      { nombre: 'Diana', apellidos: 'Guerrero', usuario: 'dguerrero', rol: 'Mesero', tipoDoc: 'CC', numDoc: '1085000004', telefono: '3004445566', correo: '', ingreso: '2025-02-01', activo: true, notas: '' },
      { nombre: 'Juan', apellidos: 'Díaz', usuario: 'jdiaz', rol: 'Mesero', tipoDoc: 'CC', numDoc: '1085000005', telefono: '3005556677', correo: '', ingreso: '2025-05-10', activo: true, notas: '' },
      { nombre: 'Carlos', apellidos: 'Aguirre', usuario: 'caguirre', rol: 'Cocinero', tipoDoc: 'CC', numDoc: '1085000006', telefono: '3006667788', correo: '', ingreso: '2025-06-20', activo: true, notas: '' }
    ],
    clientes: [
      { nombre: 'María', apellidos: 'Benavides', tipoDoc: 'CC', numDoc: '27000111', telefono: '3105556677', correo: 'maria.b@correo.com', nacimiento: '1990-05-12', registro: '2026-09-01 20:10', autoriza: true },
      { nombre: 'Jorge', apellidos: 'Pantoja', tipoDoc: '', numDoc: '', telefono: '3116667788', correo: '', nacimiento: '', registro: '2026-09-20 18:00', autoriza: false },
      { nombre: 'Eventos Nariño S.A.S.', apellidos: '', tipoDoc: 'NIT', numDoc: '900123456', telefono: '3127778899', correo: 'eventos@narino.co', nacimiento: '', registro: '2026-09-10 10:00', autoriza: true }
    ],
    ventas: [
      { n: 1, turno: 2, pedido: 1, mesa: 3, cliente: 'María Benavides', metodo: 'Transferencia PSE', efectivo: false, ref: 'PSE-000981', promo: '10% en botellas Noche Ranchera',
        subtotal: 103000, descuento: 10300, impuesto: 7416, propina: 0, total: 100116, fecha: '2026-10-13 19:40', cajero: 'Laura Martínez', factura: 'Aceptada', comprobante: 'FACTURA', documento: 'RAN1' }
    ],
    // Todo documento fiscal: factura, documento equivalente POS, nota crédito o débito. Cada envío al proveedor queda en sus intentos.
    documentos: [
      { id: 'RAN1', tipo: 'FACTURA', prefijo: 'RAN', consecutivo: 1, venta: 1, ref: '', fecha: '2026-10-13 19:40', estado: 'Aceptado', cufe: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        ambiente: '2', adquirente: { tipoDoc: '13', numero: '27000111', nombre: 'María Benavides', correo: 'maria.b@correo.com' }, total: 100116, motivo: '',
        intentos: [{ n: 1, fecha: '2026-10-13 19:41', estado: 'Error', detalle: 'Simulación local: intento de ejemplo' }, { n: 2, fecha: '2026-10-13 19:43', estado: 'Aceptado', detalle: 'Aceptado en la simulación local; no enviado a la DIAN' }] }
    ],
    // Configuración visual de facturación demostrativa; no guarda secretos ni conecta con un proveedor.
    facturacion: {
      ambiente: '2', // 2 habilitación (pruebas) · 1 producción
      proveedor: 'simulado',
      api: { base: '',
        rutas: { enviar: 'POST /invoice', nota: 'POST /credit-note', estado: 'GET /documents/{id}', adquirente: 'GET /acquirer/{tipoDoc}/{numero}', probar: 'GET /' },
        respuesta: { id: 'uuid', cufe: 'cufe', valido: 'is_valid', mensaje: 'dian_message' } },
      emisor: { nit: '', dv: '', docTipo: 'CC', razonSocial: 'Bar Ranchenatos', nombreComercial: 'Ranchenatos', tituloComprobante: 'Comprobante de pago', leyenda: 'Régimen Simplificado - No Responsable de Impuesto al Consumo. No obligado a facturar.', tipoPersona: '2', regimen: 'No responsable de IVA', responsabilidades: 'R-99-PN', ciiu: '5630',
        direccion: '', municipio: 'Pasto', departamento: 'Nariño', codigoMunicipio: '52001', telefono: '', correo: '' },
      // Impuestos que cobra la empresa: el impoconsumo (8 %) es el de los restaurantes y bares; el IVA (19 %) solo aplica a franquicias o catering
      impuestos: [{ clave: 'INC8', codigo: '04', nombre: 'Impoconsumo', tarifa: 8, activo: true }, { clave: 'IVA19', codigo: '01', nombre: 'IVA', tarifa: 19, activo: false }, { clave: 'IVA5', codigo: '01', nombre: 'IVA', tarifa: 5, activo: false }],
      resoluciones: [
        { tipo: 'FACTURA', prefijo: 'RAN', desde: 1, hasta: 5000, actual: 2, resolucion: '', fechaResolucion: '', vigenciaDesde: '', vigenciaHasta: '' },
        { tipo: 'POS', prefijo: 'POS', desde: 1, hasta: 5000, actual: 1, resolucion: '', fechaResolucion: '', vigenciaDesde: '', vigenciaHasta: '' },
        { tipo: 'NC', prefijo: 'NC', desde: 1, hasta: 1000, actual: 1, resolucion: '', fechaResolucion: '', vigenciaDesde: '', vigenciaHasta: '' }
      ],
      mediosPago: { 'Efectivo': '10', 'Transferencia PSE': '47', 'Tarjeta débito/crédito': '48', 'Nequi': 'ZZZ', 'Daviplata': 'ZZZ' }
    },
    // Dinero que entra o sale del cajón fuera de las ventas (gastos, retiros, ingresos)
    movimientosCaja: [],
    reservas: [
      { n: 1, fecha: '2026-10-13', hora: '20:00', mesa: 1, personas: 3, cliente: 'Jorge Pantoja', tipo: 'MESA', evento: '', empleado: '', comprobante: '', obs: '', estado: 'PENDIENTE' },
      { n: 2, fecha: '2026-10-16', hora: '21:00', mesa: 4, personas: 5, cliente: 'María Benavides', tipo: 'EVENTO', evento: 'Noche Ranchera', empleado: 'Paola Rosero', comprobante: '', obs: 'Cumpleaños', estado: 'CONFIRMADA' }
    ],
    turnos: [
      { id: 1, cajero: 'Laura Martínez', abre: '2026-10-12 18:00', cierra: '2026-10-13 00:05', base: 200000, sistema: 412300, contado: 412300, obs: 'Sin novedades' },
      { id: 2, cajero: 'Laura Martínez', abre: '2026-10-13 18:00', cierra: '', base: 200000, sistema: 0, contado: 0, obs: '' }
    ]
  };
}

// Recetas de ejemplo para toda la carta, con sus insumos y existencias (todo editable en Productos y Inventario).
// Botella = 1 botella del insumo, media = media botella; cerveza y gaseosa = 1 unidad; michelada = su cerveza + 1 limón + 10 g de sal.
function recetasDeEjemplo(estado) {
  if (!estado.recetasCargadas) { insumosYRecetasDeEjemplo(estado); estado.recetasCargadas = true; }
  // Preparado = se hace con varios insumos y lleva receta (micheladas, cócteles); reventa = se vende tal cual (botellas, cervezas, gaseosas) y solo descuenta inventario
  estado.productos.forEach(function (p) {
    if (p.tipo === undefined) {
      p.tipo = /^Michelada /.test(p.nombre) ? 'PREPARADO' : 'REVENTA';
      if (p.tipo === 'REVENTA' && p.preparacion === preparacionDeEjemplo(p)) p.preparacion = ''; // las indicaciones de ejemplo no aplican a lo que no se prepara
    }
    if (p.preparacion === undefined) p.preparacion = p.tipo === 'PREPARADO' ? preparacionDeEjemplo(p) : '';
  });
}

// Indicaciones de preparación de ejemplo: un paso por línea (se editan en Productos, Editar receta)
function preparacionDeEjemplo(p) {
  if (/^Michelada /.test(p.nombre)) return 'Escarcha el borde del vaso con limón y sal.\nAgrega hielo al vaso.\nExprime el limón dentro del vaso y agrega sal al gusto.\nSirve la cerveza bien fría.\nEntrega de inmediato.';
  if (/\((botella|media|litro)\)$/.test(p.nombre)) return 'Entrega la botella bien fría o con hielo.\nAcompaña con vasos, hielo y limón.\nAbre la botella frente al cliente.';
  if (/^Cerveza /.test(p.nombre)) return 'Sirve bien fría, en su botella o en vaso con hielo si el cliente lo pide.';
  if (p.cat === 'Sin alcohol') return 'Sirve frío, con vaso y hielo si el cliente lo pide.';
  return '';
}

function insumosYRecetasDeEjemplo(estado) {
  var por = {};
  estado.insumos.forEach(function (i) { por[i.nombre] = i; });
  var precioDe = function (nombre) { var p = estado.productos.filter(function (x) { return x.nombre === nombre; })[0]; return p ? p.precio : 0; };
  var insumo = function (nombre, unidad, existencia, minimo, costo) {
    if (!por[nombre]) { por[nombre] = { nombre: nombre, unidad: unidad, existencia: existencia, minimo: minimo, costo: costo }; estado.insumos.push(por[nombre]); }
    return nombre;
  };
  var redondear = function (n) { return Math.round(n / 100) * 100; };
  estado.productos.forEach(function (p) {
    if (p.receta.length) return;
    var m = /^(.*) \((botella|media|litro)\)$/.exec(p.nombre);
    if (m) {
      var litro = m[2] === 'litro';
      var precioBotella = litro ? p.precio : (precioDe(m[1] + ' (botella)') || p.precio * 1.8);
      p.receta = [[insumo(m[1] + (litro ? ' 1 L' : ' 750 ml'), 'Botella', 12, 4, redondear(precioBotella * 0.6)), m[2] === 'media' ? 0.5 : 1]];
    } else if (/^Cerveza /.test(p.nombre)) {
      p.receta = [[insumo(p.nombre, 'Unidad', 96, 24, redondear(p.precio * 0.55)), 1]];
    } else if (/^Michelada /.test(p.nombre)) {
      var marca = p.nombre.replace('Michelada ', '');
      var base = marca === 'Soda' ? 'Soda' : 'Cerveza ' + marca;
      p.receta = [[insumo(base, 'Unidad', 96, 24, redondear(precioDe(base) * 0.55 || 3200)), 1], [insumo('Limón', 'Unidad', 60, 20, 300), 1], [insumo('Sal', 'g', 2000, 500, 0.01), 10]];
    } else if (p.cat === 'Sin alcohol') {
      var nombre = p.nombre === 'Coca-Cola' ? 'Gaseosa 400 ml' : p.nombre;
      p.receta = [[insumo(nombre, 'Unidad', 48, 12, redondear(p.precio * 0.45)), 1]];
    }
  });
}

// Devuelve false si el navegador no tiene espacio para guardar (por ejemplo, con muchas imágenes)
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(ESTADO)); return true; } catch (e) { return false; }
}

// Imagen de un producto: la suya o, si se vende tal cual, la de su insumo en el inventario
function fotoDe(p) {
  if (p.foto) return p.foto;
  if (p.tipo === 'PREPARADO' || !p.receta || !p.receta.length) return '';
  var i = buscarPor(ESTADO.insumos, 'nombre', p.receta[0][0]);
  return i && i.foto ? i.foto : '';
}

// Lee una imagen elegida por el usuario y la reduce para que quepa en la memoria del navegador (máximo 480 px por lado, JPEG)
function leerImagen(archivo) {
  return new Promise(function (resolver, rechazar) {
    if (!archivo || !/^image\//.test(archivo.type)) { rechazar(new Error('El archivo no es una imagen.')); return; }
    var lector = new FileReader();
    lector.onerror = function () { rechazar(new Error('No se pudo leer el archivo.')); };
    lector.onload = function () {
      var img = new Image();
      img.onerror = function () { rechazar(new Error('No se pudo abrir la imagen.')); };
      img.onload = function () {
        var lado = 480, calidad = 0.82, url = '';
        for (var intento = 0; intento < 4; intento++) {
          var escala = Math.min(1, lado / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * escala)); c.height = Math.max(1, Math.round(img.height * escala));
          var g = c.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          url = c.toDataURL('image/jpeg', calidad);
          if (url.length < 70000) break;
          lado = Math.round(lado * 0.8); calidad -= 0.1;
        }
        resolver(url);
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}


function cargar() {
  var texto = null;
  try { texto = localStorage.getItem(CLAVE); } catch (e) { texto = null; }
  ESTADO = texto ? JSON.parse(texto) : estadoInicial();
  var base = estadoInicial();
  for (var clave in base) if (ESTADO[clave] === undefined) ESTADO[clave] = base[clave];
  // Esta copia es frontend de demostración: elimina secretos que pudieran venir
  // de datos locales antiguos y fuerza el proveedor simulado.
  if (ESTADO.facturacion) {
    ESTADO.facturacion.ambiente = '2';
    ESTADO.facturacion.proveedor = 'simulado';
    delete ESTADO.facturacion.pin;
    if (ESTADO.facturacion.api) {
      delete ESTADO.facturacion.api.token;
      delete ESTADO.facturacion.api.encabezado;
      delete ESTADO.facturacion.api.prefijoToken;
      ESTADO.facturacion.api.base = '';
    }
    (ESTADO.facturacion.resoluciones || []).forEach(function (r) { delete r.claveTecnica; });
  }
  if (ESTADO.facturacion && !ESTADO.facturacion.impuestos) ESTADO.facturacion.impuestos = base.facturacion.impuestos;
  migrarImpuestos();
  reiniciarUnionesDeOtroTurno();
  if (ESTADO.productos.length < 20 && ESTADO.productos[0].nombre.indexOf('botella 750 ml') !== -1) ESTADO.productos = base.productos; // pasa de los 5 productos de ejemplo a la carta real
  recetasDeEjemplo(ESTADO); // deja la carta con sus recetas (una sola vez) y sus indicaciones de preparación (a quien no las tenga)
  try { localStorage.setItem(CLAVE, JSON.stringify(ESTADO)); } catch (e) { /* almacenamiento de demostración no disponible */ }
}

function reiniciarDatos() {
  localStorage.removeItem(CLAVE);
  cargar();
  guardar();
}

// ---------- Consultas pequeñas que usan varias páginas ----------
// Zonas del bar sin distinguir mayúsculas: las de la lista propia y las que ya usan las mesas
function claveZona(z) { return String(z || '').trim().toLowerCase(); }

function zonasDelBar() {
  var lista = [], vistos = {};
  (ESTADO.zonas || []).concat(ESTADO.mesas.map(function (m) { return m.ubicacion; })).forEach(function (z) {
    var k = claveZona(z);
    if (k && !vistos[k]) { vistos[k] = true; lista.push(z); }
  });
  return lista;
}

function ahoraTexto() {
  var d = new Date();
  var dos = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()) + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
}

function buscarPor(lista, campo, valor) {
  for (var i = 0; i < lista.length; i++) if (lista[i][campo] === valor) return lista[i];
  return null;
}

// Turno en el que está el bar: el abierto o, si la caja está cerrada, el último
function idTurnoActual() {
  var t = turnoAbierto();
  if (t) return t.id;
  return ESTADO.turnos.length ? ESTADO.turnos[ESTADO.turnos.length - 1].id : 0;
}

// Devuelve las mesas unidas a su mesa principal, con sus puestos de antes
function separarMesasDe(n) {
  var principal = buscarPor(ESTADO.mesas, 'n', n);
  var mias = (ESTADO.mesasUnidas || []).filter(function (u) { return u.principal === n; });
  mias.forEach(function (u) {
    ESTADO.mesas.push({ n: u.n, capacidad: u.capacidad, ubicacion: u.ubicacion, estado: 'Disponible' });
    principal.capacidad -= u.capacidad;
  });
  ESTADO.mesasUnidas = (ESTADO.mesasUnidas || []).filter(function (u) { return u.principal !== n; });
  delete principal.unidas;
  delete principal.unionTurno;
  ESTADO.mesas.sort(function (a, b) { return a.n - b.n; });
  return mias.map(function (u) { return u.n; });
}

// Las mesas unidas se separan solas cuando empieza otro turno
function reiniciarUnionesDeOtroTurno() {
  var actual = idTurnoActual();
  var hubo = false;
  ESTADO.mesas.filter(function (m) { return m.unidas && m.unidas.length; }).forEach(function (m) {
    if (m.unionTurno === undefined) { m.unionTurno = actual; hubo = true; return; } // uniones anteriores a este aviso: cuentan desde hoy
    if (m.unionTurno !== actual) { separarMesasDe(m.n); hubo = true; }
  });
  if (hubo) { actualizarMesas(); guardar(); }
  return hubo;
}

function turnoAbierto() {
  for (var i = 0; i < ESTADO.turnos.length; i++) if (ESTADO.turnos[i].cierra === '') return ESTADO.turnos[i];
  return null;
}

function pedidoDeMesa(n) {
  for (var i = 0; i < ESTADO.pedidos.length; i++) {
    var p = ESTADO.pedidos[i];
    if (p.mesa === n && p.estado !== 'Facturado' && p.estado !== 'Anulado') return p;
  }
  return null;
}

function pedidosEnCurso() {
  return ESTADO.pedidos.filter(function (p) { return p.estado !== 'Facturado' && p.estado !== 'Anulado'; });
}

// Estado del pedido según sus productos: todos despachados = Entregado
function estadoDePedido(p) {
  var hechos = 0;
  for (var i = 0; i < p.lineas.length; i++) if (p.lineas[i].despacho === 'Despachado') hechos++;
  if (hechos === p.lineas.length) return 'Entregado';
  return hechos > 0 ? 'En preparación' : 'Abierto';
}

function contarLineas(p, estado) {
  var n = 0;
  for (var i = 0; i < p.lineas.length; i++) if (p.lineas[i].despacho === estado) n++;
  return n;
}

// Una mesa con pedido abierto está ocupada; la reservada se respeta si no tiene pedido
function actualizarMesas() {
  for (var i = 0; i < ESTADO.mesas.length; i++) {
    var m = ESTADO.mesas[i];
    if (pedidoDeMesa(m.n)) m.estado = 'Ocupada';
    else if (m.estado === 'Ocupada') m.estado = 'Por limpiar';
  }
}

// ¿El mesero cobra al entregar? Se activa en el rol Mesero (Usuarios y roles). Si está apagado, solo cobra la caja.
function meseroCobra() { var r = buscarPor(ESTADO.roles || [], 'nombre', 'Mesero'); return !!(r && r.cobra); }

// En qué pantalla de Despacho se prepara un producto: bar o cocina
function areaDelProducto(nombre) {
  var p = buscarPor(ESTADO.productos, 'nombre', nombre);
  return p && p.area === 'COCINA' ? 'cocina' : 'bar';
}

// Avisos entre áreas (alertas con sonido y notificaciones). para: áreas que lo reciben ('cocina', 'bar', 'mesas', 'cajera'); el administrador los ve todos.
// Se guardan en el navegador: otra pestaña de este mismo navegador los recibe al momento.
// Áreas donde puede trabajar un empleado: las de su rol y las que el administrador le asignó
var AREAS_DEL_ROL = { Administrador: ['admin', 'cajera', 'mesas', 'ventas', 'bar', 'cocina'], Cajero: ['cajera'], Mesero: ['mesas'] };
var AREAS_SOLICITABLES = { Cajero: ['mesas'], Mesero: ['cajera'] };
function empleadoPorNombre(nombre) {
  return (ESTADO.empleados || []).filter(function (e) { return (e.nombre + ' ' + e.apellidos).trim() === nombre; })[0] || null;
}
function areasPermitidas(emp) {
  var r = buscarPor(ESTADO.roles || [], 'nombre', emp.rol), base = (r && r.areas) || AREAS_DEL_ROL[emp.rol] || [];
  return base.concat((emp.areasExtra || []).filter(function (a) { return base.indexOf(a) === -1; }));
}
function areasSolicitables(emp) {
  var r = buscarPor(ESTADO.roles || [], 'nombre', emp.rol), lista = (r && r.solicitables) || AREAS_SOLICITABLES[emp.rol] || [], propias = areasPermitidas(emp);
  return lista.filter(function (a) { return propias.indexOf(a) === -1; });
}

function usuarioActual() {
  try { var p = sessionStorage.getItem('rn_persona'); if (p) return p; } catch (e) { /* sin sesión */ }
  return ESTADO.usuario;
}

function notificar(para, texto, enlace, tipo, personas) {
  ESTADO.avisos = ESTADO.avisos || [];
  var id = 0;
  ESTADO.avisos.forEach(function (a) { id = Math.max(id, a.id); });
  ESTADO.avisos.push({ id: id + 1, fecha: ahoraTexto(), para: para, texto: texto, enlace: enlace || '', tipo: tipo || 'aviso', personas: personas || [], de: window.__pestana || '' });
  if (ESTADO.avisos.length > 80) ESTADO.avisos.splice(0, ESTADO.avisos.length - 80);
}

// Política de reservas con pedido anticipado: abono mínimo (% del pedido) y penalización (% del abono que se retiene si el cliente no asiste)
var POLITICA_RESERVA = { abonoMinimo: 30, penalizacion: 50 };

// ---------- Impuestos (legislación colombiana) ----------
// Cada producto lleva UNA sola clase de impuesto:
//  INC8     Impuesto nacional al consumo del 8 % (Estatuto Tributario art. 512-1): servicio de expendio de comidas y bebidas en restaurantes, bares, tabernas y discotecas. No se suma al IVA.
//  IVA19    IVA tarifa general del 19 % (art. 468). Solo si la empresa es responsable de IVA.
//  IVA5     IVA tarifa del 5 % (art. 468-1), para los bienes que la ley señala. Solo si la empresa es responsable de IVA.
//  EXENTO   Bien o servicio exento de IVA: tarifa 0 % que se reporta en la factura (arts. 477 a 481). Solo si la empresa es responsable de IVA.
//  EXCLUIDO Bien o servicio excluido (art. 424): no causa impuesto y no se reporta tarifa.
// El impuesto al consumo de licores es del productor o importador y ya viene en el precio de compra: el bar no lo cobra aparte. La propina no es un impuesto.
var IMPUESTOS_PRODUCTO = [['INC8', 'Impoconsumo 8 % (restaurantes y bares)'], ['IVA19', 'IVA 19 %'], ['IVA5', 'IVA 5 %'], ['EXENTO', 'Exento de IVA (tarifa 0 %)'], ['EXCLUIDO', 'Excluido (no causa impuesto)']];

// ¿Está obligado a facturar electrónicamente? Se pregunta en Caja, Datos de facturación. Sin responder se trata como obligado.
// Si no lo está, no cobra impuestos en el comprobante y entrega un comprobante de venta interno (no es factura).
function obligadoFE() { var e = ESTADO.facturacion && ESTADO.facturacion.emisor; return !(e && e.obligado === false); }
function tituloComprobante() { var e = ESTADO.facturacion && ESTADO.facturacion.emisor; return (e && e.tituloComprobante) || 'Comprobante de pago'; }
function leyendaComprobante() { var e = ESTADO.facturacion && ESTADO.facturacion.emisor; return (e && e.leyenda) || ''; }

function esResponsableDeIva() { var e = ESTADO.facturacion && ESTADO.facturacion.emisor; return !!e && e.regimen === 'Responsable de IVA'; }
function impLegado(iva) { return iva > 0 ? (iva === 19 ? 'IVA19' : (iva === 5 ? 'IVA5' : 'INC8')) : 'EXCLUIDO'; }
function claveImp(x) { return x.imp || impLegado(x.iva); }
function catalogoImpuestos() { return (ESTADO.facturacion && ESTADO.facturacion.impuestos) || estadoInicial().facturacion.impuestos; }
function entradaCatalogo(clave) { return buscarPor(catalogoImpuestos(), 'clave', clave); }
// El impuesto que realmente se cobra: debe estar activo en la empresa y, si es IVA, la empresa debe ser responsable de IVA
function impuestoCobrable(clave) {
  if (!obligadoFE()) return null;
  var e = entradaCatalogo(clave);
  return e && e.activo && e.tarifa > 0 && (e.codigo !== '01' || esResponsableDeIva()) ? e : null;
}
function etiquetaImp(clave) {
  var e = entradaCatalogo(clave);
  if (clave === 'EXENTO') return 'Exento de IVA';
  if (clave === 'EXCLUIDO') return 'Excluido de impuesto';
  return e ? e.nombre + ' ' + e.tarifa + ' %' + (impuestoCobrable(clave) ? '' : ' (no se cobra)') : clave;
}
function impuestosVigentes() { return catalogoImpuestos().filter(function (i) { return impuestoCobrable(i.clave); }); }

// Pasa lo guardado antes de esta opción: cada impuesto con su clave y cada producto con su clase de impuesto
function migrarImpuestos() {
  var lista = ESTADO.facturacion && ESTADO.facturacion.impuestos;
  if (lista) {
    lista.forEach(function (i) { if (!i.clave) i.clave = i.codigo === '04' ? 'INC8' : (i.tarifa === 5 ? 'IVA5' : 'IVA19'); });
    if (!buscarPor(lista, 'clave', 'IVA5')) lista.push({ clave: 'IVA5', codigo: '01', nombre: 'IVA', tarifa: 5, activo: false });
  }
  (ESTADO.productos || []).forEach(function (p) { if (!p.imp) p.imp = impLegado(p.iva); });
}

// descLineas (opcional): descuento en pesos de cada línea, que calcula evaluarPromo. Sin él, el descuento es un porcentaje de todo el pedido
function totalesDe(p, pct, descLineas) {
  var subtotal = 0, descuento = 0, bases = {};
  for (var i = 0; i < p.lineas.length; i++) {
    var valor = p.lineas[i].cant * p.lineas[i].precio;
    var desc = descLineas ? Math.min(valor, descLineas[i] || 0) : Math.round(valor * (pct || 0) / 100);
    subtotal += valor;
    descuento += desc;
    var clave = claveImp(p.lineas[i]);
    if (impuestoCobrable(clave)) bases[clave] = (bases[clave] || 0) + valor - desc;
  }
  var detalle = catalogoImpuestos().filter(function (t) { return bases[t.clave] > 0; }).map(function (t) {
    return { clave: t.clave, codigo: t.codigo, nombre: t.nombre, porcentaje: t.tarifa, base: Math.round(bases[t.clave]), valor: Math.round(bases[t.clave] * t.tarifa / 100) };
  });
  var impuesto = 0;
  detalle.forEach(function (t) { impuesto += t.valor; });
  return { subtotal: subtotal, descuento: descuento, impuesto: impuesto, total: subtotal - descuento + impuesto, detalle: detalle };
}

// ---------- Promociones ----------
// Una promoción define qué descuenta (tipo), a qué productos, cuándo (fechas, días, horas), a qué clientes y con qué límites.
// tipo: PORCENTAJE (pct), NXM (lleva y paga: 2x1, 3x2), MONTO (monto menos por unidad), PRECIO (precio especial por unidad)
// aplicaA: TODO, CATEGORIAS (categorias) o PRODUCTOS (productos). segmento: TODOS, REGISTRADOS, PERSONAS, EMPRESAS, FRECUENTES, NUEVOS, CUMPLE
var DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
var SEGMENTOS = [['TODOS', 'Todos los clientes'], ['REGISTRADOS', 'Clientes registrados'], ['PERSONAS', 'Personas'], ['EMPRESAS', 'Empresas'], ['FRECUENTES', 'Clientes frecuentes (3 o más compras)'], ['NUEVOS', 'Clientes nuevos (sin compras)'], ['CUMPLE', 'Cumpleañeros (±3 días)']];

function clienteDe(nombre) {
  var lista = ESTADO.clientes || [];
  for (var i = 0; i < lista.length; i++) if ((lista[i].nombre + ' ' + (lista[i].apellidos || '')).trim() === nombre) return lista[i];
  return null;
}

function comprasDe(nombre) { return ESTADO.ventas.filter(function (v) { return v.cliente === nombre; }).length; }

function esCumple(c, ahora) {
  if (!c || !c.nacimiento) return false;
  var n = c.nacimiento.split('-'), a = new Date(ahora.getFullYear(), Number(n[1]) - 1, Number(n[2])), dias = Math.abs(a - new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())) / 86400000;
  return dias <= 3 || dias >= 362;
}

function cumpleSegmento(promo, nombreCliente, ahora) {
  var seg = promo.segmento || 'TODOS', c = clienteDe(nombreCliente);
  if (seg === 'TODOS') return true;
  if (!c) return false;
  if (seg === 'REGISTRADOS') return true;
  if (seg === 'PERSONAS') return c.tipoDoc !== 'NIT';
  if (seg === 'EMPRESAS') return c.tipoDoc === 'NIT';
  if (seg === 'FRECUENTES') return comprasDe(nombreCliente) >= 3;
  if (seg === 'NUEVOS') return comprasDe(nombreCliente) === 0;
  if (seg === 'CUMPLE') return esCumple(c, ahora);
  return true;
}

function hhmm(d) { return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }

// Por qué una promoción no aplica ahora ('' si es válida): vigencia, día, hora, evento y cliente
function motivoNoVigente(promo, nombreCliente, ahora) {
  var hoy = ahoraTexto().slice(0, 10);
  if (promo.activa === false) return 'Está desactivada.';
  if (promo.desde && hoy < promo.desde) return 'Empieza el ' + promo.desde + '.';
  if (promo.hasta && hoy > promo.hasta) return 'Terminó el ' + promo.hasta + '.';
  if (promo.dias && promo.dias.length && promo.dias.indexOf(ahora.getDay()) === -1) return 'Solo aplica ' + promo.dias.map(function (d) { return DIAS_SEMANA[d]; }).join(', ') + '.';
  if (promo.horaDesde && promo.horaHasta) {
    var h = hhmm(ahora), dentro = promo.horaDesde <= promo.horaHasta ? (h >= promo.horaDesde && h <= promo.horaHasta) : (h >= promo.horaDesde || h <= promo.horaHasta);
    if (!dentro) return 'Solo aplica de ' + promo.horaDesde + ' a ' + promo.horaHasta + '.';
  }
  if (promo.soloEvento && promo.evento) {
    var ev = buscarPor(ESTADO.eventos || [], 'nombre', promo.evento), t = ahoraTexto();
    if (!ev || t < ev.inicio || t > ev.fin) return 'Solo aplica durante ' + promo.evento + '.';
  }
  if (!cumpleSegmento(promo, nombreCliente, ahora)) return 'No es para este tipo de cliente.';
  return '';
}

// Evalúa una promoción sobre un pedido: devuelve cuánto descuenta cada línea. Solo toca los productos de la promoción.
function evaluarPromo(pedido, promo, nombreCliente, ahora) {
  ahora = ahora || new Date();
  var r = { aplica: false, motivo: '', descuento: 0, descLineas: pedido.lineas.map(function () { return 0; }) };
  r.motivo = motivoNoVigente(promo, nombreCliente, ahora);
  if (r.motivo) return r;
  var tipo = promo.tipo || 'PORCENTAJE', unidades = [], subtotal = 0;
  pedido.lineas.forEach(function (l, i) {
    subtotal += l.cant * l.precio;
    var prod = buscarPor(ESTADO.productos, 'nombre', l.producto);
    var ok = !promo.aplicaA || promo.aplicaA === 'TODO' || (promo.aplicaA === 'CATEGORIAS' && prod && (promo.categorias || []).indexOf(prod.cat) !== -1) || (promo.aplicaA === 'PRODUCTOS' && (promo.productos || []).indexOf(l.producto) !== -1);
    if (ok) for (var k = 0; k < l.cant; k++) unidades.push({ i: i, precio: l.precio });
  });
  if (promo.minCompra && subtotal < promo.minCompra) { r.motivo = 'La cuenta debe ser de al menos ' + pesos(promo.minCompra) + '.'; return r; }
  if (!unidades.length) { r.motivo = 'No hay productos de esta promoción en la cuenta.'; return r; }
  if (tipo === 'NXM') {
    var lleva = promo.lleva || 2, paga = promo.paga || 1, gratis = Math.floor(unidades.length / lleva) * (lleva - paga);
    unidades.sort(function (a, b) { return a.precio - b.precio; });
    unidades.slice(0, gratis).forEach(function (u) { r.descLineas[u.i] += u.precio; });
    if (!gratis) { r.motivo = 'Faltan productos: lleva ' + lleva + ' y paga ' + paga + '.'; return r; }
  } else {
    var usadas = promo.tope > 0 ? unidades.slice(0, promo.tope) : unidades;
    usadas.forEach(function (u) {
      var d = tipo === 'MONTO' ? Math.min(promo.monto || 0, u.precio) : (tipo === 'PRECIO' ? Math.max(0, u.precio - (promo.precioEspecial || 0)) : Math.round(u.precio * (promo.pct || 0) / 100));
      r.descLineas[u.i] += d;
    });
  }
  r.descuento = r.descLineas.reduce(function (s, d) { return s + d; }, 0);
  if (r.descuento <= 0) { r.motivo = 'No descuenta nada sobre esta cuenta.'; return r; }
  r.aplica = true;
  return r;
}

// Promociones que se pueden ofrecer ahora en un pedido, la que más descuenta primero
function promosAplicables(pedido, nombreCliente) {
  var lista = [];
  ESTADO.promociones.forEach(function (promo, k) {
    var r = evaluarPromo(pedido, promo, nombreCliente);
    if (r.aplica) lista.push({ promo: promo, indice: k, resultado: r });
  });
  return lista.sort(function (a, b) { return b.resultado.descuento - a.resultado.descuento; });
}

// Texto corto de lo que hace una promoción: "2x1", "10 %", "-$2.000", "$5.000"
function resumenPromo(promo) {
  var t = promo.tipo || 'PORCENTAJE';
  return t === 'NXM' ? (promo.lleva || 2) + 'x' + (promo.paga || 1) : (t === 'MONTO' ? '-' + pesos(promo.monto || 0) : (t === 'PRECIO' ? pesos(promo.precioEspecial || 0) : (promo.pct || 0) + ' %'));
}

// Cuánto de un insumo está comprometido en productos pedidos que aún no se despachan
function reservadoDe(insumo) {
  var total = 0;
  var abiertos = pedidosEnCurso();
  for (var a = 0; a < abiertos.length; a++) {
    for (var b = 0; b < abiertos[a].lineas.length; b++) {
      var l = abiertos[a].lineas[b];
      if (l.despacho !== 'Pendiente' && l.despacho !== 'Por confirmar') continue;
      var prod = buscarPor(ESTADO.productos, 'nombre', l.producto);
      for (var c = 0; prod && c < prod.receta.length; c++) if (prod.receta[c][0] === insumo) total += prod.receta[c][1] * l.cant;
    }
  }
  return total;
}

// Cuántas unidades de un producto se pueden vender con lo que hay en inventario
function disponibleDe(producto) {
  var tope = 9999;
  for (var i = 0; i < producto.receta.length; i++) {
    var ins = buscarPor(ESTADO.insumos, 'nombre', producto.receta[i][0]);
    var libre = ins ? ins.existencia - reservadoDe(ins.nombre) : 0;
    tope = Math.min(tope, Math.floor(libre / producto.receta[i][1]));
  }
  return Math.max(0, tope);
}

// Entrada suma, salida y merma restan, ajuste deja la existencia contada. Cada movimiento guarda lo que había antes y el costo promedio (kardex).
// El costo de una entrada (por unidad) se promedia con lo que ya había; las salidas salen al costo promedio. Genera o cierra la alerta de stock mínimo
function registrarMovimiento(ins, tipo, cant, obs, linea, costo, vence, compra) {
  var antes = ins.existencia, costoAntes = ins.costo;
  if (tipo === 'ENTRADA') {
    var c = costo === undefined || costo === '' ? ins.costo : costo;
    ins.existencia += cant;
    ins.costo = ins.existencia > 0 ? Math.round((antes * ins.costo + cant * c) / ins.existencia * 100) / 100 : c;
    costo = c;
  } else {
    ins.existencia = tipo === 'AJUSTE' ? cant : ins.existencia - cant;
    costo = costoAntes;
  }
  ins.existencia = Math.round(ins.existencia * 100) / 100;
  var texto = { ENTRADA: 'Entrada', SALIDA: 'Salida', MERMA: 'Merma', AJUSTE: 'Ajuste' }[tipo];
  ESTADO.movimientos.push({ fecha: ahoraTexto(), insumo: ins.nombre, quien: usuarioActual(), linea: linea || '—', tipo: texto, cant: cant, obs: obs,
    antes: Math.round(antes * 100) / 100, costo: costo, costoAntes: costoAntes, costoProm: ins.costo });
  if (tipo === 'ENTRADA') {
    if (vence) ESTADO.movimientos[ESTADO.movimientos.length - 1].vence = vence;
    if (compra) ESTADO.movimientos[ESTADO.movimientos.length - 1].compra = compra;
  }
  var activa = null;
  for (var i = 0; i < ESTADO.alertas.length; i++) if (ESTADO.alertas[i].insumo === ins.nombre && ESTADO.alertas[i].estado === 'Activa') activa = ESTADO.alertas[i];
  if (ins.existencia < ins.minimo && !activa) {
    ESTADO.alertas.push({ insumo: ins.nombre, existencia: ins.existencia, fecha: ahoraTexto(), estado: 'Activa', quien: '—', atencion: '—' });
    notificar(['admin'], (ins.existencia <= 0 ? 'Agotado: ' : 'Stock bajo: ') + ins.nombre, 'inventario.html', 'aviso');
  } else if (ins.existencia >= ins.minimo && activa) {
    activa.estado = 'Atendida';
    activa.quien = usuarioActual();
    activa.atencion = ahoraTexto();
  }
}

// Despachar una línea: el inventario descuenta lo que indica la receta y queda el movimiento
function despacharLinea(p, i) {
  var l = p.lineas[i];
  var prod = buscarPor(ESTADO.productos, 'nombre', l.producto);
  l.despacho = 'Despachado';
  for (var k = 0; prod && k < prod.receta.length; k++) {
    var ins = buscarPor(ESTADO.insumos, 'nombre', prod.receta[k][0]);
    registrarMovimiento(ins, 'SALIDA', prod.receta[k][1] * l.cant, 'Despacho pedido ' + p.n, 'Pedido ' + p.n);
  }
  p.estado = estadoDePedido(p);
}

// Categorías del inventario: las mismas de los productos cuando el insumo se vende tal cual (Aguardiente, Ron, Cerveza…) y las propias de los insumos.
// Un insumo sin categoría guardada se clasifica por su nombre o por el producto que lo usa.
var CATEGORIAS_INSUMO = ['Aguardiente', 'Ron', 'Whisky', 'Tequila', 'Vodka', 'Brandy', 'Cerveza', 'Gaseosas', 'Agua', 'Energizantes e hidratantes', 'Otras bebidas', 'Frutas y verduras', 'Despensa'];
function categoriaDeInsumo(i) {
  if (i.cat) return i.cat;
  var n = i.nombre, reglas = [
    [/^Cerveza /, 'Cerveza'], [/^Aguardiente/, 'Aguardiente'], [/^(Ron |Bacardi)/, 'Ron'], [/^Brandy/, 'Brandy'],
    [/^(Don Julio|1800|Jimador|Tres Caballos|Olmeca|José Cuervo)/, 'Tequila'], [/^(Buchanan|Old Parr|Chivas|Something Special|Jack Daniel|Red Label|Ballantines|Black and White|Baileys)/, 'Whisky'],
    [/^(Vodka|Smirnoff)/, 'Vodka'], [/^(Gaseosa|Soda)/, 'Gaseosas'], [/^Agua/, 'Agua'], [/^(Monster|Red Bull|Electrolit|Gatorade)/, 'Energizantes e hidratantes'],
    [/^(Limón|Naranja|Mora|Fresa|Piña)/, 'Frutas y verduras'], [/^(Sal|Azúcar|Hielo)\b/, 'Despensa']];
  for (var k = 0; k < reglas.length; k++) if (reglas[k][0].test(n)) return reglas[k][1];
  var prod = ESTADO.productos.filter(function (p) { return p.receta.length && p.receta[0][0] === n && p.cat !== 'Sin alcohol'; })[0];
  return prod ? prod.cat : (/^(Bonfiest)/.test(n) ? 'Otras bebidas' : 'Otros');
}
function categoriasDeInsumos() {
  var usadas = [];
  ESTADO.insumos.forEach(function (i) { var c = categoriaDeInsumo(i); if (usadas.indexOf(c) === -1) usadas.push(c); });
  var orden = CATEGORIAS_INSUMO.filter(function (c) { return usadas.indexOf(c) !== -1; });
  return orden.concat(usadas.filter(function (c) { return orden.indexOf(c) === -1; }).sort());
}

// Kardex de un insumo: saldo inicial y, por cada movimiento, lo que entró, lo que salió y cómo quedó (cantidad, costo promedio y valor).
// Los movimientos de ejemplo no traen sus saldos: se reconstruyen hacia atrás desde la existencia actual.
function kardexDe(ins) {
  var movs = [];
  ESTADO.movimientos.forEach(function (m, k) { if (m.insumo === ins.nombre) movs.push({ m: m, k: k }); });
  movs.sort(function (a, b) { return a.m.fecha === b.m.fecha ? a.k - b.k : (a.m.fecha < b.m.fecha ? -1 : 1); });
  var redondo = function (n) { return Math.round(n * 100) / 100; };
  var despues = ins.existencia, costoDespues = ins.costo;
  for (var i = movs.length - 1; i >= 0; i--) {
    var m = movs[i].m;
    var antes = m.antes !== undefined ? m.antes : (m.tipo === 'Entrada' ? despues - m.cant : (m.tipo === 'Ajuste' ? despues : despues + m.cant));
    movs[i].antes = redondo(antes);
    movs[i].despues = redondo(despues);
    movs[i].costoMov = m.costo !== undefined ? m.costo : costoDespues;
    movs[i].prom = m.costoProm !== undefined ? m.costoProm : costoDespues;
    costoDespues = m.costoAntes !== undefined ? m.costoAntes : costoDespues;
    despues = antes;
  }
  var inicial = { cant: redondo(despues), costo: costoDespues };
  inicial.valor = inicial.cant * inicial.costo;
  var filas = movs.map(function (x) {
    var m = x.m, dif = redondo(x.despues - x.antes);
    var entra = dif > 0 ? { cant: dif, costo: x.costoMov, valor: dif * x.costoMov } : null;
    var sale = dif < 0 ? { cant: -dif, costo: x.costoMov, valor: -dif * x.costoMov } : null;
    return { fecha: m.fecha, tipo: m.tipo, vence: m.vence || '', compra: m.compra || '', obs: m.obs, quien: m.quien, linea: m.linea, entra: entra, sale: sale, saldo: { cant: x.despues, costo: x.prom, valor: x.despues * x.prom } };
  });
  return { inicial: inicial, filas: filas };
}

function insumosBajos() {
  return ESTADO.insumos.filter(function (i) { return i.existencia < i.minimo; });
}

// Las ventas anuladas no cuentan en la caja ni en los reportes
function ventasActivas() { return ESTADO.ventas.filter(function (v) { return !v.anulada; }); }

function ventasDelTurno(turno) {
  return ventasActivas().filter(function (v) { return v.turno === turno.id; });
}

function documentoDe(numero) { return buscarPor(ESTADO.documentos, 'id', numero); }

// Efectivo que debe haber en el cajón: base + ventas en efectivo del turno
function efectivoEsperado(turno) {
  var suma = turno.base;
  ventasDelTurno(turno).forEach(function (v) { if (v.efectivo) suma += v.total + (v.propina || 0) - (v.abono || 0); });
  movimientosDelTurno(turno).forEach(function (m) { suma += m.tipo === 'INGRESO' ? m.valor : -m.valor; });
  return suma;
}

function movimientosDelTurno(turno) {
  return ESTADO.movimientosCaja.filter(function (m) { return m.turno === turno.id; });
}

cargar();
