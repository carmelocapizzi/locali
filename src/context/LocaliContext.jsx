// ─── Position de l'utilisateur + chargement des commerces ─
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { reverseGeocode, geocodePlace, haversine, formatDist } from '../utils/geo';
import { loadShops } from '../utils/overpass';
import { loadMarkets } from '../utils/markets';
import { loadCustomShops } from '../utils/customShops';
import { fetchOpenAgenda, OPENAGENDA_ENABLED } from '../utils/openagenda';

const Ctx = createContext(null);

// Fusionne les commerces OSM avec ceux ajoutés manuellement (recalcule la distance)
function mergeCustom(osm, la, lo) {
  const custom = loadCustomShops().map((c) => {
    const dist = la != null && c.lat != null ? haversine(la, lo, c.lat, c.lon) : 0;
    return { ...c, dist, distStr: formatDist(dist) };
  });
  return [...custom, ...osm].sort((a, b) => a.dist - b.dist);
}
// Repli si le GPS est indisponible/refusé (l'utilisateur peut « Activer ma position »)
const FALLBACK = { lat: 50.645, lon: 3.91, city: 'Position par défaut — activez la vôtre' };

// Ancienne clé de position « mémorisée » — on la purge : le GPS est désormais la base.
const LOC_KEY = 'locali.loc';
function clearSavedLoc() {
  try { localStorage.removeItem(LOC_KEY); } catch (e) {}
}

// Rayon de recherche choisi par le client (5 / 10 / 20 km)
const RKEY = 'locali.radius';
function readRadius() { try { const r = +localStorage.getItem(RKEY); return [5, 10, 20].includes(r) ? r : 10; } catch (e) { return 10; } }

export function LocaliProvider({ children }) {
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [city, setCity] = useState('Détection en cours…');
  const [shops, setShops] = useState([]);
  // status : locating | loading | ready | error
  const [status, setStatus] = useState('locating');
  // geo : locating | real | fallback (origine de la position)
  const [geo, setGeo] = useState('locating');
  // Événements externes (OpenAgenda) à venir près de l'utilisateur
  const [extEvents, setExtEvents] = useState([]);
  // Marchés OSM chargés autour de la position (universel)
  const [osmMarkets, setOsmMarkets] = useState([]);
  // Rayon de recherche choisi par le client (km)
  const [radiusKm, setRadiusKmState] = useState(readRadius);

  const osmShopsRef = useRef([]);
  const latRef = useRef(null);
  const lonRef = useRef(null);
  const radiusRef = useRef(radiusKm);
  radiusRef.current = radiusKm;

  const fetchShops = useCallback((la, lo) => {
    setStatus('loading');
    latRef.current = la; lonRef.current = lo;
    return loadShops(la, lo, radiusRef.current * 1000)
      .then((s) => { osmShopsRef.current = s; setShops(mergeCustom(s, la, lo)); setStatus('ready'); })
      .catch(() => { osmShopsRef.current = []; const merged = mergeCustom([], la, lo); setShops(merged); setStatus(merged.length ? 'ready' : 'error'); });
  }, []);

  // Changer le rayon (5/10/20) → re-cherche les commerces, mémorisé
  const setRadiusKm = useCallback((km) => {
    setRadiusKmState(km);
    radiusRef.current = km;
    try { localStorage.setItem(RKEY, String(km)); } catch (e) {}
    if (latRef.current != null) fetchShops(latRef.current, lonRef.current);
  }, [fetchShops]);

  // Re-fusionne les commerces personnalisés (après ajout manuel) sans refaire la requête OSM
  const refreshCustom = useCallback(() => {
    setShops(mergeCustom(osmShopsRef.current, latRef.current, lonRef.current));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const go = (la, lo) => {
      if (cancelled) return;
      setLat(la);
      setLon(lo);
      fetchShops(la, lo);
    };

    const fallback = () => {
      setGeo('fallback');
      setCity(FALLBACK.city);
      go(FALLBACK.lat, FALLBACK.lon);
    };

    // 1) Override de test via l'URL :
    //    ?lat=50.645&lon=3.91   ou   ?place=Bassilly
    const params = new URLSearchParams(window.location.search);
    const pLat = parseFloat(params.get('lat'));
    const pLon = parseFloat(params.get('lon'));
    const place = params.get('place');

    if (!isNaN(pLat) && !isNaN(pLon)) {
      setGeo('real');
      reverseGeocode(pLat, pLon).then((c) => { if (!cancelled) setCity(c + ' (test)'); }).catch(() => setCity('Position de test'));
      go(pLat, pLon);
      return () => { cancelled = true; };
    }
    if (place) {
      setCity('Recherche de « ' + place + ' »…');
      geocodePlace(place)
        .then((r) => { if (!cancelled) { setGeo('real'); setCity(r.label + ' (test)'); go(r.lat, r.lon); } })
        .catch(() => fallback());
      return () => { cancelled = true; };
    }

    // Purge d'une éventuelle ancienne position mémorisée (le GPS est la base)
    clearSavedLoc();

    // 2) Géolocalisation réelle du navigateur — BASE de la recherche des commerces
    if (!navigator.geolocation) { fallback(); return () => { cancelled = true; }; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setGeo('real');
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        reverseGeocode(la, lo).then((c) => { if (!cancelled) setCity(c); }).catch(() => {});
        go(la, lo);
      },
      () => fallback(), // permission refusée/indisponible → repli (bouton « Activer ma position » dispo)
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 }
    );

    return () => { cancelled = true; };
  }, [fetchShops]);

  // Marchés OSM autour de la position (rayon large, indépendant des commerces)
  useEffect(() => {
    if (lat == null) return;
    let cancelled = false;
    loadMarkets(lat, lon).then((mk) => { if (!cancelled) setOsmMarkets(mk); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lon]);

  // Événements OpenAgenda (si configuré) autour de la position courante
  useEffect(() => {
    if (lat == null || !OPENAGENDA_ENABLED) return;
    let cancelled = false;
    fetchOpenAgenda(lat, lon).then((ev) => { if (!cancelled) setExtEvents(ev); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  const retry = useCallback(() => {
    if (lat != null) fetchShops(lat, lon);
  }, [lat, lon, fetchShops]);

  // Activer / réessayer la géolocalisation à la demande (bouton « Activer ma position »)
  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeo('locating');
    setCity('Localisation…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude, lo = pos.coords.longitude;
        setGeo('real'); setLat(la); setLon(lo);
        reverseGeocode(la, lo).then(setCity).catch(() => {});
        fetchShops(la, lo);
      },
      () => { setGeo('fallback'); setCity(FALLBACK.city); setLat(FALLBACK.lat); setLon(FALLBACK.lon); fetchShops(FALLBACK.lat, FALLBACK.lon); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [fetchShops]);

  return (
    <Ctx.Provider value={{ lat, lon, city, shops, status, geo, extEvents, osmMarkets, radiusKm, setRadiusKm, retry, locate, refreshCustom }}>{children}</Ctx.Provider>
  );
}

export const useLocali = () => useContext(Ctx);
