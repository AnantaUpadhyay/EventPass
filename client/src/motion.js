import { flushSync } from 'react-dom';
export function changeView(update) {
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const transition = document.startViewTransition(() => flushSync(update));
    transition.finished.catch(() => {});
    return transition;
  }
  update();
}
