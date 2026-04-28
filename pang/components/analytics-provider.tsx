'use client';

import { useAnalytics } from '@/hooks/use-analytics';

export function AnalyticsProvider() {
  useAnalytics();
  return null;
}
