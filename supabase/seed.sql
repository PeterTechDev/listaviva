-- ============================================================
-- Listaviva — Seed Data
-- Service categories and Linhares bairros
-- ============================================================

-- Categories (Portuguese + English names)
insert into public.categories (name_pt, name_en, slug, icon, sort_order) values
  ('Eletricista', 'Electrician', 'eletricista', '⚡', 1),
  ('Encanador', 'Plumber', 'encanador', '🔧', 2),
  ('Diarista', 'House Cleaner', 'diarista', '🧹', 3),
  ('Cabeleireiro(a)', 'Hairdresser', 'cabeleireiro', '💇', 4),
  ('Manicure', 'Nail Technician', 'manicure', '💅', 5),
  ('Cozinheira / Marmitas', 'Home Cook / Meal Prep', 'cozinheira', '🍳', 6),
  ('Pedreiro', 'Mason / Builder', 'pedreiro', '🧱', 7),
  ('Pintor', 'Painter', 'pintor', '🎨', 8),
  ('Jardineiro', 'Gardener', 'jardineiro', '🌿', 9),
  ('Costureira', 'Seamstress', 'costureira', '🧵', 10),
  ('Personal Trainer', 'Personal Trainer', 'personal-trainer', '💪', 11),
  ('Aulas Particulares', 'Private Tutoring', 'aulas-particulares', '📚', 12),
  ('Pet Care', 'Pet Care', 'pet-care', '🐾', 13),
  ('Fotógrafo(a)', 'Photographer', 'fotografo', '📷', 14),
  ('Motoboy / Entregas', 'Courier / Delivery', 'motoboy', '🏍️', 15);

-- Linhares bairros
insert into public.bairros (name, slug) values
  ('Centro', 'centro'),
  ('Movelar', 'movelar'),
  ('Aviso', 'aviso'),
  ('Colina', 'colina'),
  ('Shell', 'shell'),
  ('Interlagos', 'interlagos'),
  ('Três Barras', 'tres-barras'),
  ('Conceição', 'conceicao'),
  ('Canivete', 'canivete'),
  ('Linhares IV', 'linhares-iv'),
  ('Linhares V', 'linhares-v'),
  ('BNH', 'bnh'),
  ('Novo Horizonte', 'novo-horizonte'),
  ('Planalto', 'planalto'),
  ('Araçá', 'araca'),
  ('Rio Quartel', 'rio-quartel'),
  ('São Francisco', 'sao-francisco'),
  ('Lagoa do Meio', 'lagoa-do-meio'),
  ('Jardim Laguna', 'jardim-laguna'),
  ('Santa Cruz', 'santa-cruz');
