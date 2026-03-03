export interface StructuredIngredient {
  amount?: number;
  unit?: string;
  name?: string;
  original?: string;
  percentage?: number;
  is_percentage?: boolean;
}

export interface Recipe {
  name: string;
  type: string;
  ingredients: string[] | string;
  structured_ingredients?: StructuredIngredient[];
  instructions: string;
  source_url: string;
  benefits?: string;
}
