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

  let html = `
  <html>
  <head>
    <style>
      body { font-family: Arial; padding:20px; }
      h1 { text-align:center; color:#1976d2; }
      .grid { display:flex; flex-wrap:wrap; gap:10px; }
      .card {
        width:30%;
        border:1px solid #ddd;
        border-radius:10px;
        padding:10px;
        text-align:center;
      }
      img { width:100px; height:100px; object-fit:contain; }
      .precio { color:green; font-weight:bold; }
      .oferta { color:red; font-size:12px; }
      .top { color:orange; font-size:12px; }
    </style>
  </head>
  <body>
  <h1>DistriWest</h1>
  <div class="grid">
  `;

  data.forEach(p => {
    html += `
      <div class="card">
        ${p.oferta ? "<div class='oferta'>OFERTA</div>" : ""}
        ${p.destacado ? "<div class='top'>TOP</div>" : ""}
        <img src="${p.imagen_url}" />
        <p><b>${p.nombre}</b></p>
        <p class="precio">$${p.precio}</p>
        <small>${p.categorias?.nombre || ""}</small>
      </div>
    `;
  });

  html += `</div></body></html>`;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.setContent(html);

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