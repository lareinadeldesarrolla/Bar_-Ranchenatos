
/* =========================================
   PROTECCIÓN DE LA ZONA DEL CLIENTE
   Bar Ranchenatos
========================================= */

(function () {

    const sesion = sessionStorage.getItem(
        "clienteActivoRanchenatos"
    );

    if (!sesion) {
        window.location.replace("ingreso.html");
        return;
    }

    try {
        const cliente = JSON.parse(sesion);

        if (!cliente || !cliente.email) {
            sessionStorage.removeItem("clienteActivoRanchenatos");
            window.location.replace("ingreso.html");
        }

    } catch (error) {
        sessionStorage.removeItem("clienteActivoRanchenatos");
        window.location.replace("ingreso.html");
    }

})();
