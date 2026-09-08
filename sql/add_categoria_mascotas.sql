BEGIN;

-- Crea la categoria principal "Mascotas" de forma idempotente.
-- Si ya existe, actualiza descripcion e icono.

DO $$
DECLARE
  v_category_id INTEGER;
BEGIN
  SELECT id
    INTO v_category_id
  FROM public.main_categories
  WHERE LOWER(name) IN ('mascotas')
  ORDER BY id
  LIMIT 1;

  IF v_category_id IS NULL THEN
    INSERT INTO public.main_categories
      (id, "name", description, icon, created_at, updated_at, is_active)
    VALUES
      (
        nextval('main_categories_id_seq'::regclass),
        'Mascotas',
        'Servicios para el cuidado integral de mascotas: baño, peluquería, paseo, entrenamiento, alimentación, alojamiento, veterinaria y transporte.',
        'paw-outline',
        NOW(),
        NOW(),
        TRUE
      );
  ELSE
    UPDATE public.main_categories
    SET description = 'Servicios para el cuidado integral de mascotas: baño, peluquería, paseo, entrenamiento, alimentación, alojamiento, veterinaria y transporte.',
        icon = 'paw-outline',
        updated_at = NOW(),
        is_active = TRUE
    WHERE id = v_category_id;
  END IF;
END $$;

COMMIT;
