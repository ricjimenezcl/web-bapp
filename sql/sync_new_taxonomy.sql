-- =====================================================================
-- Sincronizacion de nueva clasificacion de categorias, subcategorias y
-- servicios (reclasificacion completa) + asignacion de iconos.
--
-- Estrategia (idempotente, seguro para re-ejecutar):
--   1) Se crea una funcion temporal pg_temp.norm_text() para comparar
--      nombres ignorando mayusculas/acentos/espacios.
--   2) Para cada nivel (categoria principal, subcategoria, servicio):
--        a) UPDATE de los registros existentes que ya coinciden (por
--           nombre normalizado) para dejar nombre/descripcion/icono
--           segun la nueva clasificacion.
--        b) INSERT de los que no existian.
--   3) NO se elimina ni renombra nada fuera de lo detectado como el
--      mismo concepto; los nodos antiguos que quedaron obsoletos por la
--      reclasificacion (por ejemplo variantes mas granulares) se dejan
--      intactos para revision manual posterior.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.norm_text(input text)
RETURNS text AS $$
  SELECT lower(
    translate(
      trim(input),
      'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑ',
      'aaaaaAAAAAeeeeEEEEiiiiIIIIooooOOOOOuuuuUUUUnN'
    )
  );
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------
-- Correcciones puntuales de nombre (mismo concepto creado antes en esta
-- sesion, ahora con la grafia oficial de la nueva clasificacion).
-- ---------------------------------------------------------------------
UPDATE main_categories SET name = 'Belleza y Cuidado Personal', updated_at = NOW()
  WHERE pg_temp.norm_text(name) = pg_temp.norm_text('Belleza y Bienestar')
    AND NOT EXISTS (SELECT 1 FROM main_categories WHERE pg_temp.norm_text(name) = pg_temp.norm_text('Belleza y Cuidado Personal'));

UPDATE subcategories SET name = 'Comida rápida', updated_at = NOW()
  WHERE pg_temp.norm_text(name) = pg_temp.norm_text('Comida rapida')
    AND main_category_id IN (SELECT id FROM main_categories WHERE pg_temp.norm_text(name) = pg_temp.norm_text('Alimentación'));

UPDATE services SET name = 'Repostería', updated_at = NOW()
  WHERE pg_temp.norm_text(name) = pg_temp.norm_text('Reposteria')
    AND subcategory_id IN (
      SELECT sc.id FROM subcategories sc
      JOIN main_categories mc ON mc.id = sc.main_category_id
      WHERE pg_temp.norm_text(sc.name) = pg_temp.norm_text('Panadería y dulces')
        AND pg_temp.norm_text(mc.name) = pg_temp.norm_text('Alimentación')
    );

-- ---------------------------------------------------------------------
-- 1) Categorias principales
-- ---------------------------------------------------------------------
WITH v (name, description, icon) AS (VALUES
    ('Alimentación', 'Comida rápida, comida casera, delivery, panadería, dulces y catering.', 'restaurant-outline'),
    ('Hogar y Construcción', 'Obras, instalaciones, montajes y acabados para el hogar.', 'hammer-outline'),
    ('Belleza y Cuidado Personal', 'Peluquería, manicure, depilación, maquillaje, tratamientos, masajes, tatuajes y piercings.', 'flower-outline'),
    ('Costura y Confección', 'Confección, arreglos de ropa, textiles y arriendo de vestuario.', 'shirt-outline'),
    ('Reparaciones Generales', 'Reparación de electrodomésticos, celulares, computadores, bicicletas, muebles y calzado.', 'build-outline'),
    ('Servicios del Hogar', 'Limpieza, jardinería, organización y mantenimiento del hogar.', 'home-outline'),
    ('Servicios Automotrices', 'Carrocería, neumáticos, mecánica general, motos y electricidad automotriz.', 'car-outline'),
    ('Mascotas', 'Estética, salud, paseo, entrenamiento y otros servicios para mascotas.', 'paw-outline'),
    ('Servicios varios', 'Salud a domicilio, cuidado de personas, deporte, clases, traslados, eventos, artesanías, esoterismo y trámites.', 'apps-outline')
)
UPDATE main_categories mc SET
  description = v.description,
  icon = v.icon,
  is_active = TRUE,
  updated_at = NOW()
