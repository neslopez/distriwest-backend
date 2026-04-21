console.log("🔥 VERSION FINAL PRO PDF 🔥");

import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
import PDFDocument from "pdfkit";
import fetch from "node-fetch";
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

// ==========================
// 📄 PDF NIVEL EMPRESA
// ==========================
app.get("/generar-pdf", async (req, res) => {
  try {
    const { data: productos } = await supabase
      .from("productos")
      .select(`*, categorias(nombre)`);

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=catalogo.pdf");

    doc.pipe(res);

    // 🟦 PORTADA
    doc
      .fontSize(34)
      .fillColor("#0d47a1")
      .text("DISTRIWEST", { align: "center" });

    doc.moveDown();

    doc
      .fontSize(16)
      .fillColor("#333")
      .text("Distribuidora Mayorista", { align: "center" });

    doc.moveDown(6);

    doc
      .fontSize(12)
      .fillColor("#777")
      .text("Catálogo de productos", { align: "center" });

    doc.moveDown();

    doc
      .fontSize(10)
      .fillColor("#999")
      .text("Actualizado: " + new Date().toLocaleDateString(), {
        align: "center"
      });

    doc.addPage();

    // 🔹 AGRUPAR
    const agrupados = {};
    productos.forEach(p => {
      const cat = p.categorias?.nombre || "Sin categoría";
      if (!agrupados[cat]) agrupados[cat] = [];
      agrupados[cat].push(p);
    });

    // 🔹 RECORRER
    for (const categoria of Object.keys(agrupados)) {

      doc
        .fontSize(22)
        .fillColor("#0d47a1")
        .text(categoria);

      doc.moveDown();

      const productosCat = agrupados[categoria];

      const CARD_WIDTH = 160;
      const CARD_HEIGHT = 170;
      const GAP = 20;

      let col = 0;
      let x = 40;
      let y = doc.y;

      // 👉 CENTRADO AUTOMÁTICO
      const itemsFila = Math.min(3, productosCat.length);
      const totalWidth = itemsFila * CARD_WIDTH + (itemsFila - 1) * GAP;
      const offsetX = (500 - totalWidth) / 2;

      x += offsetX;

      for (const [index, p] of productosCat.entries()) {

        // SOMBRA
        doc
          .rect(x + 3, y + 3, CARD_WIDTH, CARD_HEIGHT)
          .fillOpacity(0.05)
          .fill("#000")
          .fillOpacity(1);

        // CARD
        doc
          .roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 12)
          .stroke("#ddd");

        // IMAGEN
        if (p.imagen_url) {
          try {
            const response = await fetch(p.imagen_url);
            const buffer = await response.arrayBuffer();

            doc.image(Buffer.from(buffer), x + 20, y + 10, {
              width: 120,
              height: 70
            });
          } catch {}
        }

        // BADGES
        if (p.oferta) {
          doc.rect(x + 5, y + 5, 50, 15).fill("#e53935");
          doc.fillColor("white").fontSize(8).text("OFERTA", x + 10, y + 8);
          doc.fillColor("black");
        }

        if (p.destacado) {
          doc.rect(x + CARD_WIDTH - 55, y + 5, 50, 15).fill("#fb8c00");
          doc.fillColor("white").fontSize(8).text("TOP", x + CARD_WIDTH - 45, y + 8);
          doc.fillColor("black");
        }

        // NOMBRE
        doc
          .fontSize(11)
          .fillColor("#000")
          .text(p.nombre, x + 10, y + 95, {
            width: CARD_WIDTH - 20,
            align: "center"
          });

        // PRECIO (PROTAGONISTA)
        doc
          .fontSize(18)
          .fillColor("#2e7d32")
          .text(`$${p.precio}`, x + 10, y + 115, {
            width: CARD_WIDTH - 20,
            align: "center"
          });

        // CATEGORIA
        doc
          .fontSize(8)
          .fillColor("#777")
          .text(categoria, x + 10, y + 140, {
            width: CARD_WIDTH - 20,
            align: "center"
          });

        // GRID
        col++;

        if (col === 3) {
          col = 0;
          x = 40 + offsetX;
          y += CARD_HEIGHT + GAP;
        } else {
          x += CARD_WIDTH + GAP;
        }

        // NUEVA PAGINA
        if (y > 700 && index !== productosCat.length - 1) {
          doc.addPage();

          doc
            .fontSize(22)
            .fillColor("#0d47a1")
            .text(categoria);

          doc.moveDown();

          x = 40 + offsetX;
          y = doc.y;
          col = 0;
        }
      }

      doc.addPage();
    }

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