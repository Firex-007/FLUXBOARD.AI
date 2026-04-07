/**
 * Utility for browser detection and capability checking.
 */

export function isSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    
    const ua = navigator.userAgent.toLowerCase();
    const isChrome = ua.indexOf('chrome') > -1 || ua.indexOf('chromium') > -1;
    const isSafari = ua.indexOf('safari') > -1 && !isChrome;
    
    // Also check for iOS Safari
    const isIOS = /ipad|iphone|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    return isSafari || isIOS;
}

/**
 * Returns a professionally worded message for unsupported browsers (Safari/iOS).
 */
export function getCompatibilityMessage(): string {
    return "AR Integration: Mobile optimization for iOS is currently in development. Please check back for updates.";
}
