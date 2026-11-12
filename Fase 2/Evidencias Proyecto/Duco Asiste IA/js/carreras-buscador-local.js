function slugify(texto) {
    return texto
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

jQuery(document).ready(function ($) {
    const COLUMNAS_GRID = 3;
    const FILAS_INICIALES = 6;
    const FILAS_INICIALES_ITEMS = COLUMNAS_GRID * FILAS_INICIALES;

    const MOBILE = window.matchMedia("(max-width: 1024px)").matches;

    let todasCarreras = [];
    // En mobile la maqueta solo contempla la vista de lista (el switch
    // cuadrícula/lista queda oculto ahí, ver busc-carreras.css); en
    // desktop sigue partiendo en cuadrícula como siempre.
    let vistaActual = MOBILE ? "list" : "grid";
    let ultimosResultados = [];
    let mostrandoTodo = false;

    if (MOBILE) {
        $("#resultados-carreras").removeClass("bc-grid").addClass("bc-list");
    }

    // En mobile los filtros quedan colapsados detrás de un botón "Filtros"
    // (se reutiliza el <h2> que ya traía el aside, sin agregar HTML nuevo);
    // el resto del contenido (grupos de filtros + botón limpiar) se
    // muestra/oculta con la clase "bc-filtros-open" (ver CSS).
    $("#buscador-carreras .bc-filtros > h2").on("click", function() {
        $(this).closest(".bc-filtros").toggleClass("bc-filtros-open");
    });

    const seleccion = {
        modalidad: new Set(), // 'presencial' | 'online'
        tipo: new Set(),      // 'profesional' | 'tecnica' (antes eran pestañas)
        escuela: new Set(),
        sede: new Set(),
        jornada: new Set()
    };

    function normalizar(texto) {
        return texto ? texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim() : "";
    }

    function obtenerJornadasUnicas(sedes_modalidades) {
        if (!sedes_modalidades) return [];
        const result = [];
        sedes_modalidades.forEach(sm => {
            if (Array.isArray(sm.modalidades)) {
                sm.modalidades.forEach(m => {
                    const limpio = m.trim();
                    if (limpio && normalizar(limpio) !== "100% online") result.push(limpio);
                });
            }
        });
        return [...new Set(result)];
    }

    function esPresencial(item) {
        return (item.sedes_modalidades || []).some(s =>
            (s.modalidades || []).some(m => normalizar(m) !== "100% online")
        );
    }

    function esOnline(item) {
        const sm = item.sedes_modalidades || [];
        if (!sm.length) return true;
        return sm.some(s => (s.modalidades || []).some(m => normalizar(m) === "100% online"));
    }

    $.ajax({
        url: "./assets/carreras-catalogo.json",
        type: "GET",
        dataType: "json",
        success: function (response) {
            if (response && response.length > 0) {
                todasCarreras = response;
                llenarFiltros();
                aplicarFiltrosDesdeURL();
                actualizarResultados();
            } else {
                $("#resultados-carreras").html("<p class=\"bc-sin-resultados\">No se pudo cargar el listado de carreras. Intenta recargar la página.</p>");
            }
        },
        error: function () {
            $("#resultados-carreras").html("<p class=\"bc-sin-resultados\">No se pudo cargar el listado de carreras. Intenta recargar la página.</p>");
        }
    });

    function llenarFiltroCheckbox($body, valores, grupo) {
        $body.empty();
        $body.append(`
            <label class="bc-check" for="bc-${grupo}-todas">
                <input type="checkbox" id="bc-${grupo}-todas" data-grupo="${grupo}" data-todas="1" checked>
                Todas
            </label>
        `);
        valores.forEach(valor => {
            const id = `bc-${grupo}-${slugify(valor)}`;
            $body.append(`
                <label class="bc-check" for="${id}">
                    <input type="checkbox" id="${id}" data-grupo="${grupo}" value="${$('<div>').text(valor).html()}">
                    ${valor}
                </label>
            `);
        });
    }

    function llenarFiltros() {
        const sedesUnicas = [...new Set(todasCarreras.flatMap(c => {
            if (Array.isArray(c.sedes)) return c.sedes;
            if (c.sedes && typeof c.sedes === "object") return Object.values(c.sedes);
            return [];
        }))].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const escuelasUnicas = [...new Set(todasCarreras.flatMap(c => c.escuela || []))]
            .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        const jornadasUnicas = [...new Set(todasCarreras.flatMap(c => obtenerJornadasUnicas(c.sedes_modalidades)))]
            .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

        llenarFiltroCheckbox($("#bc-filtro-escuela .bc-filtro-body"), escuelasUnicas, "escuela");
        llenarFiltroCheckbox($("#bc-filtro-sede .bc-filtro-body"), sedesUnicas, "sede");
        llenarFiltroCheckbox($("#bc-filtro-jornada .bc-filtro-body"), jornadasUnicas, "jornada");
    }

    function marcarCheckboxPorValor($contenedor, valorNormalizado) {
        return $contenedor.find("input[type=checkbox]").filter(function () {
            return normalizar($(this).val()) === valorNormalizado;
        });
    }

    // Preselecciona filtros recibidos por query string (?modalidad=&escuela=),
    // usados por el shortcode [buscador_carreras_mini] al enlazar hacia esta página.
    // El parámetro "modalidad" trae la misma categoría del filtro "Modalidad"
    // de este buscador: "Presencial" u "Online" (no una jornada como Diurna,
    // Vespertina, etc., esas solo existen dentro del filtro "Jornada").
    function aplicarFiltrosDesdeURL() {
        const params = new URLSearchParams(window.location.search);
        const modalidad = normalizar(params.get("modalidad"));
        const escuela = normalizar(params.get("escuela"));
        const texto = (params.get("q") || "").trim();

        // Texto escrito en el buscador mini ([buscador_carreras_mini]).
        if (texto) {
            $("#carrera-search").val(texto.slice(0, 100));
        }

        if (modalidad === "presencial" || modalidad === "online") {
            $("#bc-modalidad-todas").prop("checked", false);
            $(`#bc-modalidad-${modalidad}`).prop("checked", true);
            seleccion.modalidad.add(modalidad);
            $("#bc-filtro-modalidad").addClass("open");
        }

        if (escuela) {
            const $body = $("#bc-filtro-escuela .bc-filtro-body");
            const $match = marcarCheckboxPorValor($body, escuela);
            if ($match.length) {
                $match.prop("checked", true);
                $body.find("[data-todas]").prop("checked", false);
                seleccion.escuela.add(escuela);
                $("#bc-filtro-escuela").addClass("open");
            }
        }
    }

    // Mantiene ?q= de la URL igual al texto buscado: si no, al refrescar la
    // página volvía la búsqueda con la que se llegó y no la actual.
    function sincronizarURL() {
        // Solo en la página del buscador completo (este script también carga
        // en otras páginas, donde no existe el campo).
        if (!$("#carrera-search").length || !window.history || !window.history.replaceState) return;
        const url = new URL(window.location.href);
        const texto = String($("#carrera-search").val() || "").trim();
        if (texto) url.searchParams.set("q", texto);
        else url.searchParams.delete("q");
        if (url.href !== window.location.href) window.history.replaceState(null, "", url.href);
    }

    // Abrir/cerrar acordeones de filtros
    $(".bc-filtro-header").on("click", function () {
        $(this).closest(".bc-filtro-group").toggleClass("open");
    });

    // Modalidad ("Todas / Presencial / Online") y Tipo de carrera ("Todas /
    // Profesional / Técnica"): checkboxes fijos con "Todas" por defecto.
    ["modalidad", "tipo"].forEach(function (grupo) {
        $(`#bc-filtro-${grupo}`).on("change", "input[type=checkbox]", function () {
            const $todas = $(`#bc-${grupo}-todas`);
            if (this.id === `bc-${grupo}-todas`) {
                $(`#bc-filtro-${grupo} input[type=checkbox]`).not($todas).prop("checked", false);
                seleccion[grupo].clear();
            } else {
                $todas.prop("checked", false);
                seleccion[grupo].clear();
                $(`#bc-filtro-${grupo} input[type=checkbox]:checked`).not($todas).each(function () {
                    seleccion[grupo].add($(this).val());
                });
                if (!seleccion[grupo].size) $todas.prop("checked", true);
            }
            actualizarResultados();
        });
    });

    // Escuela / Sede / Jornada: checkboxes multi-selección dinámicos, con
    // "Todas" como opción por defecto (mismo comportamiento que Modalidad).
    $(document).on("change", ".bc-filtro-body input[type=checkbox]", function () {
        const grupo = $(this).data("grupo");
        if (!grupo || !seleccion[grupo]) return;

        const $body = $(this).closest(".bc-filtro-body");
        const $todas = $body.find("[data-todas]");

        if ($(this).is("[data-todas]")) {
            $body.find("input[type=checkbox]").not($todas).prop("checked", false);
            seleccion[grupo].clear();
        } else {
            $todas.prop("checked", false);
            seleccion[grupo].clear();
            $body.find("input[type=checkbox]:checked").not($todas).each(function () {
                seleccion[grupo].add(normalizar($(this).val()));
            });
            if (!seleccion[grupo].size) $todas.prop("checked", true);
        }
        actualizarResultados();
    });

    // Vista grid / lista
    $(".bc-view-toggle button").on("click", function () {
        $(".bc-view-toggle button").removeClass("active");
        $(this).addClass("active");
        vistaActual = $(this).data("view");
        $("#resultados-carreras").toggleClass("bc-grid", vistaActual === "grid").toggleClass("bc-list", vistaActual === "list");
        renderResultados();
    });

    function limpiarTexto(texto) {
        return texto ? texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim() : "";
    }

    // --- Búsqueda aproximada por nombre de carrera ---------------------------
    // Cada palabra escrita (ignorando conectores como "de", "en", "y") tiene que
    // parecerse a alguna palabra del nombre de la carrera: coincidencia exacta,
    // inicio de palabra (para ir buscando mientras se escribe) o una palabra
    // "similar" con pocas letras de diferencia (faltas de ortografía, letras
    // cambiadas de lugar). También se compara una versión "fonética" en español
    // (b/v, s/z/c, ll/y, h muda, qu/k, etc.) para errores como "injenieria".
    const PALABRAS_IGNORADAS = new Set(["de", "del", "la", "las", "el", "los", "en", "y", "e", "a", "al", "con", "para", "por", "o", "u"]);

    function tokenizar(texto) {
        return limpiarTexto(texto).split(/[^a-z0-9ñ]+/).filter(Boolean);
    }

    function fonetica(palabra) {
        return palabra
            .replace(/ch/g, "ç")
            .replace(/h/g, "")
            .replace(/qu/g, "k")
            .replace(/gu(?=[ei])/g, "G")
            .replace(/g(?=[ei])/g, "j")
            .replace(/G/g, "g")
            .replace(/c(?=[ei])/g, "s")
            .replace(/c/g, "k")
            .replace(/z/g, "s")
            .replace(/v/g, "b")
            .replace(/w/g, "b")
            .replace(/ll/g, "y")
            .replace(/(.)+/g, "$1");
    }

    // Distancia de edición (Damerau-Levenshtein restringida): cantidad mínima de
    // letras a insertar, borrar, cambiar o intercambiar para pasar de a a b.
    function distancia(a, b) {
        if (a === b) return 0;
        const m = a.length, n = b.length;
        if (!m) return n;
        if (!n) return m;
        let prev2 = null;
        let prev = Array.from({ length: n + 1 }, (_, j) => j);
        for (let i = 1; i <= m; i++) {
            const actual = [i];
            for (let j = 1; j <= n; j++) {
                const costo = a[i - 1] === b[j - 1] ? 0 : 1;
                let d = Math.min(prev[j] + 1, actual[j - 1] + 1, prev[j - 1] + costo);
                if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    d = Math.min(d, prev2[j - 2] + 1);
                }
                actual.push(d);
            }
            prev2 = prev;
            prev = actual;
        }
        return prev[n];
    }

    // Errores tolerados según el largo de lo escrito: nada en palabras muy
    // cortas (evita falsos positivos), 1 hasta 6 letras y 2 desde 7.
    function erroresPermitidos(largo) {
        if (largo <= 3) return 0;
        if (largo <= 6) return 1;
        return 2;
    }

    // Puntaje de parecido entre una palabra buscada y una del título (0 = no calza).
    function puntajePalabra(q, t) {
        if (t === q) return 4;
        if (t.startsWith(q)) return 3;
        if (q.length >= 3 && t.includes(q)) return 2;

        const max = erroresPermitidos(q.length);
        if (!max) return 0;

        let mejor = Infinity;
        [[q, t], [fonetica(q), fonetica(t)]].forEach(([a, b]) => {
            mejor = Math.min(mejor, distancia(a, b));
            // Comparación contra el inicio de la palabra, para que funcione
            // mientras se va escribiendo ("ingenei" -> "ingenieria").
            for (let largo = a.length - 1; largo <= a.length + 1; largo++) {
                if (largo > 0 && largo < b.length) mejor = Math.min(mejor, distancia(a, b.slice(0, largo)));
            }
        });

        return mejor <= max ? 1.5 - mejor / (max + 1) : 0;
    }

    // Puntaje del título completo para la búsqueda: 0 si alguna palabra buscada
    // no se parece a ninguna palabra del título.
    function puntajeTitulo(tokensBusqueda, busquedaCompleta, titulo) {
        const tokensTitulo = tokenizar(titulo);
        let total = 0;
        for (const q of tokensBusqueda) {
            let mejor = 0;
            for (const t of tokensTitulo) {
                mejor = Math.max(mejor, puntajePalabra(q, t));
                if (mejor === 4) break;
            }
            if (!mejor) return 0;
            total += mejor;
        }
        if (limpiarTexto(titulo).includes(busquedaCompleta)) total += 2;
        return total;
    }

    function filtrar() {
        const search = limpiarTexto($("#carrera-search").val());
        const tokensTodos = tokenizar(search);
        const tokensBusqueda = tokensTodos.filter(t => !PALABRAS_IGNORADAS.has(t));
        const buscarTexto = search.length >= 2 && tokensBusqueda.length > 0;
        const puntajes = new Map();

        const filtrados = todasCarreras.filter(item => {
            const tipos = (item.tipo || []).map(normalizar);
            const escuelas = (item.escuela || []).map(normalizar);
            const sedes = Array.isArray(item.sedes)
                ? item.sedes.map(normalizar)
                : item.sedes && typeof item.sedes === "object"
                    ? Object.values(item.sedes).map(normalizar)
                    : [];
            const jornadas = obtenerJornadasUnicas(item.sedes_modalidades).map(normalizar);

            let matchTexto = true;
            if (buscarTexto) {
                const puntaje = puntajeTitulo(tokensBusqueda, search, item.title);
                matchTexto = puntaje > 0;
                if (matchTexto) puntajes.set(item, puntaje);
            }
            const matchTipo = !seleccion.tipo.size || tipos.some(t => seleccion.tipo.has(t));

            let matchModalidad = true;
            if (seleccion.modalidad.size) {
                matchModalidad = [...seleccion.modalidad].some(m =>
                    m === "presencial" ? esPresencial(item) : esOnline(item)
                );
            }

            const matchEscuela = !seleccion.escuela.size || escuelas.some(e => seleccion.escuela.has(e));
            const matchSede = !seleccion.sede.size || sedes.some(s => seleccion.sede.has(s));
            const matchJornada = !seleccion.jornada.size || jornadas.some(j => seleccion.jornada.has(j));

            return matchTexto && matchTipo && matchModalidad && matchEscuela && matchSede && matchJornada;
        });

        // Con texto de búsqueda, las carreras que más se parecen van primero.
        if (buscarTexto) filtrados.sort((a, b) => puntajes.get(b) - puntajes.get(a));
        return filtrados;
    }

    function esModalidadOnline(item) {
        const sedesRelevantes = seleccion.sede.size
            ? (item.sedes_modalidades || []).filter(s => seleccion.sede.has(normalizar(s.sede)))
            : (item.sedes_modalidades || []);

        const modalidades = [...new Set(sedesRelevantes.flatMap(s => s.modalidades || []))];

        if (!modalidades.length) return true; // sin datos de modalidad registrados: se asume 100% Online

        return modalidades.every(m => normalizar(m) === "100% online");
    }

    // El texto de modalidad solo se muestra en la tarjeta cuando es "100% Online";
    // el resto de jornadas (Diurna, Vespertina, etc.) solo se usan en los filtros.
    function renderModalidad(item) {
        if (!esModalidadOnline(item)) return "";
        const pluginUrl = carreras_ajax.plugin_url;
        return `<span class="bc-modalidad"><img src="${pluginUrl}/iconoir_internet.svg" alt="">100% Online</span>`;
    }

    // Etiqueta del tipo de carrera (reemplaza a la de escuela): negra para
    // Profesional, amarilla para Técnica (maqueta "Badge tipo de carrera").
    function renderTipos(item) {
        const tipos = (item.tipo || []).map(normalizar);
        const badges = [];
        if (tipos.includes("profesional")) badges.push('<span class="bc-tipo bc-tipo-profesional">Carrera Profesional</span>');
        if (tipos.includes("tecnica")) badges.push('<span class="bc-tipo bc-tipo-tecnica">Carrera Técnica</span>');
        return `<span class="bc-tipos${badges.length ? "" : " bc-tipos-vacio"}">${badges.join("")}</span>`;
    }

    function renderCard(item) {
        if (vistaActual === "list") return renderCardList(item);

        return `
            <div class="bc-card">
                <div class="bc-card-body">
                    ${renderTipos(item)}
                    <h3><a href="${item.local_link || item.link}">${item.title}</a></h3>
                    <p class="bc-duracion">Duración: ${item.duracion || "N/A"}</p>
                    ${renderModalidad(item)}
                </div>
                <div class="bc-card-footer">
                    <a class="bc-ver-carrera" href="${item.local_link || item.link}">Ver Carrera</a>
                </div>
            </div>
        `;
    }

    function renderCardList(item) {
        return `
            <div class="bc-row">
                <div class="bc-row-titulo">
                    <h3><a href="${item.local_link || item.link}">${item.title}</a></h3>
                </div>
                ${renderTipos(item)}
                <p class="bc-duracion">Duración: ${item.duracion || "N/A"}</p>
                <div class="bc-row-modalidad">${renderModalidad(item)}</div>
                <a class="bc-ver-carrera" href="${item.local_link || item.link}">Ver Carrera</a>
            </div>
        `;
    }

    function actualizarResultados() {
        sincronizarURL();
        ultimosResultados = filtrar();
        mostrandoTodo = false;
        renderResultados();
    }

    function renderResultados() {
        const resultados = ultimosResultados;
        // Con un solo tipo marcado el conteo lo nombra; si no, "Carreras".
        let etiquetaTipo = resultados.length === 1 ? "Carrera" : "Carreras";
        if (seleccion.tipo.size === 1) {
            const solo = [...seleccion.tipo][0];
            etiquetaTipo = solo === "profesional"
                ? (resultados.length === 1 ? "Carrera Profesional" : "Carreras Profesionales")
                : (resultados.length === 1 ? "Carrera Técnica" : "Carreras Técnicas");
        }

        $("#bc-resultados-count").text(`${resultados.length} ${etiquetaTipo}`);
        $(".bc-ver-mas-wrapper").remove();

        if (!resultados.length) {
            $("#resultados-carreras").html("<p class=\"bc-sin-resultados\">No se encontraron carreras</p>");
            return;
        }

        const visibles = mostrandoTodo ? resultados : resultados.slice(0, FILAS_INICIALES_ITEMS);
        $("#resultados-carreras").html(visibles.map(renderCard).join(""));

        if (!mostrandoTodo && resultados.length > FILAS_INICIALES_ITEMS) {
            $("#resultados-carreras").after(`
                <div class="bc-ver-mas-wrapper">
                    <button type="button" class="bc-btn-ver-mas">Ver más resultados</button>
                </div>
            `);
        }
    }

    $(document).on("click", ".bc-btn-ver-mas", function () {
        mostrandoTodo = true;
        renderResultados();
    });

    // Búsqueda en vivo: se actualizan los resultados a medida que se escribe
    // (con una pequeña espera para no recalcular en cada tecla).
    let temporizadorBusqueda = null;
    $("#carrera-search").on("input", function () {
        clearTimeout(temporizadorBusqueda);
        temporizadorBusqueda = setTimeout(actualizarResultados, 200);
    });

    $("#carrera-search").on("keypress", function (e) {
        if (e.which === 13) {
            e.preventDefault();
            actualizarResultados();
        }
    });

    $(".bc-btn-buscar").on("click", actualizarResultados);
    $(".bc-search-box img").on("click", actualizarResultados);

    $(".bc-btn-limpiar").on("click", function () {
        $("#carrera-search").val("");
        $("#buscador-carreras input[type=checkbox]").prop("checked", false);
        $("#bc-modalidad-todas, #bc-tipo-todas, #buscador-carreras [data-todas]").prop("checked", true);
        seleccion.modalidad.clear();
        seleccion.tipo.clear();
        seleccion.escuela.clear();
        seleccion.sede.clear();
        seleccion.jornada.clear();
        actualizarResultados();
    });

    // Antes los filtros abiertos se cerraban solos al hacer click en
    // cualquier otro lugar de la página; se pidió sacar ese comportamiento
    // (ahora solo se cierran si se vuelve a hacer click en su propio
    // encabezado, como el resto de los acordeones del sitio).
});

