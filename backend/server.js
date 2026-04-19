import cors from "cors";
import puppeteer from "puppeteer";
import express from "express";
import dotenv from "dotenv";
import fileUpload from "express-fileupload";
import { supabase } from "./config/supabase.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload());

// 👉 HOME
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// 👉 TEST DB
app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase.from("categorias").select("*");
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

// 👉 SUBIR IMAGEN
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.imagen) {
      return res.status(400).json({ error: "No hay imagen" });
    }

    const file = req.files.imagen;
    const safeName = file.name.replace(/\s+/g, "_");
    const fileName = Date.now() + "-" + safeName;

    const { error } = await supabase.storage
      .from("productos")
      .upload(fileName, file.data, {
        contentType: file.mimetype,
        upsert: true
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

// 👉 PRODUCTOS
app.post("/productos", async (req, res) => {
  const { nombre, precio, imagen_url, categoria_id, destacado, oferta } = req.body;

  const { data, error } = await supabase
    .from("productos")
    .insert([{ nombre, precio, imagen_url, categoria_id, destacado, oferta }])
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

app.get("/productos", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`*, categorias(nombre)`);

  if (error) return res.status(500).json(error);
  res.json(data);
});

app.delete("/productos/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("productos")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);
  res.json({ ok: true });
});

app.put("/productos/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, categoria_id, destacado, oferta, imagen_url } = req.body;

  const updateData = {
    nombre,
    precio,
    categoria_id,
    destacado,
    oferta
  };

  if (imagen_url) updateData.imagen_url = imagen_url;

  const { data, error } = await supabase
    .from("productos")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

// 👉 PDF PRO (ARREGLADO EN SERIO)
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
    <meta charset="UTF-8">
    <style>
      body {
        font-family: Arial;
        padding: 10px;
        background: #f5f7fb;
      }

      .header {
        text-align: center;
        background: #1976d2;
        color: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
      }

      h2 {
        margin-top: 20px;
        background: #1976d2;
        color: white;
        padding: 6px;
        border-radius: 5px;
      }

      .grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .card {
        width: 30%;
        background: white;
        border-radius: 8px;
        padding: 8px;
        text-align: center;
        position: relative;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        page-break-inside: avoid;
      }

      .card img {
        width: 100%;
        height: 100px;
        object-fit: contain;
      }

      .nombre {
        font-weight: bold;
        font-size: 13px;
      }

      .precio {
        color: green;
        font-weight: bold;
        font-size: 14px;
      }

      .badge {
        position: absolute;
        top: 5px;
        left: 5px;
        font-size: 10px;
        padding: 3px 6px;
        border-radius: 4px;
        color: white;
      }

      .oferta { background: red; }
      .destacado { background: orange; color: black; }

    </style>
  </head>

  <body>

  <div class="header">
    <h1>DistriWest</h1>
    <p>Catálogo</p>
  </div>
  `;

  for (const categoria in agrupados) {
    html += `<h2>${categoria}</h2><div class="grid">`;

    agrupados[categoria].forEach(p => {
      html += `
        <div class="card">
          ${p.oferta ? '<div class="badge oferta">OFERTA</div>' : ''}
          ${p.destacado ? '<div class="badge destacado">TOP</div>' : ''}
          <img src="${p.imagen_url}" />
          <div class="nombre">${p.nombre}</div>
          <div class="precio">$${p.precio}</div>
        </div>
      `;
    });

    html += `</div>`;
  }

  html += `</body></html>`;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  // 🔥 CLAVE (esto te arregla TODO)
  await page.setViewport({ width: 1200, height: 1600 });
  await page.emulateMediaType("screen");

  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm" }
  });

  await browser.close();

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=DistriWest.pdf"
  });

  res.send(pdf);
});

// 👉 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});