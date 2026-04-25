console.log("🔥 VERSION FINAL EMPRESA PDF 🔥");

import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

import cors from "cors";
import express from "express";
import fileUpload from "express-fileupload";
import PDFDocument from "pdfkit";
import sharp from "sharp";
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
// 📄 PDF GENERADOR
// ==========================
app.get("/generar-pdf", async (req, res) => {
  try {
    const { data: productos } = await supabase
      .from("productos")
      .select(`*, categorias(nombre)`);

    const doc = new PDFDocument({ margin: 40, autoFirstPage: false });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=catalogo.pdf");

    doc.pipe(res);

    // ================= CONSTANTES DE LAYOUT =================
    const PAGE_WIDTH   = 595;   // A4 ancho en puntos
    const MARGIN       = 40;
    const COLS         = 3;
    const GAP          = 14;
    const CARD_W       = Math.floor((PAGE_WIDTH - MARGIN * 2 - GAP * (COLS - 1)) / COLS); // ~155
    const IMG_H        = 110;
    const BADGE_H      = 20;
    const NOMBRE_MAX_H = 30;    // espacio reservado para nombre (hasta 2 líneas)
    const PRECIO_H     = 26;
    const CAT_H        = 16;
    const PADDING      = 10;
    const CARD_H       = PADDING + IMG_H + PADDING + NOMBRE_MAX_H + PRECIO_H + CAT_H + PADDING; // ~186

    const SECTION_TITLE_H = 36; // altura reservada para el título de sección
    const PAGE_H          = 841; // A4 alto
    const USABLE_H        = PAGE_H - MARGIN * 2;

    // ================= PORTADA =================
    doc.addPage();

    doc.rect(0, 0, PAGE_WIDTH, PAGE_H).fill("#f4f6fa");
    doc.rect(0, 0, PAGE_WIDTH, 70).fill("#0d47a1");

    doc.fillColor("white").fontSize(24).font("Helvetica-Bold")
      .text("DISTRIWEST", 0, 22, { align: "center", width: PAGE_WIDTH });

    doc.fillColor("#0d47a1").fontSize(42).font("Helvetica-Bold")
      .text("DISTRIWEST", 0, 260, { align: "center", width: PAGE_WIDTH });

    doc.fillColor("#444").fontSize(20).font("Helvetica")
      .text("Distribuidora Mayorista", 0, 315, { align: "center", width: PAGE_WIDTH });

    doc.fillColor("#333").fontSize(15).font("Helvetica-Bold")
      .text("Catálogo de Productos", 0, 380, { align: "center", width: PAGE_WIDTH });

    doc.fillColor("#888").fontSize(11).font("Helvetica")
      .text("Actualizado: " + new Date().toLocaleDateString("es-AR"), 0, 415, { align: "center", width: PAGE_WIDTH });

    // ================= HELPER: DIBUJAR CARD =================
    async function drawCard(p, x, y) {
      // --- fondo y borde de la card ---
      doc.roundedRect(x, y, CARD_W, CARD_H, 10).fillAndStroke("white", "#e0e0e0");

      // --- IMAGEN ---
      let imgY    = y + PADDING;
      let imgX    = x + PADDING;
      let imgW    = CARD_W - PADDING * 2;
      let imagenOK = false;

      if (p.imagen_url) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const response = await fetch(p.imagen_url, { signal: controller.signal });
          clearTimeout(timeout);

          if (response.ok) {
  const rawBuffer = Buffer.from(await response.arrayBuffer());

  // Convertir cualquier formato (webp, png, jpg) a PNG para PDFKit
  const buffer = await sharp(rawBuffer).png().toBuffer();

  doc.image(buffer, imgX, imgY, { width: imgW, height: IMG_H, fit: [imgW, IMG_H], align: "center", valign: "center" });
  imagenOK = true;
}
        } catch (err) {
          console.log("⚠️  Imagen no cargada:", p.nombre);
        }
      }

      if (!imagenOK) {
        doc.rect(imgX, imgY, imgW, IMG_H).fillAndStroke("#f5f5f5", "#ddd");
        doc.fillColor("#aaa").fontSize(8).font("Helvetica")
          .text("SIN IMAGEN", imgX, imgY + IMG_H / 2 - 5, { width: imgW, align: "center" });
      }

      // --- BADGES (sobre la imagen) ---
      if (p.oferta) {
        doc.roundedRect(x + 6, y + 6, 48, 16, 4).fill("#e53935");
        doc.fillColor("white").fontSize(7).font("Helvetica-Bold")
          .text("OFERTA", x + 6, y + 9, { width: 48, align: "center" });
      }

      if (p.destacado) {
        doc.roundedRect(x + CARD_W - 54, y + 6, 48, 16, 4).fill("#fb8c00");
        doc.fillColor("white").fontSize(7).font("Helvetica-Bold")
          .text("TOP", x + CARD_W - 54, y + 9, { width: 48, align: "center" });
      }

      // --- TEXTO: posición base justo debajo de la imagen ---
      const textX = x + PADDING;
      const textW = CARD_W - PADDING * 2;
      let   curY  = y + PADDING + IMG_H + 6;

      // NOMBRE (máximo 2 líneas, clamp con ellipsis manual si es necesario)
      doc.fillColor("#111").fontSize(9).font("Helvetica-Bold");
      doc.text(p.nombre, textX, curY, {
        width: textW,
        align: "center",
        lineBreak: true,
        height: NOMBRE_MAX_H,
        ellipsis: true
      });
      curY += NOMBRE_MAX_H + 2;

      // PRECIO
      doc.fillColor("#2e7d32").fontSize(16).font("Helvetica-Bold");
      doc.text("$" + Number(p.precio).toLocaleString("es-AR"), textX, curY, {
        width: textW,
        align: "center",
        lineBreak: false
      });
      curY += PRECIO_H;

      // CATEGORÍA
      doc.fillColor("#888").fontSize(7).font("Helvetica");
      doc.text((p.categorias?.nombre || "").toUpperCase(), textX, curY, {
        width: textW,
        align: "center",
        lineBreak: false
      });
    }

    // ================= HELPER: RENDERIZAR SECCIÓN =================
    async function renderSeccion(titulo, lista) {
      if (!lista.length) return;

      // --- nueva página para cada sección ---
      doc.addPage();

      // --- título de sección ---
      doc.rect(0, MARGIN - 10, PAGE_WIDTH, SECTION_TITLE_H).fill("#0d47a1");
      doc.fillColor("white").fontSize(16).font("Helvetica-Bold")
        .text(titulo, MARGIN, MARGIN, { width: PAGE_WIDTH - MARGIN * 2 });

      let curY = MARGIN + SECTION_TITLE_H + 10;
      let col  = 0;
      let curX = MARGIN;

      for (const p of lista) {
        // ¿entra la card en esta página?
        if (curY + CARD_H > PAGE_H - MARGIN) {
          doc.addPage();
          curY = MARGIN;
          col  = 0;
          curX = MARGIN;
        }

        await drawCard(p, curX, curY);

        col++;
        if (col >= COLS) {
          col  = 0;
          curX = MARGIN;
          curY += CARD_H + GAP;
        } else {
          curX += CARD_W + GAP;
        }
      }
    }

    // ================= CLASIFICACIÓN =================
    const ofertas    = productos.filter(p => p.oferta);
    const destacados = productos.filter(p => p.destacado && !p.oferta);
    const normales   = productos.filter(p => !p.oferta && !p.destacado);

    // ================= RENDER =================
    await renderSeccion("OFERTAS", ofertas);
    await renderSeccion("DESTACADOS", destacados);

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
    console.error(err);
    res.status(500).send("Error generando PDF");
  }
});

// SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en puerto", PORT);
});