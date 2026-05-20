export type MenuItem = {
  Nome: string;
  Prezzo: string | number;
  Ingredienti: string;
  Categoria: string;
  Immagine: string;
  piccantezza?: string | number | boolean;
  Piccantezza?: string | number | boolean;
  spiceLevel?: string | number | boolean;
  spicyLevel?: string | number | boolean;
};
