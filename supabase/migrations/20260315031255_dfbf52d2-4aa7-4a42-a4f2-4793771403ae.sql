
-- Add dish_id column to recipe_ingredients for dish-level recipe reuse
ALTER TABLE recipe_ingredients ADD COLUMN dish_id uuid REFERENCES dishes(id);

-- Migrate existing data: assign dish_id from menu_dishes relationship
UPDATE recipe_ingredients ri
SET dish_id = sub.dish_id
FROM (
  SELECT DISTINCT ON (ri2.id) ri2.id AS ri_id, md.dish_id
  FROM recipe_ingredients ri2
  JOIN menu_dishes md ON md.menu_id = ri2.menu_id AND md.company_id = ri2.company_id
) sub
WHERE ri.id = sub.ri_id AND ri.dish_id IS NULL;

-- Create index for dish_id lookups
CREATE INDEX idx_recipe_ingredients_dish_id ON recipe_ingredients(dish_id);
