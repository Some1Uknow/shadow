import { useState, useEffect } from 'react';

/**
 * Hook to preload an image and track its loading state
 * @param src The source URL of the image to preload
 * @returns boolean indicating if the image has finished loading
 */
export function useImagePreload(src: string) {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!src) {
            setIsLoaded(true);
            return;
        }

        const img = new Image();
        img.src = src;

        if (img.complete) {
            setIsLoaded(true);
        } else {
            img.onload = () => setIsLoaded(true);
            img.onerror = () => setIsLoaded(true); // Fallback to avoid infinite loading
        }
    }, [src]);

    return isLoaded;
}
