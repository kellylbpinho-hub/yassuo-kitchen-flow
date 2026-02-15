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
            foreignKeyName: "audit_log_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      lotes: {
        Row: {
          codigo: string | null
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
      menus: {
        Row: {
          created_at: string
          created_by: string
          data: string
          descricao: string | null
          id: string
          nome: string
          unidade_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data: string
          descricao?: string | null
          id?: string
          nome: string
          unidade_id: string
        }
        Update: {
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
      product_fornecedores: {
        Row: {
          created_at: string
          fornecedor_id: string
          id: string
          preco_referencia: number | null
          product_id: string
        }
        Insert: {
          created_at?: string
          fornecedor_id: string
          id?: string
          preco_referencia?: number | null
          product_id: string
        }
        Update: {
          created_at?: string
          fornecedor_id?: string
          id?: string
          preco_referencia?: number | null
          product_id?: string
        }
        Relationships: [
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
          created_at: string
          fator_conversao: number
          id: string
          nome: string
          product_id: string
        }
        Insert: {
          created_at?: string
          fator_conversao?: number
          id?: string
          nome: string
          product_id: string
        }
        Update: {
          created_at?: string
          fator_conversao?: number
          id?: string
          nome?: string
          product_id?: string
        }
        Relationships: [
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
          categoria: string | null
          created_at: string
          custo_unitario: number | null
          estoque_atual: number
          estoque_minimo: number
          id: string
          nome: string
          proteina_por_100g: number | null
          unidade_id: string
          unidade_medida: string
          updated_at: string
          validade: string | null
          validade_minima_dias: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          custo_unitario?: number | null
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
          nome: string
          proteina_por_100g?: number | null
          unidade_id: string
          unidade_medida?: string
          updated_at?: string
          validade?: string | null
          validade_minima_dias?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          custo_unitario?: number | null
          estoque_atual?: number
          estoque_minimo?: number
          id?: string
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
          created_at: string
          email: string
          full_name: string
          id: string
          unidade_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          unidade_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          custo_unitario: number | null
          id: string
          product_id: string
          purchase_order_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          product_id: string
          purchase_order_id: string
          quantidade: number
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantidade?: number
        }
        Relationships: [
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
        ]
      }
      purchase_orders: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          observacao: string | null
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          observacao?: string | null
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          observacao?: string | null
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          aprovado_por: string | null
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
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_unidades: {
        Row: {
          created_at: string
          id: string
          unidade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unidade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          id: string
          menu_id: string | null
          observacao: string | null
          product_id: string
          quantidade: number
          unidade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id?: string | null
          observacao?: string | null
          product_id: string
          quantidade: number
          unidade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string | null
          observacao?: string | null
          product_id?: string
          quantidade?: number
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
