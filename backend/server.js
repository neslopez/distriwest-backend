import multer from "multer";
import cors from "cors";
import puppeteer from "puppeteer";
import express from "express";
import dotenv from "dotenv";
import { supabase } from "./config/supabase.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/uploads", express.static("backend/uploads"));
app.use(cors());
const storage = multer.diskStorage({
  destination: "backend/uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// 👉 HOME
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// 👉 PRUEBA DB
app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase
    .from("categorias")
    .select("*");

  if (error) return res.status(500).json(error);

  res.json(data);
});

// 👉 CREAR CATEGORIA
app.post("/categorias", async (req, res) => {
  const { nombre } = req.body;

  const { data, error } = await supabase
    .from("categorias")
    .insert([{ nombre }])
    .select();

  if (error) return res.status(500).json(error);

  res.json(data);
});

app.post("/upload", upload.single("imagen"), (req, res) => {
  const url = `http://localhost:3000/uploads/${req.file.filename}`;
  res.json({ url });
});

app.post("/productos", async (req, res) => {
  const { nombre, precio, imagen_url, categoria_id, destacado, oferta } = req.body;

  const { data, error } = await supabase
    .from("productos")
    .insert([
      {
        nombre,
        precio,
        imagen_url,
        categoria_id,
        destacado,
        oferta
      }
    ])
    .select();

  if (error) return res.status(500).json(error);

  res.json(data);
});

// 👉 LISTAR PRODUCTOS
app.get("/productos", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`
      *,
      categorias(nombre)
    `);

  if (error) return res.status(500).json(error);

  res.json(data);
});

// 👉 ELIMINAR PRODUCTO
app.delete("/productos/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ mensaje: "Producto eliminado" });
});

// 👉 EDITAR PRODUCTO
app.put("/productos/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, categoria_id, destacado, oferta, imagen_url } = req.body;

  // 👉 armamos objeto dinámico
  const updateData = {
    nombre,
    precio,
    categoria_id,
    destacado,
    oferta
  };

  // 👉 solo actualiza imagen si viene una nueva
  if (imagen_url) {
    updateData.imagen_url = imagen_url;
  }

  const { data, error } = await supabase
    .from("productos")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) return res.status(500).json(error);

  res.json(data);
});

// 👉 GENERAR PDF
app.get("/generar-pdf", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`
      *,
      categorias(nombre)
    `);

  if (error) return res.status(500).json(error);

  // 👉 AGRUPAR
  const agrupados = {};

  data.forEach(producto => {
    const categoria = producto.categorias?.nombre || "Sin categoría";

    if (!agrupados[categoria]) {
      agrupados[categoria] = [];
    }

    agrupados[categoria].push(producto);
  });



  // 👉 HTML BASE
  let html = `
    <html>
    <head>
      <style>
        body {
  font-family: Arial;
  padding: 20px;
  background: #f5f7fb;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(90deg, #1976d2, #42a5f5);
  color: white;
  border-radius: 10px;
}

.header h1 {
  margin: 0;
  font-size: 30px;
}

.header p {
  margin: 5px 0;
}

h2 {
  margin-top: 30px;
  padding: 10px;
  background: #1976d2;
  color: white;
  border-radius: 5px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.producto {
  background: white;
  border-radius: 12px;
  padding: 10px;
  text-align: center;
  position: relative;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.producto img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
}

.producto p {
  margin: 5px 0;
}

.precio {
  font-size: 16px;
  font-weight: bold;
  color: #2e7d32;
}

/* OFERTA */
.oferta {
  border: 2px solid #e53935;
  background: #ffecec;
}

/* DESTACADO */
.destacado {
  border: 2px solid #fbc02d;
  background: #fff8e1;
}

/* BADGES */
.badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 8px;
  font-size: 11px;
  color: white;
  border-radius: 6px;
}

.badge-oferta {
  background: #e53935;
}

.badge-destacado {
  background: #fbc02d;
  color: black;
}

      </style>

    </head>
    <body>
      <div class="header">
 <div class="header">
  <h1>DistriWest</h1>
  <p>Catálogo de productos</p>
  <span>${new Date().toLocaleDateString()}</span>
</div>
</div>
  `;

  // 👉 GENERAR CONTENIDO CORRECTO
  for (const categoria in agrupados) {
    const productos = agrupados[categoria];

    for (let i = 0; i < productos.length; i += 9) {
      const bloque = productos.slice(i, i + 9);

      html += `<h2>${categoria}</h2><div class="grid">`;

      bloque.forEach(p => {
        html += `
          <div class="producto ${p.oferta ? "oferta" : ""} ${p.destacado ? "destacado" : ""}">
            
            ${p.oferta ? '<div class="badge badge-oferta">OFERTA</div>' : ""}
            ${p.destacado ? '<div class="badge badge-destacado">TOP</div>' : ""}

            <img src="${p.imagen_url}" />
            <p>${p.nombre}</p>
            <p class="precio">$${p.precio}</p>

          </div>
        `;
      });

      html += `</div><div style="page-break-after: always;"></div>`;
    }
  }

  html += `</body></html>`;

  // 👉 GENERAR PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setContent(html);
  const pdf = await page.pdf({ format: "A4" });

  await browser.close();

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=catalogo.pdf"
  });

  res.send(pdf);
});

// 👉 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});