FROM v
WHERE pg_temp.norm_text(mc.name) = pg_temp.norm_text(v.name);

WITH v (name, description, icon) AS (VALUES
    ('Alimentación', 'Comida rápida, comida casera, delivery, panadería, dulces y catering.', 'restaurant-outline'),
    ('Hogar y Construcción', 'Obras, instalaciones, montajes y acabados para el hogar.', 'hammer-outline'),
    ('Belleza y Cuidado Personal', 'Peluquería, manicure, depilación, maquillaje, tratamientos, masajes, tatuajes y piercings.', 'flower-outline'),
    ('Costura y Confección', 'Confección, arreglos de ropa, textiles y arriendo de vestuario.', 'shirt-outline'),
    ('Reparaciones Generales', 'Reparación de electrodomésticos, celulares, computadores, bicicletas, muebles y calzado.', 'build-outline'),
    ('Servicios del Hogar', 'Limpieza, jardinería, organización y mantenimiento del hogar.', 'home-outline'),
    ('Servicios Automotrices', 'Carrocería, neumáticos, mecánica general, motos y electricidad automotriz.', 'car-outline'),
    ('Mascotas', 'Estética, salud, paseo, entrenamiento y otros servicios para mascotas.', 'paw-outline'),
    ('Servicios varios', 'Salud a domicilio, cuidado de personas, deporte, clases, traslados, eventos, artesanías, esoterismo y trámites.', 'apps-outline')
)
INSERT INTO main_categories (name, description, icon, is_active, created_at, updated_at)
SELECT v.name, v.description, v.icon, TRUE, NOW(), NOW()
FROM v
WHERE NOT EXISTS (
  SELECT 1 FROM main_categories mc WHERE pg_temp.norm_text(mc.name) = pg_temp.norm_text(v.name)
);

-- ---------------------------------------------------------------------
-- 2) Subcategorias
-- ---------------------------------------------------------------------
WITH v (category_name, name, icon) AS (VALUES
    ('Alimentación', 'Comida rápida', 'fast-food-outline'),
    ('Alimentación', 'Comida casera y menus', 'restaurant-outline'),
    ('Alimentación', 'Delivery a domicilio', 'bicycle-outline'),
    ('Alimentación', 'Panadería y dulces', 'cafe-outline'),
    ('Alimentación', 'Catering y servicios', 'wine-outline'),
    ('Hogar y Construcción', 'Obras y estructura', 'construct-outline'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'settings-outline'),
    ('Hogar y Construcción', 'Acabados y oficios', 'color-palette-outline'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'cut-outline'),
    ('Belleza y Cuidado Personal', 'Manos y pies', 'finger-print-outline'),
    ('Belleza y Cuidado Personal', 'Depilación', 'flash-outline'),
    ('Belleza y Cuidado Personal', 'Maquillaje y cejas', 'brush-outline'),
    ('Belleza y Cuidado Personal', 'Tratamientos y masajes', 'bandage-outline'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'pencil-outline'),
    ('Costura y Confección', 'Confección y arreglos', 'shirt-outline'),
    ('Costura y Confección', 'Textiles y decoración', 'color-palette-outline'),
    ('Costura y Confección', 'Arriendos', 'bag-outline'),
    ('Reparaciones Generales', 'Electrodomésticos y electrónica', 'build-outline'),
    ('Reparaciones Generales', 'Celulares y computadores', 'phone-portrait-outline'),
    ('Reparaciones Generales', 'Bicicletas', 'bicycle-outline'),
    ('Reparaciones Generales', 'Muebles', 'cube-outline'),
    ('Reparaciones Generales', 'calzado', 'footsteps-outline'),
    ('Servicios del Hogar', 'Limpieza', 'sparkles-outline'),
    ('Servicios del Hogar', 'Jardineria y exteriores', 'leaf-outline'),
    ('Servicios del Hogar', 'Organización y cocina', 'home-outline'),
    ('Servicios del Hogar', 'Mantenimiento y sanitizacion', 'shield-checkmark-outline'),
    ('Servicios Automotrices', 'Carrocería y pintura', 'brush-outline'),
    ('Servicios Automotrices', 'Neumáticos y suspension', 'disc-outline'),
    ('Servicios Automotrices', 'Mecánica general', 'construct-outline'),
    ('Servicios Automotrices', 'Motos', 'speedometer-outline'),
    ('Servicios Automotrices', 'Servicios automotrices', 'car-sport-outline'),
    ('Servicios Automotrices', 'Electricidad y electrónica automotriz', 'flash-outline'),
    ('Mascotas', 'Estetica e higiene', 'cut-outline'),
    ('Mascotas', 'Salud y cuidado', 'medkit-outline'),
    ('Mascotas', 'Otros servicios', 'paw-outline'),
    ('Mascotas', 'Paseo y entrenamiento', 'walk-outline'),
    ('Servicios varios', 'Salud a domicilio', 'medkit-outline'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'people-outline'),
    ('Servicios varios', 'Deporte y recreacion', 'fitness-outline'),
    ('Servicios varios', 'Clases y tutorias', 'school-outline'),
    ('Servicios varios', 'Traslados y mudanzas', 'cube-outline'),
    ('Servicios varios', 'Entretenimiento y eventos', 'musical-notes-outline'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'color-palette-outline'),
    ('Servicios varios', 'Esoterismo y espiritualidad', 'moon-outline'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'document-text-outline')
)
UPDATE subcategories sc SET
  icon = v.icon,
  updated_at = NOW()
