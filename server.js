console.log("🔥 SERVER NUEVO CARGADO");

import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
import PDFDocument from "pdfkit";
import { supabase } from "./backend/config/supabase.js";

const app = express();

// 🔧 CONFIG
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


// 📄 PDF PROFESIONAL
//import PDFDocument from "pdfkit";

app.get("/generar-pdf", async (req, res) => {
  try {
    const { data: productos } = await supabase
      .from("productos")
      .select(`*, categorias(nombre)`);

    // 🔥 AGRUPAR POR CATEGORIA
    const categorias = {};

    productos.forEach(p => {
      const cat = p.categorias?.nombre || "Sin categoría";
      if (!categorias[cat]) categorias[cat] = [];
      categorias[cat].push(p);
    });

    const doc = new PDFDocument({ margin: 30 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=catalogo.pdf");

    doc.pipe(res);

    // 🎯 HEADER
    doc
      .fontSize(22)
      .fillColor("#0d47a1")
      .text("DISTRIWEST", { align: "center" });

    doc
      .fontSize(12)
      .fillColor("gray")
      .text("Distribuidora Mayorista", { align: "center" });

    doc.moveDown(2);

    let pageX = 30;
    let pageY = 120;
    let col = 0;
    let row = 0;
    let count = 0;

    const CARD_WIDTH = 170;
    const CARD_HEIGHT = 150;

    Object.keys(categorias).forEach(cat => {

      // 🧱 NUEVA PÁGINA POR CATEGORÍA
      doc.addPage();

      // 📦 TITULO CATEGORIA
      doc
        .fontSize(16)
        .fillColor("#0d47a1")
        .text(cat, 30, 40);

      pageX = 30;
      pageY = 80;
      col = 0;
      row = 0;
      count = 0;

      categorias[cat].forEach(p => {

        // 📄 SALTO CADA 9 PRODUCTOS
        if (count === 9) {
          doc.addPage();

          doc
            .fontSize(16)
            .fillColor("#0d47a1")
            .text(cat, 30, 40);

          pageX = 30;
          pageY = 80;
          col = 0;
          row = 0;
          count = 0;
        }

        const x = pageX + col * (CARD_WIDTH + 10);
        const y = pageY + row * (CARD_HEIGHT + 10);

        // 🧱 CARD
        doc
          .roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 10)
          .stroke("#cccccc");

        // 🏷 NOMBRE
        doc
          .fontSize(11)
          .fillColor("black")
          .text(p.nombre, x + 10, y + 10, {
            width: CARD_WIDTH - 20,
            align: "center"
          });

        // 💰 PRECIO
        doc
          .fontSize(12)
          .fillColor("#2e7d32")
          .text(`$${p.precio}`, x + 10, y + 30, {
            align: "center"
          });

        // 🔥 BADGES
        if (p.oferta) {
          doc
            .fontSize(8)
            .fillColor("white")
            .rect(x + 5, y + 5, 45, 12)
            .fill("#e53935")
            .fillColor("white")
            .text("OFERTA", x + 8, y + 7);
        }

        if (p.destacado) {
          doc
            .fontSize(8)
            .fillColor("white")
            .rect(x + CARD_WIDTH - 50, y + 5, 40, 12)
            .fill("#fb8c00")
            .fillColor("white")
            .text("TOP", x + CARD_WIDTH - 45, y + 7);
        }

        // 📦 CATEGORIA
        doc
          .fontSize(8)
          .fillColor("gray")
          .text(p.categorias?.nombre || "", x + 10, y + 110, {
            align: "center"
          });

        // 📅 FECHA
        doc
          .fontSize(7)
          .fillColor("gray")
          .text(new Date().toLocaleDateString(), x + 10, y + 125, {
            align: "center"
          });

        // ➡️ POSICIONAMIENTO GRID
        col++;

        if (col === 3) {
          col = 0;
          row++;
        }

        count++;
      });
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