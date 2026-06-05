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

// Repli si le GPS est indisponible/refusé ET qu'aucune position n'a jamais été choisie
const FALLBACK = { lat: 50.645, lon: 3.91, city: 'Position par défaut — activez la vôtre' };

// Dernière position connue : GPS réussi OU commune saisie à la main.
// Le GPS reste prioritaire (il remplace cette valeur dès qu'il fonctionne) ; on ne
// mémorise JAMAIS la position par défaut — sinon l'utilisateur resterait bloqué dessus.
const LOC_KEY = 'locali.loc';
function readSavedLoc() {
  try { const r = localStorage.getItem(LOC_KEY); if (!r) return null; const o = JSON.parse(r); return (typeof o.lat === 'number' && typeof o.lon === 'number') ? o : null; } catch (e) { return null; }
}
function saveLoc(lat, lon, city) {
  try { localStorage.setItem(LOC_KEY, JSON.stringify({ lat, lon, city: city || null })); } catch (e) {}
}

// Message d'erreur de géolocalisation, lisible par l'utilisateur
function geoErrMsg(err) {
  if (err && err.code === 1) return "Géolocalisation refusée. Autorisez-la dans le navigateur, ou entrez votre commune ci-dessous.";
  if (err && err.code === 3) return 'Délai GPS dépassé. Réessayez, ou entrez votre commune.';
  return 'Position GPS indisponible. Entrez votre commune ou code postal.';
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
  // geo : locating | real | saved | fallback (origine de la position)
  const [geo, setGeo] = useState('locating');
  // Message d'aide quand la géolocalisation échoue
  const [geoMsg, setGeoMsg] = useState(null);
  // Événements externes (OpenAgenda) à venir près de l'utilisateur
  const [extEvents, setExtEvents] = useState([]);
  // Marchés OSM chargés autour de la position
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

    const go = (la, lo) => { if (cancelled) return; setLat(la); setLon(lo); fetchShops(la, lo); };
    const fallback = () => { setGeo('fallback'); setCity(FALLBACK.city); go(FALLBACK.lat, FALLBACK.lon); };

    // 1) Override de test via l'URL : ?lat=..&lon=..  ou  ?place=Bassilly
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

    // 2) Dernière position connue (GPS précédent ou commune saisie) → affichage immédiat
    const saved = readSavedLoc();
    if (saved) { setGeo('saved'); setCity(saved.city || 'Position enregistrée'); go(saved.lat, saved.lon); }

    // 3) GPS réel — BASE de la recherche ; remplace la position enregistrée dès qu'il répond
    if (!navigator.geolocation) { if (!saved) fallback(); return () => { cancelled = true; }; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const la = pos.coords.latitude, lo = pos.coords.longitude;
        setGeo('real'); setGeoMsg(null);
        reverseGeocode(la, lo).then((c) => { if (!cancelled) { setCity(c); saveLoc(la, lo, c); } }).catch(() => saveLoc(la, lo, null));
        go(la, lo);
      },
      (err) => { if (cancelled) return; setGeoMsg(geoErrMsg(err)); if (!saved) fallback(); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
    );

    return () => { cancelled = true; };
  }, [fetchShops]);

  // Marchés OSM autour de la position (rayon large, filtré ensuite au rayon choisi)
  useEffect(() => {
    if (lat == null) return;
    let cancelled = false;
    loadMarkets(lat, lon, 20).then((mk) => { if (!cancelled) setOsmMarkets(mk); }).catch(() => {});
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
    if (latRef.current != null) fetchShops(latRef.current, lonRef.current);
  }, [fetchShops]);

  // Activer / réessayer la géolocalisation à la demande (bouton « Activer ma position »)
  const locate = useCallback(() => {
    if (!navigator.geolocation) { setGeoMsg('Géolocalisation non supportée. Entrez votre commune.'); return; }
    setGeo('locating'); setGeoMsg(null); setCity('Localisation…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude, lo = pos.coords.longitude;
        setGeo('real'); setLat(la); setLon(lo);
        reverseGeocode(la, lo).then((c) => { setCity(c); saveLoc(la, lo, c); }).catch(() => saveLoc(la, lo, null));
        fetchShops(la, lo);
      },
      (err) => {
        setGeoMsg(geoErrMsg(err));
        const saved = readSavedLoc();
        if (saved) { setGeo('saved'); setCity(saved.city || 'Position enregistrée'); }
        else { setGeo('fallback'); setCity(FALLBACK.city); if (latRef.current == null) { setLat(FALLBACK.lat); setLon(FALLBACK.lon); fetchShops(FALLBACK.lat, FALLBACK.lon); } }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [fetchShops]);

  // Définir la position via une commune / un code postal (repli fiable quand le GPS échoue)
  const setPlace = useCallback((query) => {
    const q = (query || '').trim();
    if (!q) return Promise.resolve();
    setGeo('locating'); setGeoMsg(null); setCity('Recherche de « ' + q + ' »…');
    return geocodePlace(q)
      .then((r) => {
        setGeo('real'); setLat(r.lat); setLon(r.lon); setCity(r.label);
        saveLoc(r.lat, r.lon, r.label); fetchShops(r.lat, r.lon);
      })
      .catch(() => {
        setGeoMsg('Commune ou code postal introuvable. Vérifiez l’orthographe.');
        const saved = readSavedLoc();
        if (saved) { setGeo('saved'); setCity(saved.city || 'Position enregistrée'); }
        else { setGeo('fallback'); setCity(FALLBACK.city); }
      });
  }, [fetchShops]);

  return (
    <Ctx.Provider value={{ lat, lon, city, shops, status, geo, geoMsg, extEvents, osmMarkets, radiusKm, setRadiusKm, retry, locate, setPlace, refreshCustom }}>{children}</Ctx.Provider>
  );
}

export const useLocali = () => useContext(Ctx);
