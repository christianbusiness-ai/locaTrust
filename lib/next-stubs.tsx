import React from 'react';

export function Link({ href, children, className, onClick, ...props }: any) {
  return (
    <a href={href} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  );
}
export default Link;

export function useRouter() {
  return {
    push: (url: string) => { window.location.href = url; },
    replace: (url: string) => { window.location.replace(url); },
    back: () => { window.history.back(); },
    forward: () => { window.history.forward(); },
    refresh: () => { window.location.reload(); },
  };
}

export function usePathname() {
  if (typeof window !== 'undefined') {
    return window.location.pathname;
  }
  return '/';
}

export function useSearchParams() {
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
}
