console.log("🔥 VERSION NUEVA PDF 🔥");

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

    // HEADER
    doc
      .fontSize(22)
      .fillColor("#0d47a1")
      .text("DISTRIWEST", { align: "center" });

    doc
      .fontSize(12)
      .fillColor("gray")
      .text("Distribuidora Mayorista", { align: "center" });

    doc.moveDown(2);

    const CARD_W = 170;
    const CARD_H = 180;

    Object.keys(categorias).forEach(cat => {

      doc.addPage();

      doc
        .fontSize(16)
        .fillColor("#0d47a1")
        .text(cat, 30, 40);

      let col = 0;
      let row = 0;
      let count = 0;

      categorias[cat].forEach(p => {

        if (count === 9) {
          doc.addPage();
          doc.fontSize(16).fillColor("#0d47a1").text(cat, 30, 40);
          col = 0;
          row = 0;
          count = 0;
        }

        const x = 30 + col * (CARD_W + 10);
        const y = 80 + row * (CARD_H + 10);

        // CARD
        doc
          .roundedRect(x, y, CARD_W, CARD_H, 10)
          .stroke("#cccccc");

        // 🔴 BADGES
        if (p.oferta) {
          doc
            .rect(x + 8, y + 8, 50, 14)
            .fill("#e53935")
            .fillColor("white")
            .fontSize(8)
            .text("OFERTA", x + 12, y + 11);
        }

        if (p.destacado) {
          doc
            .rect(x + CARD_W - 58, y + 8, 45, 14)
            .fill("#fb8c00")
            .fillColor("white")
            .fontSize(8)
            .text("TOP", x + CARD_W - 52, y + 11);
        }

        // 🖼 IMAGEN
        if (p.imagen_url) {
          try {
            doc.image(p.imagen_url, x + 35, y + 30, {
              width: 100,
              height: 80,
              fit: [100, 80],
              align: "center"
            });
          } catch (e) {
            // si falla la imagen no rompe
          }
        }

        // 🏷 NOMBRE
        doc
          .fontSize(11)
          .fillColor("black")
          .text(p.nombre, x + 10, y + 115, {
            width: CARD_W - 20,
            align: "center"
          });

        // 💰 PRECIO (BIEN CENTRADO)
        doc
          .fontSize(13)
          .fillColor("#2e7d32")
          .text(`$${p.precio}`, x + 10, y + 135, {
            width: CARD_W - 20,
            align: "center"
          });

        // 📦 CATEGORIA
        doc
          .fontSize(8)
          .fillColor("gray")
          .text(p.categorias?.nombre || "", x + 10, y + 155, {
            width: CARD_W - 20,
            align: "center"
          });

        // GRID
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