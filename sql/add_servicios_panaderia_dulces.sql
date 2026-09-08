BEGIN;

-- Agrega nuevos servicios a la subcategoria "Panaderia y dulces"
-- dentro de la categoria principal "Alimentacion".
-- Script idempotente: no duplica si ya existen.

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

  -- Buscar subcategoria por nombre (con y sin tilde) dentro de Alimentacion.
  SELECT id
    INTO v_subcategory_id
  FROM subcategories
  WHERE main_category_id = v_main_category_id
    AND LOWER(name) IN ('panaderia y dulces', 'panadería y dulces')
  ORDER BY id
  LIMIT 1;

  IF v_subcategory_id IS NULL THEN
    RAISE EXCEPTION 'No existe la subcategoria Panaderia y dulces dentro de Alimentacion/Alimentación';
  END IF;

  -- Servicio: Tortas a pedido
  IF NOT EXISTS (
    SELECT 1
    FROM services
    WHERE subcategory_id = v_subcategory_id
      AND LOWER(name) = 'tortas a pedido'
  ) THEN
    INSERT INTO services (
      name,
      description,
      icon,
      subcategory_id,
      created_at,
      updated_at
    )
    VALUES (
      'Tortas a pedido',
      'Preparacion de tortas personalizadas para celebraciones y eventos.',
      'cafe-outline',
      v_subcategory_id,
      NOW(),
      NOW()
    );
  END IF;

  -- Servicio: Reposteria
  IF NOT EXISTS (
    SELECT 1
    FROM services
    WHERE subcategory_id = v_subcategory_id
      AND LOWER(name) IN ('reposteria', 'repostería')
  ) THEN
    INSERT INTO services (
      name,
      description,
      icon,
      subcategory_id,
      created_at,
      updated_at
    )
    VALUES (
      'Reposteria',
      'Elaboracion de postres y productos de reposteria artesanal.',
      'cafe-outline',
      v_subcategory_id,
      NOW(),
      NOW()
    );
  END IF;
END $$;

COMMIT;
