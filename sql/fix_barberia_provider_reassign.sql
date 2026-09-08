-- =====================================================================
-- Reasigna el/los proveedor(es) que aun apuntan al servicio obsoleto
-- "Barbería y arreglo de barba" (subcategoria antigua "Cabello",
-- categoria "Belleza y Cuidado Personal") hacia su equivalente en la
-- nueva clasificacion: "Barberia y arreglo de barba" (subcategoria
-- "Peluquería y estilismo", misma categoria). Luego limpia el servicio
-- y la subcategoria antigua "Cabello" si quedan sin referencias.
--
-- Seguro de re-ejecutar: si ya no queda nada que reasignar/borrar,
-- cada paso simplemente no afecta filas.
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
-- 1) Reasignar proveedor(es) del servicio obsoleto al equivalente nuevo.
--    (El CROSS JOIN LATERAL evita tocar nada si el servicio nuevo no
--    se encuentra: en ese caso simplemente no hay filas para actualizar).
-- ---------------------------------------------------------------------
UPDATE service_providers sp
SET service_id = new_s.id
FROM services old_s
JOIN subcategories old_sc ON old_sc.id = old_s.subcategory_id
JOIN main_categories old_mc ON old_mc.id = old_sc.main_category_id
CROSS JOIN LATERAL (
  SELECT s.id
  FROM services s
  JOIN subcategories sc ON sc.id = s.subcategory_id
  JOIN main_categories mc ON mc.id = sc.main_category_id
  WHERE pg_temp.norm_text(mc.name) = pg_temp.norm_text('Belleza y Cuidado Personal')
    AND pg_temp.norm_text(sc.name) = pg_temp.norm_text('Peluquería y estilismo')
    AND pg_temp.norm_text(s.name) = pg_temp.norm_text('Barberia y arreglo de barba')
  LIMIT 1
) new_s
WHERE sp.service_id = old_s.id
  AND pg_temp.norm_text(old_mc.name) = pg_temp.norm_text('Belleza y Cuidado Personal')
  AND pg_temp.norm_text(old_sc.name) = pg_temp.norm_text('Cabello')
  AND pg_temp.norm_text(old_s.name) = pg_temp.norm_text('Barbería y arreglo de barba');

-- ---------------------------------------------------------------------
-- 2) Borrar el servicio obsoleto ahora que ya no tiene proveedores.
-- ---------------------------------------------------------------------
DELETE FROM services s
USING subcategories sc, main_categories mc
WHERE s.subcategory_id = sc.id
  AND sc.main_category_id = mc.id
  AND pg_temp.norm_text(mc.name) = pg_temp.norm_text('Belleza y Cuidado Personal')
  AND pg_temp.norm_text(sc.name) = pg_temp.norm_text('Cabello')
  AND pg_temp.norm_text(s.name) = pg_temp.norm_text('Barbería y arreglo de barba')
  AND NOT EXISTS (SELECT 1 FROM service_providers sp WHERE sp.service_id = s.id);

-- ---------------------------------------------------------------------
-- 3) Borrar la subcategoria obsoleta "Cabello" si quedo sin servicios.
-- ---------------------------------------------------------------------
DELETE FROM subcategories sc
USING main_categories mc
WHERE sc.main_category_id = mc.id
  AND pg_temp.norm_text(mc.name) = pg_temp.norm_text('Belleza y Cuidado Personal')
  AND pg_temp.norm_text(sc.name) = pg_temp.norm_text('Cabello')
  AND NOT EXISTS (SELECT 1 FROM services s WHERE s.subcategory_id = sc.id);

-- ---------------------------------------------------------------------
-- 4) Verificacion final: si esta consulta no devuelve filas, ya no
--    queda nada pendiente relacionado con la subcategoria "Cabello".
-- ---------------------------------------------------------------------
SELECT
  s.id AS service_id,
  s.name AS service_name,
  sc.name AS subcategory_name,
  mc.name AS category_name,
  COUNT(sp.id) AS providers_count
FROM services s
JOIN subcategories sc ON sc.id = s.subcategory_id
JOIN main_categories mc ON mc.id = sc.main_category_id
LEFT JOIN service_providers sp ON sp.service_id = s.id
WHERE pg_temp.norm_text(mc.name) = pg_temp.norm_text('Belleza y Cuidado Personal')
  AND pg_temp.norm_text(sc.name) = pg_temp.norm_text('Cabello')
GROUP BY s.id, s.name, sc.name, mc.name;

DROP FUNCTION IF EXISTS pg_temp.norm_text(text);

COMMIT;
