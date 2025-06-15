
// Security headers and CSP configuration
export const getSecurityHeaders = () => {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Allow inline scripts for development
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "media-src 'self' blob:",
      "connect-src 'self' https://yvvhhtvtweqwfksrbsqr.supabase.co wss://yvvhhtvtweqwfksrbsqr.supabase.co",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=()'
  };
};

export const applySecurityHeaders = () => {
  // This would typically be applied at the server level
  // For client-side apps, we can only apply some security measures
  
  // Prevent clickjacking
  if (window.self !== window.top) {
    window.top!.location = window.self.location;
  }
  
  // Clear potentially sensitive data from memory
  window.addEventListener('beforeunload', () => {
    // Clear sensitive form data
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const inputs = form.querySelectorAll('input[type="password"], input[type="email"]');
      inputs.forEach((input: Element) => {
        (input as HTMLInputElement).value = '';
      });
    });
  });
};
