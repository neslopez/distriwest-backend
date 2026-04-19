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
app.use(fileUpload()); // ✅ BIEN ubicado

// 👉 HOME
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// 👉 TEST DB
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

// 👉 SUBIR IMAGEN (SUPABASE STORAGE)
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.imagen) {
      return res.status(400).json({ error: "No hay imagen" });
    }

    const file = req.files.imagen;

    const fileName = Date.now() + "-" + file.name;

    // 👉 subir a supabase
    const { error } = await supabase.storage
      .from("productos")
      .upload(fileName, file.data, {
        contentType: file.mimetype
      });

    if (error) {
      console.log("ERROR STORAGE:", error);
      return res.status(500).json(error);
    }

    // 👉 obtener URL pública REAL
    const { data } = supabase.storage
      .from("productos")
      .getPublicUrl(fileName);

    console.log("URL GENERADA:", data.publicUrl);

    res.json({
      url: data.publicUrl
    });

  } catch (err) {
    console.log("ERROR UPLOAD:", err);
    res.status(500).json({ error: "Error subiendo imagen" });
  }
});

// 👉 CREAR PRODUCTO
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

  const updateData = {
    nombre,
    precio,
    categoria_id,
    destacado,
    oferta
  };

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

  const agrupados = {};

  data.forEach(p => {
    const cat = p.categorias?.nombre || "Sin categoría";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(p);
  });

  let html = `
    <html>
    <body style="font-family: Arial; padding:20px;">
      <h1>DistriWest</h1>
  `;

  for (const categoria in agrupados) {
    html += `<h2>${categoria}</h2>`;

    agrupados[categoria].forEach(p => {
      html += `
        <div style="margin-bottom:10px;">
          <img src="${p.imagen_url}" width="100"/>
          <p>${p.nombre} - $${p.precio}</p>
        </div>
      `;
    });
  }

  html += `</body></html>`;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

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