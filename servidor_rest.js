var express = require("express");
var cors = require("cors");
var app = express();
const jwt = require('jwt-simple');
const secreto = 'clave_secreta_telemedicina_ua';

// 1. Importar el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// 2. Configurar con tu URL y tu Public Key (anon key)
const supabaseUrl = 'https://lymvozfvaudatjwmpbgw.supabase.co';
const supabaseKey = 'sb_publishable_ebiTV3UhXXWarDZ4qTdk_g_J954MqaO';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());
app.use(express.static('cliente_rest'));

// --- RUTA DE LOGIN ---
app.post("/api/gestores/login", async (req, res) => {
    var login = req.body.login;
    var password = req.body.password;

    try {
        const { data: gestores, error } = await supabase
            .from('gestores')
            .select('id')
            .eq('usuario', login)
            .eq('password', password);

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }

        if (gestores.length > 0) {
            var idGestor = gestores[0].id;
            var token = jwt.encode(idGestor, secreto);
            res.status(200).json({ id: idGestor, token: token });
        } else {
            res.status(401).json("Credenciales incorrectas");
        }
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- REGISTRO DE GESTOR ---
app.post("/api/gestores", async (req, res) => {
    var gestor = req.body;

    try {
        const { data, error } = await supabase
            .from('gestores')
            .insert([{
                nombre: gestor.nombre,
                apellidos: gestor.apellidos,
                usuario: gestor.usuario,
                password: gestor.password
            }])
            .select();

        if (error) {
            console.log("Error al realizar el insert", error);
            if (error.code === '23505') {
                return res.status(400).json({ error: "Usuario ya existe" });
            }
            return res.status(500).json("Error al realizar la insercion");
        }

        res.status(201).json(data[0].id);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- MIDDLEWARE JWT: Todas las rutas debajo requieren ?token=... ---
app.use('/api', function(req, res, next) {
    var token = req.query.token;
    if (!token) {
        return res.status(401).json("Falta el token");
    }
    try {
        var decoded = jwt.decode(token, secreto);
        next();
    } catch (err) {
        return res.status(403).json("Token no válido");
    }
});

// --- ACTUALIZAR GESTOR ---
app.put("/api/gestores/:id", async (req, res) => {
    var idGestor = req.params.id;
    var gestor = req.body;

    try {
        const { data, error } = await supabase
            .from('gestores')
            .update({
                nombre: gestor.nombre,
                apellidos: gestor.apellidos,
                usuario: gestor.usuario,
                password: gestor.password
            })
            .eq('id', idGestor)
            .select();

        if (error) {
            console.log("Error al realizar el update", error);
            if (error.code === '23505') {
                return res.status(400).json({ error: "Usuario ya existe" });
            }
            return res.status(500).json("Error al realizar la actualización");
        }

        res.status(200).json("Gestor actualizado");
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- OBTENER UN GESTOR POR ID ---
app.get("/api/gestores/:id", async (req, res) => {
    var idGestor = req.params.id;

    try {
        const { data: gestores, error } = await supabase
            .from('gestores')
            .select('id, nombre, apellidos, usuario')
            .eq('id', idGestor);

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }

        if (gestores.length === 1) {
            res.status(200).json(gestores[0]);
        } else {
            res.status(404).json("No se ha encontrado el gestor");
        }
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- OBTENER UN SANITARIO POR ID ---
app.get("/api/sanitarios/:id", async (req, res) => {
    var idSanitario = req.params.id;

    try {
        const { data: sanitarios, error } = await supabase
            .from('sanitarios')
            .select('id, nombre, apellidos, usuario')
            .eq('id', idSanitario);

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }

        if (sanitarios.length === 1) {
            res.status(200).json(sanitarios[0]);
        } else {
            res.status(404).json("No se ha encontrado el sanitario");
        }
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- MAESTROS: UBICACIONES, CATEGORIAS Y MODELOS ---
app.get("/api/ubicaciones", async (req, res) => {
    try {
        const { data: ubicaciones, error } = await supabase
            .from('ubicaciones')
            .select('*');

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.json(ubicaciones);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

app.get("/api/categorias", async (req, res) => {
    try {
        const { data: categorias, error } = await supabase
            .from('categorias')
            .select('*');

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.json(categorias);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

app.get("/api/modelos", async (req, res) => {
    try {
        const { data: modelos, error } = await supabase
            .from('modelos')
            .select('*');

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.json(modelos);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- OBTENER RECURSOS CON FILTROS ---
app.get("/api/recursos", async (req, res) => {
    try {
        let query = supabase.from('recursos').select('*');

        // Si filtran por categoría, primero buscamos los IDs de los modelos de esa categoría
        if (req.query.categoria && req.query.categoria !== 'Todos') {
            const { data: modelosCat, error: errMod } = await supabase
                .from('modelos')
                .select('id')
                .eq('categoria', req.query.categoria);

            if (errMod) {
                return res.status(500).json("Error al realizar la consulta");
            }
            const idsModelos = modelosCat.map(m => m.id);
            query = query.in('modelo', idsModelos);
        }

        if (req.query.modelo && req.query.modelo !== 'Todos') {
            query = query.eq('modelo', req.query.modelo);
        }

        if (req.query.ubicacion && req.query.ubicacion !== 'Todos') {
            query = query.eq('ubicacion', req.query.ubicacion);
        }

        if (req.query.estado && req.query.estado !== 'Todos') {
            query = query.eq('estado', req.query.estado);
        }

        const { data: recursos, error } = await query;

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }

        res.json(recursos);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- OBTENER UN RECURSO POR ID ---
app.get("/api/recursos/:id", async (req, res) => {
    var idRecurso = req.params.id;

    try {
        const { data: recursos, error } = await supabase
            .from('recursos')
            .select('*')
            .eq('id', idRecurso);

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }

        if (recursos.length === 1) {
            res.status(200).json(recursos[0]);
        } else {
            res.status(404).json("No se ha encontrado el recurso");
        }
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- CREAR UN RECURSO ---
app.post("/api/recursos", async (req, res) => {
    var recurso = req.body;

    try {
        const { data, error } = await supabase
            .from('recursos')
            .insert([{
                modelo: recurso.modelo,
                ubicacion: recurso.ubicacion,
                numero_serie: recurso.numero_serie,
                estado: recurso.estado
            }])
            .select();

        if (error) {
            console.log("Error al realizar el insert", error);
            return res.status(500).json("Error al realizar la insercion");
        }

        res.status(201).json(data[0].id);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- ACTUALIZAR UN RECURSO ---
app.put("/api/recursos/:id", async (req, res) => {
    var idRecurso = req.params.id;
    var recurso = req.body;

    try {
        const { data, error } = await supabase
            .from('recursos')
            .update({
                modelo: recurso.modelo,
                ubicacion: recurso.ubicacion,
                numero_serie: recurso.numero_serie,
                estado: recurso.estado
            })
            .eq('id', idRecurso)
            .select();

        if (error) {
            console.log("Error al realizar el update", error);
            return res.status(500).json("Error al realizar la actualización");
        }

        if (!data || data.length === 0) {
            res.status(404).json("No se ha encontrado el recurso");
        } else {
            res.status(200).json("Recurso actualizado");
        }
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- BORRAR UN RECURSO ---
app.delete("/api/recursos/:id", async (req, res) => {
    var idRecurso = req.params.id;

    try {
        const { data, error } = await supabase
            .from('recursos')
            .delete()
            .eq('id', idRecurso)
            .select();

        if (error) {
            console.log("Error al realizar el delete", error);
            return res.status(500).json("Error al realizar el borrado");
        }

        if (!data || data.length === 0) {
            res.status(404).json("No se ha encontrado el recurso");
        } else {
            res.status(200).json("Recurso eliminado");
        }
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- OBTENER RESERVAS DE UN RECURSO ---
app.get("/api/recursos/:id/reservas", async (req, res) => {
    var idRecurso = req.params.id;

    try {
        // Hacemos el select trayendo también el nombre y apellidos de la tabla relacionada 'sanitarios'
        const { data: reservas, error } = await supabase
            .from('reservas')
            .select('*, sanitarios(nombre, apellidos)')
            .eq('recurso', idRecurso);

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }

        // Formateamos nombreSanitario para que el cliente main.js lo reciba igual que antes
        const reservasFormateadas = reservas.map(r => ({
            ...r,
            nombreSanitario: r.sanitarios ? `${r.sanitarios.nombre} ${r.sanitarios.apellidos}` : '-'
        }));

        res.json(reservasFormateadas);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- OBTENER RESEÑAS DE UN RECURSO ---
app.get("/api/recursos/:id/resenyas", async (req, res) => {
    var idRecurso = req.params.id;

    try {
        const { data: resenyas, error } = await supabase
            .from('resenyas')
            .select('*, sanitarios(nombre, apellidos)')
            .eq('recurso', idRecurso);

        if (error) {
            console.log("Error al realizar la select", error);
            return res.status(500).json("Error al realizar la consulta");
        }

        const resenyasFormateadas = resenyas.map(r => ({
            ...r,
            nombreSanitario: r.sanitarios ? `${r.sanitarios.nombre} ${r.sanitarios.apellidos}` : '-'
        }));

        res.json(resenyasFormateadas);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

// --- CREAR UNA CALIBRACIÓN ---
app.post("/api/calibraciones", async (req, res) => {
    var calibracion = req.body;

    try {
        const { data, error } = await supabase
            .from('calibraciones')
            .insert([{
                fecha: new Date().toISOString(),
                superado: calibracion.superado,
                observaciones: calibracion.observaciones,
                recurso: calibracion.recurso
            }])
            .select();

        if (error) {
            console.log("Error al realizar el insert", error);
            return res.status(500).json("Error al realizar la insercion");
        }

        res.status(201).json(data[0].id);
    } catch (err) {
        res.status(500).json("Error en el servidor");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log("Servidor REST de Telemedicina en el puerto " + PORT);
});
