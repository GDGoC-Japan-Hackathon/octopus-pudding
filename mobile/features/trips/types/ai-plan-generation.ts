export type AiPlanGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type LatLngInput = {
  latitude: number;
  longitude: number;
};

export type CreateAiPlanGenerationRequest = {
  origin: LatLngInput;
  destination: LatLngInput;
  lodging?: LatLngInput | null;
  provider?: string;
  prompt_version?: string;
  run_async?: boolean;
  must_visit_places?: string[];
  lodging_notes?: string[];
  additional_request_comment?: string;
  selected_companion_names?: string[];
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
