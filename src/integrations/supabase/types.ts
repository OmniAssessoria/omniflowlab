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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          chave: string
          updated_at: string
          updated_by: string | null
          valor: boolean
        }
        Insert: {
          chave: string
          updated_at?: string
          updated_by?: string | null
          valor?: boolean
        }
        Update: {
          chave?: string
          updated_at?: string
          updated_by?: string | null
          valor?: boolean
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip: string | null
          user_email: string | null
          user_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_email?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip?: string | null
          user_email?: string | null
          user_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cnpj_cpf: string | null
          consultor_id: string | null
          contato: string | null
          created_at: string
          created_by: string | null
          ddd: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_role: Database["public"]["Enums"]["app_role"] | null
          deletion_reason: string | null
          email: string | null
          id: string
          is_deleted: boolean | null
          observacao: string | null
          operadoras: string[]
          qtd_linhas_total: number
          razao_social: string
          receita_total: number
          telefone: string | null
          uf: string | null
          ultima_venda_em: string | null
          updated_at: string
        }
        Insert: {
          cnpj_cpf?: string | null
          consultor_id?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          ddd?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          email?: string | null
          id?: string
          is_deleted?: boolean | null
          observacao?: string | null
          operadoras?: string[]
          qtd_linhas_total?: number
          razao_social: string
          receita_total?: number
          telefone?: string | null
          uf?: string | null
          ultima_venda_em?: string | null
          updated_at?: string
        }
        Update: {
          cnpj_cpf?: string | null
          consultor_id?: string | null
          contato?: string | null
          created_at?: string
          created_by?: string | null
          ddd?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          email?: string | null
          id?: string
          is_deleted?: boolean | null
          observacao?: string | null
          operadoras?: string[]
          qtd_linhas_total?: number
          razao_social?: string
          receita_total?: number
          telefone?: string | null
          uf?: string | null
          ultima_venda_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_role: Database["public"]["Enums"]["app_role"] | null
          deletion_reason: string | null
          funcao: string | null
          id: string
          is_deleted: boolean | null
          mesa: string | null
          nome_exibicao: string
          nome_normalizado: string
          operadoras: string[]
          origem: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          funcao?: string | null
          id?: string
          is_deleted?: boolean | null
          mesa?: string | null
          nome_exibicao: string
          nome_normalizado: string
          operadoras?: string[]
          origem?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          funcao?: string | null
          id?: string
          is_deleted?: boolean | null
          mesa?: string | null
          nome_exibicao?: string
          nome_normalizado?: string
          operadoras?: string[]
          origem?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      comissao_fechamentos: {
        Row: {
          ano: number
          created_at: string
          fechado_em: string | null
          fechado_por: string | null
          id: string
          mes: number
          observacao: string | null
          pago_em: string | null
          status: string
          total_bruto: number
          total_comissao: number
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes: number
          observacao?: string | null
          pago_em?: string | null
          status?: string
          total_bruto?: number
          total_comissao?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          mes?: number
          observacao?: string | null
          pago_em?: string | null
          status?: string
          total_bruto?: number
          total_comissao?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissao_fechamentos_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao_itens: {
        Row: {
          ajuste_manual: number
          base_calculo: number
          bonus_fixo: number
          confirmada_em: string | null
          confirmada_por: string | null
          confirmada_por_nome: string | null
          consultor_id: string | null
          created_at: string
          data_ativacao_100: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          fechamento_id: string | null
          id: string
          meta_id: string | null
          observacao: string | null
          operadora: string | null
          percentual_aplicado: number
          produto: string | null
          regra_id: string | null
          sem_regra: boolean
          status: Database["public"]["Enums"]["comissao_status_enum"]
          tipo_pedido: string | null
          updated_at: string
          valor_comissao: number
          venda_id: string
        }
        Insert: {
          ajuste_manual?: number
          base_calculo?: number
          bonus_fixo?: number
          confirmada_em?: string | null
          confirmada_por?: string | null
          confirmada_por_nome?: string | null
          consultor_id?: string | null
          created_at?: string
          data_ativacao_100?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          fechamento_id?: string | null
          id?: string
          meta_id?: string | null
          observacao?: string | null
          operadora?: string | null
          percentual_aplicado?: number
          produto?: string | null
          regra_id?: string | null
          sem_regra?: boolean
          status?: Database["public"]["Enums"]["comissao_status_enum"]
          tipo_pedido?: string | null
          updated_at?: string
          valor_comissao?: number
          venda_id: string
        }
        Update: {
          ajuste_manual?: number
          base_calculo?: number
          bonus_fixo?: number
          confirmada_em?: string | null
          confirmada_por?: string | null
          confirmada_por_nome?: string | null
          consultor_id?: string | null
          created_at?: string
          data_ativacao_100?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          fechamento_id?: string | null
          id?: string
          meta_id?: string | null
          observacao?: string | null
          operadora?: string | null
          percentual_aplicado?: number
          produto?: string | null
          regra_id?: string | null
          sem_regra?: boolean
          status?: Database["public"]["Enums"]["comissao_status_enum"]
          tipo_pedido?: string | null
          updated_at?: string
          valor_comissao?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissao_itens_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_itens_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "comissao_fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_itens_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas_mensais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_itens_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "comissao_regras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: true
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissao_regras: {
        Row: {
          ativo: boolean
          bonus_fixo: number
          consultor_id: string | null
          created_at: string
          id: string
          nome: string
          operadora: string | null
          percentual: number
          produto: string | null
          tipo_pedido: string | null
          updated_at: string
          valor_max: number | null
          valor_min: number | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean
          bonus_fixo?: number
          consultor_id?: string | null
          created_at?: string
          id?: string
          nome: string
          operadora?: string | null
          percentual?: number
          produto?: string | null
          tipo_pedido?: string | null
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean
          bonus_fixo?: number
          consultor_id?: string | null
          created_at?: string
          id?: string
          nome?: string
          operadora?: string | null
          percentual?: number
          produto?: string | null
          tipo_pedido?: string | null
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissao_regras_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      erros_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_erros: {
        Row: {
          aba: string | null
          arquivo: string | null
          coluna: string | null
          corrigido_em: string | null
          corrigido_por: string | null
          created_at: string
          id: string
          linha: number | null
          motivo: string | null
          run_id: string | null
          status: string
          valor: string | null
        }
        Insert: {
          aba?: string | null
          arquivo?: string | null
          coluna?: string | null
          corrigido_em?: string | null
          corrigido_por?: string | null
          created_at?: string
          id?: string
          linha?: number | null
          motivo?: string | null
          run_id?: string | null
          status?: string
          valor?: string | null
        }
        Update: {
          aba?: string | null
          arquivo?: string | null
          coluna?: string | null
          corrigido_em?: string | null
          corrigido_por?: string | null
          created_at?: string
          id?: string
          linha?: number | null
          motivo?: string | null
          run_id?: string | null
          status?: string
          valor?: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          ano_ref: number
          arquivo: string
          created_at: string
          id: string
          importado_por: string | null
          mes_ref: number
          operadora: Database["public"]["Enums"]["operadora_enum"]
          total_duplicadas: number
          total_erros: number
          total_inseridas: number
          total_linhas: number
        }
        Insert: {
          ano_ref: number
          arquivo: string
          created_at?: string
          id?: string
          importado_por?: string | null
          mes_ref: number
          operadora: Database["public"]["Enums"]["operadora_enum"]
          total_duplicadas?: number
          total_erros?: number
          total_inseridas?: number
          total_linhas?: number
        }
        Update: {
          ano_ref?: number
          arquivo?: string
          created_at?: string
          id?: string
          importado_por?: string | null
          mes_ref?: number
          operadora?: Database["public"]["Enums"]["operadora_enum"]
          total_duplicadas?: number
          total_erros?: number
          total_inseridas?: number
          total_linhas?: number
        }
        Relationships: []
      }
      import_runs: {
        Row: {
          arquivos: Json
          created_at: string
          id: string
          observacao: string | null
          status: string
          totais: Json
          user_id: string | null
        }
        Insert: {
          arquivos?: Json
          created_at?: string
          id?: string
          observacao?: string | null
          status?: string
          totais?: Json
          user_id?: string | null
        }
        Update: {
          arquivos?: Json
          created_at?: string
          id?: string
          observacao?: string | null
          status?: string
          totais?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      metas_mensais: {
        Row: {
          ano_ref: number
          batida_em: string | null
          consultor_id: string
          created_at: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          id: string
          mes_ref: number
          nome: string
          observacao: string | null
          operadora: string | null
          produto: string | null
          status: string
          updated_at: string
          valor_meta: number
          valor_vendido: number
        }
        Insert: {
          ano_ref: number
          batida_em?: string | null
          consultor_id: string
          created_at?: string
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          mes_ref: number
          nome: string
          observacao?: string | null
          operadora?: string | null
          produto?: string | null
          status?: string
          updated_at?: string
          valor_meta?: number
          valor_vendido?: number
        }
        Update: {
          ano_ref?: number
          batida_em?: string | null
          consultor_id?: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          mes_ref?: number
          nome?: string
          observacao?: string | null
          operadora?: string | null
          produto?: string | null
          status?: string
          updated_at?: string
          valor_meta?: number
          valor_vendido?: number
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          criticidade: string
          descricao: string | null
          id: string
          lida: boolean
          link: string | null
          push_enviado_em: string | null
          ticket_id: string | null
          tipo: string
          titulo: string
          user_id: string
          venda_id: string | null
        }
        Insert: {
          created_at?: string
          criticidade?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          push_enviado_em?: string | null
          ticket_id?: string | null
          tipo: string
          titulo: string
          user_id: string
          venda_id?: string | null
        }
        Update: {
          created_at?: string
          criticidade?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          push_enviado_em?: string | null
          ticket_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
          venda_id?: string | null
        }
        Relationships: []
      }
      produtos_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          operadora: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          operadora: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          operadora?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_role: Database["public"]["Enums"]["app_role"] | null
          deletion_reason: string | null
          email: string
          id: string
          is_deleted: boolean | null
          last_login_at: string | null
          must_change_password: boolean
          nome_completo: string
          operadora_default: string | null
          permissoes: Json
          telefone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          email?: string
          id: string
          is_deleted?: boolean | null
          last_login_at?: string | null
          must_change_password?: boolean
          nome_completo?: string
          operadora_default?: string | null
          permissoes?: Json
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          email?: string
          id?: string
          is_deleted?: boolean | null
          last_login_at?: string | null
          must_change_password?: boolean
          nome_completo?: string
          operadora_default?: string | null
          permissoes?: Json
          telefone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sla_config: {
        Row: {
          alerta_horas: number
          ativo: boolean
          created_at: string
          criticidade: string
          etapa_id: string
          funil: string
          id: string
          operadora: string | null
          prazo_horas: number
          updated_at: string
        }
        Insert: {
          alerta_horas?: number
          ativo?: boolean
          created_at?: string
          criticidade?: string
          etapa_id: string
          funil: string
          id?: string
          operadora?: string | null
          prazo_horas?: number
          updated_at?: string
        }
        Update: {
          alerta_horas?: number
          ativo?: boolean
          created_at?: string
          criticidade?: string
          etapa_id?: string
          funil?: string
          id?: string
          operadora?: string | null
          prazo_horas?: number
          updated_at?: string
        }
        Relationships: []
      }
      status_catalogo: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          operadora: string
          sla_horas: number | null
          tipo: string | null
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          operadora: string
          sla_horas?: number | null
          tipo?: string | null
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          operadora?: string
          sla_horas?: number | null
          tipo?: string | null
        }
        Relationships: []
      }
      ticket_leituras: {
        Row: {
          last_read_at: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_leituras_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_mensagens: {
        Row: {
          anexos: Json
          autor_id: string
          autor_nome: string | null
          created_at: string
          id: string
          interna: boolean
          mensagem: string
          ticket_id: string
        }
        Insert: {
          anexos?: Json
          autor_id: string
          autor_nome?: string | null
          created_at?: string
          id?: string
          interna?: boolean
          mensagem: string
          ticket_id: string
        }
        Update: {
          anexos?: Json
          autor_id?: string
          autor_nome?: string | null
          created_at?: string
          id?: string
          interna?: boolean
          mensagem?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_mensagens_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sla_historico: {
        Row: {
          changed_by: string | null
          changed_by_nome: string | null
          created_at: string
          id: string
          sla_due_at_anterior: string | null
          sla_due_at_novo: string | null
          status_anterior: string | null
          status_novo: string
          ticket_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_nome?: string | null
          created_at?: string
          id?: string
          sla_due_at_anterior?: string | null
          sla_due_at_novo?: string | null
          status_anterior?: string | null
          status_novo: string
          ticket_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_nome?: string | null
          created_at?: string
          id?: string
          sla_due_at_anterior?: string | null
          sla_due_at_novo?: string | null
          status_anterior?: string | null
          status_novo?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sla_historico_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          atribuido_a: string | null
          categoria: string
          cliente_cnpj: string | null
          cliente_razao_social: string
          created_at: string
          criado_por: string
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          id: string
          numero: string
          operadora: string | null
          prioridade: string
          resolvido_em: string | null
          sla_due_at: string | null
          status: string
          titulo: string
          updated_at: string
          venda_id: string
        }
        Insert: {
          atribuido_a?: string | null
          categoria?: string
          cliente_cnpj?: string | null
          cliente_razao_social: string
          created_at?: string
          criado_por: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          numero: string
          operadora?: string | null
          prioridade?: string
          resolvido_em?: string | null
          sla_due_at?: string | null
          status?: string
          titulo: string
          updated_at?: string
          venda_id: string
        }
        Update: {
          atribuido_a?: string | null
          categoria?: string
          cliente_cnpj?: string | null
          cliente_razao_social?: string
          created_at?: string
          criado_por?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          numero?: string
          operadora?: string | null
          prioridade?: string
          resolvido_em?: string | null
          sla_due_at?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_pedido_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          operadora: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          operadora: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          operadora?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venda_erros: {
        Row: {
          created_at: string
          created_by: string | null
          data_erro: string
          erro_id: string
          id: string
          observacao: string | null
          resolvido: boolean
          resolvido_em: string | null
          resolvido_por: string | null
          updated_at: string
          venda_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_erro?: string
          erro_id: string
          id?: string
          observacao?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          updated_at?: string
          venda_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_erro?: string
          erro_id?: string
          id?: string
          observacao?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          updated_at?: string
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_erros_erro_id_fkey"
            columns: ["erro_id"]
            isOneToOne: false
            referencedRelation: "erros_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_erros_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_historico: {
        Row: {
          campo: string | null
          created_at: string
          descricao: string | null
          id: string
          tipo: Database["public"]["Enums"]["historico_tipo_enum"]
          user_id: string | null
          user_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
          venda_id: string
        }
        Insert: {
          campo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          tipo: Database["public"]["Enums"]["historico_tipo_enum"]
          user_id?: string | null
          user_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
          venda_id: string
        }
        Update: {
          campo?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["historico_tipo_enum"]
          user_id?: string | null
          user_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_historico_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_linhas: {
        Row: {
          created_at: string
          created_by: string | null
          data_ativacao: string | null
          ddd: string | null
          iccid: string | null
          id: string
          numero: string | null
          observacao: string | null
          ordem: number
          plano: string | null
          produto: string | null
          status: string
          updated_at: string
          valor_mensal: number
          venda_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_ativacao?: string | null
          ddd?: string | null
          iccid?: string | null
          id?: string
          numero?: string | null
          observacao?: string | null
          ordem?: number
          plano?: string | null
          produto?: string | null
          status?: string
          updated_at?: string
          valor_mensal?: number
          venda_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_ativacao?: string | null
          ddd?: string | null
          iccid?: string | null
          id?: string
          numero?: string | null
          observacao?: string | null
          ordem?: number
          plano?: string | null
          produto?: string | null
          status?: string
          updated_at?: string
          valor_mensal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_linhas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_nota_versoes: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          tipo: string
          user_id: string | null
          user_nome: string | null
          venda_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          tipo: string
          user_id?: string | null
          user_nome?: string | null
          venda_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          tipo?: string
          user_id?: string | null
          user_nome?: string | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_nota_versoes_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      venda_suporte_retorno: {
        Row: {
          aberto_em: string
          created_by: string | null
          id: string
          origem_etapa_id: string
          origem_funil: string
          resolved_by: string | null
          resolvido_em: string | null
          status: string
          suporte_etapa_id: string | null
          ticket_id: string | null
          venda_id: string
        }
        Insert: {
          aberto_em?: string
          created_by?: string | null
          id?: string
          origem_etapa_id: string
          origem_funil: string
          resolved_by?: string | null
          resolvido_em?: string | null
          status?: string
          suporte_etapa_id?: string | null
          ticket_id?: string | null
          venda_id: string
        }
        Update: {
          aberto_em?: string
          created_by?: string | null
          id?: string
          origem_etapa_id?: string
          origem_funil?: string
          resolved_by?: string | null
          resolvido_em?: string | null
          status?: string
          suporte_etapa_id?: string | null
          ticket_id?: string | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_suporte_retorno_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_suporte_retorno_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          aba_origem: string | null
          ano_ref: number
          arquivo_origem: string | null
          bko_colab_id: string | null
          bko_id: string | null
          bko_nome: string | null
          cliente_cnpj: string
          cliente_contato: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_razao_social: string
          cliente_telefone: string | null
          cliente_uf: string | null
          cod_rastreio: string | null
          consultor_colab_id: string | null
          consultor_id: string | null
          consultor_nome: string | null
          cotacao: string | null
          created_at: string
          created_by: string | null
          dados_originais: Json | null
          data_aceite: string | null
          data_ativacao: string | null
          data_entrega: string | null
          data_envio: string | null
          data_input: string | null
          data_portabilidade: string | null
          data_preenchimento: string | null
          data_recebimento: string | null
          ddd: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_role: Database["public"]["Enums"]["app_role"] | null
          deletion_reason: string | null
          dias_na_etapa: number
          equipamentos: string | null
          etapa_id: string
          funil: Database["public"]["Enums"]["funil_enum"]
          id: string
          is_deleted: boolean | null
          linha_origem: number | null
          mes_ref: number
          nota_atualizada_em: string | null
          nota_atualizada_por: string | null
          nota_fiscal: string | null
          nota_manual: string | null
          nota_modo: string
          numero: string
          numero_pedido: string | null
          observacao: string | null
          operadora: Database["public"]["Enums"]["operadora_enum"]
          pdf_gerado_em: string | null
          prioridade: Database["public"]["Enums"]["prioridade_enum"]
          produto: string | null
          proxima_acao: string | null
          proxima_acao_data: string | null
          quantidade_linhas: number
          serie: string | null
          sla_alerta_at: string | null
          sla_due_at: string | null
          sla_status: Database["public"]["Enums"]["sla_enum"]
          sla_status_calc: string | null
          status: string | null
          status_biometria: string | null
          status_pedido: string | null
          status_pedido_em: string | null
          status_pedido_obs: string | null
          status_pedido_user_id: string | null
          status_pedido_user_nome: string | null
          status_portabilidade: string | null
          tem_biometria: boolean | null
          tem_erro: boolean | null
          tipo_pedido: string | null
          updated_at: string
          valor: number
          viabilidade_fixa: string | null
        }
        Insert: {
          aba_origem?: string | null
          ano_ref: number
          arquivo_origem?: string | null
          bko_colab_id?: string | null
          bko_id?: string | null
          bko_nome?: string | null
          cliente_cnpj: string
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_razao_social: string
          cliente_telefone?: string | null
          cliente_uf?: string | null
          cod_rastreio?: string | null
          consultor_colab_id?: string | null
          consultor_id?: string | null
          consultor_nome?: string | null
          cotacao?: string | null
          created_at?: string
          created_by?: string | null
          dados_originais?: Json | null
          data_aceite?: string | null
          data_ativacao?: string | null
          data_entrega?: string | null
          data_envio?: string | null
          data_input?: string | null
          data_portabilidade?: string | null
          data_preenchimento?: string | null
          data_recebimento?: string | null
          ddd?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          dias_na_etapa?: number
          equipamentos?: string | null
          etapa_id: string
          funil?: Database["public"]["Enums"]["funil_enum"]
          id?: string
          is_deleted?: boolean | null
          linha_origem?: number | null
          mes_ref: number
          nota_atualizada_em?: string | null
          nota_atualizada_por?: string | null
          nota_fiscal?: string | null
          nota_manual?: string | null
          nota_modo?: string
          numero: string
          numero_pedido?: string | null
          observacao?: string | null
          operadora: Database["public"]["Enums"]["operadora_enum"]
          pdf_gerado_em?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_enum"]
          produto?: string | null
          proxima_acao?: string | null
          proxima_acao_data?: string | null
          quantidade_linhas?: number
          serie?: string | null
          sla_alerta_at?: string | null
          sla_due_at?: string | null
          sla_status?: Database["public"]["Enums"]["sla_enum"]
          sla_status_calc?: string | null
          status?: string | null
          status_biometria?: string | null
          status_pedido?: string | null
          status_pedido_em?: string | null
          status_pedido_obs?: string | null
          status_pedido_user_id?: string | null
          status_pedido_user_nome?: string | null
          status_portabilidade?: string | null
          tem_biometria?: boolean | null
          tem_erro?: boolean | null
          tipo_pedido?: string | null
          updated_at?: string
          valor?: number
          viabilidade_fixa?: string | null
        }
        Update: {
          aba_origem?: string | null
          ano_ref?: number
          arquivo_origem?: string | null
          bko_colab_id?: string | null
          bko_id?: string | null
          bko_nome?: string | null
          cliente_cnpj?: string
          cliente_contato?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_razao_social?: string
          cliente_telefone?: string | null
          cliente_uf?: string | null
          cod_rastreio?: string | null
          consultor_colab_id?: string | null
          consultor_id?: string | null
          consultor_nome?: string | null
          cotacao?: string | null
          created_at?: string
          created_by?: string | null
          dados_originais?: Json | null
          data_aceite?: string | null
          data_ativacao?: string | null
          data_entrega?: string | null
          data_envio?: string | null
          data_input?: string | null
          data_portabilidade?: string | null
          data_preenchimento?: string | null
          data_recebimento?: string | null
          ddd?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_role?: Database["public"]["Enums"]["app_role"] | null
          deletion_reason?: string | null
          dias_na_etapa?: number
          equipamentos?: string | null
          etapa_id?: string
          funil?: Database["public"]["Enums"]["funil_enum"]
          id?: string
          is_deleted?: boolean | null
          linha_origem?: number | null
          mes_ref?: number
          nota_atualizada_em?: string | null
          nota_atualizada_por?: string | null
          nota_fiscal?: string | null
          nota_manual?: string | null
          nota_modo?: string
          numero?: string
          numero_pedido?: string | null
          observacao?: string | null
          operadora?: Database["public"]["Enums"]["operadora_enum"]
          pdf_gerado_em?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_enum"]
          produto?: string | null
          proxima_acao?: string | null
          proxima_acao_data?: string | null
          quantidade_linhas?: number
          serie?: string | null
          sla_alerta_at?: string | null
          sla_due_at?: string | null
          sla_status?: Database["public"]["Enums"]["sla_enum"]
          sla_status_calc?: string | null
          status?: string | null
          status_biometria?: string | null
          status_pedido?: string | null
          status_pedido_em?: string | null
          status_pedido_obs?: string | null
          status_pedido_user_id?: string | null
          status_pedido_user_nome?: string | null
          status_portabilidade?: string | null
          tem_biometria?: boolean | null
          tem_erro?: boolean | null
          tipo_pedido?: string | null
          updated_at?: string
          valor?: number
          viabilidade_fixa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_bko_colab_id_fkey"
            columns: ["bko_colab_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_consultor_colab_id_fkey"
            columns: ["consultor_colab_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_comissao_venda: {
        Args: { _venda_id: string }
        Returns: {
          bonus: number
          percentual: number
          regra_id: string
          valor: number
        }[]
      }
      delete_cliente_transacional: {
        Args: {
          p_cliente_id: string
          p_reason: string
          p_user_id: string
          p_user_name: string
          p_user_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      delete_colaborador_transacional: {
        Args: {
          p_colaborador_id: string
          p_reason: string
          p_user_id: string
          p_user_name: string
          p_user_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      find_meta_for_venda: {
        Args: {
          _consultor: string
          _data: string
          _operadora: string
          _produto: string
        }
        Returns: {
          ano_ref: number
          batida_em: string | null
          consultor_id: string
          created_at: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          id: string
          mes_ref: number
          nome: string
          observacao: string | null
          operadora: string | null
          produto: string | null
          status: string
          updated_at: string
          valor_meta: number
          valor_vendido: number
        }
        SetofOptions: {
          from: "*"
          to: "metas_mensais"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_module_enabled: { Args: { _chave: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      omni_usuario_eh_bko: { Args: { p_user_id: string }; Returns: boolean }
      omni_usuario_nome: { Args: { p_user_id: string }; Returns: string }
      recalc_cliente_totais: {
        Args: { _cliente_id: string }
        Returns: undefined
      }
      recalc_meta: { Args: { _meta_id: string }; Returns: undefined }
      recalc_metas_da_venda: { Args: { _venda_id: string }; Returns: undefined }
      run_sla_check: {
        Args: never
        Returns: {
          alertas: number
          estourados: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "consultor" | "bko" | "suporte"
      comissao_status_enum:
        | "pendente_confirmacao"
        | "pendente_regra"
        | "confirmada"
        | "revisada"
        | "cancelada"
        | "paga"
      funil_enum:
        | "prospeccao"
        | "followup"
        | "processos_bko"
        | "assinatura"
        | "suporte"
      historico_tipo_enum:
        | "criacao"
        | "etapa"
        | "funil"
        | "valor"
        | "consultor"
        | "observacao"
        | "importacao"
        | "bko"
        | "campo"
        | "nota"
      operadora_enum: "CLARO" | "VIVO"
      prioridade_enum: "baixa" | "media" | "alta" | "urgente"
      sla_enum: "ok" | "atencao" | "alerta" | "atrasado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "gestor", "consultor", "bko", "suporte"],
      comissao_status_enum: [
        "pendente_confirmacao",
        "pendente_regra",
        "confirmada",
        "revisada",
        "cancelada",
        "paga",
      ],
      funil_enum: [
        "prospeccao",
        "followup",
        "processos_bko",
        "assinatura",
        "suporte",
      ],
      historico_tipo_enum: [
        "criacao",
        "etapa",
        "funil",
        "valor",
        "consultor",
        "observacao",
        "importacao",
        "bko",
        "campo",
        "nota",
      ],
      operadora_enum: ["CLARO", "VIVO"],
      prioridade_enum: ["baixa", "media", "alta", "urgente"],
      sla_enum: ["ok", "atencao", "alerta", "atrasado"],
    },
  },
} as const
