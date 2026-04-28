'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function useAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    // Track page view
    if (typeof window !== 'undefined') {
      const pageViews = JSON.parse(
        localStorage.getItem('pang_analytics_pageviews') || '{}'
      );
      pageViews[pathname] = (pageViews[pathname] || 0) + 1;
      localStorage.setItem('pang_analytics_pageviews', JSON.stringify(pageViews));

      // Track navigation paths
      const lastPage = sessionStorage.getItem('pang_last_page');
      if (lastPage && lastPage !== pathname) {
        const paths = JSON.parse(
          localStorage.getItem('pang_analytics_paths') || '[]'
        );
        paths.push({ from: lastPage, to: pathname, timestamp: Date.now() });
        // Keep only last 100 paths
        if (paths.length > 100) paths.shift();
        localStorage.setItem('pang_analytics_paths', JSON.stringify(paths));
      }
      sessionStorage.setItem('pang_last_page', pathname);
    }
  }, [pathname]);

  const getAnalytics = () => {
    if (typeof window === 'undefined') return null;
    return {
      pageViews: JSON.parse(localStorage.getItem('pang_analytics_pageviews') || '{}'),
      navigationPaths: JSON.parse(localStorage.getItem('pang_analytics_paths') || '[]'),
    };
  };

  const clearAnalytics = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pang_analytics_pageviews');
      localStorage.removeItem('pang_analytics_paths');
      sessionStorage.removeItem('pang_last_page');
    }
  };

  return { getAnalytics, clearAnalytics };
}
