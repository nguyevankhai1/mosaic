const hasDoc = typeof document !== 'undefined';

/**
 * Get mouse position relative to different reference points
 * @param {MouseEvent} event - The mouse event
 * @return {Object} Mouse position relative to client, screen, target offset, and page
 */
export function getMousePosition(event: MouseEvent) {
  let pageX = event.pageX;
  let pageY = event.pageY;

  if (hasDoc && pageX === undefined) {
    pageX = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    pageY = event.clientY + document.body.scrollTop + document.documentElement.scrollTop;
  }

  const target = event.currentTarget as HTMLElement; // Cast to HTMLElement to get bounding rect
  const rect = target.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;

  return {
    client: { x: event.clientX, y: event.clientY }, // relative to the viewport
    screen: { x: event.screenX, y: event.screenY }, // relative to the physical screen
    offset: { x: offsetX, y: offsetY }, // relative to the event target
    page: { x: pageX, y: pageY }, // relative to the HTML document
  };
}