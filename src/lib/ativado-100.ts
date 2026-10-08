export type Ativado100Dates = {
  data_recebimento?: string | null;
  data_preenchimento?: string | null;
  data_aceite?: string | null;
  data_input?: string | null;
  data_ativacao?: string | null;
  data_portabilidade?: string | null;
  data_entrega?: string | null;
};

const REQUIRED_DATES: Array<[keyof Ativado100Dates, string]> = [
  ["data_recebimento", "Recebimento"],
  ["data_preenchimento", "Preenchimento"],
  ["data_aceite", "Aceite"],
  ["data_input", "Input"],
  ["data_ativacao", "Ativação"],
];

export function getMissingAtivado100Dates(dates: Ativado100Dates): string[] {
  return REQUIRED_DATES.filter(([key]) => !dates[key]).map(([, label]) => label);
}
