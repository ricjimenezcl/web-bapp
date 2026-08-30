-- ============================================================
-- BAPP - Estructura de categorías
-- Generado: 2026-08-29
-- PostgreSQL compatible
-- ============================================================

-- ------------------------------------------------------------
-- TABLAS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS main_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    icon        VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcategories (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(150) NOT NULL,
    description      TEXT,
    icon             VARCHAR(255),
    main_category_id INTEGER NOT NULL REFERENCES main_categories(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    icon            VARCHAR(255),
    subcategory_id  INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_subcategories_main_category ON subcategories(main_category_id);
CREATE INDEX IF NOT EXISTS idx_services_subcategory        ON services(subcategory_id);

-- ------------------------------------------------------------
-- DATOS
-- ------------------------------------------------------------

-- Limpiar datos previos (orden inverso por FK)
TRUNCATE services, subcategories, main_categories RESTART IDENTITY CASCADE;

-- ── Hogar y Construcción ──
INSERT INTO main_categories (id, name) VALUES (1, 'Hogar y Construcción');

INSERT INTO subcategories (id, name, main_category_id) VALUES (1, 'Obras y estructura', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (1, 'Albañilería', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (2, 'Soldadura', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (3, 'Retiro de escombros', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (4, 'Revestimientos de muros', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (5, 'Instalación de pisos', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (6, 'Construcción de terrazas de madera', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (7, 'Hojalatería', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (8, 'Techumbres y canaletas', 1);

INSERT INTO subcategories (id, name, main_category_id) VALUES (2, 'Carpintería y vidriería', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (9, 'Carpintería', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (10, 'Vidriería', 2);

INSERT INTO subcategories (id, name, main_category_id) VALUES (3, 'Instalaciones', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (11, 'Gasfitería', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (12, 'Electricista domiciliario', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (13, 'Instalación de calefont y termos', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (14, 'Climatización', 3);

INSERT INTO subcategories (id, name, main_category_id) VALUES (4, 'Seguridad', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (15, 'Cerrajero domiciliario', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (16, 'Instalación cámaras CCTV', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (17, 'Alarmas', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (18, 'Cercos eléctricos', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (19, 'Control de acceso', 4);

INSERT INTO subcategories (id, name, main_category_id) VALUES (5, 'Pintura', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (20, 'Pintura', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (21, 'Pintura exterior', 5);

INSERT INTO subcategories (id, name, main_category_id) VALUES (6, 'Equipamiento y decoración', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (22, 'Instalación de cortinas', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (23, 'Montaje de muebles', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (24, 'Instalación de persianas y cortinas', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (25, 'Arreglos florales', 6);

INSERT INTO subcategories (id, name, main_category_id) VALUES (7, 'Aseo y limpieza', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (26, 'Aseo del hogar', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (27, 'Aseo y planchado', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (28, 'Limpieza de alfombras y tapices', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (29, 'Sanitización y desinfección', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (30, 'Limpieza de ventanas', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (31, 'Limpieza post obra', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (32, 'Limpieza del hogar', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (33, 'Lavado de ropa', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (34, 'Planchado', 7);

INSERT INTO subcategories (id, name, main_category_id) VALUES (8, 'Jardinería y exterior', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (35, 'Jardinería', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (36, 'Poda de árboles', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (37, 'Corte de césped', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (38, 'Limpieza de piscinas', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (39, 'Paisajismo', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (40, 'Riego automático', 8);

INSERT INTO subcategories (id, name, main_category_id) VALUES (9, 'Control de plagas', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (41, 'Control de plagas y fumigación', 9);
INSERT INTO services (id, name, subcategory_id) VALUES (42, 'Control de plagas', 9);

INSERT INTO subcategories (id, name, main_category_id) VALUES (10, 'Organización y cocina', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (43, 'Preparación de comidas diarias', 10);
INSERT INTO services (id, name, subcategory_id) VALUES (44, 'Organización del hogar', 10);
INSERT INTO services (id, name, subcategory_id) VALUES (45, 'Asesora del hogar', 10);

INSERT INTO subcategories (id, name, main_category_id) VALUES (11, 'Reparaciones', 1);
INSERT INTO services (id, name, subcategory_id) VALUES (46, 'Reparación de electrodomésticos', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (47, 'Reparación de TV', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (48, 'Reparación de lavadoras', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (49, 'Reparación de refrigeradores', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (50, 'Reparación de muebles', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (51, 'Reparación de calzado', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (52, 'Reparación de bicicletas', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (53, 'Reparación de bicicletas eléctricas', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (54, 'Reparación de relojes', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (55, 'Reparación de consolas de videojuegos y controles', 11);
INSERT INTO services (id, name, subcategory_id) VALUES (56, 'Reparación de sillas de ruedas', 11);

-- ── Belleza y Bienestar ──
INSERT INTO main_categories (id, name) VALUES (2, 'Belleza y Bienestar');

INSERT INTO subcategories (id, name, main_category_id) VALUES (12, 'Cabello', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (57, 'Peluquería y corte de cabello', 12);
INSERT INTO services (id, name, subcategory_id) VALUES (58, 'Peluquería a domicilio', 12);
INSERT INTO services (id, name, subcategory_id) VALUES (59, 'Peinados y styling', 12);
INSERT INTO services (id, name, subcategory_id) VALUES (60, 'Coloración y mechas', 12);
INSERT INTO services (id, name, subcategory_id) VALUES (61, 'Tratamientos capilares', 12);
INSERT INTO services (id, name, subcategory_id) VALUES (62, 'Extensiones de cabello', 12);
INSERT INTO services (id, name, subcategory_id) VALUES (63, 'Barbería y arreglo de barba', 12);

INSERT INTO subcategories (id, name, main_category_id) VALUES (13, 'Uñas', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (64, 'Manicure y pedicure', 13);
INSERT INTO services (id, name, subcategory_id) VALUES (65, 'Manicure y pedicure a domicilio', 13);
INSERT INTO services (id, name, subcategory_id) VALUES (66, 'Uñas acrílicas y esculpidas', 13);

INSERT INTO subcategories (id, name, main_category_id) VALUES (14, 'Depilación y cejas', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (67, 'Depilación con cera (+ a domicilio)', 14);
INSERT INTO services (id, name, subcategory_id) VALUES (68, 'Depilación láser', 14);
INSERT INTO services (id, name, subcategory_id) VALUES (69, 'Diseño y perfilado de cejas', 14);
INSERT INTO services (id, name, subcategory_id) VALUES (70, 'Extensiones y lifting de pestañas', 14);

INSERT INTO subcategories (id, name, main_category_id) VALUES (15, 'Maquillaje', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (71, 'Maquillaje profesional', 15);
INSERT INTO services (id, name, subcategory_id) VALUES (72, 'Maquillaje a domicilio', 15);

INSERT INTO subcategories (id, name, main_category_id) VALUES (16, 'Tratamientos', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (73, 'Tratamientos faciales', 16);
INSERT INTO services (id, name, subcategory_id) VALUES (74, 'Tratamientos corporales', 16);
INSERT INTO services (id, name, subcategory_id) VALUES (75, 'Podología', 16);

INSERT INTO subcategories (id, name, main_category_id) VALUES (17, 'Masajes', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (76, 'Masaje relajante', 17);
INSERT INTO services (id, name, subcategory_id) VALUES (77, 'Masaje descontracturante', 17);
INSERT INTO services (id, name, subcategory_id) VALUES (78, 'Masajes a domicilio', 17);

INSERT INTO subcategories (id, name, main_category_id) VALUES (18, 'Tatuajes', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (79, 'Tatuajes artísticos', 18);
INSERT INTO services (id, name, subcategory_id) VALUES (80, 'Tatuajes temporales', 18);
INSERT INTO services (id, name, subcategory_id) VALUES (81, 'Cobertura de tatuajes', 18);
INSERT INTO services (id, name, subcategory_id) VALUES (82, 'Retiro de tatuajes y micropigmentación', 18);

INSERT INTO subcategories (id, name, main_category_id) VALUES (19, 'Piercings', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (83, 'Perforaciones', 19);
INSERT INTO services (id, name, subcategory_id) VALUES (84, 'Expansión de lóbulos', 19);

INSERT INTO subcategories (id, name, main_category_id) VALUES (20, 'Micropigmentación', 2);
INSERT INTO services (id, name, subcategory_id) VALUES (85, 'Micropigmentación de cejas (microblading)', 20);
INSERT INTO services (id, name, subcategory_id) VALUES (86, 'Semipermanente de labios', 20);
INSERT INTO services (id, name, subcategory_id) VALUES (87, 'Nanopigmentación corporal', 20);

-- ── Cuidado y Salud ──
INSERT INTO main_categories (id, name) VALUES (3, 'Cuidado y Salud');

INSERT INTO subcategories (id, name, main_category_id) VALUES (21, 'Salud en casa', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (88, 'Toma de presión', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (89, 'Inyecciones', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (90, 'Curaciones', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (91, 'Exámenes de laboratorio a domicilio', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (92, 'Cuidado de pacientes', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (93, 'Ayuda en higiene personal', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (94, 'Cuidados paliativos', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (95, 'Cuidados postoperatorios', 21);
INSERT INTO services (id, name, subcategory_id) VALUES (96, 'Enfermería a domicilio', 21);

INSERT INTO subcategories (id, name, main_category_id) VALUES (22, 'Terapias y rehabilitación', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (97, 'Kinesioterapia a domicilio', 22);
INSERT INTO services (id, name, subcategory_id) VALUES (98, 'Masaje terapéutico a domicilio', 22);
INSERT INTO services (id, name, subcategory_id) VALUES (99, 'Terapia ocupacional', 22);
INSERT INTO services (id, name, subcategory_id) VALUES (100, 'Fonoaudiología', 22);
INSERT INTO services (id, name, subcategory_id) VALUES (101, 'Acupuntura', 22);

INSERT INTO subcategories (id, name, main_category_id) VALUES (23, 'Salud mental y nutrición', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (102, 'Psicología a domicilio', 23);
INSERT INTO services (id, name, subcategory_id) VALUES (103, 'Nutrición y dietética a domicilio', 23);
INSERT INTO services (id, name, subcategory_id) VALUES (104, 'Acompañamiento y cuidado emocional', 23);

INSERT INTO subcategories (id, name, main_category_id) VALUES (24, 'Niños y niñera', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (105, 'Niñera a domicilio', 24);
INSERT INTO services (id, name, subcategory_id) VALUES (106, 'Babysitter por horas', 24);
INSERT INTO services (id, name, subcategory_id) VALUES (107, 'Cuidado de niños jornada completa', 24);
INSERT INTO services (id, name, subcategory_id) VALUES (108, 'Cuidado nocturno de niños', 24);
INSERT INTO services (id, name, subcategory_id) VALUES (109, 'Cuidado ocasional', 24);
INSERT INTO services (id, name, subcategory_id) VALUES (110, 'Cuidado de lactantes', 24);
INSERT INTO services (id, name, subcategory_id) VALUES (111, 'Cuidado de niños con necesidades especiales', 24);

INSERT INTO subcategories (id, name, main_category_id) VALUES (25, 'Estimulación y educación infantil', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (112, 'Traslado y retiro al colegio', 25);
INSERT INTO services (id, name, subcategory_id) VALUES (113, 'Cuidado después del colegio', 25);
INSERT INTO services (id, name, subcategory_id) VALUES (114, 'Estimulación temprana', 25);
INSERT INTO services (id, name, subcategory_id) VALUES (115, 'Apoyo escolar en casa', 25);

INSERT INTO subcategories (id, name, main_category_id) VALUES (26, 'Adultos mayores', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (116, 'Acompañante para trámites o citas médicas', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (117, 'Traslado a consultas médicas', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (118, 'Acompañamiento y cuidado emocional', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (119, 'Cuidado en domicilio', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (120, 'Asistencia en movilidad', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (121, 'Asistente personal para compras o supermercado', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (122, 'Administración de medicamentos', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (123, 'Actividad física adulto mayor', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (124, 'Estimulación cognitiva para adultos mayores', 26);
INSERT INTO services (id, name, subcategory_id) VALUES (125, 'Masaje terapéutico adulto mayor', 26);

INSERT INTO subcategories (id, name, main_category_id) VALUES (27, 'Mascotas', 3);
INSERT INTO services (id, name, subcategory_id) VALUES (126, 'Peluquería canina', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (127, 'Peluquería canina a domicilio', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (128, 'Baño y limpieza de mascotas', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (129, 'Baño y limpieza de mascotas a domicilio', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (130, 'Adiestramiento', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (131, 'Paseo de mascotas', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (132, 'Paseo y entrenamiento de mascotas', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (133, 'Veterinario a domicilio', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (134, 'Medicina veterinaria', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (135, 'Hotel para mascotas', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (136, 'Transporte de mascotas', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (137, 'Cuidado de mascotas', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (138, 'Alimentos para mascotas', 27);
INSERT INTO services (id, name, subcategory_id) VALUES (139, 'Fotografía de mascotas', 27);

-- ── Educación y Deporte ──
INSERT INTO main_categories (id, name) VALUES (4, 'Educación y Deporte');

INSERT INTO subcategories (id, name, main_category_id) VALUES (28, 'Reforzamiento escolar', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (140, 'Clases de reforzamiento: matemáticas', 28);
INSERT INTO services (id, name, subcategory_id) VALUES (141, 'Clases de reforzamiento: lenguaje y comunicación', 28);
INSERT INTO services (id, name, subcategory_id) VALUES (142, 'Clases de reforzamiento: ciencias', 28);
INSERT INTO services (id, name, subcategory_id) VALUES (143, 'Clases de reforzamiento: historia y cs. sociales', 28);
INSERT INTO services (id, name, subcategory_id) VALUES (144, 'Clases de reforzamiento: inglés', 28);
INSERT INTO services (id, name, subcategory_id) VALUES (145, 'Preparación para la PAES', 28);
INSERT INTO services (id, name, subcategory_id) VALUES (146, 'Apoyo en tareas', 28);

INSERT INTO subcategories (id, name, main_category_id) VALUES (29, 'Tecnología', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (147, 'Clases de computación', 29);

INSERT INTO subcategories (id, name, main_category_id) VALUES (30, 'Música', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (148, 'Clases de guitarra', 30);
INSERT INTO services (id, name, subcategory_id) VALUES (149, 'Clases de piano', 30);
INSERT INTO services (id, name, subcategory_id) VALUES (150, 'Clases de canto', 30);

INSERT INTO subcategories (id, name, main_category_id) VALUES (31, 'Idiomas', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (151, 'Clases de idiomas (francés, portugués, mandarín)', 31);

INSERT INTO subcategories (id, name, main_category_id) VALUES (32, 'Arte', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (152, 'Clases de dibujo y pintura', 32);
INSERT INTO services (id, name, subcategory_id) VALUES (153, 'Clases de fotografía', 32);

INSERT INTO subcategories (id, name, main_category_id) VALUES (33, 'Entrenamiento personal', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (154, 'Entrenador personal', 33);
INSERT INTO services (id, name, subcategory_id) VALUES (155, 'Crossfit personalizado', 33);
INSERT INTO services (id, name, subcategory_id) VALUES (156, 'Rutinas personalizadas', 33);
INSERT INTO services (id, name, subcategory_id) VALUES (157, 'Clases de acondicionamiento físico', 33);
INSERT INTO services (id, name, subcategory_id) VALUES (158, 'Coaching deportivo', 33);

INSERT INTO subcategories (id, name, main_category_id) VALUES (34, 'Deportes de raqueta', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (159, 'Clases de tenis', 34);
INSERT INTO services (id, name, subcategory_id) VALUES (160, 'Clases de pádel', 34);

INSERT INTO subcategories (id, name, main_category_id) VALUES (35, 'Deportes de equipo', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (161, 'Clases de básquetbol', 35);
INSERT INTO services (id, name, subcategory_id) VALUES (162, 'Clases de fútbol', 35);

INSERT INTO subcategories (id, name, main_category_id) VALUES (36, 'Artes marciales y contacto', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (163, 'Clases de artes marciales', 36);
INSERT INTO services (id, name, subcategory_id) VALUES (164, 'Clases de boxeo', 36);

INSERT INTO subcategories (id, name, main_category_id) VALUES (37, 'Baile y bienestar', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (165, 'Yoga / pilates', 37);
INSERT INTO services (id, name, subcategory_id) VALUES (166, 'Clases de baile (cueca, salsa, urbano)', 37);
INSERT INTO services (id, name, subcategory_id) VALUES (167, 'Clases de fitness', 37);

INSERT INTO subcategories (id, name, main_category_id) VALUES (38, 'Natación', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (168, 'Clases de natación', 38);

INSERT INTO subcategories (id, name, main_category_id) VALUES (39, 'Eventos deportivos', 4);
INSERT INTO services (id, name, subcategory_id) VALUES (169, 'Recreación y eventos deportivos', 39);

-- ── Tecnología y Vehículos ──
INSERT INTO main_categories (id, name) VALUES (5, 'Tecnología y Vehículos');

INSERT INTO subcategories (id, name, main_category_id) VALUES (40, 'Mecánica general', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (170, 'Frenos', 40);
INSERT INTO services (id, name, subcategory_id) VALUES (171, 'Mecánica automotriz', 40);
INSERT INTO services (id, name, subcategory_id) VALUES (172, 'Mecánico a domicilio', 40);
INSERT INTO services (id, name, subcategory_id) VALUES (173, 'Diagnóstico automotriz', 40);
INSERT INTO services (id, name, subcategory_id) VALUES (174, 'Cambio de aceite', 40);
INSERT INTO services (id, name, subcategory_id) VALUES (175, 'Cambio de baterías', 40);
INSERT INTO services (id, name, subcategory_id) VALUES (176, 'Suspensión', 40);
INSERT INTO services (id, name, subcategory_id) VALUES (177, 'Scanner automotriz', 40);

INSERT INTO subcategories (id, name, main_category_id) VALUES (41, 'Motos', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (178, 'Mecánica de motos', 41);

INSERT INTO subcategories (id, name, main_category_id) VALUES (42, 'Electricidad y electrónica automotriz', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (179, 'Electricidad automotriz', 42);
INSERT INTO services (id, name, subcategory_id) VALUES (180, 'Instalación de audio y alarmas vehiculares', 42);
INSERT INTO services (id, name, subcategory_id) VALUES (181, 'Aire acondicionado automotriz', 42);
INSERT INTO services (id, name, subcategory_id) VALUES (182, 'Instalación de accesorios', 42);

INSERT INTO subcategories (id, name, main_category_id) VALUES (43, 'Carrocería y estética', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (183, 'Desabolladura y pintura', 43);
INSERT INTO services (id, name, subcategory_id) VALUES (184, 'Lavado de autos', 43);
INSERT INTO services (id, name, subcategory_id) VALUES (185, 'Lavado de autos a domicilio', 43);
INSERT INTO services (id, name, subcategory_id) VALUES (186, 'Tapicería de autos', 43);

INSERT INTO subcategories (id, name, main_category_id) VALUES (44, 'Neumáticos y dirección', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (187, 'Vulcanización', 44);
INSERT INTO services (id, name, subcategory_id) VALUES (188, 'Alineación y balanceo', 44);
INSERT INTO services (id, name, subcategory_id) VALUES (189, 'Tubos de escape', 44);

INSERT INTO subcategories (id, name, main_category_id) VALUES (45, 'Servicios automotrices especiales', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (190, 'Servicio de grúa', 45);
INSERT INTO services (id, name, subcategory_id) VALUES (191, 'Cerrajería de vehículos', 45);

INSERT INTO subcategories (id, name, main_category_id) VALUES (46, 'Celulares y tablets', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (192, 'Cambio de pantalla', 46);
INSERT INTO services (id, name, subcategory_id) VALUES (193, 'Reparación de botones físicos y flexes', 46);
INSERT INTO services (id, name, subcategory_id) VALUES (194, 'Reparación de placa madre', 46);
INSERT INTO services (id, name, subcategory_id) VALUES (195, 'Desbloqueo de equipos', 46);
INSERT INTO services (id, name, subcategory_id) VALUES (196, 'Recuperación de datos', 46);
INSERT INTO services (id, name, subcategory_id) VALUES (197, 'Reparación de tablets', 46);

INSERT INTO subcategories (id, name, main_category_id) VALUES (47, 'Computadores y notebooks', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (198, 'Reparación de notebooks', 47);
INSERT INTO services (id, name, subcategory_id) VALUES (199, 'Reinstalación de sistema operativo', 47);
INSERT INTO services (id, name, subcategory_id) VALUES (200, 'Eliminación de virus y software malicioso', 47);
INSERT INTO services (id, name, subcategory_id) VALUES (201, 'Formateo y particionado de discos', 47);
INSERT INTO services (id, name, subcategory_id) VALUES (202, 'Armado y configuración de PC', 47);
INSERT INTO services (id, name, subcategory_id) VALUES (203, 'Limpieza interna de componentes', 47);

INSERT INTO subcategories (id, name, main_category_id) VALUES (48, 'Servicio y soporte técnico', 5);
INSERT INTO services (id, name, subcategory_id) VALUES (204, 'Servicio a domicilio', 48);
INSERT INTO services (id, name, subcategory_id) VALUES (205, 'Instalación y configuración de aplicaciones', 48);

-- ── Alimentación ──
INSERT INTO main_categories (id, name) VALUES (6, 'Alimentación');

INSERT INTO subcategories (id, name, main_category_id) VALUES (49, 'Delivery a domicilio', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (206, 'Delivery de comida casera', 49);
INSERT INTO services (id, name, subcategory_id) VALUES (207, 'Delivery de comida y postres', 49);
INSERT INTO services (id, name, subcategory_id) VALUES (208, 'Sushi delivery', 49);
INSERT INTO services (id, name, subcategory_id) VALUES (209, 'Comida rápida a domicilio', 49);
INSERT INTO services (id, name, subcategory_id) VALUES (210, 'Comida para llevar', 49);

INSERT INTO subcategories (id, name, main_category_id) VALUES (50, 'Platos y especialidades', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (211, 'Ceviches', 50);
INSERT INTO services (id, name, subcategory_id) VALUES (212, 'Pollos asados', 50);

INSERT INTO subcategories (id, name, main_category_id) VALUES (51, 'Panadería y dulces', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (213, 'Pan amasado', 51);
INSERT INTO services (id, name, subcategory_id) VALUES (214, 'Helados', 51);

INSERT INTO subcategories (id, name, main_category_id) VALUES (52, 'Catering y servicios', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (215, 'Banquetería y coffee break', 52);
INSERT INTO services (id, name, subcategory_id) VALUES (216, 'Cocinero/a por horas', 52);
INSERT INTO services (id, name, subcategory_id) VALUES (217, 'Carrito de comida', 52);

INSERT INTO subcategories (id, name, main_category_id) VALUES (53, 'Opciones especiales', 6);
INSERT INTO services (id, name, subcategory_id) VALUES (218, 'Comida rápida vegana/vegetariana', 53);

-- ── Eventos y Traslados ──
INSERT INTO main_categories (id, name) VALUES (7, 'Eventos y Traslados');

INSERT INTO subcategories (id, name, main_category_id) VALUES (54, 'Música y DJ', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (219, 'DJ para eventos', 54);
INSERT INTO services (id, name, subcategory_id) VALUES (220, 'Música en vivo (solista / grupo)', 54);
INSERT INTO services (id, name, subcategory_id) VALUES (221, 'Karaoke a domicilio', 54);

INSERT INTO subcategories (id, name, main_category_id) VALUES (55, 'Animación infantil', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (222, 'Animación infantil', 55);
INSERT INTO services (id, name, subcategory_id) VALUES (223, 'Animación para cumpleaños y quinceañeros', 55);
INSERT INTO services (id, name, subcategory_id) VALUES (224, 'Show de magia', 55);
INSERT INTO services (id, name, subcategory_id) VALUES (225, 'Payaso / Clown', 55);
INSERT INTO services (id, name, subcategory_id) VALUES (226, 'Cuentacuentos infantil', 55);
INSERT INTO services (id, name, subcategory_id) VALUES (227, 'Piñatero', 55);

INSERT INTO subcategories (id, name, main_category_id) VALUES (56, 'Fotografía y video', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (228, 'Fotografía de eventos', 56);
INSERT INTO services (id, name, subcategory_id) VALUES (229, 'Fotógrafo profesional a domicilio', 56);
INSERT INTO services (id, name, subcategory_id) VALUES (230, 'Videografía de eventos', 56);

INSERT INTO subcategories (id, name, main_category_id) VALUES (57, 'Ceremonias', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (231, 'Maestro de ceremonias', 57);

INSERT INTO subcategories (id, name, main_category_id) VALUES (58, 'Decoración y logística', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (232, 'Decoración de eventos', 58);
INSERT INTO services (id, name, subcategory_id) VALUES (233, 'Alquiler de implementos para eventos', 58);

INSERT INTO subcategories (id, name, main_category_id) VALUES (59, 'Mudanzas y fletes', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (234, 'Mudanza', 59);
INSERT INTO services (id, name, subcategory_id) VALUES (235, 'Flete punto a punto', 59);

INSERT INTO subcategories (id, name, main_category_id) VALUES (60, 'Choferes', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (236, 'Chofer particular por hora', 60);
INSERT INTO services (id, name, subcategory_id) VALUES (237, 'Chofer para eventos', 60);
INSERT INTO services (id, name, subcategory_id) VALUES (238, 'Traslados de personas', 60);

INSERT INTO subcategories (id, name, main_category_id) VALUES (61, 'Traslados especiales', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (239, 'Traslados especiales', 61);
INSERT INTO services (id, name, subcategory_id) VALUES (240, 'Traslado al aeropuerto', 61);
INSERT INTO services (id, name, subcategory_id) VALUES (241, 'Transporte escolar', 61);
INSERT INTO services (id, name, subcategory_id) VALUES (242, 'Ambulancia privada', 61);

INSERT INTO subcategories (id, name, main_category_id) VALUES (62, 'Mensajería', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (243, 'Mensajería y delivery', 62);

INSERT INTO subcategories (id, name, main_category_id) VALUES (63, 'Vans y colectivos', 7);
INSERT INTO services (id, name, subcategory_id) VALUES (244, 'Servicio de minivan', 63);

-- ── Arte y Creatividad ──
INSERT INTO main_categories (id, name) VALUES (8, 'Arte y Creatividad');

INSERT INTO subcategories (id, name, main_category_id) VALUES (64, 'Joyería', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (245, 'Joyería personalizada', 64);
INSERT INTO services (id, name, subcategory_id) VALUES (246, 'Fabricación de joyas', 64);
INSERT INTO services (id, name, subcategory_id) VALUES (247, 'Reparación de joyas', 64);
INSERT INTO services (id, name, subcategory_id) VALUES (248, 'Grabado de joyas', 64);
INSERT INTO services (id, name, subcategory_id) VALUES (249, 'Ajuste de anillos', 64);
INSERT INTO services (id, name, subcategory_id) VALUES (250, 'Limpieza de joyas', 64);
INSERT INTO services (id, name, subcategory_id) VALUES (251, 'Bisutería artesanal', 64);

INSERT INTO subcategories (id, name, main_category_id) VALUES (65, 'Cerámica', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (252, 'Cerámica personalizada', 65);
INSERT INTO services (id, name, subcategory_id) VALUES (253, 'Creación de piezas de cerámica', 65);
INSERT INTO services (id, name, subcategory_id) VALUES (254, 'Cerámica decorativa', 65);
INSERT INTO services (id, name, subcategory_id) VALUES (255, 'Cerámica utilitaria (hogar)', 65);
INSERT INTO services (id, name, subcategory_id) VALUES (256, 'Restauración de cerámica', 65);
INSERT INTO services (id, name, subcategory_id) VALUES (257, 'Esmaltado de cerámica', 65);

INSERT INTO subcategories (id, name, main_category_id) VALUES (66, 'Tejidos y bordados artesanales', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (258, 'Tejido a mano (crochet / palillo)', 66);
INSERT INTO services (id, name, subcategory_id) VALUES (259, 'Prendas tejidas a pedido', 66);
INSERT INTO services (id, name, subcategory_id) VALUES (260, 'Reparación de tejidos', 66);
INSERT INTO services (id, name, subcategory_id) VALUES (261, 'Bordado artesanal', 66);
INSERT INTO services (id, name, subcategory_id) VALUES (262, 'Tejidos decorativos (mantas, cojines)', 66);
INSERT INTO services (id, name, subcategory_id) VALUES (263, 'Amigurumis', 66);
INSERT INTO services (id, name, subcategory_id) VALUES (264, 'Macramé', 66);

INSERT INTO subcategories (id, name, main_category_id) VALUES (67, 'Arte visual', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (265, 'Lienzos y cuadros pintados a mano', 67);
INSERT INTO services (id, name, subcategory_id) VALUES (266, 'Decoupage y decoración artesanal', 67);
INSERT INTO services (id, name, subcategory_id) VALUES (267, 'Personalización de ropa', 67);

INSERT INTO subcategories (id, name, main_category_id) VALUES (68, 'Confección de ropa', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (268, 'Confección a medida', 68);
INSERT INTO services (id, name, subcategory_id) VALUES (269, 'Uniformes escolares', 68);
INSERT INTO services (id, name, subcategory_id) VALUES (270, 'Disfraces', 68);
INSERT INTO services (id, name, subcategory_id) VALUES (271, 'Customización de ropa', 68);
INSERT INTO services (id, name, subcategory_id) VALUES (272, 'Ropa de bebé a medida', 68);
INSERT INTO services (id, name, subcategory_id) VALUES (273, 'Ropa deportiva personalizada', 68);
INSERT INTO services (id, name, subcategory_id) VALUES (274, 'Ajuste y arreglo de ropa', 68);

INSERT INTO subcategories (id, name, main_category_id) VALUES (69, 'Arriendo y textiles', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (275, 'Arriendo de ternos', 69);
INSERT INTO services (id, name, subcategory_id) VALUES (276, 'Cortinas a medida', 69);
INSERT INTO services (id, name, subcategory_id) VALUES (277, 'Fundas de almohadas y cojines', 69);

INSERT INTO subcategories (id, name, main_category_id) VALUES (70, 'Bordados y estampados', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (278, 'Bordados', 70);
INSERT INTO services (id, name, subcategory_id) VALUES (279, 'Estampados', 70);

INSERT INTO subcategories (id, name, main_category_id) VALUES (71, 'Lectura y predicción', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (280, 'Lectura de cartas (Tarot, oráculos)', 71);
INSERT INTO services (id, name, subcategory_id) VALUES (281, 'Lectura de runas', 71);
INSERT INTO services (id, name, subcategory_id) VALUES (282, 'Lectura de péndulo', 71);
INSERT INTO services (id, name, subcategory_id) VALUES (283, 'Quiromancia (lectura de manos)', 71);
INSERT INTO services (id, name, subcategory_id) VALUES (284, 'Numerología', 71);
INSERT INTO services (id, name, subcategory_id) VALUES (285, 'Astrología', 71);

INSERT INTO subcategories (id, name, main_category_id) VALUES (72, 'Energía y sanación', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (286, 'Reiki', 72);
INSERT INTO services (id, name, subcategory_id) VALUES (287, 'Sanación energética', 72);
INSERT INTO services (id, name, subcategory_id) VALUES (288, 'Alineación de chakras', 72);
INSERT INTO services (id, name, subcategory_id) VALUES (289, 'Limpiezas energéticas', 72);

INSERT INTO subcategories (id, name, main_category_id) VALUES (73, 'Rituales y protección', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (290, 'Rituales de amor (unión, atracción)', 73);
INSERT INTO services (id, name, subcategory_id) VALUES (291, 'Rituales de protección', 73);
INSERT INTO services (id, name, subcategory_id) VALUES (292, 'Protección espiritual', 73);

INSERT INTO subcategories (id, name, main_category_id) VALUES (74, 'Consejería y meditación', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (293, 'Consejería espiritual', 74);
INSERT INTO services (id, name, subcategory_id) VALUES (294, 'Meditación guiada', 74);

INSERT INTO subcategories (id, name, main_category_id) VALUES (75, 'Terapias complementarias', 8);
INSERT INTO services (id, name, subcategory_id) VALUES (295, 'Cristaloterapia', 75);
INSERT INTO services (id, name, subcategory_id) VALUES (296, 'Aromaterapia', 75);

-- Ajustar secuencias tras INSERT con IDs explícitos
SELECT setval('main_categories_id_seq', 8);
SELECT setval('subcategories_id_seq',   75);
SELECT setval('services_id_seq',        296);

-- Total: 8 categorías | 75 subcategorías | 296 servicios