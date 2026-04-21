console.log("🔥 ESTE ES EL SERVER REAL 🔥");
import dotenv from "dotenv";

// 🔥 CARGAR VARIABLES (IMPORTANTE)
dotenv.config({ path: "./backend/.env" });

import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
import puppeteer from "puppeteer-core";
import { supabase } from "./backend/config/supabase.js";

const app = express();

// 🔧 CONFIGURACIÓN RAILWAY
app.set("trust proxy", 1);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use(fileUpload());

// 🏠 HOME
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// 📂 CATEGORIAS
app.get("/categorias", async (req, res) => {
  const { data, error } = await supabase.from("categorias").select("*");
  if (error) return res.status(500).json(error);
  res.json(data);
});

app.post("/categorias", async (req, res) => {
  const { nombre } = req.body;

  const { data, error } = await supabase
    .from("categorias")
    .insert([{ nombre }])
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

// 📦 PRODUCTOS
app.get("/productos", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`*, categorias(nombre)`);

  if (error) return res.status(500).json(error);
  res.json(data);
});

app.post("/productos", async (req, res) => {
  const { nombre, precio, imagen_url, categoria_id, destacado, oferta } = req.body;

  const { data, error } = await supabase
    .from("productos")
    .insert([{ nombre, precio, imagen_url, categoria_id, destacado, oferta }])
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

app.put("/productos/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("productos")
    .update(req.body)
    .eq("id", id);

  if (error) return res.status(500).json(error);
  res.json({ ok: true });
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

// 📤 SUBIR IMAGEN
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

// 📄 GENERAR PDF
app.get("/generar-pdf", async (req, res) => {

  const { data, error } = await supabase
    .from("productos")
    .select(`*, categorias(nombre)`);

  if (error) return res.status(500).json(error);

  // 🔥 ORDEN INTELIGENTE
  data.sort((a, b) => {
    if (a.destacado && !b.destacado) return -1;
    if (!a.destacado && b.destacado) return 1;
    if (a.oferta && !b.oferta) return -1;
    if (!a.oferta && b.oferta) return 1;
    return 0;
  });

  // 🧠 AGRUPAR
  const agrupados = {};
  data.forEach(p => {
    const cat = p.categorias?.nombre || "Sin categoría";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(p);
  });

  const fecha = new Date().toLocaleDateString();

  let html = `
  <html>
  <head>
    <style>
      body {
        font-family: Arial;
        padding:20px;
      }

      .portada {
        display:flex;
        height:90vh;
        align-items:center;
        justify-content:center;
        flex-direction:column;
        page-break-after: always;
      }

      .portada h1 {
        font-size:50px;
        color:#1976d2;
      }

      .portada p {
        font-size:18px;
      }

      .fecha {
        margin-top:20px;
        font-size:14px;
        color:#666;
      }

      .categoria {
        page-break-before: always;
      }

      h2 {
        border-bottom:3px solid #1976d2;
      }

      .grid {
        display:grid;
        grid-template-columns: repeat(3, 1fr);
        gap:15px;
      }

      .card {
        border:1px solid #ddd;
        border-radius:10px;
        padding:10px;
        text-align:center;
        position:relative;
        height:250px;
      }

      img {
        width:100%;
        height:120px;
        object-fit:contain;
      }

      .precio {
        color:green;
        font-weight:bold;
      }

      .badge {
        position:absolute;
        top:5px;
        left:5px;
        color:white;
        padding:3px 6px;
        font-size:10px;
        border-radius:5px;
      }

      .oferta { background:red; }
      .destacado { background:orange; }

      .card {
        page-break-inside: avoid;
      }
    </style>
  </head>

  <body>

  <div class="portada">
    <h1>DistriWest</h1>
    <p>Catálogo de Productos</p>
    <div class="fecha">Fecha: ${fecha}</div>
  </div>
  `;

  for (const categoria in agrupados) {
    html += `<div class="categoria">`;
    html += `<h2>${categoria}</h2>`;
    html += `<div class="grid">`;

    agrupados[categoria].forEach((p, i) => {

      // 🔥 CORTE CADA 9 PRODUCTOS
      if (i > 0 && i % 9 === 0) {
        html += `</div></div><div class="categoria"><h2>${categoria}</h2><div class="grid">`;
      }

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
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});

  const page = await browser.newPage();

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
// 🚀 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en puerto", PORT);
});