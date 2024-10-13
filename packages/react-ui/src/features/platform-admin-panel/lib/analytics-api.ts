import {
  AnalyticsReportResponse,
  ListPlatformProjectsLeaderboardParams,
  PlatformProjectLeaderBoardRow,
  SeekPage,
} from '@activepieces/shared';

import { api } from '@/lib/api';

export const analyticsApi = {
  get(): Promise<AnalyticsReportResponse> {
    return api.get<AnalyticsReportResponse>('/v1/analytics');
  },

  listProjectsLeaderBoard(
    request: ListPlatformProjectsLeaderboardParams,
  ): Promise<SeekPage<PlatformProjectLeaderBoardRow>> {
    return api.get<SeekPage<PlatformProjectLeaderBoardRow>>(
      '/v1/analytics/leaderboards/platform-projects',
      request,
    );
  },
};
