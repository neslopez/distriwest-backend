console.log("🔥 VERSION FINAL EMPRESA PDF 🔥");

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

// ==========================
// 📄 PDF NIVEL EMPRESA REAL
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

    // =====================
    // 🟦 PORTADA PRO
    // =====================
    doc.rect(0, 0, 600, 800).fill("#f4f6fa");

    doc.rect(0, 0, 600, 60).fill("#0d47a1");

    doc.fillColor("white")
      .fontSize(22)
      .text("DISTRIWEST", 0, 20, { align: "center" });

    doc.fillColor("#0d47a1")
      .fontSize(36)
      .text("DISTRIWEST", 0, 220, { align: "center" });

    doc.fillColor("#444")
      .fontSize(18)
      .text("Distribuidora Mayorista", { align: "center" });

    doc.moveDown(3);

    doc.moveTo(150, doc.y).lineTo(450, doc.y).stroke("#0d47a1");

    doc.moveDown(2);

    doc.fillColor("#333")
      .fontSize(14)
      .text("Catálogo de Productos", { align: "center" });

    doc.fillColor("#888")
      .fontSize(10)
      .text("Actualizado: " + new Date().toLocaleDateString(), {
        align: "center"
      });

    doc.fillColor("#aaa")
      .fontSize(9)
      .text("Precios sujetos a modificación sin previo aviso", 0, 750, {
        align: "center"
      });

    // =====================
    // 🔹 AGRUPAR
    // =====================
    const agrupados = {};
    productos.forEach(p => {
      const cat = p.categorias?.nombre || "Sin categoría";
      if (!agrupados[cat]) agrupados[cat] = [];
      agrupados[cat].push(p);
    });

    const categorias = Object.keys(agrupados);

    // =====================
    // 🔁 RECORRER CATEGORÍAS
    // =====================
    for (let c = 0; c < categorias.length; c++) {

      const categoria = categorias[c];

      // 👉 SOLO crear nueva página si NO es la primera
      doc.addPage();
      doc.x = 40;
      doc.y = 40;

      // HEADER
      doc.rect(0, 0, 600, 40).fill("#0d47a1");
      doc.fillColor("white").fontSize(12).text("DISTRIWEST - Catálogo", 20, 12);

      doc.fillColor("#0d47a1")
        .fontSize(20)
        .text(categoria, 40, 60);

      let y = 100;

      const productosCat = agrupados[categoria];

      const CARD_WIDTH = 160;
      const CARD_HEIGHT = 170;
      const GAP = 20;

      const itemsFila = Math.min(3, productosCat.length);
      const totalWidth = itemsFila * CARD_WIDTH + (itemsFila - 1) * GAP;
      const offsetX = (500 - totalWidth) / 2;

      let x = 40 + offsetX;
      let col = 0;

      for (const [index, p] of productosCat.entries()) {

        // SOMBRA
        doc.rect(x + 3, y + 3, CARD_WIDTH, CARD_HEIGHT)
          .fillOpacity(0.05)
          .fill("#000")
          .fillOpacity(1);

        // CARD
        doc.roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 12)
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
        doc.fontSize(11).fillColor("#000")
          .text(p.nombre, x + 10, y + 95, {
            width: CARD_WIDTH - 20,
            align: "center"
          });

        // PRECIO
        doc.fontSize(18).fillColor("#2e7d32")
          .text(`$${p.precio}`, x + 10, y + 115, {
            width: CARD_WIDTH - 20,
            align: "center"
          });

        // CATEGORIA
        doc.fillColor("#777")
          .fontSize(8)
          .text(categoria, x + 10, y + 140, {
            width: CARD_WIDTH - 20,
            align: "center"
          });

        col++;

        if (col === 3) {
          col = 0;
          x = 40 + offsetX;
          y += CARD_HEIGHT + GAP;
        } else {
          x += CARD_WIDTH + GAP;
        }

        // 👉 NUEVA PAGINA INTERNA
        if (y > 700 && index !== productosCat.length - 1) {
          doc.addPage();
          doc.x = 40;
          doc.y = 40;

          doc.rect(0, 0, 600, 40).fill("#0d47a1");
          doc.fillColor("white").fontSize(12).text("DISTRIWEST - Catálogo", 20, 12);

          doc.fillColor("#0d47a1")
            .fontSize(20)
            .text(categoria, 40, 60);

          y = 100;
          x = 40 + offsetX;
          col = 0;
        }
      }
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