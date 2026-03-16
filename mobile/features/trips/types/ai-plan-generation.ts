export type AiPlanGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type CreateAiPlanGenerationRequest = {
  provider?: string;
  prompt_version?: string;
  run_async?: boolean;
};

export type AiPlanGenerationResponse = {
  id: number;
  trip_id: number;
  status: AiPlanGenerationStatus;
  provider?: string | null;
  prompt_version?: string | null;
  requested_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  error_message?: string | null;
  result_summary_json?: string | null;
};
