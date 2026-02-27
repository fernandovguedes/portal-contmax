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
      bc_contracts: {
        Row: {
          active: boolean
          bc_contract_id: number
          closed_at: string | null
          closed_competencia: string | null
          created_at: string
          id: string
          legacy: boolean
          portal_company_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          bc_contract_id: number
          closed_at?: string | null
          closed_competencia?: string | null
          created_at?: string
          id?: string
          legacy?: boolean
          portal_company_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          bc_contract_id?: number
          closed_at?: string | null
          closed_competencia?: string | null
          created_at?: string
          id?: string
          legacy?: boolean
          portal_company_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      bc_invoice_map: {
        Row: {
          bc_contract_id: number
          bc_invoice_id: number
          competencia: string
          created_at: string
          due_date: string | null
          id: string
          last_payment_sync_at: string | null
          last_synced_value: number | null
          message: string | null
          paid: boolean
          payment_date: string | null
          payment_value: number | null
          portal_company_id: string
          status: string
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          bc_contract_id: number
          bc_invoice_id: number
          competencia: string
          created_at?: string
          due_date?: string | null
          id?: string
          last_payment_sync_at?: string | null
          last_synced_value?: number | null
          message?: string | null
          paid?: boolean
          payment_date?: string | null
          payment_value?: number | null
          portal_company_id: string
          status?: string
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          bc_contract_id?: number
          bc_invoice_id?: number
          competencia?: string
          created_at?: string
          due_date?: string | null
          id?: string
          last_payment_sync_at?: string | null
          last_synced_value?: number | null
          message?: string | null
          paid?: boolean
          payment_date?: string | null
          payment_value?: number | null
          portal_company_id?: string
          status?: string
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      bc_sync_log: {
        Row: {
          action: string
          competencia: string | null
          created_at: string
          duration_ms: number | null
          id: string
          ok: boolean
          portal_company_id: string | null
          request_json: Json | null
          response_json: Json | null
          tenant_id: string
        }
        Insert: {
          action: string
          competencia?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          ok?: boolean
          portal_company_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          tenant_id: string
        }
        Update: {
          action?: string
          competencia?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          ok?: boolean
          portal_company_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          tenant_id?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string
          created_at: string
          data_abertura: string | null
          data_baixa: string | null
          data_cadastro: string
          emite_nota_fiscal: boolean
          external_key: string | null
          external_source: string | null
          hash_payload: string | null
          id: string
          meses: Json
          nome: string
          numero: number
          obrigacoes: Json
          onecode_contact_id: string | null
          organizacao_id: string
          raw_payload: Json | null
          regime_tributario: string
          socios: Json
          synced_at: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_synced_at: string | null
        }
        Insert: {
          cnpj: string
          created_at?: string
          data_abertura?: string | null
          data_baixa?: string | null
          data_cadastro?: string
          emite_nota_fiscal?: boolean
          external_key?: string | null
          external_source?: string | null
          hash_payload?: string | null
          id?: string
          meses?: Json
          nome: string
          numero?: number
          obrigacoes?: Json
          onecode_contact_id?: string | null
          organizacao_id: string
          raw_payload?: Json | null
          regime_tributario?: string
          socios?: Json
          synced_at?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_synced_at?: string | null
        }
        Update: {
          cnpj?: string
          created_at?: string
          data_abertura?: string | null
          data_baixa?: string | null
          data_cadastro?: string
          emite_nota_fiscal?: boolean
          external_key?: string | null
          external_source?: string | null
          hash_payload?: string | null
          id?: string
          meses?: Json
          nome?: string
          numero?: number
          obrigacoes?: Json
          onecode_contact_id?: string | null
          organizacao_id?: string
          raw_payload?: Json | null
          regime_tributario?: string
          socios?: Json
          synced_at?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      honorarios_config: {
        Row: {
          created_at: string
          id: string
          salario_minimo: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          salario_minimo?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          salario_minimo?: number
          updated_at?: string
        }
        Relationships: []
      }
      honorarios_empresas: {
        Row: {
          contabil_percentual: number
          created_at: string
          emitir_nf: string
          empresa_id: string
          fiscal_percentual: number
          id: string
          mes_inicial: string
          meses: Json
          nao_emitir_boleto: boolean
          pessoal_valor: number
          updated_at: string
        }
        Insert: {
          contabil_percentual?: number
          created_at?: string
          emitir_nf?: string
          empresa_id: string
          fiscal_percentual?: number
          id?: string
          mes_inicial?: string
          meses?: Json
          nao_emitir_boleto?: boolean
          pessoal_valor?: number
          updated_at?: string
        }
        Update: {
          contabil_percentual?: number
          created_at?: string
          emitir_nf?: string
          empresa_id?: string
          fiscal_percentual?: number
          id?: string
          mes_inicial?: string
          meses?: Json
          nao_emitir_boleto?: boolean
          pessoal_valor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          attempts: number
          created_at: string
          created_by: string | null
          error_message: string | null
          execution_time_ms: number | null
          finished_at: string | null
          id: string
          max_attempts: number
          payload: Json
          progress: number
          provider_slug: string
          result: Json | null
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          progress?: number
          provider_slug: string
          result?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          finished_at?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          progress?: number
          provider_slug?: string
          result?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          created_at: string
          error_message: string | null
          execution_id: string
          execution_time_ms: number | null
          id: string
          integration: string
          payload: Json | null
          provider_slug: string | null
          response: Json | null
          status: string
          tenant_id: string
          total_ignored: number
          total_matched: number
          total_processados: number
          total_review: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_id?: string
          execution_time_ms?: number | null
          id?: string
          integration: string
          payload?: Json | null
          provider_slug?: string | null
          response?: Json | null
          status: string
          tenant_id: string
          total_ignored?: number
          total_matched?: number
          total_processados?: number
          total_review?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_id?: string
          execution_time_ms?: number | null
          id?: string
          integration?: string
          payload?: Json | null
          provider_slug?: string | null
          response?: Json | null
          status?: string
          tenant_id?: string
          total_ignored?: number
          total_matched?: number
          total_processados?: number
          total_review?: number
        }
        Relationships: []
      }
      integration_providers: {
        Row: {
          category: string
          config_schema: Json
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          name: string
          slug: string
        }
        Insert: {
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
          slug: string
        }
        Update: {
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
          organizacao_id: string | null
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          organizacao_id?: string | null
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          organizacao_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      onecode_contact_match_log: {
        Row: {
          company_id: string | null
          contact_id: string
          contact_name: string
          created_at: string
          id: string
          processed_at: string | null
          similarity_score: number
          status: string
          tenant_id: string
        }
        Insert: {
          company_id?: string | null
          contact_id: string
          contact_name: string
          created_at?: string
          id?: string
          processed_at?: string | null
          similarity_score: number
          status: string
          tenant_id: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string
          contact_name?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          similarity_score?: number
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      onecode_contact_review: {
        Row: {
          contact_id: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          resolved: boolean
          resolved_action: string | null
          resolved_at: string | null
          similarity_score: number
          suggested_company_id: string
          suggested_company_name: string
          tenant_id: string
        }
        Insert: {
          contact_id: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          resolved?: boolean
          resolved_action?: string | null
          resolved_at?: string | null
          similarity_score: number
          suggested_company_id: string
          suggested_company_name: string
          tenant_id: string
        }
        Update: {
          contact_id?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          resolved?: boolean
          resolved_action?: string | null
          resolved_at?: string | null
          similarity_score?: number
          suggested_company_id?: string
          suggested_company_name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      onecode_messages_raw: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string
          created_at_onecode: string | null
          from_me: boolean
          id: string
          is_group: boolean
          onecode_message_id: string
          organizacao_id: string
          payload_json: Json | null
          ticket_id: string
          user_id: string | null
          user_name: string | null
          whatsapp_id: string | null
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_at_onecode?: string | null
          from_me: boolean
          id?: string
          is_group?: boolean
          onecode_message_id: string
          organizacao_id: string
          payload_json?: Json | null
          ticket_id: string
          user_id?: string | null
          user_name?: string | null
          whatsapp_id?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          created_at_onecode?: string | null
          from_me?: boolean
          id?: string
          is_group?: boolean
          onecode_message_id?: string
          organizacao_id?: string
          payload_json?: Json | null
          ticket_id?: string
          user_id?: string | null
          user_name?: string | null
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onecode_messages_raw_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      onecode_ticket_scores: {
        Row: {
          clareza: number | null
          conformidade: number | null
          cordialidade: number | null
          created_at: string
          feedback: string | null
          id: string
          model_used: string | null
          objetividade: number | null
          organizacao_id: string
          pontos_fortes: string[] | null
          pontos_melhoria: string[] | null
          resolucao: number | null
          score_final: number | null
          scored_at: string
          ticket_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          clareza?: number | null
          conformidade?: number | null
          cordialidade?: number | null
          created_at?: string
          feedback?: string | null
          id?: string
          model_used?: string | null
          objetividade?: number | null
          organizacao_id: string
          pontos_fortes?: string[] | null
          pontos_melhoria?: string[] | null
          resolucao?: number | null
          score_final?: number | null
          scored_at?: string
          ticket_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          clareza?: number | null
          conformidade?: number | null
          cordialidade?: number | null
          created_at?: string
          feedback?: string | null
          id?: string
          model_used?: string | null
          objetividade?: number | null
          organizacao_id?: string
          pontos_fortes?: string[] | null
          pontos_melhoria?: string[] | null
          resolucao?: number | null
          score_final?: number | null
          scored_at?: string
          ticket_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onecode_ticket_scores_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      onecode_webhook_events: {
        Row: {
          error_message: string | null
          id: string
          message_id: string | null
          onecode_action: string | null
          onecode_object: string | null
          payload_json: Json | null
          processed: boolean
          received_at: string
          source: string | null
          ticket_id: number | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          message_id?: string | null
          onecode_action?: string | null
          onecode_object?: string | null
          payload_json?: Json | null
          processed?: boolean
          received_at?: string
          source?: string | null
          ticket_id?: number | null
        }
        Update: {
          error_message?: string | null
          id?: string
          message_id?: string | null
          onecode_action?: string | null
          onecode_object?: string | null
          payload_json?: Json | null
          processed?: boolean
          received_at?: string
          source?: string | null
          ticket_id?: number | null
        }
        Relationships: []
      }
      organizacoes: {
        Row: {
          created_at: string
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string
          id: string
          nome?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          created_by_user_id: string | null
          entity: string
          error_message: string | null
          finished_at: string | null
          id: string
          provider: string
          started_at: string
          status: string
          tenant_id: string
          total_created: number
          total_errors: number
          total_read: number
          total_skipped: number
          total_updated: number
        }
        Insert: {
          created_by_user_id?: string | null
          entity?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          provider: string
          started_at?: string
          status?: string
          tenant_id: string
          total_created?: number
          total_errors?: number
          total_read?: number
          total_skipped?: number
          total_updated?: number
        }
        Update: {
          created_by_user_id?: string | null
          entity?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          provider?: string
          started_at?: string
          status?: string
          tenant_id?: string
          total_created?: number
          total_errors?: number
          total_read?: number
          total_skipped?: number
          total_updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          payload: Json | null
          sync_job_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          payload?: Json | null
          sync_job_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          payload?: Json | null
          sync_job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_sync_job_id_fkey"
            columns: ["sync_job_id"]
            isOneToOne: false
            referencedRelation: "sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          base_url: string
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          last_error: string | null
          last_run: string | null
          last_status: string | null
          plan_feature_code: string | null
          provider: string
          provider_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_url?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_run?: string | null
          last_status?: string | null
          plan_feature_code?: string | null
          provider: string
          provider_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_run?: string | null
          last_status?: string | null
          plan_feature_code?: string | null
          provider?: string
          provider_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_modules: {
        Row: {
          can_edit: boolean
          created_at: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tenants: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          batch_id: string | null
          batch_index: number | null
          batch_total: number | null
          body: string
          competencia: string | null
          created_at: string
          empresa_id: string
          id: string
          is_resend: boolean | null
          message_type: string | null
          resend_reason: string | null
          response_raw: Json | null
          status: string
          ticket_id: string | null
          to: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          batch_index?: number | null
          batch_total?: number | null
          body: string
          competencia?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          is_resend?: boolean | null
          message_type?: string | null
          resend_reason?: string | null
          response_raw?: Json | null
          status?: string
          ticket_id?: string | null
          to: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          batch_index?: number | null
          batch_total?: number | null
          body?: string
          competencia?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          is_resend?: boolean | null
          message_type?: string | null
          resend_reason?: string | null
          response_raw?: Json | null
          status?: string
          ticket_id?: string | null
          to?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_module_access: {
        Args: { _module_slug: string; _user_id: string }
        Returns: boolean
      }
      has_module_edit_access: {
        Args: { _module_slug: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_slug: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
