const configuredBox = import.meta.env.VITE_FIRMS_BBOX?.split(',').map(Number);
const validBox = configuredBox?.length === 4 && configuredBox.every(Number.isFinite);

// Provisional demo region because the brief did not name a state. Replace via .env or this module.
export const REGION = {
  name: import.meta.env.VITE_REGION_NAME || 'Uttarakhand, India',
  bbox: validBox ? configuredBox : [77.6, 28.7, 81.1, 31.5], // west, south, east, north
  center: [30.0668, 79.0193], // approximate state center for the overview weather/map
  zoom: 7,
  attribution: 'Region and bounding box are provisional; replace with your project study area.',
};

export const boxAsString = () => REGION.bbox.map((n) => Number(n).toFixed(4)).join(',');
