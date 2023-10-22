// https://stackoverflow.com/a/18295844

export type Coordinates = {
  x: number;
  y: number;
};

/**
 * tl: topLeftCoordinates
 * br: bottomRightCoordinates
 * p: point
 */
export default (
  tl: Coordinates,
  br: Coordinates,
  p: Coordinates,
  included = false
) => {
  if (!included) return p.x > tl.x && p.x < br.x && p.y > tl.y && p.y < br.y;
  return p.x >= tl.x && p.x <= br.x && p.y >= tl.y && p.y <= br.y;
};