FROM v
JOIN main_categories mc ON pg_temp.norm_text(mc.name) = pg_temp.norm_text(v.category_name)
WHERE sc.main_category_id = mc.id
  AND pg_temp.norm_text(sc.name) = pg_temp.norm_text(v.name);

WITH v (category_name, name, icon) AS (VALUES
    ('Alimentación', 'Comida rápida', 'fast-food-outline'),
    ('Alimentación', 'Comida casera y menus', 'restaurant-outline'),
    ('Alimentación', 'Delivery a domicilio', 'bicycle-outline'),
    ('Alimentación', 'Panadería y dulces', 'cafe-outline'),
    ('Alimentación', 'Catering y servicios', 'wine-outline'),
    ('Hogar y Construcción', 'Obras y estructura', 'construct-outline'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'settings-outline'),
    ('Hogar y Construcción', 'Acabados y oficios', 'color-palette-outline'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'cut-outline'),
    ('Belleza y Cuidado Personal', 'Manos y pies', 'finger-print-outline'),
    ('Belleza y Cuidado Personal', 'Depilación', 'flash-outline'),
    ('Belleza y Cuidado Personal', 'Maquillaje y cejas', 'brush-outline'),
    ('Belleza y Cuidado Personal', 'Tratamientos y masajes', 'bandage-outline'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'pencil-outline'),
    ('Costura y Confección', 'Confección y arreglos', 'shirt-outline'),
    ('Costura y Confección', 'Textiles y decoración', 'color-palette-outline'),
    ('Costura y Confección', 'Arriendos', 'bag-outline'),
    ('Reparaciones Generales', 'Electrodomésticos y electrónica', 'build-outline'),
    ('Reparaciones Generales', 'Celulares y computadores', 'phone-portrait-outline'),
    ('Reparaciones Generales', 'Bicicletas', 'bicycle-outline'),
    ('Reparaciones Generales', 'Muebles', 'cube-outline'),
    ('Reparaciones Generales', 'calzado', 'footsteps-outline'),
    ('Servicios del Hogar', 'Limpieza', 'sparkles-outline'),
    ('Servicios del Hogar', 'Jardineria y exteriores', 'leaf-outline'),
    ('Servicios del Hogar', 'Organización y cocina', 'home-outline'),
    ('Servicios del Hogar', 'Mantenimiento y sanitizacion', 'shield-checkmark-outline'),
    ('Servicios Automotrices', 'Carrocería y pintura', 'brush-outline'),
    ('Servicios Automotrices', 'Neumáticos y suspension', 'disc-outline'),
    ('Servicios Automotrices', 'Mecánica general', 'construct-outline'),
    ('Servicios Automotrices', 'Motos', 'speedometer-outline'),
    ('Servicios Automotrices', 'Servicios automotrices', 'car-sport-outline'),
    ('Servicios Automotrices', 'Electricidad y electrónica automotriz', 'flash-outline'),
    ('Mascotas', 'Estetica e higiene', 'cut-outline'),
    ('Mascotas', 'Salud y cuidado', 'medkit-outline'),
    ('Mascotas', 'Otros servicios', 'paw-outline'),
    ('Mascotas', 'Paseo y entrenamiento', 'walk-outline'),
    ('Servicios varios', 'Salud a domicilio', 'medkit-outline'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'people-outline'),
    ('Servicios varios', 'Deporte y recreacion', 'fitness-outline'),
    ('Servicios varios', 'Clases y tutorias', 'school-outline'),
    ('Servicios varios', 'Traslados y mudanzas', 'cube-outline'),
    ('Servicios varios', 'Entretenimiento y eventos', 'musical-notes-outline'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'color-palette-outline'),
    ('Servicios varios', 'Esoterismo y espiritualidad', 'moon-outline'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'document-text-outline')
)
INSERT INTO subcategories (name, icon, main_category_id, created_at, updated_at)
SELECT v.name, v.icon, mc.id, NOW(), NOW()
FROM v
JOIN main_categories mc ON pg_temp.norm_text(mc.name) = pg_temp.norm_text(v.category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM subcategories sc
  WHERE sc.main_category_id = mc.id
    AND pg_temp.norm_text(sc.name) = pg_temp.norm_text(v.name)
);

