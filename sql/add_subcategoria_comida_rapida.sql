BEGIN;

-- Crea/actualiza la subcategoria "Comida rapida" bajo "Alimentacion" y agrega servicios.
-- Es idempotente: no duplica registros si ya existen.

DO $$
DECLARE
  v_main_category_id INTEGER;
  v_subcategory_id INTEGER;
BEGIN
  -- Buscar categoria principal por nombre (con y sin tilde).
  SELECT id
    INTO v_main_category_id
  FROM main_categories
  WHERE LOWER(name) IN ('alimentacion', 'alimentación')
  ORDER BY id
  LIMIT 1;

  IF v_main_category_id IS NULL THEN
    RAISE EXCEPTION 'No existe la categoria principal Alimentacion/Alimentación en main_categories';
  END IF;

  -- Crear la subcategoria si no existe.
  SELECT id
    INTO v_subcategory_id
  FROM subcategories
  WHERE main_category_id = v_main_category_id
    AND LOWER(name) = 'comida rapida'
  LIMIT 1;

  IF v_subcategory_id IS NULL THEN
    INSERT INTO subcategories (
      name,
      description,
      icon,
      main_category_id,
      created_at,
      updated_at
    )
    VALUES (
      'Comida rapida',
      'Preparacion y despacho de comida rapida: completos, churrascos, sushi, chorrillanas, hamburguesas, papas fritas y empanadas.',
      'fast-food-outline',
      v_main_category_id,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_subcategory_id;
  ELSE
    -- Si existe, asegurar descripcion e icono solicitados.
    UPDATE subcategories
    SET description = 'Preparacion y despacho de comida rapida: completos, churrascos, sushi, chorrillanas, hamburguesas, papas fritas y empanadas.',
        icon = 'fast-food-outline',
        updated_at = NOW()
    WHERE id = v_subcategory_id;
  END IF;

  -- Servicios requeridos en la subcategoria.
  IF NOT EXISTS (SELECT 1 FROM services WHERE subcategory_id = v_subcategory_id AND LOWER(name) = 'completos') THEN
    INSERT INTO services (name, description, icon, subcategory_id, created_at, updated_at)
    VALUES ('Completos', 'Preparacion de completos clasicos, italianos y especiales.', 'fast-food-outline', v_subcategory_id, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE subcategory_id = v_subcategory_id AND LOWER(name) = 'churrascos') THEN
    INSERT INTO services (name, description, icon, subcategory_id, created_at, updated_at)
    VALUES ('Churrascos', 'Preparacion de churrascos tradicionales y gourmet.', 'fast-food-outline', v_subcategory_id, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE subcategory_id = v_subcategory_id AND LOWER(name) = 'sushi') THEN
    INSERT INTO services (name, description, icon, subcategory_id, created_at, updated_at)
    VALUES ('Sushi', 'Preparacion de rolls, nigiris y combinaciones de sushi.', 'fast-food-outline', v_subcategory_id, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE subcategory_id = v_subcategory_id AND LOWER(name) = 'chorrillanas') THEN
    INSERT INTO services (name, description, icon, subcategory_id, created_at, updated_at)
    VALUES ('Chorrillanas', 'Preparacion de chorrillanas clasicas y versiones especiales.', 'fast-food-outline', v_subcategory_id, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE subcategory_id = v_subcategory_id AND LOWER(name) = 'hamburguesas') THEN
    INSERT INTO services (name, description, icon, subcategory_id, created_at, updated_at)
    VALUES ('Hamburguesas', 'Preparacion de hamburguesas artesanales y tradicionales.', 'fast-food-outline', v_subcategory_id, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE subcategory_id = v_subcategory_id AND LOWER(name) = 'papas fritas') THEN
    INSERT INTO services (name, description, icon, subcategory_id, created_at, updated_at)
    VALUES ('Papas fritas', 'Preparacion de papas fritas clasicas, rusticas y con toppings.', 'fast-food-outline', v_subcategory_id, NOW(), NOW());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM services WHERE subcategory_id = v_subcategory_id AND LOWER(name) = 'empanadas') THEN
    INSERT INTO services (name, description, icon, subcategory_id, created_at, updated_at)
    VALUES ('Empanadas', 'Preparacion de empanadas horneadas y fritas con distintos rellenos.', 'fast-food-outline', v_subcategory_id, NOW(), NOW());
  END IF;
END $$;

COMMIT;
