
import { useEffect } from 'react';
import { getSecurityHeaders, applySecurityHeaders } from '@/utils/securityHeaders';

export const useContentSecurityPolicy = () => {
  useEffect(() => {
    // Apply client-side security measures
    applySecurityHeaders();
    
    // Set CSP meta tag if not already set
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!existingCSP) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = getSecurityHeaders()['Content-Security-Policy'];
      document.head.appendChild(meta);
    }
    
    // Add other security headers as meta tags where possible
    const securityMeta = [
      { name: 'referrer', content: 'strict-origin-when-cross-origin' },
      { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' }
    ];
    
    securityMeta.forEach(({ name, httpEquiv, content }) => {
      const selector = name ? `meta[name="${name}"]` : `meta[http-equiv="${httpEquiv}"]`;
      if (!document.querySelector(selector)) {
        const meta = document.createElement('meta');
        if (name) meta.name = name;
        if (httpEquiv) meta.httpEquiv = httpEquiv;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });
  }, []);
};