-- ---------------------------------------------------------------------
-- 3) Servicios
-- ---------------------------------------------------------------------
WITH v (category_name, subcategory_name, name) AS (VALUES
    ('Alimentación', 'Comida rápida', 'Ceviches'),
    ('Alimentación', 'Comida rápida', 'Pollos asados'),
    ('Alimentación', 'Comida rápida', 'Completos'),
    ('Alimentación', 'Comida rápida', 'Churrascos'),
    ('Alimentación', 'Comida rápida', 'Empanadas'),
    ('Alimentación', 'Comida rápida', 'Sushi'),
    ('Alimentación', 'Comida rápida', 'Helados'),
    ('Alimentación', 'Comida rápida', 'Carrito de comida'),
    ('Alimentación', 'Comida rápida', 'Comida vegana/vegetariana'),
    ('Alimentación', 'Comida casera y menus', 'Almuerzos diarios'),
    ('Alimentación', 'Comida casera y menus', 'Postres'),
    ('Alimentación', 'Comida casera y menus', 'Comida para llevar'),
    ('Alimentación', 'Comida casera y menus', 'Almuerzos a pedido'),
    ('Alimentación', 'Delivery a domicilio', 'Delivery de comida casera'),
    ('Alimentación', 'Delivery a domicilio', 'Delivery Pollos asados'),
    ('Alimentación', 'Delivery a domicilio', 'Delivery comida rápida'),
    ('Alimentación', 'Panadería y dulces', 'Pan amasado'),
    ('Alimentación', 'Panadería y dulces', 'Repostería'),
    ('Alimentación', 'Panadería y dulces', 'Tortas a pedido'),
    ('Alimentación', 'Catering y servicios', 'Cocinero/a por horas'),
    ('Alimentación', 'Catering y servicios', 'Banquetera y Coffe break'),
    ('Hogar y Construcción', 'Obras y estructura', 'Albañilería'),
    ('Hogar y Construcción', 'Obras y estructura', 'Carpintería'),
    ('Hogar y Construcción', 'Obras y estructura', 'Soldadura'),
    ('Hogar y Construcción', 'Obras y estructura', 'Retiro de escombros'),
    ('Hogar y Construcción', 'Obras y estructura', 'Revestimientos de muros'),
    ('Hogar y Construcción', 'Obras y estructura', 'Hojalatería'),
    ('Hogar y Construcción', 'Obras y estructura', 'Instalación de pisos'),
    ('Hogar y Construcción', 'Obras y estructura', 'Construcción de terrazas de madera'),
    ('Hogar y Construcción', 'Obras y estructura', 'Techumbres y canaletas'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'Instalación de cortinas'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'Instalación cámaras CCTV'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'Alarmas y cercos eléctricos'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'Control de acceso'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'Montaje de muebles'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'Instalación de calefón y termos'),
    ('Hogar y Construcción', 'Instalaciones y montajes', 'Climatización'),
    ('Hogar y Construcción', 'Acabados y oficios', 'Pintura (interior y exterior)'),
    ('Hogar y Construcción', 'Acabados y oficios', 'Vidriería'),
    ('Hogar y Construcción', 'Acabados y oficios', 'Cerrajero domiciliario'),
    ('Hogar y Construcción', 'Acabados y oficios', 'Electricista domiciliario'),
    ('Hogar y Construcción', 'Acabados y oficios', 'Gasfitería'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'Corte de cabello (local y a domicilio)'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'Peinados y styling'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'Coloración y mechas'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'Tratamientos capilares'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'Extensiones de cabello'),
    ('Belleza y Cuidado Personal', 'Peluquería y estilismo', 'Barberia y arreglo de barba'),
    ('Belleza y Cuidado Personal', 'Manos y pies', 'Manicure y pedicure (local y a domicilio)'),
    ('Belleza y Cuidado Personal', 'Manos y pies', 'Uñas acrílicas y esculpidas'),
    ('Belleza y Cuidado Personal', 'Depilación', 'Depilación con cera (local y a domicilio)'),
    ('Belleza y Cuidado Personal', 'Depilación', 'Depilación laser'),
    ('Belleza y Cuidado Personal', 'Maquillaje y cejas', 'Diseño y perfilado de cejas'),
    ('Belleza y Cuidado Personal', 'Maquillaje y cejas', 'Extensiones y lifting de pestañas'),
    ('Belleza y Cuidado Personal', 'Maquillaje y cejas', 'Maquillaje profesional (local y a domicilio)'),
    ('Belleza y Cuidado Personal', 'Tratamientos y masajes', 'Tratamientos faciales y corporales'),
    ('Belleza y Cuidado Personal', 'Tratamientos y masajes', 'Masajes relajantes, descontracturantes y a domicilio'),
    ('Belleza y Cuidado Personal', 'Tratamientos y masajes', 'Podología'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'Tatuajes artísticos y temporales'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'Cobertura y retiro de tatuajes'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'Perforaciones y expansión de lóbulos'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'Micropigmentación de cejas (microblading)'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'Semipermanente de labios'),
    ('Belleza y Cuidado Personal', 'Tatuajes y piercings', 'Nano pigmentación corporal'),
    ('Costura y Confección', 'Confección y arreglos', 'Uniformes escolares'),
    ('Costura y Confección', 'Confección y arreglos', 'Confección a medida (ropa en general)'),
    ('Costura y Confección', 'Confección y arreglos', 'Customización y personalización de ropa'),
    ('Costura y Confección', 'Confección y arreglos', 'Ajuste y arreglo de ropa'),
    ('Costura y Confección', 'Confección y arreglos', 'Ropa de bebe a medida'),
    ('Costura y Confección', 'Confección y arreglos', 'Ropa deportiva personalizada'),
    ('Costura y Confección', 'Textiles y decoración', 'Cortinas a medida'),
    ('Costura y Confección', 'Textiles y decoración', 'Fundas de almohadas y cojines'),
    ('Costura y Confección', 'Textiles y decoración', 'Bordados y bordado artesanal'),
    ('Costura y Confección', 'Textiles y decoración', 'Estampados'),
    ('Costura y Confección', 'Arriendos', 'Arriendo de ternos'),
    ('Costura y Confección', 'Arriendos', 'Disfraces'),
    ('Reparaciones Generales', 'Electrodomésticos y electrónica', 'Reparacion de electrodomesticos (TV, lavadoras, refrigeradores, etc.)'),
    ('Reparaciones Generales', 'Electrodomésticos y electrónica', 'Reparacion de relojes'),
    ('Reparaciones Generales', 'Electrodomésticos y electrónica', 'Reparacion de consolas de videojuegos y controles'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Cambio de pantalla y Reparacion de botones/flexes'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Reparacion de placa madre'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Desbloqueo de equipos'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Reparación de datos'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Limpieza interna de componentes'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Reparación de notebooks y tablets'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Reinstalación de sistema operativo, formateo y eliminación de virus'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Armado y configuración de PC'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Instalación y configuración de aplicaciones'),
    ('Reparaciones Generales', 'Celulares y computadores', 'Servicio tecnico a domicilio'),
    ('Reparaciones Generales', 'Bicicletas', 'Reparacion de bicicletas (tradicionales y electricas)'),
    ('Reparaciones Generales', 'Bicicletas', 'Reparacion de sillas de ruedas'),
    ('Reparaciones Generales', 'Muebles', 'Reparacion de muebles'),
    ('Reparaciones Generales', 'Muebles', 'Instalacion de muebles'),
    ('Reparaciones Generales', 'calzado', 'Reparacion de calzado'),
    ('Reparaciones Generales', 'calzado', 'Lavado de zapatillas'),
    ('Servicios del Hogar', 'Limpieza', 'Aseo y limpieza integral del hogar'),
    ('Servicios del Hogar', 'Limpieza', 'Aseo y planchado'),
    ('Servicios del Hogar', 'Limpieza', 'Lavado de ropa'),
    ('Servicios del Hogar', 'Limpieza', 'Limpieza de alfombras y tapices'),
    ('Servicios del Hogar', 'Limpieza', 'Limpieza de ventanas'),
    ('Servicios del Hogar', 'Jardineria y exteriores', 'Jardineria y paisajismo'),
    ('Servicios del Hogar', 'Jardineria y exteriores', 'Poda de arboles'),
    ('Servicios del Hogar', 'Jardineria y exteriores', 'Corte de cesped'),
    ('Servicios del Hogar', 'Jardineria y exteriores', 'Riego automatico'),
    ('Servicios del Hogar', 'Organización y cocina', 'Asesora del hogar y organizacion del hogar'),
    ('Servicios del Hogar', 'Organización y cocina', 'Preparacion de comidas diarias'),
    ('Servicios del Hogar', 'Organización y cocina', 'Arreglos florales'),
    ('Servicios del Hogar', 'Mantenimiento y sanitizacion', 'Sanitizacion y desinfeccion'),
    ('Servicios del Hogar', 'Mantenimiento y sanitizacion', 'Control de plagas y fumigacion'),
    ('Servicios del Hogar', 'Mantenimiento y sanitizacion', 'Limpieza de piscinas'),
    ('Servicios Automotrices', 'Carrocería y pintura', 'Lavado de autos'),
    ('Servicios Automotrices', 'Carrocería y pintura', 'Lavado de autos a domicilio'),
    ('Servicios Automotrices', 'Carrocería y pintura', 'Desabolladura y pintura'),
    ('Servicios Automotrices', 'Carrocería y pintura', 'Tapicería de autos'),
    ('Servicios Automotrices', 'Neumáticos y suspension', 'Vulcanizacion'),
    ('Servicios Automotrices', 'Neumáticos y suspension', 'Alineacion y balanceo'),
    ('Servicios Automotrices', 'Neumáticos y suspension', 'Suspension y frenos'),
    ('Servicios Automotrices', 'Mecánica general', 'Frenos'),
    ('Servicios Automotrices', 'Mecánica general', 'Mecánica automotriz'),
    ('Servicios Automotrices', 'Mecánica general', 'Diagnóstico automotriz'),
    ('Servicios Automotrices', 'Mecánica general', 'Tubos de escape'),
    ('Servicios Automotrices', 'Motos', 'Mecánica de motos'),
    ('Servicios Automotrices', 'Servicios automotrices', 'Servicio de grua'),
    ('Servicios Automotrices', 'Servicios automotrices', 'Cerrajeria de vehiculos'),
    ('Servicios Automotrices', 'Servicios automotrices', 'Cambio de aceite y baterias'),
    ('Servicios Automotrices', 'Servicios automotrices', 'Aire acondicionado automotriz'),
    ('Servicios Automotrices', 'Servicios automotrices', 'Instalacion de accesorios'),
    ('Servicios Automotrices', 'Electricidad y electrónica automotriz', 'Scanner automotriz'),
    ('Servicios Automotrices', 'Electricidad y electrónica automotriz', 'Electricidad automotriz'),
    ('Mascotas', 'Estetica e higiene', 'Peluqueria canina (local y a domicilio)'),
    ('Mascotas', 'Estetica e higiene', 'Baño y limpieza de mascotas (local y a domicilio)'),
    ('Mascotas', 'Salud y cuidado', 'Veterinaria y medicina (consultas a domicilio y clinica)'),
    ('Mascotas', 'Salud y cuidado', 'Hotel y cuidado de mascotas (guarderia)'),
    ('Mascotas', 'Salud y cuidado', 'Alimentos para mascotas'),
    ('Mascotas', 'Otros servicios', 'Transporte de mascotas'),
    ('Mascotas', 'Otros servicios', 'Fotografia de mascotas'),
    ('Mascotas', 'Paseo y entrenamiento', 'Paseo y entrenamiento de mascotas'),
    ('Servicios varios', 'Salud a domicilio', 'Toma de presion, inyecciones y curaciones'),
    ('Servicios varios', 'Salud a domicilio', 'Ayuda en higiene personal y cuidado de pacientes'),
    ('Servicios varios', 'Salud a domicilio', 'Acompañamiento y cuidado emocional'),
    ('Servicios varios', 'Salud a domicilio', 'Terapia ocupacional y fonoaudiologia'),
    ('Servicios varios', 'Salud a domicilio', 'Cuidados paliativos y postoperatorios'),
    ('Servicios varios', 'Salud a domicilio', 'Kinesioterapia y masaje terapeutico a domicilio'),
    ('Servicios varios', 'Salud a domicilio', 'Nutricion, dietetica y psicologia a domicilio'),
    ('Servicios varios', 'Salud a domicilio', 'Examenes de laboratorio y acupuntura'),
    ('Servicios varios', 'Salud a domicilio', 'Enfermeria a domicilio'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Niñera y babysitter (por horas, jornada completa, nocturna y ocasional)'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Cuidado de niños con necesidades especiales'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Traslado y retiro al colegio / cuidado despues del colegio'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Cuidado de lactantes y estimulacion temprana'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Apoyo escolar en casa'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Acompañante para tramites, citas medicas y compras'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Administracion de medicamentos y asistencia en movilidad'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Cuidado en domicilio y traslado a consultas'),
    ('Servicios varios', 'Cuidado de niños y adultos mayores', 'Actividad fisica, estimulacion cognitiva y masaje terapeutico para adultos mayores'),
    ('Servicios varios', 'Deporte y recreacion', 'Entrenador personal y rutinas personalizadas'),
    ('Servicios varios', 'Deporte y recreacion', 'Clases de fitness, yoga, pilates y crossfit'),
    ('Servicios varios', 'Deporte y recreacion', 'Clases de artes marciales, basquetbol, tenis, padel, natacion y futbol'),
    ('Servicios varios', 'Deporte y recreacion', 'Clases de baile (cueca, salsa, urbano) y boxeo'),
    ('Servicios varios', 'Deporte y recreacion', 'Coaching deportivo y acondicionamiento fisico'),
    ('Servicios varios', 'Clases y tutorias', 'Reforzamiento escolar (matematicas, lenguaje, ciencias, historia, ingles)'),
    ('Servicios varios', 'Clases y tutorias', 'Preparacion para la PAES y apoyo en tareas'),
    ('Servicios varios', 'Clases y tutorias', 'Clases de computacion'),
    ('Servicios varios', 'Clases y tutorias', 'Clases de guitarra, piano y canto'),
    ('Servicios varios', 'Clases y tutorias', 'Clases de idiomas (frances, portugues, mandarin)'),
    ('Servicios varios', 'Clases y tutorias', 'Clases de dibujo, pintura y fotografia'),
    ('Servicios varios', 'Traslados y mudanzas', 'Mudanza y flete punto a punto'),
    ('Servicios varios', 'Traslados y mudanzas', 'Chofer particular por hora y para eventos'),
    ('Servicios varios', 'Traslados y mudanzas', 'Traslados de personas, especiales y al aeropuerto'),
    ('Servicios varios', 'Traslados y mudanzas', 'Mensajeria y delivery'),
    ('Servicios varios', 'Traslados y mudanzas', 'Servicio de minivan, transporte escolar y ambulancia privada'),
    ('Servicios varios', 'Entretenimiento y eventos', 'DJ, musica en vivo y karaoke a domicilio'),
    ('Servicios varios', 'Entretenimiento y eventos', 'Animacion infantil, cumpleaños y quinceañeros'),
    ('Servicios varios', 'Entretenimiento y eventos', 'Fotografia y videografia de eventos (profesional a domicilio)'),
    ('Servicios varios', 'Entretenimiento y eventos', 'Show de magia, payaso/clown y cuentacuentos'),
    ('Servicios varios', 'Entretenimiento y eventos', 'Maestro de ceremonias y piñatero'),
    ('Servicios varios', 'Entretenimiento y eventos', 'Decoracion de eventos y alquiler de implementos'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'Joyeria personalizada, fabricacion, reparacion, grabado, ajuste y limpieza'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'Bisuteria artesanal'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'Ceramica personalizada, decorativa, utilitaria, restauracion y esmaltado'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'Tejido a mano (crochet/palillo), prendas a pedido y reparacion de tejidos'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'Amigurumis y macrame'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'Lienzos y cuadros pintados a mano'),
    ('Servicios varios', 'Arte, creatividad y artesanias', 'Decoupage y decoracion artesanal'),
    ('Servicios varios', 'Esoterismo y espiritualidad', 'Lectura de cartas (Tarot, oraculos), runas, pendulo y quiromancia'),
    ('Servicios varios', 'Esoterismo y espiritualidad', 'Numerologia y astrologia'),
    ('Servicios varios', 'Esoterismo y espiritualidad', 'Reiki, sanacion energetica, alineacion de chakras y limpiezas energeticas'),
    ('Servicios varios', 'Esoterismo y espiritualidad', 'Rituales de amor, proteccion y consejeria espiritual'),
    ('Servicios varios', 'Esoterismo y espiritualidad', 'Meditacion guiada, cristaloterapia y aromaterapia'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'Trámites municipales'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'Trámites en Registro Civil'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'Pago de cuentas de servicios básicos'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'Retiro y entrega de documentos en oficinas públicas'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'Hacer filas en consultorios , bancos, municipalidad, etc'),
    ('Servicios varios', 'Acompañante o gestión de Trámites y Mandados', 'Acompañamiento a citas médicas y trámites presenciales')
)
INSERT INTO services (name, subcategory_id, created_at, updated_at)
SELECT v.name, sc.id, NOW(), NOW()
FROM v
JOIN main_categories mc ON pg_temp.norm_text(mc.name) = pg_temp.norm_text(v.category_name)
JOIN subcategories sc ON sc.main_category_id = mc.id AND pg_temp.norm_text(sc.name) = pg_temp.norm_text(v.subcategory_name)
WHERE NOT EXISTS (
  SELECT 1 FROM services s
  WHERE s.subcategory_id = sc.id
    AND pg_temp.norm_text(s.name) = pg_temp.norm_text(v.name)
);

DROP FUNCTION IF EXISTS pg_temp.norm_text(text);

COMMIT;
