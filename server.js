console.log("🔥 SERVER NUEVO CARGADO");
import dotenv from "dotenv";

// 🔥 CARGAR VARIABLES (IMPORTANTE)
dotenv.config({ path: "./backend/.env" });

import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
//import puppeteer from "puppeteer-core";
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
import PDFDocument from "pdfkit";

app.get("/generar-pdf", async (req, res) => {
  try {
    const { data: productos } = await supabase
      .from("productos")
      .select(`*, categorias(nombre)`);

    const doc = new PDFDocument({ margin: 30 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=catalogo.pdf");

    doc.pipe(res);

    // 🎯 HEADER
    doc
      .fontSize(20)
      .text("DISTRIWEST", { align: "center" });

    doc
      .fontSize(12)
      .text("Distribuidora Mayorista", { align: "center" });

    doc.moveDown();

    let x = 30;
    let y = 100;
    let count = 0;

    productos.forEach((p) => {

      // 📄 NUEVA PÁGINA CADA 9 PRODUCTOS
      if (count === 9) {
        doc.addPage();
        x = 30;
        y = 100;
        count = 0;
      }

      // 🧱 CAJA
      doc.rect(x, y, 150, 120).stroke();

      // 🏷 NOMBRE
      doc.fontSize(10).text(p.nombre, x + 5, y + 5);

      // 💰 PRECIO
      doc.text("$" + p.precio, x + 5, y + 20);

      // 🔥 BADGES
      if (p.oferta) doc.fillColor("red").text("OFERTA", x + 5, y + 35).fillColor("black");
      if (p.destacado) doc.fillColor("orange").text("TOP", x + 5, y + 50).fillColor("black");

      // 📦 CATEGORÍA
      doc.fontSize(8).text(p.categorias?.nombre || "", x + 5, y + 70);

      // 📅 FECHA
      doc.text(new Date().toLocaleDateString(), x + 5, y + 85);

      x += 170;

      if (x > 400) {
        x = 30;
        y += 140;
      }

      count++;
    });

    doc.end();

  } catch (err) {
    console.log("ERROR PDF:", err);
    res.status(500).send("Error generando PDF");
  }
});
// 🚀 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en puerto", PORT);
});