import cors from "cors";
import puppeteer from "puppeteer";
import express from "express";
import dotenv from "dotenv";
import fileUpload from "express-fileupload";
import { supabase } from "./config/supabase.js";
console.log("🔥 DEPLOY NUEVO ACTIVO");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
<<<<<<< HEAD
app.use(fileUpload());
=======
app.use(fileUpload()); // ✅ BIEN ubicado
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863

// 👉 HOME
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// 👉 TEST DB
app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase.from("categorias").select("*");
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

<<<<<<< HEAD
// 👉 SUBIR IMAGEN
=======
// 👉 SUBIR IMAGEN (SUPABASE STORAGE)
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863
app.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.imagen) {
      return res.status(400).json({ error: "No hay imagen" });
    }

    const file = req.files.imagen;
<<<<<<< HEAD
    const safeName = file.name.replace(/\s+/g, "_");
    const fileName = Date.now() + "-" + safeName;
=======
    const fileName = Date.now() + "-" + file.name;
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863

    const { error } = await supabase.storage
      .from("productos")
      .upload(fileName, file.data, {
<<<<<<< HEAD
        contentType: file.mimetype,
        upsert: true
      });

    if (error) return res.status(500).json(error);

    const { data } = supabase.storage
      .from("productos")
      .getPublicUrl(fileName);

    res.json({ url: data.publicUrl });
=======
        contentType: file.mimetype
      });

    if (error) {
      return res.status(500).json(error);
    }

    const { data: publicUrl } = supabase.storage
      .from("productos")
      .getPublicUrl(fileName);

    res.json({ url: publicUrl.publicUrl });
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863

  } catch (err) {
    res.status(500).json({ error: "Error subiendo imagen" });
  }
});

<<<<<<< HEAD
// 👉 PRODUCTOS
=======
// 👉 CREAR PRODUCTO
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863
app.post("/productos", async (req, res) => {
  const { nombre, precio, imagen_url, categoria_id, destacado, oferta } = req.body;

  const { data, error } = await supabase
    .from("productos")
    .insert([{ nombre, precio, imagen_url, categoria_id, destacado, oferta }])
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

app.get("/productos", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`*, categorias(nombre)`);

  if (error) return res.status(500).json(error);
  res.json(data);
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

<<<<<<< HEAD
  if (imagen_url) updateData.imagen_url = imagen_url;
=======
  if (imagen_url) {
    updateData.imagen_url = imagen_url;
  }
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863

  const { data, error } = await supabase
    .from("productos")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) return res.status(500).json(error);
  res.json(data);
});

// 👉 PDF PRO (ARREGLADO EN SERIO)
app.get("/generar-pdf", async (req, res) => {
  const { data, error } = await supabase
    .from("productos")
    .select(`*, categorias(nombre)`);

  if (error) return res.status(500).json(error);

  const agrupados = {};

  data.forEach(p => {
    const cat = p.categorias?.nombre || "Sin categoría";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(p);
  });

  let html = `
<<<<<<< HEAD
<html>
<head>
  <style>
    body {
      font-family: Arial;
      padding: 10px;
    }

    h1 {
      text-align: center;
    }

    h2 {
      margin-top: 20px;
      border-bottom: 2px solid #1976d2;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    td {
      width: 33%;
      text-align: center;
      padding: 10px;
      vertical-align: top;
    }

    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px;
    }

    img {
      width: 100px;
      height: 100px;
      object-fit: contain;
    }

    .nombre {
      font-weight: bold;
      margin-top: 5px;
    }

    .precio {
      color: green;
      font-weight: bold;
    }

    .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 5px;
    }

    .oferta { background: red; color: white; }
    .top { background: orange; }
  </style>
</head>

<body>

<h1>DistriWest</h1>
`;

  for (const categoria in agrupados) {
  const productos = agrupados[categoria];

  html += `<h2>${categoria}</h2><table><tr>`;

  productos.forEach((p, i) => {
    html += `
      <td>
        <div class="card">

          ${p.oferta ? '<div class="badge oferta">OFERTA</div>' : ''}
          ${p.destacado ? '<div class="badge top">TOP</div>' : ''}

          <img src="${p.imagen_url}" />

          <div class="nombre">${p.nombre}</div>
          <div class="precio">$${p.precio}</div>

        </div>
      </td>
    `;

    if ((i + 1) % 3 === 0) {
      html += `</tr><tr>`;
    }
  });

  html += `</tr></table>`;
}
=======
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
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863

  html += `</body></html>`;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
<<<<<<< HEAD

  const page = await browser.newPage();

  // 🔥 CLAVE (esto te arregla TODO)
  await page.setViewport({ width: 1200, height: 1600 });
  await page.emulateMediaType("screen");

  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm" }
  });
=======

  const page = await browser.newPage();
  await page.setContent(html);

  const pdf = await page.pdf({ format: "A4" });
>>>>>>> ed0a1f5a13a032a7cd19cb7d8101b5747b016863

  await browser.close();

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": "attachment; filename=DistriWest.pdf"
  });

  res.send(pdf);
});

// 👉 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});