console.log("🔥 VERSION FINAL EMPRESA PDF 🔥");

import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
import PDFDocument from "pdfkit";
import { supabase } from "./backend/config/supabase.js";

const app = express();

// CONFIG
app.set("trust proxy", 1);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use(fileUpload());

// HOME
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// ==========================
// 📂 CATEGORIAS
// ==========================
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

// ==========================
// 📦 PRODUCTOS
// ==========================
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

// ==========================
// 📤 SUBIR IMAGEN
// ==========================
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
// 📄 PDF NIVEL EMPRESA REAL (MEJORADO)
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

    // ================= PORTADA =================
    doc.rect(0, 0, 600, 800).fill("#f4f6fa");
    doc.rect(0, 0, 600, 60).fill("#0d47a1");

    doc.fillColor("white").fontSize(22).text("DISTRIWEST", 0, 20, { align: "center" });

    doc.fillColor("#0d47a1").fontSize(36).text("DISTRIWEST", 0, 220, { align: "center" });

    doc.fillColor("#444").fontSize(18).text("Distribuidora Mayorista", { align: "center" });

    doc.moveDown(6);

    doc.fillColor("#333").fontSize(14).text("Catálogo de Productos", { align: "center" });

    doc.moveDown(2);

    doc.fillColor("#888").fontSize(10)
      .text("Actualizado: " + new Date().toLocaleDateString(), { align: "center" });

    doc.addPage();

    // ================= HELPERS =================
    const CARD_WIDTH = 160;
    const CARD_HEIGHT = 170;
    const GAP = 20;

    async function drawProducto(p, x, y) {

  doc.roundedRect(x, y, 160, 170, 12).stroke("#ddd");

  // ===== IMAGEN SEGURA =====
  let imagenOK = false;

  if (p.imagen_url) {
    try {
      const response = await fetch(p.imagen_url);

      if (response.ok) {
        const buffer = await response.arrayBuffer();

        doc.image(Buffer.from(buffer), x + 20, y + 10, {
          width: 120,
          height: 70
        });

        imagenOK = true;
      }
    } catch (err) {
      console.log("Error imagen:", p.nombre);
    }
  }

  // 🔥 fallback SIEMPRE
  if (!imagenOK) {
    doc
      .rect(x + 20, y + 10, 120, 70)
      .stroke("#ccc");

    doc
      .fontSize(8)
      .fillColor("#999")
      .text("SIN IMAGEN", x + 20, y + 35, {
        width: 120,
        align: "center"
      });
  }

  // ===== BADGES =====
  if (p.oferta) {
    doc.fillColor("#e53935")
      .roundedRect(x + 8, y + 8, 50, 16, 4)
      .fill();

    doc.fillColor("white")
      .fontSize(8)
      .text("OFERTA", x + 8, y + 11, {
        width: 50,
        align: "center"
      });
  }

  if (p.destacado) {
    doc.fillColor("#fb8c00")
      .roundedRect(x + 102, y + 8, 50, 16, 4)
      .fill();

    doc.fillColor("white")
      .fontSize(8)
      .text("TOP", x + 102, y + 11, {
        width: 50,
        align: "center"
      });
  }

  // ===== TEXTO =====
  doc.fontSize(11).fillColor("#000")
    .text(p.nombre, x + 10, y + 95, {
      width: 140,
      align: "center"
    });

  doc.fontSize(18).fillColor("#2e7d32")
    .text(`$${p.precio}`, x + 10, y + 115, {
      width: 140,
      align: "center"
    });

  doc.fillColor("#777").fontSize(8)
    .text(p.categorias?.nombre || "", x + 10, y + 140, {
      width: 140,
      align: "center"
    });
}

    async function renderSeccion(titulo, lista) {
      if (!lista.length) return;

      doc.addPage();

      doc.fillColor("#0d47a1").fontSize(20).text(titulo, 40, 60);

      let x = 40;
      let y = 100;
      let col = 0;

      for (const p of lista) {

        // 🔥 CONTROL ANTES DE DIBUJAR
        if (y + CARD_HEIGHT > 750) {
          doc.addPage();
          y = 100;
          x = 40;
          col = 0;
        }

        await drawProducto(p, x, y);

        col++;

        if (col === 3) {
          col = 0;
          x = 40;
          y += CARD_HEIGHT + GAP;
        } else {
          x += CARD_WIDTH + GAP;
        }
      }
    }

    // ================= ORDEN =================
    const ofertas = productos.filter(p => p.oferta);
    const destacados = productos.filter(p => p.destacado && !p.oferta);
    const normales = productos.filter(p => !p.oferta && !p.destacado);

    // ================= RENDER =================
    await renderSeccion("OFERTAS", ofertas);
    await renderSeccion("DESTACADOS", destacados);

    // normales por categoría
    const agrupados = {};
    normales.forEach(p => {
      const cat = p.categorias?.nombre || "Sin categoría";
      if (!agrupados[cat]) agrupados[cat] = [];
      agrupados[cat].push(p);
    });

    for (const cat of Object.keys(agrupados)) {
      await renderSeccion(cat, agrupados[cat]);
    }

    doc.end();

  } catch (err) {
    console.log(err);
    res.status(500).send("Error PDF");
  }
});

// SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en puerto", PORT);
});