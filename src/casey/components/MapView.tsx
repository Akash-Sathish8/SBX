
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MlMap, LngLatBoundsLike, Marker } from 'maplibre-gl';
import { sampleArc, haversineMiles, initialBearing, interpolateGreatCircle } from '@/lib/geo';
import type {
  CaseyLocation,
  ItineraryMatch,
  Stadium,
  TripStats,
} from '@/lib/types';

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Computed from the actual 13 stadiums (Mexico City southernmost, Vancouver
// northwest, Foxborough easternmost, Miami southeast) with a small margin so
// the corner pins aren't flush against the edge.
function computeBounds(stadiums: Record<string, Stadium>): LngLatBoundsLike {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (const s of Object.values(stadiums)) {
    lats.push(s.lat);
    lngs.push(s.lng);
  }
  if (lats.length === 0) {
    return [
      [-125, 18],
      [-68, 51],
    ];
  }
  const margin = 1.5;
  return [
    [Math.min(...lngs) - margin, Math.min(...lats) - margin],
    [Math.max(...lngs) + margin, Math.max(...lats) + margin],
  ];
}

function computePadding(): { top: number; bottom: number; left: number; right: number } {
  if (typeof document === 'undefined') {
    return { top: 40, bottom: 160, left: 20, right: 20 };
  }
  // Measure the actual UI overlays so the fitBounds frames stadiums into
  // the *visible* area (the part not hidden behind the hero panel or video
  // strip), not the raw viewport. Add a 16px gap so corner pins don't sit
  // flush against the overlay edge.
  const topEl = document.querySelector<HTMLElement>('[data-map-overlay="top"]');
  const bottomEl = document.querySelector<HTMLElement>('[data-map-overlay="bottom"]');
  const isMobile = window.innerWidth < 640;
  const gap = 16;
  // No top overlay in the SBX embed (branding/StatsBar removed; controls float
  // top-right only), so keep top padding small — a large top fallback used to
  // exceed the canvas height and make fitBounds refuse to frame the stadiums.
  const topFallback = isMobile ? 32 : 24;
  const bottomFallback = isMobile ? 150 : 170;
  const top = (topEl?.offsetHeight ?? topFallback) + gap;
  const bottom = (bottomEl?.offsetHeight ?? bottomFallback) + gap;
  return {
    top,
    bottom,
    left: isMobile ? 16 : 30,
    right: isMobile ? 16 : 30,
  };
}

const PLANE_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M16 2 L17.5 13.5 L30 17 L30 19.5 L17.5 18 L16.7 25 L20 28 L20 29.5 L12 29.5 L12 28 L15.3 25 L14.5 18 L2 19.5 L2 17 L14.5 13.5 Z"/></svg>`;
const DOT_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="6"/><circle cx="16" cy="16" r="11" fill="none" stroke="rgba(255,212,0,0.4)" stroke-width="1.5"/></svg>`;
const CASEY_AVATAR_SRC = '/casey-cutout.png';

const ARC_SAMPLES = 64;

interface Props {
  location: CaseyLocation;
  itinerary: ItineraryMatch[];
  stadiums: Record<string, Stadium>;
  stats: TripStats;
  following: boolean;
  onUserPan: () => void;
  onStadiumClick: (id: string) => void;
}

export default function MapView({
  location,
  itinerary,
  stadiums,
  stats,
  following,
  onUserPan,
  onStadiumClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const caseyMarkerRef = useRef<Marker | null>(null);
  const caseyIconElRef = useRef<HTMLDivElement | null>(null);
  const stadiumMarkersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);

  const displayPosRef = useRef({ lat: location.lat, lng: location.lng });
  const targetPosRef = useRef({ lat: location.lat, lng: location.lng });
  const userPanRef = useRef<(() => void) | null>(null);
  const followingRef = useRef(false);
  const activeArcRef = useRef<{
    origin: { lat: number; lng: number };
    dest: { lat: number; lng: number };
    samples: [number, number][];
    totalMiles: number;
  } | null>(null);
  const lastStateRef = useRef<string>(location.state);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const bounds = computeBounds(stadiums);
    const padding = computePadding();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      bounds,
      fitBoundsOptions: { padding },
      attributionControl: false,
      maxZoom: 8,
      minZoom: 2.5,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: '© Snapback Sports' }),
      'bottom-right',
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      mapRef.current = map;
      setReady(true);
      // Re-fit with measured overlay heights once the DOM has settled.
      // The initial constructor fit may have measured before the React
      // tree fully laid out; this second pass guarantees accuracy.
      requestAnimationFrame(() => {
        map.fitBounds(computeBounds(stadiums), {
          padding: computePadding(),
          duration: 0,
        });
      });
    });

    const handleUserPan = (e: maplibregl.MapLibreEvent & { originalEvent?: unknown }) => {
      if (e.originalEvent) {
        userPanRef.current?.();
      }
    };
    map.on('dragstart', handleUserPan);
    map.on('zoomstart', handleUserPan);

    const recenter = () => {
      map.fitBounds(computeBounds(stadiums), {
        padding: computePadding(),
        duration: 800,
      });
    };
    window.__caseyRecenter = recenter;

    // Re-fit on viewport changes (rotation, browser chrome show/hide on mobile)
    // so the map stays accurately framed.
    const handleResize = () => {
      map.resize();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      stadiumMarkersRef.current.forEach((m) => m.remove());
      stadiumMarkersRef.current = [];
      caseyMarkerRef.current?.remove();
      caseyMarkerRef.current = null;
      caseyIconElRef.current = null;
      map.remove();
      mapRef.current = null;
      if (window.__caseyRecenter === recenter) {
        delete window.__caseyRecenter;
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    stadiumMarkersRef.current.forEach((m) => m.remove());
    stadiumMarkersRef.current = [];

    const attended = itinerary.slice(0, stats.matchesAttended);
    const visitedIds = new Set(attended.map((m) => m.stadiumId));
    const currentStadiumId =
      location.state === 'at-stadium' && location.currentMatchNumber
        ? itinerary.find((m) => m.matchNumber === location.currentMatchNumber)?.stadiumId
        : null;

    Object.values(stadiums).forEach((s) => {
      let status: 'visited' | 'current' | 'upcoming' = 'upcoming';
      if (currentStadiumId === s.id) status = 'current';
      else if (visitedIds.has(s.id)) status = 'visited';

      const wrap = document.createElement('div');
      wrap.className = 'stadium-pin-wrap';
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('aria-label', `${s.name} · ${s.city}`);

      const el = document.createElement('div');
      el.className = `stadium-pin ${status} country-${s.country.toLowerCase()}`;
      const accent = document.createElement('div');
      accent.className = 'country-accent';
      el.appendChild(accent);
      const label = document.createElement('div');
      label.className = 'stadium-label';
      label.textContent = s.city.toUpperCase();
      el.appendChild(label);
      wrap.appendChild(el);
      wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        onStadiumClick(s.id);
      });

      const marker = new maplibregl.Marker({ element: wrap, anchor: 'center' })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      stadiumMarkersRef.current.push(marker);
    });
  }, [ready, itinerary, stadiums, stats.matchesAttended, location, onStadiumClick]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    const upcoming: GeoJSON.Feature[] = [];
    const flown: GeoJSON.Feature[] = [];
    const current: GeoJSON.Feature[] = [];

    // Casey lives in NYC; every trip begins with the JFK→MEX flight on
    // Jun 10. Stadium-to-stadium loop starts at i=1, so the very first
    // leg (origin → Match 1 stadium) is added here explicitly.
    const TRIP_ORIGIN = { lat: 40.7128, lng: -74.006 };

    type LegInput = {
      a: { lat: number; lng: number };
      b: { lat: number; lng: number };
      legIndex: number; // index against stats.matchesAttended for status
      mode: 'flight' | 'train' | 'home';
      props: Record<string, unknown>;
    };

    const addLeg = ({ a, b, legIndex, mode, props }: LegInput) => {
      const coords = sampleArc(a, b, 48);
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { ...props, mode },
        geometry: { type: 'LineString', coordinates: coords },
      };
      // Leg N is the journey TO match N (or to match 1 for leg 0, the
      // initial NYC departure). It's only flown once Casey has actually
      // arrived at the destination, i.e. matchesAttended exceeds N.
      // The "current" bucket fires only when Casey is mid-flight on
      // exactly this leg, to avoid the prior bug where the next-upcoming
      // arc was getting rendered as yellow-dashed pre-departure.
      if (legIndex < stats.matchesAttended) {
        flown.push(feature);
      } else if (
        legIndex === stats.matchesAttended &&
        location.state === 'in-transit'
      ) {
        current.push(feature);
      } else {
        upcoming.push(feature);
      }
    };

    // Initial leg: NYC origin → Match 1 stadium. Treated as leg index 0,
    // so it appears upcoming until Casey arrives at Mexico City (which
    // happens once Match 1 attendance flips it to flown).
    const first = itinerary[0];
    const firstStadium = first ? stadiums[first.stadiumId] : null;
    if (first && firstStadium) {
      addLeg({
        a: TRIP_ORIGIN,
        b: { lat: firstStadium.lat, lng: firstStadium.lng },
        legIndex: 0,
        mode: first.transportMode === 'train' ? 'train' : 'flight',
        props: { from: 'origin', to: first.matchNumber },
      });
    }

    // Subsequent legs: prev stadium → curr stadium, with the option to
    // bend through a routeVia waypoint when Casey actually rested in a
    // third city between matches (e.g. Match 30→31 routes through NYC
    // for the 2-day rest before flying to Dallas).
    for (let i = 1; i < itinerary.length; i++) {
      const prev = itinerary[i - 1];
      const curr = itinerary[i];
      const ps = stadiums[prev.stadiumId];
      const cs = stadiums[curr.stadiumId];
      if (!ps || !cs) continue;

      const mode = curr.transportMode === 'train' ? 'train' : 'flight';

      if (curr.routeVia) {
        // Two arcs that share the same status and mode tag, joined at
        // the via point. Properties carry a `via` half-flag so each
        // segment can be referenced individually if needed later.
        addLeg({
          a: { lat: ps.lat, lng: ps.lng },
          b: { lat: curr.routeVia.lat, lng: curr.routeVia.lng },
          legIndex: i,
          mode,
          props: { from: prev.matchNumber, to: curr.matchNumber, via: 'a' },
        });
        addLeg({
          a: { lat: curr.routeVia.lat, lng: curr.routeVia.lng },
          b: { lat: cs.lat, lng: cs.lng },
          legIndex: i,
          mode,
          props: { from: prev.matchNumber, to: curr.matchNumber, via: 'b' },
        });
      } else {
        addLeg({
          a: { lat: ps.lat, lng: ps.lng },
          b: { lat: cs.lat, lng: cs.lng },
          legIndex: i,
          mode,
          props: { from: prev.matchNumber, to: curr.matchNumber },
        });
      }
    }

    const setData = (id: string, features: GeoJSON.Feature[]) => {
      const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
      const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(fc);
      } else {
        map.addSource(id, { type: 'geojson', data: fc });
      }
    };

    setData('arcs-upcoming', upcoming);
    setData('arcs-flown', flown);
    setData('arcs-current', current);

    if (!map.getSource('casey-trail')) {
      map.addSource('casey-trail', {
        type: 'geojson',
        lineMetrics: true,
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Layer paints are data-driven on the `mode` property so train
    // segments (matches 4, 13, 25, 28 — the four Amtrak rides) render
    // thinner and in an amber tint, visually distinct from flight arcs.
    const colorByMode = (defaultColor: string, trainColor: string) => [
      'match',
      ['get', 'mode'],
      'train',
      trainColor,
      defaultColor,
    ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<string>;

    const widthByMode = (defaultWidth: number, trainWidth: number) => [
      'match',
      ['get', 'mode'],
      'train',
      trainWidth,
      defaultWidth,
    ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<number>;

    if (!map.getLayer('arcs-upcoming')) {
      map.addLayer({
        id: 'arcs-upcoming',
        type: 'line',
        source: 'arcs-upcoming',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': colorByMode('#6E6E6E', '#5E5E5E'),
          'line-width': widthByMode(1, 1.2),
          'line-opacity': 0.55,
          'line-dasharray': [2, 3],
        },
      });
    }
    if (!map.getLayer('arcs-flown')) {
      map.addLayer({
        id: 'arcs-flown',
        type: 'line',
        source: 'arcs-flown',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': colorByMode('#FFD400', '#E0B000'),
          'line-width': widthByMode(1.5, 1.2),
          'line-opacity': 0.55,
        },
      });
    }
    if (!map.getLayer('arcs-current')) {
      map.addLayer({
        id: 'arcs-current',
        type: 'line',
        source: 'arcs-current',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': colorByMode('#FFD400', '#E0B000'),
          'line-width': widthByMode(1.5, 1.2),
          'line-opacity': 0.35,
          'line-dasharray': [4, 3],
        },
      });
    }
    if (!map.getLayer('casey-trail')) {
      map.addLayer({
        id: 'casey-trail',
        type: 'line',
        source: 'casey-trail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': 2.5,
          'line-blur': 0.8,
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            'rgba(255, 212, 0, 0)',
            0.55,
            'rgba(255, 212, 0, 0.3)',
            0.9,
            'rgba(255, 212, 0, 0.95)',
            1,
            'rgba(255, 212, 0, 1)',
          ],
        },
      });
    }

    // Invisible "hit pad" layers above each visible arc. They share the
    // same GeoJSON source so feature.properties (mode, from, to, via)
    // come through unchanged on click, but at 18px width they're an
    // easy touch target instead of a 1.5px hair-line. line-opacity:0
    // still participates in MapLibre's feature query.
    const hitLayerPaint = {
      'line-width': 18,
      'line-opacity': 0,
      'line-color': '#000000',
    } as const;
    if (!map.getLayer('arcs-upcoming-hit')) {
      map.addLayer({
        id: 'arcs-upcoming-hit',
        type: 'line',
        source: 'arcs-upcoming',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: hitLayerPaint,
      });
    }
    if (!map.getLayer('arcs-flown-hit')) {
      map.addLayer({
        id: 'arcs-flown-hit',
        type: 'line',
        source: 'arcs-flown',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: hitLayerPaint,
      });
    }
    if (!map.getLayer('arcs-current-hit')) {
      map.addLayer({
        id: 'arcs-current-hit',
        type: 'line',
        source: 'arcs-current',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: hitLayerPaint,
      });
    }
  }, [ready, itinerary, stadiums, stats.matchesAttended, location.state]);

  // Click on a travel arc → popup describing the leg's transportation. Hover
  // also flips the cursor so the arcs feel interactive. Wires the same
  // handlers for all three arc layers (upcoming / flown / current).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    // Attach handlers to the wide invisible *-hit layers, not the thin
    // visible arc layers — clicking a 1.5px line is impossible on a
    // touch device. The hit pads are 18px wide and transparent.
    const layerIds = ['arcs-upcoming-hit', 'arcs-flown-hit', 'arcs-current-hit'];

    let activePopup: maplibregl.Popup | null = null;

    const matchByNumber = (n: number) => itinerary.find((m) => m.matchNumber === n) ?? null;
    const stadiumForMatch = (n: number) => {
      const m = matchByNumber(n);
      return m ? stadiums[m.stadiumId] ?? null : null;
    };

    const buildPopupHtml = (props: Record<string, unknown>): string => {
      const mode = (props.mode as string) ?? 'flight';
      const from = props.from as number | 'origin';
      const to = props.to as number;
      const via = props.via as string | undefined; // 'a' | 'b' | undefined

      const modeLabel = mode === 'train' ? '🚆 AMTRAK' : '✈ FLIGHT';
      const modeColor = mode === 'train' ? '#E0B000' : '#FFD400';

      // Origin/destination labels for this segment specifically.
      let fromLabel: string;
      let toLabel: string;
      let context = '';

      if (from === 'origin') {
        fromLabel = 'New York City';
        const m = matchByNumber(to);
        const s = stadiumForMatch(to);
        toLabel = s ? `${s.city}` : 'Match 1';
        context = `Trip begins · departing for ${m?.match ?? 'Match 1'}`;
      } else if (via === 'a') {
        // First half of a routeVia split: prev stadium → routeVia city.
        const prev = matchByNumber(from);
        const curr = matchByNumber(to);
        const ps = prev ? stadiums[prev.stadiumId] : null;
        fromLabel = ps?.city ?? `Match ${from}`;
        toLabel = curr?.routeVia?.city ?? 'Rest stopover';
        context = `Rest stopover · part 1 of 2 (en route to Match ${to})`;
      } else if (via === 'b') {
        // Second half of a routeVia split: routeVia city → curr stadium.
        const curr = matchByNumber(to);
        const cs = curr ? stadiums[curr.stadiumId] : null;
        fromLabel = curr?.routeVia?.city ?? 'Rest stopover';
        toLabel = cs?.city ?? `Match ${to}`;
        context = `Continuing to Match ${to} · part 2 of 2`;
      } else {
        // Normal stadium-to-stadium leg.
        const prev = matchByNumber(from as number);
        const curr = matchByNumber(to);
        const ps = prev ? stadiums[prev.stadiumId] : null;
        const cs = curr ? stadiums[curr.stadiumId] : null;
        fromLabel = ps?.city ?? `Match ${from}`;
        toLabel = cs?.city ?? `Match ${to}`;
        context = curr ? `${curr.date} · ${curr.match}` : '';
      }

      return `
        <div style="font-family: 'Bebas Neue', sans-serif; min-width: 200px;">
          <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.22em; color: ${modeColor}; margin-bottom: 4px;">
            ${modeLabel}
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-family: monospace; font-size: 12px; color: #E8E8E8;">
            <span>${fromLabel.toUpperCase()}</span>
            <span style="color: ${modeColor}; font-size: 14px;">→</span>
            <span>${toLabel.toUpperCase()}</span>
          </div>
          ${context ? `<div style="font-family: monospace; font-size: 10px; color: #8A8A8A; margin-top: 6px; letter-spacing: 0.05em;">${context}</div>` : ''}
        </div>
      `;
    };

    const handleClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!feature?.properties) return;
      activePopup?.remove();
      activePopup = new maplibregl.Popup({
        closeOnClick: true,
        closeButton: true,
        maxWidth: '280px',
        className: 'arc-popup',
      })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHtml(feature.properties))
        .addTo(map);
    };

    const handleEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    for (const id of layerIds) {
      map.on('click', id, handleClick);
      map.on('mouseenter', id, handleEnter);
      map.on('mouseleave', id, handleLeave);
    }

    return () => {
      for (const id of layerIds) {
        map.off('click', id, handleClick);
        map.off('mouseenter', id, handleEnter);
        map.off('mouseleave', id, handleLeave);
      }
      activePopup?.remove();
    };
  }, [ready, itinerary, stadiums]);

  useEffect(() => {
    if (!ready || !mapRef.current || caseyMarkerRef.current) return;
    const el = document.createElement('div');
    el.className = `casey-marker ${location.state}`;

    // Avatar (circular portrait, never rotates)
    const avatar = document.createElement('div');
    avatar.className = 'casey-avatar';
    const img = document.createElement('img');
    img.src = CASEY_AVATAR_SRC;
    img.alt = 'Casey';
    img.draggable = false;
    // Fallback: if the avatar image isn't deployed yet, render the dot SVG.
    img.onerror = () => {
      avatar.classList.add('casey-avatar-fallback');
      avatar.innerHTML = DOT_SVG;
    };
    avatar.appendChild(img);
    el.appendChild(avatar);

    // Direction arrow (small plane badge, rotates with flight bearing in-transit)
    const arrow = document.createElement('div');
    arrow.className = 'casey-direction-arrow';
    arrow.innerHTML = PLANE_SVG;
    el.appendChild(arrow);

    caseyMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([displayPosRef.current.lng, displayPosRef.current.lat])
      .addTo(mapRef.current);
    caseyIconElRef.current = arrow;
    lastStateRef.current = location.state;
  }, [ready, location.state]);

  useEffect(() => {
    if (!caseyMarkerRef.current || !caseyIconElRef.current) return;
    const el = caseyMarkerRef.current.getElement();
    if (lastStateRef.current !== location.state) {
      el.className = `casey-marker ${location.state}`;
      if (location.state !== 'in-transit') {
        caseyIconElRef.current.style.transform = '';
      }
      lastStateRef.current = location.state;
    }
  }, [location.state]);

  useEffect(() => {
    userPanRef.current = onUserPan;
  }, [onUserPan]);

  useEffect(() => {
    followingRef.current = following;
    if (following && mapRef.current) {
      mapRef.current.easeTo({
        center: [location.lng, location.lat],
        zoom: Math.max(mapRef.current.getZoom(), 4.5),
        duration: 900,
      });
    }
  }, [following, location.lat, location.lng]);

  useEffect(() => {
    targetPosRef.current = { lat: location.lat, lng: location.lng };

    if (
      location.state === 'in-transit' &&
      location.fromStadiumId &&
      location.toStadiumId &&
      stadiums[location.fromStadiumId] &&
      stadiums[location.toStadiumId]
    ) {
      const o = stadiums[location.fromStadiumId];
      const d = stadiums[location.toStadiumId];
      const origin = { lat: o.lat, lng: o.lng };
      const dest = { lat: d.lat, lng: d.lng };
      activeArcRef.current = {
        origin,
        dest,
        samples: sampleArc(origin, dest, ARC_SAMPLES),
        totalMiles: haversineMiles(origin, dest),
      };
    } else {
      activeArcRef.current = null;
      if (mapRef.current?.getSource('casey-trail')) {
        (mapRef.current.getSource('casey-trail') as maplibregl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }
  }, [location, stadiums]);

  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    let raf = 0;

    const tick = () => {
      if (stopped) return;

      const d = displayPosRef.current;
      const t = targetPosRef.current;
      const dLat = t.lat - d.lat;
      const dLng = t.lng - d.lng;

      const SNAP_EPS = 0.0001;
      if (Math.abs(dLat) < SNAP_EPS && Math.abs(dLng) < SNAP_EPS) {
        d.lat = t.lat;
        d.lng = t.lng;
      } else {
        d.lat += dLat * 0.08;
        d.lng += dLng * 0.08;
      }

      caseyMarkerRef.current?.setLngLat([d.lng, d.lat]);

      const arc = activeArcRef.current;
      if (arc && caseyIconElRef.current) {
        const bearing = initialBearing(d, arc.dest);
        caseyIconElRef.current.style.transform = `rotate(${bearing}deg)`;

        const traveled = haversineMiles(arc.origin, d);
        const progress = Math.max(0, Math.min(1, traveled / Math.max(arc.totalMiles, 1)));

        if (progress > 0.005) {
          const nSamples = Math.max(2, Math.ceil(progress * ARC_SAMPLES));
          const partialT = (progress * ARC_SAMPLES) / nSamples;
          const trailPoints: [number, number][] = arc.samples.slice(0, nSamples).map((p) => [p[0], p[1]]);
          const tip = interpolateGreatCircle(arc.origin, arc.dest, progress);
          trailPoints[trailPoints.length - 1] = [tip.lng, tip.lat];

          const src = mapRef.current?.getSource('casey-trail') as
            | maplibregl.GeoJSONSource
            | undefined;
          if (src) {
            src.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'LineString', coordinates: trailPoints },
                },
              ],
            });
          }
          void partialT;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [ready]);

  return <div ref={containerRef} className="absolute inset-0 bg-snap-black" />;
}
