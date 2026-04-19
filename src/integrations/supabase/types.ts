export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          acao: string
          company_id: string
          created_at: string
          dados: Json | null
          id: string
          registro_id: string | null
          tabela: string
          unidade_id: string | null
          user_id: string
        }
        Insert: {
          acao: string
          company_id: string
          created_at?: string
          dados?: Json | null
          id?: string
          registro_id?: string | null
          tabela: string
          unidade_id?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          company_id?: string
          created_at?: string
          dados?: Json | null
          id?: string
          registro_id?: string | null
          tabela?: string
          unidade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      dish_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "dish_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          ativo: boolean
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string
          descricao: string | null
          equipamento: string | null
          id: string
          is_padrao: boolean
          modo_preparo: string | null
          nome: string
          peso_porcao: number | null
          tempo_preparo: string | null
        }
        Insert: {
          ativo?: boolean
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by: string
          descricao?: string | null
          equipamento?: string | null
          id?: string
          is_padrao?: boolean
          modo_preparo?: string | null
          nome: string
          peso_porcao?: number | null
          tempo_preparo?: string | null
        }
        Update: {
          ativo?: boolean
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          descricao?: string | null
          equipamento?: string | null
          id?: string
          is_padrao?: boolean
          modo_preparo?: string | null
          nome?: string
          peso_porcao?: number | null
          tempo_preparo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dish_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          categoria: string | null
          cnpj: string | null
          company_id: string
          condicao_pagamento: string | null
          contato: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacao: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          cnpj?: string | null
          company_id: string
          condicao_pagamento?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacao?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          cnpj?: string | null
          company_id?: string
          condicao_pagamento?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_order_items: {
        Row: {
          company_id: string
          created_at: string
          id: string
          observacao: string | null
          order_id: string
          product_id: string
          quantidade: number
          quantidade_aprovada: number | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          order_id: string
          product_id: string
          quantidade: number
          quantidade_aprovada?: number | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          order_id?: string
          product_id?: string
          quantidade?: number
          quantidade_aprovada?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "internal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_orders: {
        Row: {
          aprovado_por: string | null
          company_id: string
          created_at: string
          id: string
          numero: number
          observacao: string | null
          solicitado_por: string
          status: string
          unidade_destino_id: string
          unidade_origem_id: string
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          company_id: string
          created_at?: string
          id?: string
          numero?: number
          observacao?: string | null
          solicitado_por: string
          status?: string
          unidade_destino_id: string
          unidade_origem_id: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          company_id?: string
          created_at?: string
          id?: string
          numero?: number
          observacao?: string | null
          solicitado_por?: string
          status?: string
          unidade_destino_id?: string
          unidade_origem_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_orders_unidade_destino_id_fkey"
            columns: ["unidade_destino_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_orders_unidade_origem_id_fkey"
            columns: ["unidade_origem_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          cargo: Database["public"]["Enums"]["app_role"]
          company_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          status: string
          token: string
          unidade_ids: string[]
          updated_at: string
          used_by: string | null
        }
        Insert: {
          cargo: Database["public"]["Enums"]["app_role"]
          company_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          unidade_ids?: string[]
          updated_at?: string
          used_by?: string | null
        }
        Update: {
          cargo?: Database["public"]["Enums"]["app_role"]
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          unidade_ids?: string[]
          updated_at?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          codigo: string | null
          company_id: string
          created_at: string
          id: string
          product_id: string
          quantidade: number
          recebido_em: string
          status: string
          unidade_id: string
          updated_at: string
          validade: string
        }
        Insert: {
          codigo?: string | null
          company_id: string
          created_at?: string
          id?: string
          product_id: string
          quantidade?: number
          recebido_em?: string
          status?: string
          unidade_id: string
          updated_at?: string
          validade: string
        }
        Update: {
          codigo?: string | null
          company_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantidade?: number
          recebido_em?: string
          status?: string
          unidade_id?: string
          updated_at?: string
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_dishes: {
        Row: {
          company_id: string
          created_at: string
          dish_id: string
          id: string
          menu_id: string
          ordem: number
        }
        Insert: {
          company_id: string
          created_at?: string
          dish_id: string
          id?: string
          menu_id: string
          ordem?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          dish_id?: string
          id?: string
          menu_id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_dishes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_dishes_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_dishes_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          data: string
          descricao: string | null
          id: string
          nome: string
          unidade_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          data: string
          descricao?: string | null
          id?: string
          nome: string
          unidade_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          data?: string
          descricao?: string | null
          id?: string
          nome?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          motivo: string | null
          product_id: string
          quantidade: number
          tipo: string
          unidade_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          motivo?: string | null
          product_id: string
          quantidade: number
          tipo: string
          unidade_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          motivo?: string | null
          product_id?: string
          quantidade?: number
          tipo?: string
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fornecedores: {
        Row: {
          company_id: string
          created_at: string
          fornecedor_id: string
          id: string
          preco_referencia: number | null
          product_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          fornecedor_id: string
          id?: string
          preco_referencia?: number | null
          product_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          fornecedor_id?: string
          id?: string
          preco_referencia?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_fornecedores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fornecedores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fornecedores_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_purchase_units: {
        Row: {
          company_id: string
          created_at: string
          fator_conversao: number
          id: string
          nome: string
          product_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          fator_conversao?: number
          id?: string
          nome: string
          product_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          fator_conversao?: number
          id?: string
          nome?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_purchase_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_purchase_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean
          categoria: string | null
          category_id: string | null
          codigo_barras: string | null
          company_id: string
          created_at: string
          custo_unitario: number | null
          estoque_atual: number
          estoque_minimo: number
          id: string
          marca: string | null
          nome: string
          proteina_por_100g: number | null
          unidade_id: string
          unidade_medida: string
          updated_at: string
          validade: string | null
          validade_minima_dias: number | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          category_id?: string | null
          codigo_barras?: string | null
          company_id: string
          created_at?: string
          custo_unitario?: number | null
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          marca?: string | null
          nome: string
          proteina_por_100g?: number | null
          unidade_id: string
          unidade_medida?: string
          updated_at?: string
          validade?: string | null
          validade_minima_dias?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          category_id?: string | null
          codigo_barras?: string | null
          company_id?: string
          created_at?: string
          custo_unitario?: number | null
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          marca?: string | null
          nome?: string
          proteina_por_100g?: number | null
          unidade_id?: string
          unidade_medida?: string
          updated_at?: string
          validade?: string | null
          validade_minima_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cargo: string
          company_id: string
          created_at: string
          email: string
          full_name: string
          guided_mode: boolean
          guided_step: number | null
          guided_task_id: string | null
          id: string
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string
          company_id: string
          created_at?: string
          email: string
          full_name: string
          guided_mode?: boolean
          guided_step?: number | null
          guided_task_id?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string
          company_id?: string
          created_at?: string
          email?: string
          full_name?: string
          guided_mode?: boolean
          guided_step?: number | null
          guided_task_id?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          company_id: string
          created_at: string
          custo_unitario: number | null
          fator_conversao: number | null
          id: string
          product_id: string
          purchase_order_id: string
          purchase_unit_id: string | null
          purchase_unit_nome: string | null
          quantidade: number
          quantidade_estoque: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          custo_unitario?: number | null
          fator_conversao?: number | null
          id?: string
          product_id: string
          purchase_order_id: string
          purchase_unit_id?: string | null
          purchase_unit_nome?: string | null
          quantidade: number
          quantidade_estoque?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          custo_unitario?: number | null
          fator_conversao?: number | null
          id?: string
          product_id?: string
          purchase_order_id?: string
          purchase_unit_id?: string | null
          purchase_unit_nome?: string | null
          quantidade?: number
          quantidade_estoque?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_unit_id_fkey"
            columns: ["purchase_unit_id"]
            isOneToOne: false
            referencedRelation: "product_purchase_units"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string
          fornecedor_id: string | null
          id: string
          numero: number
          observacao: string | null
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          fornecedor_id?: string | null
          id?: string
          numero?: number
          observacao?: string | null
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          fornecedor_id?: string | null
          id?: string
          numero?: number
          observacao?: string | null
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          adicionado_pelo_fornecedor: boolean
          company_id: string
          created_at: string
          id: string
          nome_produto: string
          observacao_fornecedor: string | null
          preco_unitario: number | null
          product_id: string | null
          quantidade: number
          quotation_id: string
          unidade_medida: string
        }
        Insert: {
          adicionado_pelo_fornecedor?: boolean
          company_id: string
          created_at?: string
          id?: string
          nome_produto: string
          observacao_fornecedor?: string | null
          preco_unitario?: number | null
          product_id?: string | null
          quantidade?: number
          quotation_id: string
          unidade_medida?: string
        }
        Update: {
          adicionado_pelo_fornecedor?: boolean
          company_id?: string
          created_at?: string
          id?: string
          nome_produto?: string
          observacao_fornecedor?: string | null
          preco_unitario?: number | null
          product_id?: string | null
          quantidade?: number
          quotation_id?: string
          unidade_medida?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_requests: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          expires_at: string
          fornecedor_id: string
          id: string
          observacao: string | null
          respondido_em: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          fornecedor_id: string
          id?: string
          observacao?: string | null
          respondido_em?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          fornecedor_id?: string
          id?: string
          observacao?: string | null
          respondido_em?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_requests_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          company_id: string
          created_at: string
          dish_id: string | null
          fator_correcao: number
          id: string
          menu_id: string
          peso_limpo_per_capita: number
          product_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dish_id?: string | null
          fator_correcao?: number
          id?: string
          menu_id: string
          peso_limpo_per_capita?: number
          product_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dish_id?: string | null
          fator_correcao?: number
          id?: string
          menu_id?: string
          peso_limpo_per_capita?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          aprovado_por: string | null
          company_id: string
          created_at: string
          id: string
          lote_id: string | null
          motivo_rejeicao: string | null
          product_id: string
          quantidade: number
          solicitado_por: string
          status: string
          unidade_destino_id: string
          unidade_origem_id: string
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          company_id: string
          created_at?: string
          id?: string
          lote_id?: string | null
          motivo_rejeicao?: string | null
          product_id: string
          quantidade: number
          solicitado_por: string
          status?: string
          unidade_destino_id: string
          unidade_origem_id: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          company_id?: string
          created_at?: string
          id?: string
          lote_id?: string | null
          motivo_rejeicao?: string | null
          product_id?: string
          quantidade?: number
          solicitado_por?: string
          status?: string
          unidade_destino_id?: string
          unidade_origem_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_unidade_destino_id_fkey"
            columns: ["unidade_destino_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_unidade_origem_id_fkey"
            columns: ["unidade_origem_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_product_rules: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          product_id: string
          status: string
          unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          product_id: string
          status?: string
          unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          product_id?: string
          status?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_product_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_product_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_product_rules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          company_id: string
          contract_value: number | null
          created_at: string
          id: string
          name: string
          numero_colaboradores: number
          target_meal_cost: number | null
          type: string
        }
        Insert: {
          company_id: string
          contract_value?: number | null
          created_at?: string
          id?: string
          name: string
          numero_colaboradores?: number
          target_meal_cost?: number | null
          type?: string
        }
        Update: {
          company_id?: string
          contract_value?: number | null
          created_at?: string
          id?: string
          name?: string
          numero_colaboradores?: number
          target_meal_cost?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_unidades: {
        Row: {
          company_id: string
          created_at: string
          id: string
          unidade_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          unidade_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unidades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_logs: {
        Row: {
          company_id: string
          created_at: string
          desperdicio_total_organico: number
          dish_id: string | null
          id: string
          menu_id: string | null
          observacao: string | null
          product_id: string | null
          quantidade: number
          sobra_limpa_rampa: number
          sobra_prato: number
          unidade_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          desperdicio_total_organico?: number
          dish_id?: string | null
          id?: string
          menu_id?: string | null
          observacao?: string | null
          product_id?: string | null
          quantidade: number
          sobra_limpa_rampa?: number
          sobra_prato?: number
          unidade_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          desperdicio_total_organico?: number
          dish_id?: string | null
          id?: string
          menu_id?: string | null
          observacao?: string | null
          product_id?: string | null
          quantidade?: number
          sobra_limpa_rampa?: number
          sobra_prato?: number
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_logs_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_logs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_logs_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_divergence_logs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          media_historica: number
          percentual_desvio: number
          peso_informado: number
          product_id: string
          product_name: string
          unidade_id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          media_historica: number
          percentual_desvio: number
          peso_informado: number
          product_id: string
          product_name: string
          unidade_id: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          media_historica?: number
          percentual_desvio?: number
          peso_informado?: number
          product_id?: string
          product_name?: string
          unidade_id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weight_divergence_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_divergence_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_divergence_logs_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      meal_cost_daily: {
        Row: {
          company_id: string | null
          date: string | null
          meals_served: number | null
          real_meal_cost: number | null
          total_food_cost: number | null
          unit_id: string | null
          unit_name: string | null
          waste_cost: number | null
          waste_kg: number | null
        }
        Relationships: []
      }
      v_estoque_por_unidade: {
        Row: {
          company_id: string | null
          product_id: string | null
          saldo: number | null
          unidade_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_unit_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ceo: { Args: never; Returns: boolean }
      is_comprador: { Args: never; Returns: boolean }
      is_estoquista: { Args: never; Returns: boolean }
      is_financeiro: { Args: never; Returns: boolean }
      normalize_barcode: { Args: { raw: string }; Returns: string }
      rpc_approve_transfer: {
        Args: { p_decision: string; p_reason?: string; p_transfer_id: string }
        Returns: Json
      }
      rpc_consume_fefo: {
        Args: {
          p_menu_id?: string
          p_motivo?: string
          p_observacao?: string
          p_product_id: string
          p_quantidade: number
          p_tipo: string
          p_unidade_id: string
        }
        Returns: Json
      }
      rpc_create_product: {
        Args: {
          p_category_id?: string
          p_codigo_barras?: string
          p_nome: string
          p_unidade_id: string
          p_unidade_medida?: string
        }
        Returns: Json
      }
      rpc_dashboard_executive: { Args: never; Returns: Json }
      rpc_ensure_profile: { Args: never; Returns: Json }
      rpc_get_cd_balance: {
        Args: { p_cd_unit_id: string; p_product_id: string }
        Returns: number
      }
      rpc_painel_nutri: { Args: { p_unit_id: string }; Returns: Json }
      rpc_receive_digital: {
        Args: {
          p_lote_codigo: string
          p_product_id: string
          p_quantidade: number
          p_unidade_id: string
          p_validade: string
        }
        Returns: Json
      }
      rpc_request_transfer: {
        Args: {
          p_motivo?: string
          p_product_id: string
          p_quantidade: number
          p_unidade_destino_id: string
          p_unidade_origem_id: string
        }
        Returns: string
      }
      user_can_approve: { Args: never; Returns: boolean }
      user_can_manage: { Args: never; Returns: boolean }
      user_can_see_costs: { Args: never; Returns: boolean }
      user_can_see_unit: { Args: { _unit_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "ceo"
        | "gerente_financeiro"
        | "gerente_operacional"
        | "nutricionista"
        | "funcionario"
        | "estoquista"
        | "comprador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "ceo",
        "gerente_financeiro",
        "gerente_operacional",
        "nutricionista",
        "funcionario",
        "estoquista",
        "comprador",
      ],
    },
  },
} as const
