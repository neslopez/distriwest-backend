import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import fileUpload from "express-fileupload";
import puppeteer from "puppeteer-core";
import { supabase } from "./config/supabase.js";

dotenv.config();

console.log("🔥 BACKEND INICIADO 🔥");
console.log("URL:", process.env.SUPABASE_URL);
console.log("KEY:", process.env.SUPABASE_KEY ? "OK" : "NO DEFINIDA");

const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload());

// HOME
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// TEST DB
app.get("/categorias", async (req, res) => {
  const { data, error } = await supabase.from("categorias").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

// CREAR CATEGORIA
app.post("/categorias", async (req, res) => {
  const { nombre } = req.body;

  const { data, error } = await supabase
    .from("categorias")
    .insert([{ nombre }])
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

// SUBIR IMAGEN
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.imagen) {
      return res.status(400).json({ error: "No hay imagen" });
    }

    const file = req.files.imagen;
    const fileName = Date.now() + "-" + file.name.replace(/\s+/g, "_");

    const { error } = await supabase.storage
      .from("productos")
      .upload(fileName, file.data, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) return res.status(500).json(error);

    const { data } = supabase.storage
      .from("productos")
      .getPublicUrl(fileName);

    res.json({ url: data.publicUrl });

  } catch (err) {
    res.status(500).json({ error: "Error subiendo imagen" });
  }
});

// CREAR PRODUCTO
app.post("/productos", async (req, res) => {
  const { nombre, precio, imagen_url, categoria_id, destacado, oferta } = req.body;

  const { data, error } = await supabase
    .from("productos")
    .insert([{ nombre, precio, imagen_url, categoria_id, destacado, oferta }])
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

// LISTAR PRODUCTOS
app.get("/productos", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`*, categorias(nombre)`);

  if (error) return res.status(500).json(error);
  res.json(data);
});

// ELIMINAR
app.delete("/productos/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);
  res.json({ ok: true });
});

// EDITAR
app.put("/productos/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const { error } = await supabase
    .from("productos")
    .update(data)
    .eq("id", id);

  if (error) return res.status(500).json(error);
  res.json({ ok: true });
});

// PDF PRO
app.get("/generar-pdf", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`*, categorias(nombre)`);

  if (error) return res.status(500).json(error);

  const agrupados = {};

  data.forEach(p => {
    const cat = p.categorias?.nombre || "Sin categoría";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(p);
  });

  let html = `
  <html>
  <head>
    <style>
      body { font-family: Arial; padding: 20px; }
      .portada {
        height: 90vh;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        page-break-after: always;
      }
      .portada h1 { font-size: 50px; color: #1976d2; }
      .categoria { page-break-before: always; }
      h2 { border-bottom: 3px solid #1976d2; padding-bottom: 5px; }
      .grid { display: flex; flex-wrap: wrap; gap: 10px; }
      .card {
        width: 30%;
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 10px;
        text-align: center;
        position: relative;
      }
      img { width: 100px; height: 100px; object-fit: contain; }
      .precio { color: green; font-weight: bold; }
      .badge {
        position: absolute;
        top: 5px;
        left: 5px;
        padding: 3px 6px;
        font-size: 10px;
        color: white;
        border-radius: 5px;
      }
      .oferta { background: red; }
      .destacado { background: orange; }
    </style>
  </head>
  <body>

  <div class="portada">
    <h1>DistriWest</h1>
    <p>Catálogo de Productos</p>
  </div>
  `;

  for (const categoria in agrupados) {
    html += `<div class="categoria">`;
    html += `<h2>${categoria}</h2>`;
    html += `<div class="grid">`;

    agrupados[categoria].forEach(p => {
      html += `
        <div class="card">
          ${p.oferta ? `<div class="badge oferta">OFERTA</div>` : ""}
          ${p.destacado ? `<div class="badge destacado">TOP</div>` : ""}
          <img src="${p.imagen_url}" />
          <p><b>${p.nombre}</b></p>
          <p class="precio">$${p.precio}</p>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  html += `</body></html>`;

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true
  });

  await browser.close();

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=DistriWest.pdf"
  });

  res.send(pdf);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});