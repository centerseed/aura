/**
 * User Preferences Resource (Section 3.3)
 *
 * URI Pattern: zentropy://profile/bias-vector
 * Required Scope: read:profile
 */

import type { BackendApiClient } from "../backend-client/api-client";

export interface UserPreferencesResult {
  bias_vector: Record<string, unknown>;
  negative_prompts: string[];
}

export async function readUserPreferences(
  apiClient: BackendApiClient,
  accessToken: string,
): Promise<UserPreferencesResult> {
  const response = await apiClient.getUserPreferences(accessToken);

  return {
    bias_vector: response.bias_vector,
    negative_prompts: response.negative_prompts,
  };
}
